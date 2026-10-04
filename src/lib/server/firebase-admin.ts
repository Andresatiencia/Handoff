import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { HttpError } from "./validation";

export function adminAuth() {
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const emulator = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  if (process.env.VERCEL === "1" && emulator) {
    throw new HttpError(503, "Firebase Auth Emulator cannot be used on Vercel.");
  }
  if (!projectId || (!emulator && (!clientEmail || !privateKey))) {
    throw new HttpError(503, "Firebase Admin is not configured for this project.");
  }
  const app = getApps().find(existing => existing.name === "handoff-auth") ?? initializeApp(emulator
    ? { projectId }
    : { credential: cert({ projectId, clientEmail: clientEmail!, privateKey: privateKey! }), projectId }, "handoff-auth");
  return getAuth(app);
}
