import type { Listing } from "../listings";
import { queryOne, queryAll } from "./db";

export const listingSelect = `SELECT l.id,l.sellerId,l.title,l.description,l.university,l.category,
  l.priceCents / 100.0 AS price,l.condition,l.availableFrom,l.availableUntil,l.status,l.illustration,l.color,
  u.name AS sellerName FROM listings l JOIN users u ON u.id=l.sellerId`;

export function getListing(id: number) {
  return queryOne<Listing>(`${listingSelect} WHERE l.id=?`, [id]);
}

export function recentListings() {
  return queryAll<Listing>(`${listingSelect} WHERE l.status='available' ORDER BY l.id DESC LIMIT 3`);
}
