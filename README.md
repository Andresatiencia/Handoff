# Handoff

A working student marketplace for the University of Central Missouri, built with Next.js App Router, TypeScript, and Tailwind CSS.

## Run locally

Use **Node.js 24 or newer**. The database adapter uses libSQL locally and Turso when hosted credentials are configured.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. No cloud account, API keys, database installation, or seed credentials are required for local development. Without Turso credentials, the server creates `data/handoff.sqlite` and its schema on the first database request. Existing local SQLite data remains readable by the new adapter.

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

See `.env.example`. Local file configuration is optional:

- `HANDOFF_DB_PATH`: database file location; defaults to `data/handoff.sqlite`.
- `APP_ORIGIN`: exact public origin, such as `https://handoff.example.com` (no trailing slash). Set this when deploying behind an HTTPS reverse proxy. It controls write-origin checks and Secure session cookies.

### Vercel with Turso

The account, listing, session, and messaging APIs support a persistent Turso database shared by Vercel function instances. The existing password hashing, ownership checks, and private conversations are retained.

1. In the Handoff Vercel project, open **Storage** and connect **Turso** from the Marketplace. Select the free plan if available; no paid plan is needed for this implementation.
2. Confirm that `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` are set in the project's server environment for the deployment being used. These are server secrets: do not prefix them with `NEXT_PUBLIC_` or commit real values.
3. Set `APP_ORIGIN` to the site's exact public HTTPS origin, without a trailing slash. A preview deployment needs its own origin and a separate test database; avoid connecting preview builds to production accounts.
4. Deploy the branch containing this adapter. The first database request creates the missing tables and indexes without deleting existing rows. To initialize explicitly before deploying, put the credentials in the ignored `.env.local` file and run `npm run db:setup`.
5. Test registration in the published site, then sign in from a second browser and verify that the same accounts and listings remain accessible after a redeployment.

The Vercel filesystem is never used for account storage. On Vercel, missing credentials, file URLs, or unencrypted database URLs return a 503 configuration error instead of silently using a temporary SQLite file. The landing page remains available. If only one Turso variable is set locally, the server also rejects that incomplete configuration.

Local accounts are not automatically uploaded to Turso. If existing local data must be retained in the hosted database, arrange an explicit import before inviting users. Use Turso's backup and recovery facilities for hosted data rather than copying files from Vercel.

Production commands:

```sh
npm run build
npm run start
```

The Vercel configuration explicitly selects the Next.js framework and its `.next` build output. This overrides project settings left over from a generic `dist` deployment.

For deployments using the local file adapter, run one Node server instance with a persistent local disk and HTTPS in front of it. Multiple independent replicas and ephemeral serverless disks require the hosted Turso configuration above.

Keep the database outside publicly served folders and source control. Back up the database regularly; for a simple consistent backup, stop the server and copy the entire database directory (including any SQLite sidecar files), then restart it. Sessions and private messages are stored in that database.

## Checks

```sh
npm run lint
npm run typecheck
npm run build
npm run test:integration
```

Integration tests require an existing production build. They launch isolated servers on temporary ports with temporary databases, then test multiple users, university and input validation, date filtering, listing ownership, private messages, CSRF checks, logout, and persistence across restart. They also verify that invalid hosted configurations cannot create a local database or issue a registration session. The tests explicitly ignore inherited Turso credentials and never use a real hosted application database.

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

Write requests require JSON and an Origin header matching the app origin. Cookies identify the account. `@libsql/client` is the database SDK used for both local SQLite and hosted Turso queries.

Reference APIs: [libSQL client](https://tursodatabase.github.io/libsql-client-ts/), [Turso on Vercel](https://vercel.com/marketplace/tursocloud/database), [Next.js route handlers](https://nextjs.org/docs/app/api-reference/file-conventions/route).
