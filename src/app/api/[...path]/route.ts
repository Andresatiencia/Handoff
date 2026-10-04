import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { currentUser, requireUser, passwordHash, verifyPassword, startSession, endSession, limit } from "@/lib/server/auth";
import { HttpError, text, date, university, listingInput } from "@/lib/server/validation";
import { getListing, listingSelect } from "@/lib/server/listings";
import { categories } from "@/lib/listings";
import type { Conversation, User } from "@/lib/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
const conversationSelect = `SELECT c.id,c.listingId,c.buyerId,l.sellerId,l.title,l.status,
  b.name AS buyerName,s.name AS sellerName FROM conversations c JOIN listings l ON l.id=c.listingId
  JOIN users b ON b.id=c.buyerId JOIN users s ON s.id=l.sellerId`;

async function body(request: NextRequest) {
  if (!request.headers.get("content-type")?.includes("application/json")) throw new HttpError(415, "Send JSON data.");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "Missing request body.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 16384) { await reader.cancel(); throw new HttpError(413, "Request is too large."); }
    chunks.push(value);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch { throw new HttpError(400, "Invalid JSON data."); }
}

function conversation(id: number, userId: number) {
  const item = db().prepare(`${conversationSelect} WHERE c.id=? AND (c.buyerId=? OR l.sellerId=?)`).get(id, userId, userId) as Conversation | undefined;
  if (!item) throw new HttpError(404, "Conversation not found.");
  return item;
}

