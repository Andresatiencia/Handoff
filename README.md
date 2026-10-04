# Handoff

A working student marketplace for the University of Central Missouri, built with Next.js App Router, TypeScript, and Tailwind CSS.

## Run locally

Use **Node.js 24 or newer**. The database adapter uses SQLite locally, Neon Postgres on the connected Vercel project, and also supports Turso when its credentials are configured.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. No cloud account, API keys, database installation, or seed credentials are required for local development. Without hosted credentials, the server creates `data/handoff.sqlite` and its schema on the first database request. Existing local SQLite data remains readable by the adapter.

Use the same host and port in the browser and in `APP_ORIGIN` when that variable is set. The API compares write requests with this exact origin; mixing `localhost` and `127.0.0.1` can return “Request origin is not allowed.” For a review with a separate local database, start the server with `APP_ORIGIN=http://127.0.0.1:3000`, `HANDOFF_DB_PATH=data/handoff-review.sqlite`, and empty `DATABASE_URL`, `TURSO_DATABASE_URL`, and `TURSO_AUTH_TOKEN`, then use only `http://127.0.0.1:3000` in the browser. Keep the origin check enabled.

Create an account at **Sign in → Create account**, then post your first item. The live marketplace starts empty; old mock listings and browser-only conversations are not imported because they have no verified account owner. Landing-page illustrations are decorative examples.

The Hands design uses illustrative cutout objects on the home page; marketplace cards serve each listing's actual uploaded photo when one exists. The `public/brand` fonts carry their OFL licenses, and the illustrative WebP files carry source notes. There are no new runtime dependencies.

## Try a real handoff

1. Create a seller account in your normal browser. Post an item with its availability dates and an optional product photo.
2. Open an incognito window or a second browser and create a buyer account.
3. Browse the marketplace and choose **Message seller**. Send a message.
4. In the seller's browser, open **Messages** and reply. Messages refresh every three seconds.
5. Each buyer has a separate private conversation with the seller.
6. Use **My account → Manage my listings** to mark an item available, reserved, or sold/handed off, or to delete it.

Both browsers must access the **same running Handoff server**. Different localhost ports or separate server databases are separate installations. Other devices can use a reachable server address; internet-wide access requires hosting.

## Implemented behavior

Bundles: Sellers can open **Create a bundle** from the marketplace, group 2–12 named items with conditions and an availability window, and enter a bundle price and estimated new cost. Arriving students can add specific needs on the arrival form; cards calculate coverage, timing, and estimated savings. A signed-in buyer can reserve a whole bundle in one action. The five labeled demo bundles have personal demo reservations and do not arrange pickup; a bundle posted by a real account can be reserved by only one buyer.

- Registration, sign-in, sign-out, seven-day server-side sessions, and account ownership.
- Salted scrypt password hashes and random session tokens stored as SHA-256 hashes; HttpOnly, SameSite cookies, with Secure cookies when the configured origin uses HTTPS.
- Persistent shared listings, seller status management and deletion, server validation, product photos, and prices stored as integer cents. The price form accepts at most two decimal places.
- Seller-created bundles and database-backed reservations. Bundle matches and savings use entered items, needs, dates, and estimated retail values; no payment is collected.
- Public browsing with category, search, status, university, inclusive arrival-date, and optional minimum/maximum price filters. Price ranges include their endpoints and can be shared through `minPrice` and `maxPrice` URL parameters.
- Only University of Central Missouri is selectable; the API enforces this restriction.
- Private per-buyer/per-listing conversations, sender identity from the session, and polling for new messages.
- Database-backed rate limits for authentication, listing creation, conversations, and messages.
- Same-origin checks on writes, request-size limits, parameterized SQL, and participant/ownership checks.
- Loading, empty, and error states. Failed writes do not display a success confirmation.

Selecting a university is self-reported affiliation; it does not verify enrollment. Payments, email verification, password recovery, notifications, moderation, and buyer claiming of individual listings are not implemented. Sellers reserve and close individual listings manually; pickup arrangements for those items happen in messages. Deleting a listing also permanently removes its photo and associated conversations and messages. These are follow-up features, not simulated backend behavior.

## Configuration and hosting

