import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, unlink, rmdir } from "node:fs/promises";
import { scryptSync } from "node:crypto";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { DatabaseSync } from "node:sqlite";

test("real server: accounts, listings, bundles, private messages, and restart persistence", { timeout: 120000 }, async t => {
  const dir = await mkdtemp(join(tmpdir(), "handoff-backend-"));
  const database = join(dir, "test.sqlite");
  const socket = createServer();
  socket.listen(0, "127.0.0.1"); await once(socket, "listening");
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  const origin = `http://localhost:${port}`;
  let processHandle;
  let output = "";
  async function start(google = false) {
    processHandle = spawn(process.execPath, [resolve("node_modules/next/dist/bin/next"), "start", "--port", String(port)], {
      env: { ...process.env, VERCEL: "", DATABASE_URL: "", TURSO_DATABASE_URL: "", TURSO_AUTH_TOKEN: "", HANDOFF_DB_PATH: database, APP_ORIGIN: origin,
        GOOGLE_CLIENT_ID: google ? "test.apps.googleusercontent.com" : "", GOOGLE_CLIENT_SECRET: google ? "test-secret" : "" },
      stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
    });
    processHandle.stdout.on("data", chunk => { output += chunk; });
    processHandle.stderr.on("data", chunk => { output += chunk; });
    for (let count = 0; count < 150; count++) {
      if (processHandle.exitCode !== null) throw new Error(output);
      try { if ((await fetch(`${origin}/api/auth/me`)).ok) return; } catch {}
      await delay(100);
    }
    throw new Error(`Server did not start: ${output}`);
  }
  async function stop() {
    if (processHandle && processHandle.exitCode === null) {
      const exited = once(processHandle, "exit"); processHandle.kill(); await exited;
    }
  }
  t.after(async () => {
    await stop();
    // Remove only these named temporary test files; never the application's database.
    for (const suffix of ["", "-wal", "-shm"]) await unlink(database + suffix).catch(() => {});
    await rmdir(dir).catch(() => {});
  });
  const password = "Testing-handoff-2026!";
  const legacy = new DatabaseSync(database);
  legacy.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, "passwordHash" TEXT NOT NULL, university TEXT NOT NULL)`);
  const salt = "0123456789abcdef0123456789abcdef";
  const legacyHash = `${salt}:${scryptSync(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }).toString("hex")}`;
  legacy.prepare(`INSERT INTO users(name,email,"passwordHash",university) VALUES(?,?,?,?)`).run("Earlier student", "earlier@example.com", legacyHash, "University of Central Missouri");
  legacy.close();
  await start();
  const campus = "University of Central Missouri";
  function client() {
    let cookie = "";
    return async (path, method = "GET", body, extraHeaders = {}) => {
      const response = await fetch(`${origin}/api/${path}`, {
        method, headers: { Origin: origin, "Content-Type": "application/json", Cookie: cookie, ...extraHeaders },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const setCookie = response.headers.get("set-cookie");
      if (setCookie) cookie = setCookie.split(";")[0];
      const data = await response.json();
      return { status: response.status, data, setCookie };
    };
  }
  const seller = client(), buyer = client(), stranger = client(), anonymous = client();
  let sellerId, buyerId, listingId, threadId, secondThreadId, imageId, bundleId;
  const item = { title: "Test desk lamp", description: "Working lamp for a dorm room.", university: campus,
    category: "Bedroom", price: 12.50, condition: "Good", availableFrom: "2026-12-10", availableUntil: "2026-12-17" };
  await t.test("student flows render a university dropdown, not a text field", async () => {
    for (const path of ["/leaving", "/arriving"]) {
      const html = await (await fetch(origin + path)).text();
      assert.match(html, /<select[^>]*name="university"/);
      assert.match(html, /<option[^>]*value="University of Central Missouri"/);
      assert.doesNotMatch(html, /<input[^>]*name="university"/);
    }
  });

  await t.test("accounts use private sessions and enforce the university", async () => {
    assert.equal((await anonymous("auth/register", "POST", { name: "Nope", email: "invalid@example.com", password, university: "Other" })).status, 400);
    const registered = await seller("auth/register", "POST", { name: "Seller", email: "seller@example.com", password, university: campus });
    assert.equal(registered.status, 201);
    assert.match(registered.setCookie, /HttpOnly/i);
    assert.match(registered.setCookie, /SameSite=lax/i);
    sellerId = registered.data.user.id;
    assert.equal(registered.data.user.passwordHash, undefined);
    assert.equal(registered.data.user.emailVerificationRequired, undefined);
    assert.equal(registered.data.emailSent, undefined);
    assert.equal((await seller("auth/me")).data.user.id, sellerId);
    assert.equal((await seller("listings", "POST", { ...item, price: -1 })).status, 400);
    assert.equal((await seller("auth/resend-verification", "POST")).status, 404);
    assert.equal((await seller("auth/verify-email", "POST", { token: "unused" })).status, 404);
    const oldLink = await fetch(`${origin}/verify-email?token=old`, { redirect: "manual" });
    assert.equal(oldLink.status, 200);
    assert.match(await oldLink.text(), /url=\/account/);
    assert.equal((await anonymous("auth/me")).data.user, null);
    assert.equal((await anonymous("auth/register", "POST", { name: "Duplicate", email: "SELLER@example.com", password, university: campus })).status, 409);
    buyerId = (await buyer("auth/register", "POST", { name: "Buyer", email: "buyer@example.com", password, university: campus })).data.user.id;
    assert.equal((await buyer("bundles/demo-winter/claim", "POST")).status, 201);
    assert.equal((await stranger("auth/register", "POST", { name: "Another buyer", email: "third@example.com", password, university: campus })).status, 201);
  });

  await t.test("posting validates server-side data and derives ownership from the session", async () => {
    assert.equal((await anonymous("listings", "POST", item)).status, 401);
    for (const invalid of [{ university: "Other" }, { price: -1 }, { price: 1.234 }, { price: 12.345 }, { price: "12" }, { availableFrom: "2026-02-30" }, { availableUntil: "2026-12-01" }, { category: "Invalid" }, { title: "   " }, { departure: "2026-12-15" }]) {
      assert.equal((await seller("listings", "POST", { ...item, ...invalid })).status, 400, JSON.stringify(invalid));
    }
    const created = await seller("listings", "POST", { ...item, sellerId: buyerId, sellerName: "Impersonated" });
    assert.equal(created.status, 201);
    listingId = created.data.listing.id;
    assert.equal(created.data.listing.sellerId, sellerId);
    assert.equal(created.data.listing.sellerName, "Seller");
    assert.equal(created.data.listing.price, 12.5);
    const persisted = await buyer(`listings/${listingId}`);
    assert.equal(persisted.data.listing.illustration, "lamp");
    assert.equal(persisted.data.listing.color, "#e6ebe4");
    assert.equal((await buyer("listings")).data.listings[0].id, listingId);
    assert.equal((await buyer("listings?mine=true")).data.listings.length, 0);
    assert.equal((await seller("listings?mine=true")).data.listings.length, 1);
    assert.equal((await anonymous("listings?mine=true")).status, 401);
  });

  await t.test("arrival matching is inclusive and combines search and categories", async () => {
    for (const arrival of ["2026-12-10", "2026-12-17"]) assert.equal((await anonymous(`listings?arrival=${arrival}&categories=Bedroom&q=lamp`)).data.listings.length, 1);
    assert.equal((await anonymous("listings?arrival=2026-12-18")).data.listings.length, 0);
    assert.equal((await anonymous("listings?categories=Kitchen")).data.listings.length, 0);
    assert.equal((await anonymous("listings?arrival=bad")).status, 400);
    assert.equal((await anonymous("listings?university=Other")).status, 400);
  });

  await t.test("older accounts can sign in and act without email verification", async () => {
    const inspection = new DatabaseSync(database, { readOnly: true });
    assert.equal(inspection.prepare("SELECT emailVerifiedAt FROM users WHERE email='earlier@example.com'").get().emailVerifiedAt, "legacy");
    inspection.close();
    const earlier = client();
    assert.equal((await earlier("auth/login", "POST", { email: "earlier@example.com", password })).status, 200);
    assert.equal((await earlier("auth/me")).data.user.emailVerificationRequired, undefined);
    assert.equal((await earlier("bundles/demo-bedroom/claim", "POST")).status, 201);
  });

  await t.test("bundles group items and reserve atomically for one buyer", async () => {
    const demos = await anonymous("bundles");
    assert.equal(demos.status, 200);
    assert.equal(demos.data.bundles.filter(bundle => bundle.demo).length, 5);
    assert.equal(demos.data.bundles.find(bundle => bundle.id === "demo-kitchen").items.length, 6);
    assert.equal((await buyer("bundles/demo-kitchen/claim", "POST")).status, 201);
    assert.equal((await buyer("bundles/demo-kitchen")).data.bundle.claimedByMe, true);
    assert.equal((await stranger("bundles/demo-kitchen")).data.bundle.status, "available");
    const draft = { name: "Test Kitchen Starter Bundle", description: "Cooking basics for a new student.", university: campus,
      price: 35, estimatedRetail: 120, availableFrom: "2026-12-10", availableUntil: "2026-12-17",
      items: [{ name: "Plates", quantity: 4, condition: "Good", category: "Kitchen" }, { name: "Frying Pan", quantity: 1, condition: "Fair", category: "Kitchen" }] };
    assert.equal((await anonymous("bundles", "POST", draft)).status, 401);
    for (const invalid of [{ price: 1.234 }, { items: [draft.items[0]] }, { estimatedRetail: 20 }, { availableUntil: "2026-12-01" }]) {
      assert.equal((await seller("bundles", "POST", { ...draft, ...invalid })).status, 400);
    }
    const created = await seller("bundles", "POST", draft);
    assert.equal(created.status, 201);
    bundleId = created.data.bundle.id;
    assert.equal(created.data.bundle.sellerId, sellerId);
    assert.equal(created.data.bundle.priceCents, 3500);
    assert.equal(created.data.bundle.items.length, 2);
    assert.equal((await buyer(`bundles/${bundleId}`)).data.bundle.status, "available");
    assert.equal((await seller(`bundles/${bundleId}/claim`, "POST")).status, 400);
    assert.equal((await anonymous(`bundles/${bundleId}/claim`, "POST")).status, 401);
    const claimed = await buyer(`bundles/${bundleId}/claim`, "POST");
    assert.equal(claimed.status, 201);
    assert.equal(claimed.data.bundle.claimedByMe, true);
    assert.equal(claimed.data.bundle.status, "reserved");
    assert.equal((await buyer(`bundles/${bundleId}/claim`, "POST")).status, 200);
    assert.equal((await stranger(`bundles/${bundleId}/claim`, "POST")).status, 409);
    assert.equal((await stranger(`bundles/${bundleId}`)).data.bundle.claimedByMe, false);
    assert.equal((await anonymous("bundles")).data.bundles.find(bundle => bundle.id === bundleId).status, "reserved");
  });

  await t.test("optional price bounds include endpoints and combine with other filters", async () => {
    assert.equal((await anonymous("listings?minPrice=12.50&maxPrice=12.50&arrival=2026-12-10&categories=Bedroom")).data.listings.length, 1);
    assert.equal((await anonymous("listings?minPrice=12.51")).data.listings.length, 0);
    assert.equal((await anonymous("listings?maxPrice=12.49")).data.listings.length, 0);
    assert.equal((await anonymous("listings?minPrice=0")).data.listings.length, 1);
    for (const query of ["minPrice=-1", "minPrice=1.234", "maxPrice=100000.01", "minPrice=20&maxPrice=10", "maxPrice="]) {
      assert.equal((await anonymous(`listings?${query}`)).status, 400, query);
    }
  });

  await t.test("different buyers have separate conversations and cannot impersonate a sender", async () => {
    assert.equal((await anonymous("conversations")).status, 401);
    assert.equal((await seller("conversations", "POST", { listingId })).status, 400);
    const created = await buyer("conversations", "POST", { listingId });
    assert.equal(created.status, 201); threadId = created.data.conversation.id;
    assert.equal((await buyer("conversations", "POST", { listingId })).data.conversation.id, threadId);
    secondThreadId = (await stranger("conversations", "POST", { listingId })).data.conversation.id;
    assert.notEqual(threadId, secondThreadId);
    assert.equal((await buyer(`conversations/${threadId}/messages`, "POST", { text: "Is it available?", senderId: sellerId })).status, 201);
    const received = await seller(`conversations/${threadId}/messages`);
    assert.equal(received.data.messages[0].senderId, buyerId);
    assert.equal((await seller(`conversations/${threadId}/messages`, "POST", { text: "Yes, let's arrange pickup." })).status, 201);
    assert.equal((await buyer(`conversations/${threadId}/messages`)).data.messages.length, 2);
    assert.equal((await stranger(`conversations/${threadId}/messages`)).status, 404);
    assert.equal((await stranger(`conversations/${threadId}/messages`, "POST", { text: "Intrusion" })).status, 404);
    assert.equal((await stranger(`conversations/${secondThreadId}/messages`)).data.messages.length, 0);
    assert.equal((await buyer(`conversations/${threadId}/messages`, "POST", { text: "   " })).status, 400);
    assert.equal((await buyer(`conversations/${threadId}/messages`, "POST", { text: "x".repeat(2001) })).status, 400);
    assert.equal((await seller("conversations")).data.conversations.length, 2);
  });

  await t.test("only owners manage status and unavailable items reject new buyers", async () => {
    assert.equal((await buyer(`listings/${listingId}`, "PATCH", { status: "sold" })).status, 403);
    assert.equal((await seller(`listings/${listingId}`, "PATCH", { status: "reserved" })).status, 200);
    assert.equal((await anonymous("listings?available=true")).data.listings.length, 0);
    assert.equal((await seller(`listings/${listingId}`, "PATCH", { status: "sold" })).data.listing.status, "sold");
    const fourth = client();
    await fourth("auth/register", "POST", { name: "Late buyer", email: "fourth@example.com", password, university: campus });
    assert.equal((await fourth("conversations", "POST", { listingId })).status, 409);
    assert.equal((await buyer("conversations", "POST", { listingId })).data.conversation.id, threadId);
  });

  await t.test("uploaded photos are validated, served, and kept with listings", async () => {
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
    assert.equal((await seller("listings", "POST", { ...item, image: { mime: "image/jpeg", data: png.toString("base64") } })).status, 400);
    const created = await seller("listings", "POST", { ...item, title: "Photo listing", image: { mime: "image/png", data: png.toString("base64") } });
    assert.equal(created.status, 201);
    assert.equal(created.data.listing.hasImage, 1);
    imageId = created.data.listing.id;
    const image = await fetch(`${origin}/api/listings/${imageId}/image`);
    assert.equal(image.status, 200);
    assert.equal(image.headers.get("content-type"), "image/png");
    assert.equal(image.headers.get("cache-control"), "no-store");
    assert.deepEqual(Buffer.from(await image.arrayBuffer()), png);
    assert.equal((await seller(`listings/${imageId}`, "PATCH", { status: "sold" })).status, 200);
  });

  await t.test("CSRF, request size, password checks, and logout are enforced", async () => {
    assert.equal((await seller("listings", "POST", item, { Origin: "https://other.example" })).status, 403);
    assert.equal((await seller("listings", "POST", item, { Origin: "" })).status, 403);
    assert.equal((await seller("listings", "POST", { ...item, description: "x".repeat(17000) })).status, 413);
    assert.equal((await anonymous("auth/login", "POST", { email: "seller@example.com", password: "wrong-password-123" })).status, 401);
    const signedIn = await buyer("auth/login", "POST", { email: "buyer@example.com", password });
    const previousCookie = signedIn.setCookie.split(";")[0];
    assert.equal((await buyer("auth/logout", "POST")).status, 200);
    const replay = await fetch(`${origin}/api/auth/me`, { headers: { Cookie: previousCookie } });
    assert.equal((await replay.json()).user, null);
    assert.equal((await buyer("auth/me")).data.user, null);
    assert.equal((await buyer(`conversations/${threadId}/messages`)).status, 401);
    assert.equal((await buyer("auth/login", "POST", { email: "buyer@example.com", password })).status, 200);
    const inspection = new DatabaseSync(database, { readOnly: true });
    const row = inspection.prepare("SELECT passwordHash FROM users WHERE id=?").get(sellerId);
    assert.notEqual(row.passwordHash, password);
    assert.match(row.passwordHash, /^[a-f0-9]{32}:[a-f0-9]{128}$/);
    inspection.close();
  });

  await t.test("database and authenticated sessions survive a server restart", async () => {
    await stop(); await start();
    assert.equal((await seller("auth/me")).data.user.id, sellerId);
    assert.equal((await anonymous(`listings/${listingId}`)).data.listing.title, item.title);
    assert.equal((await buyer(`conversations/${threadId}/messages`)).data.messages.length, 2);
    assert.equal((await buyer(`bundles/${bundleId}`)).data.bundle.claimedByMe, true);
  });

  await t.test("only the seller can delete a listing and its conversations, messages, and photo", async () => {
    assert.equal((await anonymous(`listings/${listingId}`, "DELETE")).status, 401);
    assert.equal((await buyer(`listings/${listingId}`, "DELETE")).status, 403);
    assert.equal((await seller(`listings/${listingId}`, "DELETE", undefined, { Origin: "https://other.example" })).status, 403);
    assert.equal((await seller(`listings/${listingId}`, "DELETE")).status, 200);
    assert.equal((await anonymous(`listings/${listingId}`)).status, 404);
    assert.equal((await buyer(`conversations/${threadId}/messages`)).status, 404);
    assert.equal((await seller("conversations")).data.conversations.length, 0);
    assert.equal((await seller(`listings/${listingId}`, "DELETE")).status, 404);
    assert.equal((await seller(`listings/${imageId}`, "DELETE")).status, 200);
    const photo = await fetch(`${origin}/api/listings/${imageId}/image`);
    assert.equal(photo.status, 404);
    assert.equal((await anonymous("listings")).data.listings.length, 0);
    const inspection = new DatabaseSync(database, { readOnly: true });
    assert.equal(inspection.prepare("SELECT COUNT(*) AS total FROM conversations").get().total, 0);
    assert.equal(inspection.prepare("SELECT COUNT(*) AS total FROM messages").get().total, 0);
    inspection.close();
  });

  await t.test("a zero-dollar listing is included in a free-only price range", async () => {
    const free = await seller("listings", "POST", { ...item, title: "Free lamp", price: 0 });
    assert.equal(free.status, 201);
    const results = await anonymous("listings?minPrice=0&maxPrice=0");
    assert.deepEqual(results.data.listings.map(listing => listing.id), [free.data.listing.id]);
    assert.equal((await seller(`listings/${free.data.listing.id}`, "DELETE")).status, 200);
  });

  await t.test("registration and posting work without a mail provider", async () => {
    const account = client();
    const registered = await account("auth/register", "POST", { name: "Before email setup", email: "before-setup@example.com", password, university: campus });
    assert.equal(registered.status, 201);
    assert.equal(registered.data.user.emailVerificationRequired, undefined);
    const posted = await account("listings", "POST", { ...item, title: "Pre-setup item" });
    assert.equal(posted.status, 201);
    assert.equal((await account(`listings/${posted.data.listing.id}`, "DELETE")).status, 200);
    assert.equal((await account("listings")).status, 200);
    assert.equal((await fetch(`${origin}/api/auth/google/start`, { redirect: "manual" })).status, 503);
    const inspection = new DatabaseSync(database, { readOnly: true });
    assert.ok(inspection.prepare("PRAGMA table_info(users)").all().some(column => column.name === "googleSub"));
    inspection.close();
  });

  await t.test("Google sign-in starts with protected state and a registered callback", async () => {
    await stop(); await start(true);
    const started = await fetch(`${origin}/api/auth/google/start?next=%2Fmarketplace`, { redirect: "manual" });
    assert.equal(started.status, 307);
    assert.match(started.headers.get("set-cookie"), /handoff_google_flow=.*HttpOnly/i);
    const redirect = new URL(started.headers.get("location"));
    assert.equal(redirect.origin, "https://accounts.google.com");
    assert.equal(redirect.searchParams.get("redirect_uri"), `${origin}/api/auth/google/callback`);
    assert.equal(redirect.searchParams.get("code_challenge_method"), "S256");
    assert.equal(redirect.searchParams.get("scope"), "openid email profile");
    const rejected = await fetch(`${origin}/api/auth/google/callback?code=fake&state=wrong`, {
      headers: { Cookie: started.headers.get("set-cookie").split(";")[0] }, redirect: "manual",
    });
    assert.equal(rejected.status, 307);
    assert.match(rejected.headers.get("location"), /google_error=/);
    assert.equal((await anonymous("auth/me")).data.user, null);
    await stop(); await start();
  });

  await t.test("Google identity is unique and a Google-only account has no password login", async () => {
    const inspection = new DatabaseSync(database);
    inspection.prepare(`INSERT INTO users(name,email,"passwordHash",university,"emailVerifiedAt","googleSub") VALUES(?,?,?,?,?,?)`)
      .run("Google student", "google@example.com", "google-only:unusable", campus, new Date().toISOString(), "google-sub-123");
    assert.throws(() => inspection.prepare(`INSERT INTO users(name,email,"passwordHash",university,"emailVerifiedAt","googleSub") VALUES(?,?,?,?,?,?)`)
      .run("Duplicate", "other@example.com", "google-only:unusable", campus, new Date().toISOString(), "google-sub-123"));
    inspection.close();
    assert.equal((await anonymous("auth/login", "POST", { email: "google@example.com", password })).status, 401);
  });

  await t.test("repeated failed login attempts are throttled", async () => {
    let result;
    for (let i = 0; i < 21; i++) result = await anonymous("auth/login", "POST", { email: "missing@example.com", password });
    assert.equal(result.status, 429);
  });
});
