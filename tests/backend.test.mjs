import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, unlink, rmdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { DatabaseSync } from "node:sqlite";

test("real server: accounts, listings, bundles, private messages, and restart persistence", { timeout: 120000 }, async t => {
  const dir = await mkdtemp(join(tmpdir(), "handoff-backend-"));
  const database = join(dir, "test.sqlite");
  const outbox = join(dir, "verification-emails.txt");
  const socket = createServer();
  socket.listen(0, "127.0.0.1"); await once(socket, "listening");
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  const origin = `http://localhost:${port}`;
  let processHandle;
  let output = "";
  async function start(emailOutbox = outbox) {
    processHandle = spawn(process.execPath, [resolve("node_modules/next/dist/bin/next"), "start", "--port", String(port)], {
      env: { ...process.env, VERCEL: "", DATABASE_URL: "", TURSO_DATABASE_URL: "", TURSO_AUTH_TOKEN: "", RESEND_API_KEY: "", HANDOFF_EMAIL_FROM: "", HANDOFF_EMAIL_OUTBOX: emailOutbox, HANDOFF_DB_PATH: database, APP_ORIGIN: origin }, stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
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
    await unlink(outbox).catch(() => {});
    await rmdir(dir).catch(() => {});
  });
  const legacy = new DatabaseSync(database);
  legacy.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, "passwordHash" TEXT NOT NULL, university TEXT NOT NULL);
    INSERT INTO users(name,email,"passwordHash",university) VALUES('Earlier student','earlier@example.com','legacy-hash','University of Central Missouri');`);
  legacy.close();
  await start();
  const campus = "University of Central Missouri";
  const password = "Testing-handoff-2026!";
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
  async function tokenFor(email) {
    const lines = (await readFile(outbox, "utf8")).trim().split(/\r?\n/);
    const line = lines.filter(value => value.startsWith(`${email} `)).at(-1);
    assert.ok(line, `Verification email for ${email}`);
    return new URL(line.slice(email.length + 1)).searchParams.get("token");
  }
  async function verify(client, email) {
    const token = await tokenFor(email);
    assert.equal((await client("auth/verify-email", "POST", { token })).status, 200);
    assert.equal((await client("auth/verify-email", "POST", { token })).status, 400);
    assert.equal((await client("auth/me")).data.user.emailVerified, true);
  }

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
    assert.equal(registered.data.user.emailVerificationRequired, true);
    assert.equal(registered.data.emailSent, true);
    assert.equal((await seller("auth/me")).data.user.id, sellerId);
    assert.equal((await seller("listings", "POST", item)).status, 403);
    const oldToken = await tokenFor("seller@example.com");
    assert.equal((await seller("auth/resend-verification", "POST")).status, 200);
    assert.equal((await seller("auth/verify-email", "POST", { token: oldToken })).status, 400);
    await verify(seller, "seller@example.com");
    assert.equal((await anonymous("auth/me")).data.user, null);
    assert.equal((await anonymous("auth/register", "POST", { name: "Duplicate", email: "SELLER@example.com", password, university: campus })).status, 409);
    buyerId = (await buyer("auth/register", "POST", { name: "Buyer", email: "buyer@example.com", password, university: campus })).data.user.id;
    assert.equal((await buyer("bundles/demo-kitchen/claim", "POST")).status, 403);
    await verify(buyer, "buyer@example.com");
    assert.equal((await stranger("auth/register", "POST", { name: "Another buyer", email: "third@example.com", password, university: campus })).status, 201);
    await verify(stranger, "third@example.com");
  });

  await t.test("expired verification links cannot verify an address", async () => {
    const late = client();
    const registered = await late("auth/register", "POST", { name: "Late verifier", email: "late@example.com", password, university: campus });
    assert.equal(registered.status, 201);
    const token = await tokenFor("late@example.com");
    const inspection = new DatabaseSync(database);
    inspection.prepare("UPDATE email_verifications SET expiresAt=0 WHERE userId=?").run(registered.data.user.id);
    inspection.close();
    assert.equal((await late("auth/verify-email", "POST", { token })).status, 400);
    assert.equal((await late("auth/me")).data.user.emailVerificationRequired, true);
    assert.equal((await late("auth/resend-verification", "POST")).status, 200);
    await verify(late, "late@example.com");
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

  await t.test("existing accounts are grandfathered when the verification column is added", async () => {
    await anonymous("bundles");
    const inspection = new DatabaseSync(database, { readOnly: true });
    assert.equal(inspection.prepare("SELECT emailVerifiedAt FROM users WHERE email='earlier@example.com'").get().emailVerifiedAt, "legacy");
    inspection.close();
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
    await verify(fourth, "fourth@example.com");
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

  await t.test("delivery failures preserve the previous link and can be retried", async () => {
    const pending = client();
    const registered = await pending("auth/register", "POST", { name: "Pending student", email: "pending@example.com", password, university: campus });
    assert.equal(registered.data.emailSent, true);
    const original = await tokenFor("pending@example.com");
    await stop(); await start(dir); // A directory cannot be used as the local test outbox.
    const failed = await pending("auth/resend-verification", "POST");
    assert.equal(failed.status, 503);
    assert.match(failed.data.error, /could not send/i);
    assert.equal((await pending("auth/verify-email", "POST", { token: original })).status, 200);
    const another = client();
    const unsent = await another("auth/register", "POST", { name: "Retry student", email: "retry@example.com", password, university: campus });
    assert.equal(unsent.status, 201);
    assert.equal(unsent.data.emailSent, false);
    assert.equal(unsent.data.user.emailVerificationRequired, true);
    const inspection = new DatabaseSync(database, { readOnly: true });
    assert.equal(inspection.prepare("SELECT COUNT(*) AS count FROM email_verifications WHERE userId=?").get(unsent.data.user.id).count, 0);
    inspection.close();
    await stop(); await start();
    assert.equal((await another("auth/resend-verification", "POST")).status, 200);
    await verify(another, "retry@example.com");
  });

  await t.test("without a mail provider, production keeps the existing signup behavior", async () => {
    await stop(); await start("");
    const account = client();
    const registered = await account("auth/register", "POST", { name: "Before email setup", email: "before-setup@example.com", password, university: campus });
    assert.equal(registered.status, 201);
    assert.equal(registered.data.user.emailVerificationRequired, false);
    assert.equal(registered.data.user.emailVerified, false);
    const posted = await account("listings", "POST", { ...item, title: "Pre-setup item" });
    assert.equal(posted.status, 201);
    assert.equal((await account(`listings/${posted.data.listing.id}`, "DELETE")).status, 200);
  });

  await t.test("repeated failed login attempts are throttled", async () => {
    let result;
    for (let i = 0; i < 21; i++) result = await anonymous("auth/login", "POST", { email: "missing@example.com", password });
    assert.equal(result.status, 429);
  });
});
