import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { neon } from "@neondatabase/serverless";
import { createClient, type Client } from "@libsql/client";

type Value = string | number | null;
let connection: DatabaseSync | undefined;
let initialized: Promise<void> | undefined;
let tursoConnection: Promise<Client> | undefined;

export class StorageUnavailable extends Error {
  constructor() {
    super("The marketplace database is not configured. Connect Neon or Turso to this Vercel project.");
    this.name = "StorageUnavailable";
  }
}

function sqlite() {
  if (connection) return connection;
  if (process.env.VERCEL === "1") throw new StorageUnavailable();
  const path = resolve(process.env.HANDOFF_DB_PATH ?? "data/handoff.sqlite");
  mkdirSync(dirname(path), { recursive: true });
  connection = new DatabaseSync(path);
  connection.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE, "passwordHash" TEXT NOT NULL, university TEXT NOT NULL,
      "emailVerifiedAt" TEXT DEFAULT 'legacy'
    );
    CREATE TABLE IF NOT EXISTS email_verifications (
      "userId" INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      "tokenHash" TEXT NOT NULL UNIQUE, "expiresAt" INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      "tokenHash" TEXT PRIMARY KEY, "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      "expiresAt" INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS listings (
      id INTEGER PRIMARY KEY AUTOINCREMENT, "sellerId" INTEGER NOT NULL REFERENCES users(id),
      title TEXT NOT NULL, description TEXT NOT NULL, university TEXT NOT NULL,
      category TEXT NOT NULL, "priceCents" INTEGER NOT NULL CHECK("priceCents" >= 0),
      condition TEXT NOT NULL, "availableFrom" TEXT NOT NULL, "availableUntil" TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available','reserved','sold')),
      illustration TEXT NOT NULL, color TEXT NOT NULL DEFAULT '#e7ede8',
      "imageData" TEXT, "imageMime" TEXT,
      CHECK("availableFrom" <= "availableUntil")
    );
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT, "listingId" INTEGER NOT NULL REFERENCES listings(id),
      "buyerId" INTEGER NOT NULL REFERENCES users(id), UNIQUE("listingId", "buyerId")
    );
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT, "conversationId" INTEGER NOT NULL REFERENCES conversations(id),
      "senderId" INTEGER NOT NULL REFERENCES users(id), text TEXT NOT NULL,
      "createdAt" TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS messages_conversation ON messages("conversationId", id);
    CREATE INDEX IF NOT EXISTS listings_seller ON listings("sellerId");
    CREATE INDEX IF NOT EXISTS conversations_buyer ON conversations("buyerId");
    CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, "resetsAt" INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS bundles (
      id INTEGER PRIMARY KEY AUTOINCREMENT, "sellerId" INTEGER NOT NULL REFERENCES users(id),
      name TEXT NOT NULL, description TEXT NOT NULL, "itemsJson" TEXT NOT NULL, "priceCents" INTEGER NOT NULL,
      "retailCents" INTEGER NOT NULL, "availableFrom" TEXT NOT NULL,
      "availableUntil" TEXT NOT NULL, university TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS bundle_claims (
      "bundleId" TEXT PRIMARY KEY, "buyerId" INTEGER NOT NULL REFERENCES users(id),
      "claimedAt" TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS bundles_seller ON bundles("sellerId");
  `);
  const columns = connection.prepare("PRAGMA table_info(listings)").all() as { name: string }[];
  const userColumns = connection.prepare("PRAGMA table_info(users)").all() as { name: string }[];
  if (!userColumns.some(column => column.name === "emailVerifiedAt")) connection.exec('ALTER TABLE users ADD COLUMN "emailVerifiedAt" TEXT DEFAULT \'legacy\'');
  if (!columns.some(column => column.name === "imageData")) connection.exec('ALTER TABLE listings ADD COLUMN "imageData" TEXT');
  if (!columns.some(column => column.name === "imageMime")) connection.exec('ALTER TABLE listings ADD COLUMN "imageMime" TEXT');
  return connection;
}

function postgres() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new StorageUnavailable();
  return neon(url);
}

async function turso() {
  if (!tursoConnection) tursoConnection = (async () => {
    const url = process.env.TURSO_DATABASE_URL?.trim();
    const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
    if (!url || !authToken) throw new StorageUnavailable();
    let parsed: URL;
    try { parsed = new URL(url); } catch { throw new StorageUnavailable(); }
    if (!parsed.hostname || parsed.username || parsed.password || !["libsql:", "https:"].includes(parsed.protocol) || parsed.searchParams.get("tls") === "0") {
      throw new StorageUnavailable();
    }
    const client = createClient({ url, authToken, intMode: "number" });
    const schema = [
      `CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, "passwordHash" TEXT NOT NULL, university TEXT NOT NULL, "emailVerifiedAt" TEXT DEFAULT 'legacy')`,
      `CREATE TABLE IF NOT EXISTS email_verifications ("userId" INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, "tokenHash" TEXT NOT NULL UNIQUE, "expiresAt" INTEGER NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS sessions ("tokenHash" TEXT PRIMARY KEY, "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, "expiresAt" INTEGER NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS listings (id INTEGER PRIMARY KEY AUTOINCREMENT, "sellerId" INTEGER NOT NULL REFERENCES users(id), title TEXT NOT NULL, description TEXT NOT NULL, university TEXT NOT NULL, category TEXT NOT NULL, "priceCents" INTEGER NOT NULL CHECK("priceCents" >= 0), condition TEXT NOT NULL, "availableFrom" TEXT NOT NULL, "availableUntil" TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available','reserved','sold')), illustration TEXT NOT NULL, color TEXT NOT NULL DEFAULT '#e7ede8', "imageData" TEXT, "imageMime" TEXT, CHECK("availableFrom" <= "availableUntil"))`,
      `CREATE TABLE IF NOT EXISTS conversations (id INTEGER PRIMARY KEY AUTOINCREMENT, "listingId" INTEGER NOT NULL REFERENCES listings(id), "buyerId" INTEGER NOT NULL REFERENCES users(id), UNIQUE("listingId", "buyerId"))`,
      `CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, "conversationId" INTEGER NOT NULL REFERENCES conversations(id), "senderId" INTEGER NOT NULL REFERENCES users(id), text TEXT NOT NULL, "createdAt" TEXT NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, "resetsAt" INTEGER NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS bundles (id INTEGER PRIMARY KEY AUTOINCREMENT, "sellerId" INTEGER NOT NULL REFERENCES users(id), name TEXT NOT NULL, description TEXT NOT NULL, "itemsJson" TEXT NOT NULL, "priceCents" INTEGER NOT NULL, "retailCents" INTEGER NOT NULL, "availableFrom" TEXT NOT NULL, "availableUntil" TEXT NOT NULL, university TEXT NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS bundle_claims ("bundleId" TEXT PRIMARY KEY, "buyerId" INTEGER NOT NULL REFERENCES users(id), "claimedAt" TEXT NOT NULL)`,
      `CREATE INDEX IF NOT EXISTS bundles_seller ON bundles("sellerId")`,
      `CREATE INDEX IF NOT EXISTS messages_conversation ON messages("conversationId", id)`,
      `CREATE INDEX IF NOT EXISTS listings_seller ON listings("sellerId")`,
      `CREATE INDEX IF NOT EXISTS conversations_buyer ON conversations("buyerId")`,
    ];
    try {
      await client.batch(schema, "write");
      for (const column of ["imageData", "imageMime"]) {
        try { await client.execute(`ALTER TABLE listings ADD COLUMN "${column}" TEXT`); }
        catch (error) { if (!String(error).toLowerCase().includes("duplicate column name")) throw error; }
      }
      try { await client.execute(`ALTER TABLE users ADD COLUMN "emailVerifiedAt" TEXT DEFAULT 'legacy'`); }
      catch (error) { if (!String(error).toLowerCase().includes("duplicate column name")) throw error; }
      return client;
    } catch (error) { client.close(); throw error; }
  })().catch(error => { tursoConnection = undefined; throw error; });
  return tursoConnection;
}

