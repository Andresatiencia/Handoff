import { HttpError } from "./validation";

export function googleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim() && process.env.APP_ORIGIN?.trim());
}

export function googleOrigin() {
  if (!googleConfigured()) throw new HttpError(503, "Google Sign-In is not configured yet.");
  let origin: URL;
  try { origin = new URL(process.env.APP_ORIGIN!); }
  catch { throw new HttpError(503, "Google Sign-In needs a valid APP_ORIGIN."); }
  if (origin.pathname !== "/" || origin.search || origin.hash || origin.username || origin.password
    || (origin.protocol !== "https:" && !(origin.protocol === "http:" && ["localhost", "127.0.0.1"].includes(origin.hostname)))) {
    throw new HttpError(503, "Google Sign-In needs a valid APP_ORIGIN.");
  }
  return origin.origin;
}
