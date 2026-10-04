import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, unlink, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { DatabaseSync } from "node:sqlite";

test("real server: accounts, listings, private messages, and restart persistence", { timeout: 120000 }, async t => {
  const dir = await mkdtemp(join(tmpdir(), "handoff-backend-"));
  const database = join(dir, "test.sqlite");
  const socket = createServer();
  socket.listen(0, "127.0.0.1"); await once(socket, "listening");
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  const origin = `http://localhost:${port}`;
  let processHandle;
  let output = "";
  async function start() {
    processHandle = spawn(process.execPath, [resolve("node_modules/next/dist/bin/next"), "start", "--port", String(port)], {
      env: { ...process.env, VERCEL: "", TURSO_DATABASE_URL: "", TURSO_AUTH_TOKEN: "", HANDOFF_DB_PATH: database, APP_ORIGIN: origin }, stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
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
  let sellerId, buyerId, listingId, threadId, secondThreadId;
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
    assert.equal((await seller("auth/me")).data.user.id, sellerId);
    assert.equal((await anonymous("auth/me")).data.user, null);
    assert.equal((await anonymous("auth/register", "POST", { name: "Duplicate", email: "SELLER@example.com", password, university: campus })).status, 409);
    buyerId = (await buyer("auth/register", "POST", { name: "Buyer", email: "buyer@example.com", password, university: campus })).data.user.id;
    assert.equal((await stranger("auth/register", "POST", { name: "Another buyer", email: "third@example.com", password, university: campus })).status, 201);
  });

  await t.test("posting validates server-side data and derives ownership from the session", async () => {
    assert.equal((await anonymous("listings", "POST", item)).status, 401);
    for (const invalid of [{ university: "Other" }, { price: -1 }, { price: 1.234 }, { price: "12" }, { availableFrom: "2026-02-30" }, { availableUntil: "2026-12-01" }, { category: "Invalid" }, { title: "   " }, { departure: "2026-12-15" }]) {
      assert.equal((await seller("listings", "POST", { ...item, ...invalid })).status, 400, JSON.stringify(invalid));
    }
    const created = await seller("listings", "POST", { ...item, sellerId: buyerId, sellerName: "Impersonated" });
    assert.equal(created.status, 201);
    listingId = created.data.listing.id;
    assert.equal(created.data.listing.sellerId, sellerId);
    assert.equal(created.data.listing.sellerName, "Seller");
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
  });

  await t.test("repeated failed login attempts are throttled", async () => {
    let result;
    for (let i = 0; i < 21; i++) result = await anonymous("auth/login", "POST", { email: "missing@example.com", password });
    assert.equal(result.status, 429);
  });
});
