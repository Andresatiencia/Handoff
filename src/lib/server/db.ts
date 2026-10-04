import { createClient, type Client, type InValue } from "@libsql/client";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

let connection: Promise<Client> | undefined;

export class StorageUnavailable extends Error {
  constructor() {
    super("The marketplace database is not configured. Accounts, listings, and messages are temporarily unavailable.");
    this.name = "StorageUnavailable";
  }
}

const schema = `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE, passwordHash TEXT NOT NULL, university TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      tokenHash TEXT PRIMARY KEY, userId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expiresAt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS listings (
      id INTEGER PRIMARY KEY AUTOINCREMENT, sellerId INTEGER NOT NULL REFERENCES users(id),
      title TEXT NOT NULL, description TEXT NOT NULL, university TEXT NOT NULL,
      category TEXT NOT NULL, priceCents INTEGER NOT NULL CHECK(priceCents >= 0),
      condition TEXT NOT NULL, availableFrom TEXT NOT NULL, availableUntil TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available','reserved','sold')),
      illustration TEXT NOT NULL, color TEXT NOT NULL DEFAULT '#e7ede8',
      CHECK(availableFrom <= availableUntil)
    );
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT, listingId INTEGER NOT NULL REFERENCES listings(id),
      buyerId INTEGER NOT NULL REFERENCES users(id), UNIQUE(listingId, buyerId)
    );
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT, conversationId INTEGER NOT NULL REFERENCES conversations(id),
      senderId INTEGER NOT NULL REFERENCES users(id), text TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS messages_conversation ON messages(conversationId, id);
    CREATE INDEX IF NOT EXISTS listings_seller ON listings(sellerId);
    CREATE INDEX IF NOT EXISTS conversations_buyer ON conversations(buyerId);
    CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, resetsAt INTEGER NOT NULL);
  `;

async function connect() {
  const url = process.env.TURSO_DATABASE_URL?.trim();
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
  let client: Client;
  if (url || authToken || process.env.VERCEL === "1") {
    // Never fall back to an ephemeral file when hosted credentials are missing.
    if (!url || !authToken) throw new StorageUnavailable();
    let parsed: URL;
    try { parsed = new URL(url); } catch { throw new StorageUnavailable(); }
    if (!parsed.hostname || parsed.username || parsed.password
      || !["libsql:", "https:"].includes(parsed.protocol) || parsed.searchParams.get("tls") === "0") {
      throw new StorageUnavailable();
    }
    try { client = createClient({ url, authToken, intMode: "number" }); }
    catch { throw new StorageUnavailable(); }
  } else {
    const path = resolve(process.env.HANDOFF_DB_PATH ?? "data/handoff.sqlite");
    mkdirSync(dirname(path), { recursive: true });
    client = createClient({ url: pathToFileURL(path).href, intMode: "number", concurrency: 1, timeout: 5000 });
  }
  try {
    if (client.protocol === "file") await client.executeMultiple("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;");
    await client.batch(schema.split(";").map(sql => sql.trim()).filter(Boolean), "write");
    return client;
  } catch (error) {
    client.close();
    throw error;
  }
}

export function db(): Promise<Client> {
  if (!connection) {
    connection = connect().catch(error => {
      connection = undefined;
      throw error;
    });
  }
  return connection;
}

export async function execute(sql: string, args: InValue[] = []) {
  return (await db()).execute({ sql, args });
}

export async function queryAll<T>(sql: string, args: InValue[] = []): Promise<T[]> {
  const result = await execute(sql, args);
  return result.rows.map(row => Object.fromEntries(result.columns.map(column => [column, row[column]]))) as T[];
}

export async function queryOne<T>(sql: string, args: InValue[] = []): Promise<T | undefined> {
  return (await queryAll<T>(sql, args))[0];
}
