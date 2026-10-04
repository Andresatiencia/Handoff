import { db } from "../src/lib/server/db.ts";

try {
  const client = await db();
  try {
    await client.execute("SELECT id FROM users LIMIT 1");
    console.info("Handoff database is ready. Existing accounts and listings were preserved.");
  } finally {
    client.close();
  }
} catch {
  console.error("Database setup failed. Check the connection URL and token, then retry.");
  process.exitCode = 1;
}
