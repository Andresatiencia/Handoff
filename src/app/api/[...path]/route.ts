import { NextRequest, NextResponse } from "next/server";
import { deleteListing, row, rows, StorageUnavailable } from "@/lib/server/db";
import { currentUser, requireUser, requireVerifiedUser, passwordHash, verifyPassword, startSession, endSession, limit } from "@/lib/server/auth";
import { consumeVerification, emailDeliveryMessage, issueVerification, verificationEnabled } from "@/lib/server/email-verification";
import { HttpError, text, date, university, listingInput, priceBound } from "@/lib/server/validation";
import { getListing, listingSelect } from "@/lib/server/listings";
import { bundleInput, getBundle, listBundles } from "@/lib/server/bundles";
import { categories } from "@/lib/listings";
import type { Conversation, User } from "@/lib/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
const conversationSelect = `SELECT c.id,c."listingId",c."buyerId",l."sellerId",l.title,l.status,
  b.name AS "buyerName",s.name AS "sellerName" FROM conversations c JOIN listings l ON l.id=c."listingId"
  JOIN users b ON b.id=c."buyerId" JOIN users s ON s.id=l."sellerId"`;

async function body(request: NextRequest, maxSize = 16384) {
  if (!request.headers.get("content-type")?.includes("application/json")) throw new HttpError(415, "Send JSON data.");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "Missing request body.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxSize) { await reader.cancel(); throw new HttpError(413, "Request is too large."); }
    chunks.push(value);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    if (size > 16384 && !("image" in value)) throw new HttpError(413, "Request is too large.");
    return value as Record<string, unknown>;
  } catch (error) { if (error instanceof HttpError) throw error; throw new HttpError(400, "Invalid JSON data."); }
}

async function conversation(id: number, userId: number) {
  const item = await row<Conversation>(`${conversationSelect} WHERE c.id=$1 AND (c."buyerId"=$2 OR l."sellerId"=$3)`, id, userId, userId);
  if (!item) throw new HttpError(404, "Conversation not found.");
  return item;
}

