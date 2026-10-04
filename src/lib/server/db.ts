import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

let connection: DatabaseSync | undefined;

export class StorageUnavailable extends Error {
  constructor() {
    super("The marketplace database is not configured for Vercel. The landing page is available; accounts, listings, and messages need a persistent hosted database.");
    this.name = "StorageUnavailable";
  }
}

export function db() {
  if (connection) return connection;
  if (process.env.VERCEL === "1" && !process.env.HANDOFF_DB_PATH) throw new StorageUnavailable();
  const path = resolve(process.env.HANDOFF_DB_PATH ?? "data/handoff.sqlite");
  mkdirSync(dirname(path), { recursive: true });
  connection = new DatabaseSync(path);
  connection.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
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
    PRAGMA user_version = 1;
  `);
  return connection;
}
