import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/server/auth";
import { newGoogleAttempt, safeNext } from "@/lib/server/google-auth";
import { googleOrigin } from "@/lib/server/google-config";
import { HttpError } from "@/lib/server/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const origin = googleOrigin();
    if (request.nextUrl.origin !== origin) throw new HttpError(400, "Open Handoff from its configured address to sign in with Google.");
    const attempt = newGoogleAttempt(safeNext(request.nextUrl.searchParams.get("next")), Boolean(await currentUser(request)));
    const response = NextResponse.redirect(attempt.url);
    response.headers.set("Cache-Control", "no-store");
    response.cookies.set("handoff_google_flow", attempt.cookie, { httpOnly: true, secure: origin.startsWith("https:"),
      sameSite: "lax", path: "/api/auth/google", maxAge: 600 });
    return response;
  } catch (error) {
    const message = error instanceof HttpError ? error.message : "Google Sign-In could not start. Please try again.";
    return NextResponse.json({ error: message }, { status: error instanceof HttpError ? error.status : 500 });
  }
}