function imageInput(value: unknown) {
  if (value === undefined || value === null) return { data: null, mime: null };
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new HttpError(400, "Choose a valid product photo.");
  const image = value as Record<string, unknown>;
  if (typeof image.data !== "string" || typeof image.mime !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(image.data)) {
    throw new HttpError(400, "Choose a JPEG, PNG, or WebP photo.");
  }
  const bytes = Buffer.from(image.data, "base64");
  if (!bytes.length || bytes.length > 750_000 || bytes.toString("base64") !== image.data) throw new HttpError(400, "Photo must be 750 KB or smaller.");
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const webp = bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  if (!((image.mime === "image/jpeg" && jpeg) || (image.mime === "image/png" && png) || (image.mime === "image/webp" && webp))) {
    throw new HttpError(400, "Choose a JPEG, PNG, or WebP photo.");
  }
  return { data: image.data, mime: image.mime };
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
    if (route === "auth/me" && method === "GET") return json({ user: await currentUser(request) });
    if (route === "auth/logout" && method === "POST") {
      const response = json({ ok: true }); await endSession(request, response); return response;
    }
    if (route === "auth/resend-verification" && method === "POST") {
      const user = await requireUser(request);
      if (!user.emailVerificationRequired) return json({ sent: false, alreadyVerified: true });
      if (!verificationEnabled()) throw new HttpError(503, "Email delivery is not configured yet. Please try again later.");
      await limit(`verify-email:${user.id}`, 3, 3600000);
      try { await issueVerification(user.id, user.email, process.env.APP_ORIGIN ?? request.nextUrl.origin); }
      catch (error) { throw new HttpError(503, emailDeliveryMessage(error)); }
      return json({ sent: true });
    }
    if (route === "auth/verify-email" && method === "POST") {
      const data = await body(request);
      if (typeof data.token !== "string" || !await consumeVerification(data.token)) throw new HttpError(400, "This verification link is invalid or expired. Request a new one from your account.");
      return json({ verified: true });
    }
    if (["auth/register", "auth/login"].includes(route) && method === "POST") {
      // Global cap cannot be bypassed by spoofing proxy headers; per-email cap protects individual accounts.
      await limit("auth:global", 300);
      const data = await body(request);
      const email = text(data.email, "Email", 254).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "Enter a valid email address.");
      await limit(`auth:${email}`, 20);
      if (typeof data.password !== "string" || data.password.length < 12 || data.password.length > 128) {
        throw new HttpError(400, "Use a password between 12 and 128 characters.");
      }
      let user: User;
      let emailSent: boolean | undefined;
      let emailError: string | undefined;
      if (route === "auth/register") {
        const name = text(data.name, "Name", 60);
        const campus = university(data.university);
        const hash = await passwordHash(data.password);
        try {
          const required = verificationEnabled();
          const result = await row<{ id: number }>("INSERT INTO users(name,email,\"passwordHash\",university,\"emailVerifiedAt\") VALUES($1,$2,$3,$4,$5) RETURNING id", name, email, hash, campus, required ? null : "legacy");
          user = { id: Number(result!.id), name, email, university: campus, emailVerified: false, emailVerificationRequired: required };
          if (required) {
            try { await issueVerification(user.id, email, process.env.APP_ORIGIN ?? request.nextUrl.origin); emailSent = true; }
            catch (error) { emailSent = false; emailError = emailDeliveryMessage(error); }
          }
        } catch (error) {
          if (String(error).toLowerCase().includes("unique") || (error as { code?: string }).code === "23505") throw new HttpError(409, "An account with this email already exists. Sign in instead.");
          throw error;
        }
      } else {
        const account = await row<User & { passwordHash: string; emailVerifiedAt: string | null }>("SELECT * FROM users WHERE email=$1", email);
        // Perform the same password work for unknown addresses.
        const fallback = `00000000000000000000000000000000:${"00".repeat(64)}`;
        const valid = await verifyPassword(data.password, account?.passwordHash ?? fallback);
        if (!account || !valid) throw new HttpError(401, "Email or password is incorrect.");
        user = { id: account.id, name: account.name, email: account.email, university: account.university,
          emailVerified: Boolean(account.emailVerifiedAt && account.emailVerifiedAt !== "legacy"), emailVerificationRequired: account.emailVerifiedAt === null };
      }
      const response = json({ user, emailSent, emailError }, route === "auth/register" ? 201 : 200);
      await startSession(request, response, user.id); return response;
    }
    if (route === "bundles" && method === "GET") {
      return json({ bundles: await listBundles((await currentUser(request))?.id ?? null) });
    }
    if (route === "bundles" && method === "POST") {
      const user = await requireVerifiedUser(request); await limit(`bundle:${user.id}`, 30, 3600000);
      const data = bundleInput(await body(request));
      const created = await row<{ id: number }>(`INSERT INTO bundles("sellerId",name,description,"itemsJson","priceCents","retailCents","availableFrom","availableUntil",university)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`, user.id, data.name, data.description, JSON.stringify(data.items), data.priceCents, data.retailCents, data.availableFrom, data.availableUntil, data.university);
      return json({ bundle: await getBundle(`bundle-${created!.id}`, user.id) }, 201);
    }
    if (parts[0] === "bundles" && parts.length === 2 && method === "GET") {
      const bundle = await getBundle(parts[1], (await currentUser(request))?.id ?? null);
      if (!bundle) throw new HttpError(404, "Bundle not found.");
      return json({ bundle });
    }
    if (parts[0] === "bundles" && parts.length === 3 && parts[2] === "claim" && method === "POST") {
      const user = await requireVerifiedUser(request); await limit(`claim:${user.id}`, 60, 3600000);
      const bundle = await getBundle(parts[1], user.id);
      if (!bundle) throw new HttpError(404, "Bundle not found.");
      if (bundle.sellerId === user.id) throw new HttpError(400, "You cannot claim your own bundle.");
      const claimKey = bundle.demo ? `${bundle.id}:${user.id}` : bundle.id;
      const created = await row<{ bundleId: string }>(`INSERT INTO bundle_claims("bundleId","buyerId","claimedAt")
        VALUES($1,$2,$3) ON CONFLICT("bundleId") DO NOTHING RETURNING "bundleId"`, claimKey, user.id, new Date().toISOString());
      const updated = await getBundle(bundle.id, user.id);
      if (!created && !updated?.claimedByMe) throw new HttpError(409, "This bundle has already been reserved.");
      return json({ bundle: updated }, created ? 201 : 200);
    }
    if (route === "listings" && method === "GET") {
      const params = request.nextUrl.searchParams;
      const clauses: string[] = [];
      const values: (string | number)[] = [];
      if (params.get("mine") === "true") { clauses.push(`l."sellerId"=$${values.length + 1}`); values.push((await requireUser(request)).id); }
      if (params.get("university")) { clauses.push(`l.university=$${values.length + 1}`); values.push(university(params.get("university"))); }
      if (params.get("arrival")) { const arrival = date(params.get("arrival")); clauses.push(`l."availableFrom"<=$${values.length + 1} AND l."availableUntil">=$${values.length + 2}`); values.push(arrival, arrival); }
      const minimum = params.get("minPrice");
      const maximum = params.get("maxPrice");
      const minimumCents = minimum === null ? null : priceBound(minimum, "Minimum price");
      const maximumCents = maximum === null ? null : priceBound(maximum, "Maximum price");
      if (minimumCents !== null && maximumCents !== null && minimumCents > maximumCents) throw new HttpError(400, "Minimum price cannot exceed maximum price.");
      if (minimumCents !== null) { clauses.push(`l."priceCents">=$${values.length + 1}`); values.push(minimumCents); }
      if (maximumCents !== null) { clauses.push(`l."priceCents"<=$${values.length + 1}`); values.push(maximumCents); }
      if (params.get("available") === "true") clauses.push("l.status='available'");
      if (params.get("q")) { clauses.push(`lower(l.title) LIKE $${values.length + 1} ESCAPE '\\'`); values.push(`%${text(params.get("q"), "Search", 100).toLowerCase().replace(/[\\%_]/g, "\\$&")}%`); }
      if (params.get("categories")) {
        const selected = params.get("categories")!.split(",");
        if (selected.length > categories.length || !selected.every(value => categories.includes(value as typeof categories[number]))) throw new HttpError(400, "Invalid category.");
        clauses.push(`l.category IN (${selected.map((_, index) => `$${values.length + index + 1}`).join(",")})`); values.push(...selected);
      }
      const listings = await rows(`${listingSelect}${clauses.length ? ` WHERE ${clauses.join(" AND ")}` : ""} ORDER BY l.id DESC LIMIT 200`, ...values);
      return json({ listings });
    }
    if (route === "listings" && method === "POST") {
      const user = await requireVerifiedUser(request); await limit(`post:${user.id}`, 30, 3600000);
      const input = await body(request, 1_100_000);
      const data = listingInput(input);
      const image = imageInput(input.image);
      const result = await row<{ id: number }>(`INSERT INTO listings("sellerId",title,description,university,category,"priceCents",condition,"availableFrom","availableUntil",illustration,color,"imageData","imageMime")
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`, user.id, data.title, data.description, data.university, data.category, data.priceCents, data.condition, data.availableFrom, data.availableUntil, data.illustration, data.color, image.data, image.mime);
      return json({ listing: await getListing(Number(result!.id)) }, 201);
    }
    if (parts[0] === "listings" && parts.length === 3 && /^\d+$/.test(parts[1]) && parts[2] === "image" && method === "GET") {
      const image = await row<{ imageData: string | null; imageMime: string | null }>(`SELECT "imageData","imageMime" FROM listings WHERE id=$1`, Number(parts[1]));
      if (!image?.imageData || !image.imageMime) throw new HttpError(404, "Photo not found.");
      return new NextResponse(Buffer.from(image.imageData, "base64"), {
        headers: { "Content-Type": image.imageMime, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
      });
    }
    if (parts[0] === "listings" && parts.length === 2 && /^\d+$/.test(parts[1])) {
      const id = Number(parts[1]);
      const listing = await getListing(id);
      if (!listing) throw new HttpError(404, "Item not found.");
      if (method === "GET") return json({ listing });
      if (method === "DELETE") {
        const user = await requireUser(request);
        if (listing.sellerId !== user.id) throw new HttpError(403, "Only the seller can delete this listing.");
        if (!await deleteListing(id, user.id)) throw new HttpError(404, "Item not found.");
        return json({ ok: true });
      }
      if (method === "PATCH") {
        const user = await requireUser(request);
        if (listing.sellerId !== user.id) throw new HttpError(403, "Only the seller can change this listing.");
        const data = await body(request);
        if (typeof data.status !== "string" || !["available", "reserved", "sold"].includes(data.status)) throw new HttpError(400, "Choose a valid status.");
        await rows("UPDATE listings SET status=$1 WHERE id=$2 AND \"sellerId\"=$3", String(data.status), id, user.id);
        return json({ listing: await getListing(id) });
      }
    }
    if (route === "conversations" && method === "GET") {
      const user = await requireUser(request);
      return json({ conversations: await rows(`${conversationSelect} WHERE c."buyerId"=$1 OR l."sellerId"=$2 ORDER BY c.id DESC`, user.id, user.id) });
    }
    if (route === "conversations" && method === "POST") {
      const user = await requireVerifiedUser(request); await limit(`conversation:${user.id}`, 60, 3600000);
      const data = await body(request);
      if (!Number.isSafeInteger(data.listingId)) throw new HttpError(400, "Choose an item.");
      const listing = await getListing(Number(data.listingId));
      if (!listing) throw new HttpError(404, "Item not found.");
      if (listing.sellerId === user.id) throw new HttpError(400, "This is your listing. Open Messages to reply to interested buyers.");
      const existing = await row<{ id: number }>(`SELECT id FROM conversations WHERE "listingId"=$1 AND "buyerId"=$2`, listing.id, user.id);
      if (existing) return json({ conversation: await conversation(existing.id, user.id) });
      if (listing.status !== "available") throw new HttpError(409, "This item is no longer available. Existing conversations remain open.");
      await rows(`INSERT INTO conversations("listingId","buyerId") VALUES($1,$2) ON CONFLICT("listingId","buyerId") DO NOTHING`, listing.id, user.id);
      const created = await row<{ id: number }>(`SELECT id FROM conversations WHERE "listingId"=$1 AND "buyerId"=$2`, listing.id, user.id);
      return json({ conversation: await conversation(created!.id, user.id) }, 201);
    }
    if (parts[0] === "conversations" && /^\d+$/.test(parts[1] ?? "") && parts[2] === "messages" && parts.length === 3) {
      const user = await requireUser(request);
      const thread = await conversation(Number(parts[1]), user.id);
      if (method === "GET") {
        return json({ conversation: thread, messages: await rows(`SELECT m.id,m."conversationId",m."senderId",m.text,m."createdAt",u.name AS "senderName"
          FROM messages m JOIN users u ON u.id=m."senderId" WHERE m."conversationId"=$1 ORDER BY m.id`, thread.id) });
      }
      if (method === "POST") {
        await requireVerifiedUser(request);
        await limit(`message:${user.id}`, 60, 60000);
        const data = await body(request);
        const content = text(data.text, "Message", 2000);
        const result = await row<{ id: number }>(`INSERT INTO messages("conversationId","senderId",text,"createdAt") VALUES($1,$2,$3,$4) RETURNING id`, thread.id, user.id, content, new Date().toISOString());
        return json({ id: Number(result!.id) }, 201);
      }
    }
    throw new HttpError(404, "Endpoint not found.");
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status);
    if (error instanceof StorageUnavailable) return json({ error: error.message }, 503);
    console.error("Handoff API error", error);
    return json({ error: "The server could not complete this request. Please try again." }, 500);
  }
}

export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
