import { createHash, randomBytes } from "node:crypto";
import { appendFile } from "node:fs/promises";
import { row, rows } from "./db";

const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
const lifetime = 24 * 60 * 60 * 1000;

export function verificationEnabled() {
  return Boolean((process.env.RESEND_API_KEY?.trim() && process.env.HANDOFF_EMAIL_FROM?.trim())
    || (process.env.HANDOFF_EMAIL_OUTBOX && process.env.VERCEL !== "1")
    || (process.env.NODE_ENV === "development" && process.env.VERCEL !== "1"));
}

async function sendVerificationEmail(email: string, link: string) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.HANDOFF_EMAIL_FROM?.trim();
  if (apiKey && from) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [email], subject: "Verify your Handoff email", text: `Welcome to Handoff! Open this link to verify your email address:\n\n${link}\n\nThis link expires in 24 hours. If you did not create an account, you can ignore this message.` }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`Email delivery failed (${response.status}).`);
    return;
  }
  if (process.env.HANDOFF_EMAIL_OUTBOX && process.env.VERCEL !== "1") {
    await appendFile(process.env.HANDOFF_EMAIL_OUTBOX, `${email} ${link}\n`, { encoding: "utf8" });
    return;
  }
  if (process.env.NODE_ENV === "development" && process.env.VERCEL !== "1") {
    console.info(`Handoff development verification link for ${email}: ${link}`);
    return;
  }
  throw new Error("Email delivery is not configured.");
}

export async function issueVerification(userId: number, email: string, origin: string) {
  const token = randomBytes(32).toString("hex");
  await rows(`INSERT INTO email_verifications("userId","tokenHash","expiresAt") VALUES($1,$2,$3)
    ON CONFLICT("userId") DO UPDATE SET "tokenHash"=$2,"expiresAt"=$3`, userId, tokenHash(token), Date.now() + lifetime);
  const link = `${origin}/verify-email?token=${token}`;
  await sendVerificationEmail(email, link);
}

export async function consumeVerification(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return false;
  const consumed = await row<{ userId: number }>(`DELETE FROM email_verifications WHERE "tokenHash"=$1 AND "expiresAt">$2 RETURNING "userId"`, tokenHash(token), Date.now());
  if (!consumed) return false;
  await rows(`UPDATE users SET "emailVerifiedAt"=$1 WHERE id=$2`, new Date().toISOString(), consumed.userId);
  return true;
}
