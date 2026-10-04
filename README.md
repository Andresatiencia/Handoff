# Handoff

Student marketplace for the University of Central Missouri, built with Next.js App Router, TypeScript, Tailwind CSS, Firebase Authentication, and the existing Handoff database.

## Run locally

Use Node.js 24 or newer. Copy `.env.example` to the ignored `.env.local` and fill in the Firebase Web App and Admin values. Enable Email/Password in Firebase Authentication and add `localhost` to Authorized domains. Then:

```sh
npm ci
npm run dev
```

Open http://localhost:3000. The local database defaults to `data/handoff.sqlite`; no database installation is needed. A hosted Neon `DATABASE_URL` or Turso credentials can be supplied instead. Use the same hostname in the browser and in `APP_ORIGIN` if set, because API writes enforce the request origin.

Create a Firebase account from **Sign in → Create account**. Firebase sends the verification email. Until the link is used, the account can browse public items and bundles. On returning to Handoff, open `/verify-email` or press **I've verified my email** to refresh Firebase's state. Posting, claiming, managing listings, and messaging require a server-verified Firebase ID token with `email_verified=true`. Password reset and verification resend are handled by Firebase.

The marketplace still stores profiles, listings, photos, bundles, claims, conversations, and messages in the existing SQLite, Neon, or Turso database. Firebase Auth does not require Firestore. New profiles contain a unique `firebaseUid` while preserving the numeric Handoff user ID used by existing marketplace records. A Firebase account whose email matches an older Handoff profile must enter its old Handoff password once on the account page to link it; the old hash is then replaced with a non-login marker. An older account cannot use its former Handoff password to sign in directly anymore. Its Firebase email must be verified even if the former Handoff account was marked verified. Existing Google-only profiles without a usable Handoff password need an administrator-assisted identity-checked link; they are never linked automatically by email alone. No profile or marketplace data is deleted.

## Firebase Console setup

1. Create a project in [Firebase Console](https://console.firebase.google.com/). A custom domain is not required for Firebase's built-in verification and password-reset emails.
2. In **Project settings → General → Your apps**, add a **Web app**. Copy its `firebaseConfig` fields into the six `NEXT_PUBLIC_FIREBASE_*` variables listed in `.env.example`. These are browser configuration values, not service account secrets.
3. In **Build → Authentication → Sign-in method**, enable **Email/Password**. Google Sign-In is not used.
4. In **Authentication → Settings → Authorized domains**, add `handoff-opal.vercel.app`. Add `localhost` for local development. Add each Preview/custom hostname only if users will authenticate there. Do not include a scheme or path.
5. In **Project settings → Service accounts**, generate a new private key for the Firebase Admin SDK and download the JSON once. From that JSON, set `FIREBASE_PROJECT_ID` (`project_id`), `FIREBASE_CLIENT_EMAIL` (`client_email`), and `FIREBASE_PRIVATE_KEY` (`private_key`). Store the private key as a Vercel secret with its newlines preserved, or as literal `\n` escapes. Never put Admin values in `NEXT_PUBLIC_` variables or source control.
6. In **Vercel → Handoff → Settings → Environment Variables**, add the six public Web App variables and three Admin variables to **Production**. Use the same Firebase project for all nine values. If Preview is needed, configure its variables and authorize its hostname separately. Existing `DATABASE_URL` from Neon remains required for marketplace persistence.
7. Redeploy Handoff after saving environment variables. Firebase Web App values are embedded in the Next.js build, so changing them requires a rebuild. Test registration, the verification link, sign-in, and password reset at https://handoff-opal.vercel.app.

Do not configure `FIREBASE_AUTH_EMULATOR_HOST` on Vercel. `RESEND_API_KEY` and `HANDOFF_EMAIL_FROM` are no longer used for account verification and may remain only for a future unrelated email feature. The former Google OAuth variables and callback are no longer used. `APP_ORIGIN` is optional unless a reverse proxy requires a fixed public origin.

## Marketplace behavior

Sellers post items with availability dates, an optional photo, a price of at most two decimal places, and a university. They can change status or delete their own listings. Buyers can filter by category, date, status, university, search, and inclusive price range, and can message sellers. Sellers can create bundles of 2–12 items with an availability window and estimated retail cost; buyers can reserve a whole bundle without payment. Match, timing, and savings displays use entered items, needs, dates, and estimated values. The five labeled demo bundles have per-user demo reservations. Only University of Central Missouri is selectable; enrollment is self-reported. Individual listings are not directly claimed; pickup is arranged by message.

The connected Vercel project uses Neon through `DATABASE_URL`. Turso is supported with `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` when Neon is absent. Never expose database credentials to the browser. On Vercel, missing hosted database credentials produce a 503 rather than creating temporary SQLite data. Product photos are resized in the browser and stored with listings; the API validates the image and limits stored data to 750 KB. Existing local SQLite accounts do not automatically move to Neon.

## Checks

```sh
npm run lint
npm run typecheck
npm run build
npm run test:integration
```

The integration runner starts an isolated Firebase Auth Emulator and local Handoff server with temporary databases. It exercises registration, verification/resend, reset, verified and unverified authorization, profile linking, and invalid/expired tokens. No production Firebase or marketplace database is used.

## Structure and API

- `src/lib/firebase-client.ts` and `src/components/auth-provider.tsx`: browser Firebase initialization and auth state.
- `src/lib/server/firebase-admin.ts` and `src/lib/server/auth.ts`: ID token validation and API authorization.
- `src/lib/server/db.ts`: existing database adapters and additive `firebaseUid` migration.
- `src/app/api/[...path]/route.ts`: marketplace routes and Handoff profile link endpoints.
- `src/components/account.tsx` and `verify-email-prompt.tsx`: registration, login, reset, and verification UI.
- `tests/backend.test.mjs`: Firebase Emulator integration tests.

Account endpoints: `GET /api/auth/me`, `POST /api/auth/profile`, and `POST /api/auth/migrate`. Authenticated requests send a Firebase ID token in `Authorization: Bearer …`; protected writes require a verified email. Marketplace routes include `/api/listings`, `/api/bundles`, `/api/conversations`, and their item/detail actions. Writes also require a matching Origin header. The former Handoff session cookies, password sign-in endpoints, Google OAuth endpoints, and custom verification endpoints are no longer used. Legacy session and verification tables remain in the database to avoid deleting old data.
