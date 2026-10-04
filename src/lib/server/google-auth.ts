import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { row, rows } from "./db";
import { HttpError } from "./validation";
import { googleOrigin } from "./google-config";
import { UNIVERSITY } from "../universities";

const keys = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const random = () => randomBytes(32).toString("base64url");

export function safeNext(value: string | null) {
  return value && /^\/(?!\/)/.test(value) && !value.includes("\\") ? value : "/marketplace";
}

export function newGoogleAttempt(next: string, linking: boolean) {
  const state = random();
  const nonce = random();
  const verifier = random();
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const redirectUri = `${googleOrigin()}/api/auth/google/callback`;
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, redirect_uri: redirectUri,
    response_type: "code", scope: "openid email profile", state, nonce, code_challenge: challenge,
    code_challenge_method: "S256" }).toString();
  const cookie = Buffer.from(JSON.stringify({ state, nonce, verifier, next, linking })).toString("base64url");
  return { url, cookie };
}

export function readGoogleAttempt(value: string | undefined) {
  try {
    if (!value || value.length > 2048) return null;
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (![parsed.state, parsed.nonce, parsed.verifier].every((part: unknown) => typeof part === "string" && /^[A-Za-z0-9_-]{43}$/.test(part))
      || typeof parsed.next !== "string" || parsed.next.length > 500 || typeof parsed.linking !== "boolean") return null;
    return parsed as { state: string; nonce: string; verifier: string; next: string; linking: boolean };
  } catch { return null; }
}

export async function googleIdentity(code: string, attempt: { nonce: string; verifier: string }) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${googleOrigin()}/api/auth/google/callback`, grant_type: "authorization_code", code_verifier: attempt.verifier }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new HttpError(401, "Google could not complete sign-in. Please try again.");
  const token = await response.json() as { id_token?: unknown };
  if (typeof token.id_token !== "string") throw new HttpError(401, "Google did not return an identity token.");
  const { payload } = await jwtVerify(token.id_token, keys, {
    audience: process.env.GOOGLE_CLIENT_ID!, issuer: ["https://accounts.google.com", "accounts.google.com"], algorithms: ["RS256"],
  });
  if (payload.nonce !== attempt.nonce || payload.email_verified !== true || typeof payload.sub !== "string"
    || typeof payload.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    throw new HttpError(401, "Google could not verify this email address.");
  }
  const domain = payload.email.split("@")[1].toLowerCase();
  // Google is authoritative for Gmail and hosted Workspace domains. A third-party
  // email on a Google account might have changed owners since Google first checked it.
  if (domain !== "gmail.com" && (typeof payload.hd !== "string" || payload.hd.toLowerCase() !== domain)) {
    throw new HttpError(401, "Use a Gmail or Google Workspace account to verify your email with Google.");
  }
  return { sub: payload.sub, email: payload.email.toLowerCase(), name: typeof payload.name === "string" && payload.name.trim()
    ? payload.name.trim().slice(0, 60) : payload.email.split("@")[0].slice(0, 60) };
}

type GoogleProfile = { sub: string; email: string; name: string };
type Account = { id: number; email: string; googleSub: string | null };

export async function findGoogleUser(profile: GoogleProfile, linkingUserId: number | null) {
  const linked = await row<Account>(`SELECT id,email,"googleSub" FROM users WHERE "googleSub"=$1`, profile.sub);
  const sameEmail = await row<Account>(`SELECT id,email,"googleSub" FROM users WHERE email=$1`, profile.email);
  if (linkingUserId !== null) {
    const current = await row<Account>(`SELECT id,email,"googleSub" FROM users WHERE id=$1`, linkingUserId);
    if (!current || current.email !== profile.email || (linked && linked.id !== current.id)
      || (current.googleSub && current.googleSub !== profile.sub)) {
      throw new HttpError(409, "This Google account does not match your Handoff account.");
    }
    await rows(`UPDATE users SET "googleSub"=$1,"emailVerifiedAt"=$2 WHERE id=$3`, profile.sub, new Date().toISOString(), current.id);
    return current.id;
  }
  if (linked) {
    if (sameEmail && sameEmail.id !== linked.id) throw new HttpError(409, "This email belongs to another Handoff account.");
    if (linked.email !== profile.email) await rows(`UPDATE users SET email=$1 WHERE id=$2`, profile.email, linked.id);
    return linked.id;
  }
  if (sameEmail) throw new HttpError(409, "This email already has a Handoff account. Sign in with your password, then connect Google from your account page.");
  const created = await row<{ id: number }>(`INSERT INTO users(name,email,"passwordHash",university,"emailVerifiedAt","googleSub")
    VALUES($1,$2,$3,$4,$5,$6) RETURNING id`, profile.name, profile.email, `google-only:${random()}`, UNIVERSITY,
    new Date().toISOString(), profile.sub);
  return Number(created!.id);
}
