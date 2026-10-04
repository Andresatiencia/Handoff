import { rows } from "../src/lib/server/db.ts";

try {
  await rows("SELECT id FROM users LIMIT 1");
  console.info("Handoff database is ready. Existing accounts and listings were preserved.");
} catch {
  console.error("Database setup failed. Check the database connection settings, then retry.");
  process.exitCode = 1;
}
