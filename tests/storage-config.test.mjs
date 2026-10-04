import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, access, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";

test("Vercel rejects missing or unsafe hosted storage without creating a local database", { timeout: 60000 }, async t => {
  const dir = await mkdtemp(join(tmpdir(), "handoff-storage-"));
  const database = join(dir, "must-not-be-created.sqlite");
  t.after(() => rmdir(dir));
  const cases = [
    { name: "missing credentials even with a local path", url: "", token: "" },
    { name: "missing token", url: "libsql://example.turso.io", token: "" },
    { name: "missing URL", url: "", token: "test-token" },
    { name: "malformed URL", url: "not-a-database-url", token: "test-token" },
    { name: "missing database host", url: "libsql:", token: "test-token" },
    { name: "local file masquerading as hosted storage", url: `file:${database}`, token: "test-token" },
    { name: "unencrypted connection", url: "http://example.turso.io", token: "test-token" },
    { name: "disabled TLS", url: "libsql://example.turso.io?tls=0", token: "test-token" },
  ];
  for (const config of cases) await t.test(config.name, async () => {
    const socket = createServer();
    socket.listen(0, "127.0.0.1"); await once(socket, "listening");
    const port = socket.address().port;
    await new Promise(resolve => socket.close(resolve));
    const origin = `http://localhost:${port}`;
    const server = spawn(process.execPath, [resolve("node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", String(port)], {
      env: { ...process.env, VERCEL: "1", DATABASE_URL: "", TURSO_DATABASE_URL: config.url, TURSO_AUTH_TOKEN: config.token, HANDOFF_DB_PATH: database, APP_ORIGIN: origin },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    server.stdout.on("data", chunk => { output += chunk; });
    server.stderr.on("data", chunk => { output += chunk; });
    try {
      let response;
      for (let count = 0; count < 100; count++) {
        if (server.exitCode !== null) throw new Error(output);
        try { response = await fetch(`${origin}/api/listings`); break; } catch {}
        await delay(100);
      }
      assert.ok(response, `Server did not start: ${output}`);
      assert.equal(response.status, 503);
      assert.match((await response.json()).error, /database is not configured/);
      assert.equal((await fetch(origin)).status, 200);
      const profile = await fetch(`${origin}/api/auth/profile`, {
        method: "POST", headers: { Origin: origin, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Test student", university: "University of Central Missouri" }),
      });
      assert.equal(profile.status, 401);
      assert.equal(profile.headers.get("set-cookie"), null);
      await assert.rejects(access(database));
    } finally {
      if (server.exitCode === null) {
        const exited = once(server, "exit"); server.kill(); await exited;
      }
    }
  });
});
