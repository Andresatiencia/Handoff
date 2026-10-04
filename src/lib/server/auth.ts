import { randomBytes, createHash, scrypt, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import type { User } from "../contracts";
import { db, execute, queryOne } from "./db";
import { HttpError } from "./validation";

const COOKIE = "handoff_session";
const TTL = 60 * 60 * 24 * 7;
const digest = (value: string) => createHash("sha256").update(value).digest("hex");

export async function passwordHash(password: string, salt = randomBytes(16).toString("hex")) {
  const key = await new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, derived) => {
      if (error) reject(error); else resolve(derived);
    });
  });
  return `${salt}:${key.toString("hex")}`;
}

export async function verifyPassword(password: string, hash: string) {
  const [salt, expected] = hash.split(":");
  const actual = (await passwordHash(password, salt)).split(":")[1];
  return timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}

export async function currentUser(request: NextRequest): Promise<User | null> {
  const token = request.cookies.get(COOKIE)?.value;
  if (!token) return null;
  return await queryOne<User>(`SELECT u.id,u.name,u.email,u.university FROM sessions s JOIN users u ON u.id=s.userId
    WHERE s.tokenHash=? AND s.expiresAt>?`, [digest(token), Date.now()]) ?? null;
}

export async function requireUser(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) throw new HttpError(401, "Sign in to continue.");
  return user;
}

export async function endSession(request: NextRequest, response: NextResponse) {
  const old = request.cookies.get(COOKIE)?.value;
  if (old) await execute("DELETE FROM sessions WHERE tokenHash=?", [digest(old)]);
  response.cookies.set(COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0, secure: secureCookie(request) });
}

function secureCookie(request: NextRequest) {
  return process.env.APP_ORIGIN ? new URL(process.env.APP_ORIGIN).protocol === "https:" : request.nextUrl.protocol === "https:";
}

export async function startSession(request: NextRequest, response: NextResponse, userId: number) {
  const old = request.cookies.get(COOKIE)?.value;
  const token = randomBytes(32).toString("hex");
  const now = Date.now();
  await (await db()).batch([
    { sql: "DELETE FROM sessions WHERE expiresAt<=?", args: [now] },
    ...(old ? [{ sql: "DELETE FROM sessions WHERE tokenHash=?", args: [digest(old)] }] : []),
    { sql: "INSERT INTO sessions(tokenHash,userId,expiresAt) VALUES(?,?,?)", args: [digest(token), userId, now + TTL * 1000] },
  ], "write");
  response.cookies.set(COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: TTL, secure: secureCookie(request) });
}

export async function limit(key: string, max: number, windowMs = 15 * 60 * 1000) {
  const now = Date.now();
  const [, result] = await (await db()).batch([
    { sql: "DELETE FROM rate_limits WHERE resetsAt<=?", args: [now] },
    { sql: `INSERT INTO rate_limits(key,attempts,resetsAt) VALUES(?,1,?)
      ON CONFLICT(key) DO UPDATE SET attempts=attempts+1 RETURNING attempts`, args: [key, now + windowMs] },
  ], "write");
  if (Number(result.rows[0].attempts) > max) throw new HttpError(429, "Too many requests. Please try again in a few minutes.");
}