Bundle claims reserve the grouped items in Handoff. Pickup coordination for bundles is not yet integrated with item messaging. Estimated new costs are seller-entered, and arrival needs travel in the marketplace URL rather than an account profile.

See `.env.example`. Local file configuration is optional:

- `HANDOFF_DB_PATH`: database file location; defaults to `data/handoff.sqlite`.
- `DATABASE_URL`: Neon Postgres connection string. The connected Vercel marketplace resource sets this automatically for production, preview, and development.
- `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`: optional alternative hosted Turso connection. Neon takes precedence when both are configured.
- `APP_ORIGIN`: exact public origin, such as `https://handoff.example.com` (no trailing slash). Set this when deploying behind an HTTPS reverse proxy. It controls write-origin checks and Secure session cookies.

### Vercel hosted database

Handoff's Vercel project is connected to a Neon Postgres resource. The integration supplies `DATABASE_URL` to the server for production, preview, and development. Deploy the current branch; the first API request creates tables and indexes. Accounts, sessions, listings, product photos, and messages are stored in the hosted database and persist across deployments. Set `APP_ORIGIN` only if a reverse proxy requires a fixed public origin; otherwise write-origin checks use the incoming request's origin.

Turso remains supported if `DATABASE_URL` is absent: set both `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` as server-only environment variables. Do not prefix database credentials with `NEXT_PUBLIC_` or commit real values. To initialize either hosted database explicitly before deploying, put its credentials in the ignored `.env.local` file and run `npm run db:setup`.

The Vercel filesystem is never used for account storage. On Vercel, missing credentials or unsafe Turso URLs return a 503 configuration error instead of silently using a temporary SQLite file. The landing page remains available. If only one Turso variable is set locally, the server also rejects that incomplete configuration.

Local accounts are not automatically uploaded to hosted storage. If existing local data must be retained online, arrange an explicit import before inviting users. Use the provider's backup and recovery facilities for hosted data rather than copying files from Vercel.

Product photos accept JPEG, PNG, and WebP files up to 10 MB. The browser converts them to smaller JPEG images before posting; the API validates the image signature and limits storage to 750 KB per image. Images are stored with listings in the database. Listings without a photo show a category illustration.

Production commands:

```sh
npm run build
npm run start
```

The Vercel configuration explicitly selects the Next.js framework and its `.next` build output. This overrides project settings left over from a generic `dist` deployment.

For deployments using the local file adapter, run one Node server instance with a persistent local disk and HTTPS in front of it. Multiple independent replicas and ephemeral serverless disks require hosted Postgres or Turso.

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
- `src/lib/server/`: SQLite, Neon, and Turso schema and queries, authentication, and validation.
- `src/lib/photo.ts`: browser-side photo resizing for listing posts.
- `src/lib/api-client.ts`: client requests and polling.
- `src/lib/contracts.ts`: shared API types.
- `src/lib/universities.ts`: supported university list.
- `src/components/auth-provider.tsx`: account state and protected screens.
- `src/components/account.tsx`, `sell-form.tsx`, `marketplace.tsx`, `messages.tsx`: live application flows.
- `tests/backend.test.mjs`: end-to-end API integration tests.

Routes: `/`, `/account`, `/leaving`, `/arriving`, `/sell`, `/marketplace`, `/bundles/new`, `/bundles/:id`, `/messages`.

API:
- `GET /api/auth/me`; `POST /api/auth/register|login|logout`.
- `GET/POST /api/listings`; `GET/PATCH/DELETE /api/listings/:id` (PATCH changes status; DELETE is seller-only); `GET /api/listings/:id/image`.
- `GET/POST /api/bundles`; `GET /api/bundles/:id`; `POST /api/bundles/:id/claim`.
- `GET/POST /api/conversations`.
- `GET/POST /api/conversations/:id/messages`.

Write requests require JSON and an Origin header matching the app origin. Cookies identify the account. Hosted queries use `@neondatabase/serverless` or `@libsql/client`.

Reference APIs: [Neon serverless driver](https://neon.com/docs/serverless/serverless-driver), [libSQL client](https://tursodatabase.github.io/libsql-client-ts/), [Next.js route handlers](https://nextjs.org/docs/app/api-reference/file-conventions/route).