async function initPostgres() {
  if (!initialized) initialized = (async () => {
    const sql = postgres();
    const schema = [
      `CREATE TABLE IF NOT EXISTS users (id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, "passwordHash" TEXT NOT NULL, university TEXT NOT NULL, "emailVerifiedAt" TEXT DEFAULT 'legacy')`,
      `CREATE TABLE IF NOT EXISTS email_verifications ("userId" INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, "tokenHash" TEXT NOT NULL UNIQUE, "expiresAt" BIGINT NOT NULL)`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TEXT DEFAULT 'legacy'`,
      `CREATE TABLE IF NOT EXISTS sessions ("tokenHash" TEXT PRIMARY KEY, "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, "expiresAt" BIGINT NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS listings (id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, "sellerId" INTEGER NOT NULL REFERENCES users(id), title TEXT NOT NULL, description TEXT NOT NULL, university TEXT NOT NULL, category TEXT NOT NULL, "priceCents" INTEGER NOT NULL CHECK("priceCents" >= 0), condition TEXT NOT NULL, "availableFrom" TEXT NOT NULL, "availableUntil" TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available','reserved','sold')), illustration TEXT NOT NULL, color TEXT NOT NULL DEFAULT '#e7ede8', "imageData" TEXT, "imageMime" TEXT, CHECK("availableFrom" <= "availableUntil"))`,
      `CREATE TABLE IF NOT EXISTS conversations (id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, "listingId" INTEGER NOT NULL REFERENCES listings(id), "buyerId" INTEGER NOT NULL REFERENCES users(id), UNIQUE("listingId", "buyerId"))`,
      `CREATE TABLE IF NOT EXISTS messages (id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, "conversationId" INTEGER NOT NULL REFERENCES conversations(id), "senderId" INTEGER NOT NULL REFERENCES users(id), text TEXT NOT NULL, "createdAt" TEXT NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, "resetsAt" BIGINT NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS bundles (id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, "sellerId" INTEGER NOT NULL REFERENCES users(id), name TEXT NOT NULL, description TEXT NOT NULL, "itemsJson" TEXT NOT NULL, "priceCents" INTEGER NOT NULL, "retailCents" INTEGER NOT NULL, "availableFrom" TEXT NOT NULL, "availableUntil" TEXT NOT NULL, university TEXT NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS bundle_claims ("bundleId" TEXT PRIMARY KEY, "buyerId" INTEGER NOT NULL REFERENCES users(id), "claimedAt" TEXT NOT NULL)`,
      `CREATE INDEX IF NOT EXISTS bundles_seller ON bundles("sellerId")`,
      `ALTER TABLE listings ADD COLUMN IF NOT EXISTS "imageData" TEXT`,
      `ALTER TABLE listings ADD COLUMN IF NOT EXISTS "imageMime" TEXT`,
      `CREATE INDEX IF NOT EXISTS messages_conversation ON messages("conversationId", id)`,
      `CREATE INDEX IF NOT EXISTS listings_seller ON listings("sellerId")`,
      `CREATE INDEX IF NOT EXISTS conversations_buyer ON conversations("buyerId")`,
    ];
    for (const statement of schema) await sql.query(statement);
  })().catch(error => { initialized = undefined; throw error; });
  await initialized;
}

export async function rows<T>(query: string, ...values: Value[]): Promise<T[]> {
  if (process.env.DATABASE_URL) {
    await initPostgres();
    return await postgres().query(query, values) as T[];
  }
  const ordered: Value[] = [];
  const sqliteQuery = query.replace(/\$(\d+)/g, (_match, index: string) => {
    ordered.push(values[Number(index) - 1]);
    return "?";
  });
  if (process.env.TURSO_DATABASE_URL || process.env.TURSO_AUTH_TOKEN) {
    const result = await (await turso()).execute({ sql: sqliteQuery, args: ordered });
    return result.rows.map(item => Object.fromEntries(result.columns.map(column => [column, item[column]]))) as T[];
  }
  const statement = sqlite().prepare(sqliteQuery);
  return (statement.columns().length ? statement.all(...ordered) : (statement.run(...ordered), [])) as T[];
}

export async function row<T>(query: string, ...values: Value[]): Promise<T | undefined> {
  return (await rows<T>(query, ...values))[0];
}

export async function deleteListing(id: number, sellerId: number): Promise<boolean> {
  const statements = [
    `DELETE FROM messages WHERE "conversationId" IN (
      SELECT c.id FROM conversations c JOIN listings l ON l.id=c."listingId"
      WHERE l.id=$1 AND l."sellerId"=$2)`,
    `DELETE FROM conversations WHERE "listingId" IN (SELECT id FROM listings WHERE id=$1 AND "sellerId"=$2)`,
    `DELETE FROM listings WHERE id=$1 AND "sellerId"=$2 RETURNING id`,
  ];
  if (process.env.DATABASE_URL) {
    await initPostgres();
    const sql = postgres();
    const results = await sql.transaction(statements.map(statement => sql.query(statement, [id, sellerId])));
    return results[2].length > 0;
  }
  const sqliteStatements = statements.map(statement => statement.replace(/\$[12]/g, "?"));
  if (process.env.TURSO_DATABASE_URL || process.env.TURSO_AUTH_TOKEN) {
    const results = await (await turso()).batch(sqliteStatements.map(statement => [statement, [id, sellerId]]), "write");
    return results[2].rows.length > 0;
  }
  const connection = sqlite();
  connection.exec("BEGIN IMMEDIATE");
  try {
    connection.prepare(sqliteStatements[0]).run(id, sellerId);
    connection.prepare(sqliteStatements[1]).run(id, sellerId);
    const deleted = connection.prepare(sqliteStatements[2]).get(id, sellerId);
    connection.exec("COMMIT");
    return Boolean(deleted);
  } catch (error) {
    connection.exec("ROLLBACK");
    throw error;
  }
}
