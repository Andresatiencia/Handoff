# Handoff

A working student marketplace for the University of Central Missouri, built with Next.js App Router, TypeScript, and Tailwind CSS.

## Run locally

Use **Node.js 24 or newer** (the database uses Node's built-in SQLite module).

```sh
npm install
npm run dev
```

Open http://localhost:3000. No cloud account, API keys, database installation, or seed credentials are required. The server creates `data/handoff.sqlite` and its schema on the first database request. An experimental SQLite notice from Node 24 is expected.

Create an account at **Sign in → Create account**, then post your first item. The live marketplace starts empty; old mock listings and browser-only conversations are not imported because they have no verified account owner. Landing-page illustrations are decorative examples.

## Try a real handoff

1. Create a seller account in your normal browser. Post an item with its availability dates.
2. Open an incognito window or a second browser and create a buyer account.
3. Browse the marketplace and choose **Message seller**. Send a message.
4. In the seller's browser, open **Messages** and reply. Messages refresh every three seconds.
5. Each buyer has a separate private conversation with the seller.
6. Use **My account → Manage my listings** to mark an item available, reserved, or sold/handed off.

Both browsers must access the **same running Handoff server**. Different localhost ports or separate server databases are separate installations. Other devices can use a reachable server address; internet-wide access requires hosting.

## Implemented behavior

- Registration, sign-in, sign-out, seven-day server-side sessions, and account ownership.
- Salted scrypt password hashes and random session tokens stored as SHA-256 hashes; HttpOnly, SameSite cookies, with Secure cookies when the configured origin uses HTTPS.
- Persistent shared listings, seller status management, server validation, and prices stored as integer cents.
- Public browsing with category, search, status, university, and inclusive arrival-date filters.
- Only University of Central Missouri is selectable; the API enforces this restriction.
- Private per-buyer/per-listing conversations, sender identity from the session, and polling for new messages.
- Database-backed rate limits for authentication, listing creation, conversations, and messages.
- Same-origin checks on writes, request-size limits, parameterized SQL, and participant/ownership checks.
- Loading, empty, and error states. Failed writes do not display a success confirmation.

Selecting a university is self-reported affiliation; it does not verify enrollment. Payments, image uploads, email verification, password recovery, notifications, moderation, and automatic claiming are not implemented. Sellers reserve and close listings manually; pickup arrangements happen in messages. These are follow-up features, not simulated backend behavior.

## Configuration and hosting

See `.env.example`. Configuration is optional locally:

- `HANDOFF_DB_PATH`: database file location; defaults to `data/handoff.sqlite`.
- `APP_ORIGIN`: exact public origin, such as `https://handoff.example.com` (no trailing slash). Set this when deploying behind an HTTPS reverse proxy. It controls write-origin checks and Secure session cookies.

Production commands:

```sh
npm run build
npm run start
```

The Vercel configuration explicitly selects the Next.js framework and its `.next` build output. This overrides project settings left over from a generic `dist` deployment.

Run one Node server instance with a persistent local disk and HTTPS in front of it. This SQLite setup is intended for local development and a single server. It cannot store data on Vercel's serverless filesystem. Vercel deployments show a clear 503 storage-configuration error for marketplace API requests, while the landing page remains available. Hosting the functional account, listing, and messaging backend on Vercel requires migrating the SQLite adapter to a managed Postgres provider such as Neon before connecting a database resource. A Postgres adapter is not included yet.

Keep the database outside publicly served folders and source control. Back up the database regularly; for a simple consistent backup, stop the server and copy the entire database directory (including any SQLite sidecar files), then restart it. Sessions and private messages are stored in that database.

## Checks

```sh
npm run lint
npm run typecheck
npm run build
npm run test:integration
```

Integration tests require an existing production build. They launch an isolated server on a temporary port with a temporary database, then test multiple users, university and input validation, date filtering, listing ownership, private messages, CSRF checks, logout, and persistence across restart. They do not use the real application database.

## Structure

- `src/app/api/[...path]/route.ts`: HTTP API and authorization.
- `src/lib/server/`: SQLite schema, authentication, validation, listing queries.
- `src/lib/api-client.ts`: client requests and polling.
- `src/lib/contracts.ts`: shared API types.
- `src/lib/universities.ts`: supported university list.
- `src/components/auth-provider.tsx`: account state and protected screens.
- `src/components/account.tsx`, `sell-form.tsx`, `marketplace.tsx`, `messages.tsx`: live application flows.
- `tests/backend.test.mjs`: end-to-end API integration tests.

Routes: `/`, `/account`, `/leaving`, `/arriving`, `/sell`, `/marketplace`, `/messages`.

API:
- `GET /api/auth/me`; `POST /api/auth/register|login|logout`.
- `GET/POST /api/listings`; `GET/PATCH /api/listings/:id` (PATCH changes status).
- `GET/POST /api/conversations`.
- `GET/POST /api/conversations/:id/messages`.

Write requests require JSON and an Origin header matching the app origin. Cookies identify the account. No new package dependencies were needed for the backend.

Reference APIs: [Node SQLite](https://nodejs.org/api/sqlite.html), [Next.js route handlers](https://nextjs.org/docs/app/api-reference/file-conventions/route).
