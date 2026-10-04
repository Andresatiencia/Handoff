import { NextRequest, NextResponse } from "next/server";
import { currentUser, startSession } from "@/lib/server/auth";
import { findGoogleUser, googleIdentity, readGoogleAttempt, safeNext } from "@/lib/server/google-auth";
import { googleOrigin } from "@/lib/server/google-config";
import { HttpError } from "@/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const attempt = readGoogleAttempt(request.cookies.get("handoff_google_flow")?.value);
  let origin: string;
  try { origin = googleOrigin(); }
  catch (error) { return NextResponse.json({ error: error instanceof HttpError ? error.message : "Google Sign-In is unavailable." }, { status: 503 }); }
  const destination = new URL("/account", origin);
  const responseFor = (message: string) => {
    destination.searchParams.set("google_error", message);
    const response = NextResponse.redirect(destination);
    response.headers.set("Cache-Control", "no-store");
    response.cookies.set("handoff_google_flow", "", { path: "/api/auth/google", maxAge: 0 });
    return response;
  };
  if (request.nextUrl.origin !== origin || !attempt || attempt.state !== request.nextUrl.searchParams.get("state")) {
    return responseFor("Google sign-in expired or did not match this browser. Please try again.");
  }
  const code = request.nextUrl.searchParams.get("code");
  if (!code || code.length > 4096) return responseFor("Google sign-in was cancelled or could not be completed.");
  try {
    const profile = await googleIdentity(code, attempt);
    const current = attempt.linking ? await currentUser(request) : null;
    if (attempt.linking && !current) throw new HttpError(401, "Your Handoff session expired. Sign in with your password before connecting Google.");
    const userId = await findGoogleUser(profile, current?.id ?? null);
    const response = NextResponse.redirect(new URL(safeNext(attempt.next), origin));
    response.headers.set("Cache-Control", "no-store");
    response.cookies.set("handoff_google_flow", "", { path: "/api/auth/google", maxAge: 0 });
    await startSession(request, response, userId);
    return response;
  } catch (error) {
    if (!(error instanceof HttpError)) console.error("Google sign-in failed", error instanceof Error ? error.name : "unknown");
    return responseFor(error instanceof HttpError ? error.message : "Google sign-in could not be completed. Please try again.");
  }
}
