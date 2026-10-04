import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, unlink, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import { randomBytes, scryptSync } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { setTimeout as delay } from "node:timers/promises";
import { initializeApp, deleteApp } from "firebase/app";
import { applyActionCode, confirmPasswordReset, connectAuthEmulator, createUserWithEmailAndPassword, getAuth,
  reload, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from "firebase/auth";

const project = "demo-handoff-test";
const emulator = process.env.FIREBASE_AUTH_EMULATOR_HOST;
if (!emulator) throw new Error("Run these tests with the Firebase Authentication Emulator.");

test("Firebase identity protects Handoff marketplace data", { timeout: 180000 }, async t => {
  const dir = await mkdtemp(join(tmpdir(), "handoff-firebase-"));
  const database = join(dir, "test.sqlite");
  const socket = createServer();
  socket.listen(0, "127.0.0.1"); await once(socket, "listening");
  const port = socket.address().port;
  await new Promise(resolvePort => socket.close(resolvePort));
  const origin = `http://localhost:${port}`;
  const campus = "University of Central Missouri";
  const password = "Testing-handoff-2026!";
  const item = { title: "Test desk lamp", description: "Working lamp for a dorm room.", university: campus,
    category: "Bedroom", price: 12.5, condition: "Good", availableFrom: "2026-12-10", availableUntil: "2026-12-17" };
  let server;
  let output = "";
  const apps = [];
  t.after(async () => {
    if (server?.exitCode === null) { const exited = once(server, "exit"); server.kill(); await exited; }
    for (const app of apps) await deleteApp(app);
    for (const suffix of ["", "-wal", "-shm"]) await unlink(database + suffix).catch(() => {});
    await rmdir(dir).catch(() => {});
  });

  // Pre-Firebase Handoff data remains in the same database and retains its IDs.
  const salt = randomBytes(16).toString("hex");
  const legacyHash = `${salt}:${scryptSync(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }).toString("hex")}`;
  const legacyDb = new DatabaseSync(database);
  legacyDb.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
    "passwordHash" TEXT NOT NULL, university TEXT NOT NULL, "emailVerifiedAt" TEXT DEFAULT 'legacy', "googleSub" TEXT)`);
  legacyDb.prepare(`INSERT INTO users(name,email,"passwordHash",university) VALUES(?,?,?,?)`).run("Earlier seller", "legacy@example.com", legacyHash, campus);
  const legacyId = legacyDb.prepare("SELECT id FROM users WHERE email='legacy@example.com'").get().id;
  legacyDb.close();

  server = spawn(process.execPath, [resolve("node_modules/next/dist/bin/next"), "start", "--port", String(port)], {
    env: { ...process.env, VERCEL: "", DATABASE_URL: "", TURSO_DATABASE_URL: "", TURSO_AUTH_TOKEN: "", HANDOFF_DB_PATH: database,
      APP_ORIGIN: origin, FIREBASE_PROJECT_ID: project, FIREBASE_CLIENT_EMAIL: "", FIREBASE_PRIVATE_KEY: "",
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: project, FIREBASE_AUTH_EMULATOR_HOST: emulator },
    stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
  });
  server.stdout.on("data", chunk => { output += chunk; });
  server.stderr.on("data", chunk => { output += chunk; });
  for (let attempt = 0; attempt < 150; attempt++) {
    if (server.exitCode !== null) throw new Error(output);
    try { if ((await fetch(`${origin}/api/auth/me`)).ok) break; } catch {}
    await delay(100);
  }

  function identity(label) {
    const app = initializeApp({ apiKey: "fake-api-key", authDomain: `${project}.firebaseapp.com`, projectId: project }, label);
    apps.push(app);
    const auth = getAuth(app);
    connectAuthEmulator(auth, `http://${emulator}`, { disableWarnings: true });
    return auth;
  }
  const sellerAuth = identity("seller"), buyerAuth = identity("buyer"), legacyAuth = identity("legacy");
  async function api(path, method = "GET", data, auth = null, tokenOverride) {
    const token = tokenOverride ?? (auth?.currentUser ? await auth.currentUser.getIdToken() : "");
    const response = await fetch(`${origin}/api/${path}`, { method,
      headers: { Origin: origin, "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    return { status: response.status, data: await response.json() };
  }
  async function oob(email, requestType) {
    const response = await fetch(`http://${emulator}/emulator/v1/projects/${project}/oobCodes`);
    const result = await response.json();
    const code = result.oobCodes?.filter(entry => entry.email === email && entry.requestType === requestType).at(-1);
    assert.ok(code?.oobCode, `${requestType} email was generated for ${email}`);
    return code.oobCode;
  }

  await t.test("new registration sends verification; unverified users browse but cannot transact", async () => {
    const credential = await createUserWithEmailAndPassword(sellerAuth, "seller@example.com", password);
    assert.equal(credential.user.emailVerified, false);
    const profile = await api("auth/profile", "POST", { name: "Seller", university: campus }, sellerAuth);
    assert.equal(profile.status, 201);
    assert.equal(profile.data.user.emailVerified, false);
    await sendEmailVerification(credential.user);
    await oob("seller@example.com", "VERIFY_EMAIL");
    await signOut(sellerAuth);
    await signInWithEmailAndPassword(sellerAuth, "seller@example.com", password);
    assert.equal((await api("auth/me", "GET", undefined, sellerAuth)).data.user.emailVerified, false);
    assert.equal((await api("listings")).status, 200);
    assert.equal((await api("bundles")).status, 200);
    assert.equal((await api("listings", "POST", item, sellerAuth)).status, 403);
    assert.equal((await api("bundles/demo-kitchen/claim", "POST", undefined, sellerAuth)).status, 403);
    assert.equal((await api("conversations", "POST", { listingId: 1 }, sellerAuth)).status, 403);
    const inspection = new DatabaseSync(database);
    const listing = inspection.prepare(`INSERT INTO listings("sellerId",title,description,university,category,"priceCents",condition,"availableFrom","availableUntil",illustration)
      VALUES(?,?,?,?,?,?,?,?,?,?) RETURNING id`).get(legacyId, "Earlier lamp", "Test item", campus, "Bedroom", 1000, "Good", "2026-12-10", "2026-12-17", "lamp");
    const thread = inspection.prepare(`INSERT INTO conversations("listingId","buyerId") VALUES(?,?) RETURNING id`).get(listing.id, profile.data.user.id);
    inspection.close();
    assert.equal((await api("conversations", "GET", undefined, sellerAuth)).status, 403);
    assert.equal((await api(`conversations/${thread.id}/messages`, "GET", undefined, sellerAuth)).status, 403);
    assert.equal((await api(`listings/${listing.id}`, "PATCH", { status: "reserved" }, sellerAuth)).status, 403);
    assert.equal((await api("listings?mine=true", "GET", undefined, sellerAuth)).status, 403);
    assert.equal((await api(`conversations/${thread.id}/messages`, "POST", { text: "Hello" }, sellerAuth)).status, 403);
  });

  await t.test("resend verification, verify, refresh token and sign in again", async () => {
    await sendEmailVerification(sellerAuth.currentUser);
    const code = await oob("seller@example.com", "VERIFY_EMAIL");
    await applyActionCode(sellerAuth, code);
    await reload(sellerAuth.currentUser);
    assert.equal(sellerAuth.currentUser.emailVerified, true);
    await sellerAuth.currentUser.getIdToken(true);
    assert.equal((await api("auth/me", "GET", undefined, sellerAuth)).data.user.emailVerified, true);
    await signOut(sellerAuth);
    await signInWithEmailAndPassword(sellerAuth, "seller@example.com", password);
    assert.equal(sellerAuth.currentUser.emailVerified, true);
  });

  let listingId;
  await t.test("verified seller can publish and send messages", async () => {
    const created = await api("listings", "POST", item, sellerAuth);
    assert.equal(created.status, 201);
    listingId = created.data.listing.id;
    assert.equal(created.data.listing.sellerName, "Seller");
  });

  await t.test("verified buyer can claim bundles and message seller", async () => {
    const credential = await createUserWithEmailAndPassword(buyerAuth, "buyer@example.com", password);
    assert.equal((await api("auth/profile", "POST", { name: "Buyer", university: campus }, buyerAuth)).status, 201);
    await sendEmailVerification(credential.user);
    await applyActionCode(buyerAuth, await oob("buyer@example.com", "VERIFY_EMAIL"));
    await reload(credential.user); await credential.user.getIdToken(true);
    assert.equal((await api("bundles/demo-kitchen/claim", "POST", undefined, buyerAuth)).status, 201);
    const conversation = await api("conversations", "POST", { listingId }, buyerAuth);
    assert.equal(conversation.status, 201);
    assert.equal((await api(`conversations/${conversation.data.conversation.id}/messages`, "POST", { text: "Is this available?" }, buyerAuth)).status, 201);
    assert.equal((await api(`conversations/${conversation.data.conversation.id}/messages`, "POST", { text: "Yes" }, sellerAuth)).status, 201);
  });

  await t.test("password reset email changes the Firebase credential", async () => {
    await sendPasswordResetEmail(buyerAuth, "buyer@example.com");
    const code = await oob("buyer@example.com", "PASSWORD_RESET");
    const newPassword = "Reset-handoff-2026!";
    await confirmPasswordReset(buyerAuth, code, newPassword);
    await signOut(buyerAuth);
    await assert.rejects(signInWithEmailAndPassword(buyerAuth, "buyer@example.com", password));
    await signInWithEmailAndPassword(buyerAuth, "buyer@example.com", newPassword);
    assert.equal((await api("auth/me", "GET", undefined, buyerAuth)).data.user.emailVerified, true);
  });

  await t.test("existing profiles require old password proof and retain their ID", async () => {
    await createUserWithEmailAndPassword(legacyAuth, "legacy@example.com", password);
    assert.equal((await api("auth/profile", "POST", { name: "Duplicate", university: campus }, legacyAuth)).status, 409);
    assert.equal((await api("auth/migrate", "POST", { password: "wrong-password-2026" }, legacyAuth)).status, 401);
    const linked = await api("auth/migrate", "POST", { password }, legacyAuth);
    assert.equal(linked.status, 200);
    assert.equal(linked.data.user.id, legacyId);
    assert.equal(linked.data.user.emailVerified, false);
    const inspection = new DatabaseSync(database, { readOnly: true });
    const account = inspection.prepare("SELECT id,firebaseUid,passwordHash FROM users WHERE email='legacy@example.com'").get();
    inspection.close();
    assert.equal(account.id, legacyId);
    assert.equal(account.firebaseUid, legacyAuth.currentUser.uid);
    assert.equal(account.passwordHash, "firebase-managed");
    assert.equal((await api("listings", "POST", item, legacyAuth)).status, 403);
  });

  await t.test("missing, malformed and expired tokens cannot call protected APIs", async () => {
    assert.equal((await api("listings", "POST", item)).status, 401);
    assert.equal((await api("listings", "POST", item, null, "not-a-valid-firebase-token-1234567890")).status, 401);
    const [header, payload, signature] = (await sellerAuth.currentUser.getIdToken()).split(".");
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    claims.exp = Math.floor(Date.now() / 1000) - 30;
    const expired = `${header}.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.${signature}`;
    assert.equal((await api("listings", "POST", item, null, expired)).status, 401);
    assert.equal((await api("auth/register", "POST", { email: "bypass@example.com", password })).status, 404);
    assert.equal((await api("auth/verify-email", "POST", { token: "fake" })).status, 404);
  });
});
