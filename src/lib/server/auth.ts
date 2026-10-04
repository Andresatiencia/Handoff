import { randomBytes, createHash, scrypt, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import type { User } from "../contracts";
import { db } from "./db";
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

export function currentUser(request: NextRequest): User | null {
  const token = request.cookies.get(COOKIE)?.value;
  if (!token) return null;
  return db().prepare(`SELECT u.id,u.name,u.email,u.university FROM sessions s JOIN users u ON u.id=s.userId
    WHERE s.tokenHash=? AND s.expiresAt>?`).get(digest(token), Date.now()) as User | undefined ?? null;
}

export function requireUser(request: NextRequest) {
  const user = currentUser(request);
  if (!user) throw new HttpError(401, "Sign in to continue.");
  return user;
}

export function endSession(request: NextRequest, response: NextResponse) {
  const old = request.cookies.get(COOKIE)?.value;
  if (old) db().prepare("DELETE FROM sessions WHERE tokenHash=?").run(digest(old));
  response.cookies.set(COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0, secure: secureCookie(request) });
}

function secureCookie(request: NextRequest) {
  return process.env.APP_ORIGIN ? new URL(process.env.APP_ORIGIN).protocol === "https:" : request.nextUrl.protocol === "https:";
}

export function startSession(request: NextRequest, response: NextResponse, userId: number) {
  endSession(request, response);
  const token = randomBytes(32).toString("hex");
  db().prepare("DELETE FROM sessions WHERE expiresAt<=?").run(Date.now());
  db().prepare("INSERT INTO sessions(tokenHash,userId,expiresAt) VALUES(?,?,?)").run(digest(token), userId, Date.now() + TTL * 1000);
  response.cookies.set(COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: TTL, secure: secureCookie(request) });
}

export function limit(key: string, max: number, windowMs = 15 * 60 * 1000) {
  const now = Date.now();
  db().prepare("DELETE FROM rate_limits WHERE resetsAt<=?").run(now);
  const row = db().prepare(`INSERT INTO rate_limits(key,attempts,resetsAt) VALUES(?,1,?)
    ON CONFLICT(key) DO UPDATE SET attempts=attempts+1 RETURNING attempts`).get(key, now + windowMs) as { attempts: number };
  if (row.attempts > max) throw new HttpError(429, "Too many requests. Please try again in a few minutes.");
}
