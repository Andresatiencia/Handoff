import { randomBytes, createHash, scrypt, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import type { User } from "../contracts";
import { row, rows } from "./db";
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
  const account = await row<User>(`SELECT u.id,u.name,u.email,u.university FROM sessions s JOIN users u ON u.id=s."userId"
    WHERE s."tokenHash"=$1 AND s."expiresAt">$2`, digest(token), Date.now());
  return account ?? null;
}

export async function requireUser(request: NextRequest) {
  const user = await currentUser(request);
  if (!user) throw new HttpError(401, "Sign in to continue.");
  return user;
}

export async function endSession(request: NextRequest, response: NextResponse) {
  const old = request.cookies.get(COOKIE)?.value;
  if (old) await rows("DELETE FROM sessions WHERE \"tokenHash\"=$1", digest(old));
  response.cookies.set(COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0, secure: secureCookie(request) });
}

function secureCookie(request: NextRequest) {
  return process.env.APP_ORIGIN ? new URL(process.env.APP_ORIGIN).protocol === "https:" : request.nextUrl.protocol === "https:";
}

export async function startSession(request: NextRequest, response: NextResponse, userId: number) {
  await endSession(request, response);
  const token = randomBytes(32).toString("hex");
  await rows("DELETE FROM sessions WHERE \"expiresAt\"<=$1", Date.now());
  await rows("INSERT INTO sessions(\"tokenHash\",\"userId\",\"expiresAt\") VALUES($1,$2,$3)", digest(token), userId, Date.now() + TTL * 1000);
  response.cookies.set(COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: TTL, secure: secureCookie(request) });
}

export async function limit(key: string, max: number, windowMs = 15 * 60 * 1000) {
  const now = Date.now();
  await rows("DELETE FROM rate_limits WHERE \"resetsAt\"<=$1", now);
  const result = await row<{ attempts: number }>(`INSERT INTO rate_limits(key,attempts,"resetsAt") VALUES($1,1,$2)
    ON CONFLICT(key) DO UPDATE SET attempts=rate_limits.attempts+1 RETURNING attempts`, key, now + windowMs);
  if (result && result.attempts > max) throw new HttpError(429, "Too many requests. Please try again in a few minutes.");
}
