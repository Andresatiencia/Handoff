import { categories, type Category } from "../listings";
import { demoBundles, type Bundle, type BundleItem } from "../bundles";
import { row, rows } from "./db";
import { date, HttpError, text, university } from "./validation";

type StoredBundle = { id: number; sellerId: number; sellerName: string; name: string; description: string; itemsJson: string; priceCents: number; retailCents: number; availableFrom: string; availableUntil: string; university: string };
type Claim = { bundleId: string; buyerId: number };

const select = `SELECT b.id,b."sellerId",u.name AS "sellerName",b.name,b.description,b."itemsJson",b."priceCents",b."retailCents",b."availableFrom",b."availableUntil",b.university FROM bundles b JOIN users u ON u.id=b."sellerId"`;

function withClaim(bundle: Bundle, claim: Claim | undefined, userId: number | null): Bundle {
  return { ...bundle, status: claim ? "reserved" : "available", claimedByMe: Boolean(claim && claim.buyerId === userId) };
}

function storedBundle(bundle: StoredBundle): Bundle {
  return {
    id: `bundle-${bundle.id}`, name: bundle.name, description: bundle.description,
    items: JSON.parse(bundle.itemsJson) as BundleItem[], priceCents: bundle.priceCents,
    retailCents: bundle.retailCents, availableFrom: bundle.availableFrom,
    availableUntil: bundle.availableUntil, university: bundle.university,
    sellerName: bundle.sellerName, sellerId: bundle.sellerId,
    status: "available", claimedByMe: false, demo: false,
  };
}

export async function listBundles(userId: number | null) {
  const [stored, claims] = await Promise.all([
    rows<StoredBundle>(`${select} ORDER BY b.id DESC LIMIT 200`),
    rows<Claim>(`SELECT "bundleId","buyerId" FROM bundle_claims`),
  ]);
  const byId = new Map(claims.map(claim => [claim.bundleId, claim]));
  return [...stored.map(storedBundle), ...demoBundles].map(bundle => withClaim(bundle, byId.get(bundle.demo && userId ? `${bundle.id}:${userId}` : bundle.id), userId));
}

export async function getBundle(id: string, userId: number | null) {
  const demo = demoBundles.find(bundle => bundle.id === id);
  let bundle = demo;
  if (!bundle && /^bundle-[1-9]\d*$/.test(id)) {
    const stored = await row<StoredBundle>(`${select} WHERE b.id=$1`, Number(id.slice(7)));
    if (stored) bundle = storedBundle(stored);
  }
  if (!bundle) return undefined;
  const claim = await row<Claim>(`SELECT "bundleId","buyerId" FROM bundle_claims WHERE "bundleId"=$1`, bundle.demo && userId ? `${id}:${userId}` : id);
  return withClaim(bundle, claim, userId);
}

function cents(value: unknown, label: string) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100000
    || Math.abs(value * 100 - Math.round(value * 100)) > 0.000001) {
    throw new HttpError(400, `${label} must be between $0 and $100,000 with at most two decimals.`);
  }
  return Math.round(value * 100);
}

export function bundleInput(data: Record<string, unknown>) {
  const name = text(data.name, "Bundle name", 80);
  const description = text(data.description, "Description", 500);
  const campus = university(data.university);
  const availableFrom = date(data.availableFrom);
  const availableUntil = date(data.availableUntil);
  if (availableFrom > availableUntil) throw new HttpError(400, "Availability must end on or after its start date.");
  const priceCents = cents(data.price, "Bundle price");
  const retailCents = cents(data.estimatedRetail, "Estimated new cost");
  if (retailCents < priceCents) throw new HttpError(400, "Estimated new cost must be at least the bundle price.");
  if (!Array.isArray(data.items) || data.items.length < 2 || data.items.length > 12) throw new HttpError(400, "Add between 2 and 12 items.");
  const items: BundleItem[] = data.items.map(value => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new HttpError(400, "Enter valid bundle items.");
    const entry = value as Record<string, unknown>;
    const itemName = text(entry.name, "Item name", 80);
    if (!Number.isSafeInteger(entry.quantity) || Number(entry.quantity) < 1 || Number(entry.quantity) > 99) throw new HttpError(400, "Item quantity must be between 1 and 99.");
    if (!categories.includes(entry.category as Category)) throw new HttpError(400, "Choose a valid item category.");
    if (!(["Like new", "Good", "Fair", "Used"] as unknown[]).includes(entry.condition)) throw new HttpError(400, "Choose a valid item condition.");
    return { name: itemName, quantity: Number(entry.quantity), condition: entry.condition as BundleItem["condition"], category: entry.category as Category };
  });
  return { name, description, university: campus, availableFrom, availableUntil, priceCents, retailCents, items };
}
