import { scrypt, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import type { DecodedIdToken } from "firebase-admin/auth";
import type { User } from "../contracts";
import { row, rows } from "./db";
import { adminAuth } from "./firebase-admin";
import { HttpError } from "./validation";

const tokenCache = new WeakMap<NextRequest, Promise<DecodedIdToken | null>>();

export async function verifiedToken(request: NextRequest) {
  let pending = tokenCache.get(request);
  if (!pending) {
    pending = (async () => {
      const authorization = request.headers.get("authorization");
      if (!authorization) return null;
      const match = /^Bearer ([A-Za-z0-9_.-]{20,8192})$/.exec(authorization);
      if (!match) throw new HttpError(401, "Sign in again to continue.");
      try { return await adminAuth().verifyIdToken(match[1], true); }
      catch (error) {
        if (error instanceof HttpError) throw error;
        throw new HttpError(401, "Your sign-in expired. Sign in again to continue.");
      }
    })();
    tokenCache.set(request, pending);
  }
  return pending;
}

export async function currentUser(request: NextRequest): Promise<User | null> {
  const identity = await verifiedToken(request);
  if (!identity) return null;
  const account = await row<Pick<User, "id" | "name" | "email" | "university">>(
    `SELECT id,name,email,university FROM users WHERE "firebaseUid"=$1`, identity.uid);
  if (!account) return null;
  const emailVerified = identity.email_verified === true;
  return { ...account, emailVerified, emailVerificationRequired: !emailVerified };
}

export async function requireUser(request: NextRequest) {
  if (!await verifiedToken(request)) throw new HttpError(401, "Sign in to continue.");
  const user = await currentUser(request);
  if (!user) throw new HttpError(403, "Complete your Handoff profile before continuing.");
  return user;
}

export async function requireVerifiedUser(request: NextRequest) {
  const user = await requireUser(request);
  if (!user.emailVerified) throw new HttpError(403, "Verify your Firebase email address before using this feature.");
  return user;
}

// Used only to prove ownership of an existing Handoff profile during migration.
export async function verifyLegacyPassword(password: string, hash: string) {
  const [salt, expected] = hash.split(":");
  if (!/^[a-f0-9]{32}$/.test(salt ?? "") || !/^[a-f0-9]{128}$/.test(expected ?? "")) return false;
  const actual = await new Promise<Buffer>((resolve, reject) => scrypt(password, salt, 64,
    { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, derived) => error ? reject(error) : resolve(derived)));
  return timingSafeEqual(actual, Buffer.from(expected, "hex"));
}

export async function limit(key: string, max: number, windowMs = 15 * 60 * 1000) {
  const now = Date.now();
  await rows("DELETE FROM rate_limits WHERE \"resetsAt\"<=$1", now);
  const result = await row<{ attempts: number }>(`INSERT INTO rate_limits(key,attempts,"resetsAt") VALUES($1,1,$2)
    ON CONFLICT(key) DO UPDATE SET attempts=rate_limits.attempts+1 RETURNING attempts`, key, now + windowMs);
  if (result && result.attempts > max) throw new HttpError(429, "Too many requests. Please try again in a few minutes.");
}