async function handle(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  try {
    const parts = (await context.params).path;
    const route = parts.join("/");
    const method = request.method;
    if (method !== "GET") {
      const expected = process.env.APP_ORIGIN ?? request.nextUrl.origin;
      if (request.headers.get("origin") !== expected || request.headers.get("sec-fetch-site") === "cross-site") {
        throw new HttpError(403, "Request origin is not allowed.");
      }
    }
    if (route === "auth/me" && method === "GET") return json({ user: currentUser(request) });
    if (route === "auth/logout" && method === "POST") {
      const response = json({ ok: true }); endSession(request, response); return response;
    }
    if (["auth/register", "auth/login"].includes(route) && method === "POST") {
      // Global cap cannot be bypassed by spoofing proxy headers; per-email cap protects individual accounts.
      limit("auth:global", 300);
      const data = await body(request);
      const email = text(data.email, "Email", 254).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "Enter a valid email address.");
      limit(`auth:${email}`, 20);
      if (typeof data.password !== "string" || data.password.length < 12 || data.password.length > 128) {
        throw new HttpError(400, "Use a password between 12 and 128 characters.");
      }
      let user: User;
      if (route === "auth/register") {
        const name = text(data.name, "Name", 60);
        const campus = university(data.university);
        const hash = await passwordHash(data.password);
        try {
          const result = db().prepare("INSERT INTO users(name,email,passwordHash,university) VALUES(?,?,?,?)").run(name, email, hash, campus);
          user = { id: Number(result.lastInsertRowid), name, email, university: campus };
        } catch (error) {
          if (String(error).includes("UNIQUE")) throw new HttpError(409, "An account with this email already exists. Sign in instead.");
          throw error;
        }
      } else {
        const account = db().prepare("SELECT * FROM users WHERE email=?").get(email) as (User & { passwordHash: string }) | undefined;
        // Perform the same password work for unknown addresses.
        const fallback = `00000000000000000000000000000000:${"00".repeat(64)}`;
        const valid = await verifyPassword(data.password, account?.passwordHash ?? fallback);
        if (!account || !valid) throw new HttpError(401, "Email or password is incorrect.");
        user = { id: account.id, name: account.name, email: account.email, university: account.university };
      }
      const response = json({ user }, route === "auth/register" ? 201 : 200);
      startSession(request, response, user.id); return response;
    }
    if (route === "listings" && method === "GET") {
      const params = request.nextUrl.searchParams;
      const clauses: string[] = [];
      const values: (string | number)[] = [];
      if (params.get("mine") === "true") { clauses.push("l.sellerId=?"); values.push(requireUser(request).id); }
      if (params.get("university")) { clauses.push("l.university=?"); values.push(university(params.get("university"))); }
      if (params.get("arrival")) { const arrival = date(params.get("arrival")); clauses.push("l.availableFrom<=? AND l.availableUntil>=?"); values.push(arrival, arrival); }
      if (params.get("available") === "true") clauses.push("l.status='available'");
      if (params.get("q")) { clauses.push("instr(lower(l.title),lower(?))>0"); values.push(text(params.get("q"), "Search", 100)); }
      if (params.get("categories")) {
        const selected = params.get("categories")!.split(",");
        if (selected.length > categories.length || !selected.every(value => categories.includes(value as typeof categories[number]))) throw new HttpError(400, "Invalid category.");
        clauses.push(`l.category IN (${selected.map(() => "?").join(",")})`); values.push(...selected);
      }
      const rows = db().prepare(`${listingSelect}${clauses.length ? ` WHERE ${clauses.join(" AND ")}` : ""} ORDER BY l.id DESC LIMIT 200`).all(...values);
      return json({ listings: rows });
    }
    if (route === "listings" && method === "POST") {
      const user = requireUser(request); limit(`post:${user.id}`, 30, 3600000);
      const data = listingInput(await body(request));
      const result = db().prepare(`INSERT INTO listings(sellerId,title,description,university,category,priceCents,condition,availableFrom,availableUntil,illustration)
        VALUES(?,?,?,?,?,?,?,?,?,?)`).run(user.id, data.title, data.description, data.university, data.category, data.priceCents, data.condition, data.availableFrom, data.availableUntil, data.illustration);
      return json({ listing: getListing(Number(result.lastInsertRowid)) }, 201);
    }
    if (parts[0] === "listings" && parts.length === 2 && /^\d+$/.test(parts[1])) {
      const id = Number(parts[1]);
      const listing = getListing(id);
      if (!listing) throw new HttpError(404, "Item not found.");
      if (method === "GET") return json({ listing });
      if (method === "PATCH") {
        const user = requireUser(request);
        if (listing.sellerId !== user.id) throw new HttpError(403, "Only the seller can change this listing.");
        const data = await body(request);
        if (typeof data.status !== "string" || !["available", "reserved", "sold"].includes(data.status)) throw new HttpError(400, "Choose a valid status.");
        db().prepare("UPDATE listings SET status=? WHERE id=? AND sellerId=?").run(String(data.status), id, user.id);
        return json({ listing: getListing(id) });
      }
    }
    if (route === "conversations" && method === "GET") {
      const user = requireUser(request);
      return json({ conversations: db().prepare(`${conversationSelect} WHERE c.buyerId=? OR l.sellerId=? ORDER BY c.id DESC`).all(user.id, user.id) });
    }
    if (route === "conversations" && method === "POST") {
      const user = requireUser(request); limit(`conversation:${user.id}`, 60, 3600000);
      const data = await body(request);
      if (!Number.isSafeInteger(data.listingId)) throw new HttpError(400, "Choose an item.");
      const listing = getListing(Number(data.listingId));
      if (!listing) throw new HttpError(404, "Item not found.");
      if (listing.sellerId === user.id) throw new HttpError(400, "This is your listing. Open Messages to reply to interested buyers.");
      const existing = db().prepare("SELECT id FROM conversations WHERE listingId=? AND buyerId=?").get(listing.id, user.id) as { id: number } | undefined;
      if (existing) return json({ conversation: conversation(existing.id, user.id) });
      if (listing.status !== "available") throw new HttpError(409, "This item is no longer available. Existing conversations remain open.");
      db().prepare("INSERT OR IGNORE INTO conversations(listingId,buyerId) VALUES(?,?)").run(listing.id, user.id);
      const row = db().prepare("SELECT id FROM conversations WHERE listingId=? AND buyerId=?").get(listing.id, user.id) as { id: number };
      return json({ conversation: conversation(row.id, user.id) }, 201);
    }
    if (parts[0] === "conversations" && /^\d+$/.test(parts[1] ?? "") && parts[2] === "messages" && parts.length === 3) {
      const user = requireUser(request);
      const thread = conversation(Number(parts[1]), user.id);
      if (method === "GET") {
        return json({ conversation: thread, messages: db().prepare(`SELECT m.id,m.conversationId,m.senderId,m.text,m.createdAt,u.name AS senderName
          FROM messages m JOIN users u ON u.id=m.senderId WHERE m.conversationId=? ORDER BY m.id`).all(thread.id) });
      }
      if (method === "POST") {
        limit(`message:${user.id}`, 60, 60000);
        const data = await body(request);
        const content = text(data.text, "Message", 2000);
        const result = db().prepare("INSERT INTO messages(conversationId,senderId,text,createdAt) VALUES(?,?,?,?)")
          .run(thread.id, user.id, content, new Date().toISOString());
        return json({ id: Number(result.lastInsertRowid) }, 201);
      }
    }
    throw new HttpError(404, "Endpoint not found.");
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status);
    console.error("Handoff API error", error);
    return json({ error: "The server could not complete this request. Please try again." }, 500);
  }
}

export { handle as GET, handle as POST, handle as PATCH };
