import type { Listing } from "../listings";
import { row, rows } from "./db";

export const listingSelect = `SELECT l.id,l."sellerId",l.title,l.description,l.university,l.category,
  l."priceCents" / 100.0 AS price,l.condition,l."availableFrom",l."availableUntil",l.status,l.illustration,l.color,
  CASE WHEN l."imageData" IS NULL THEN 0 ELSE 1 END AS "hasImage",
  u.name AS "sellerName" FROM listings l JOIN users u ON u.id=l."sellerId"`;

export function getListing(id: number) {
  return row<Listing>(`${listingSelect} WHERE l.id=$1`, id);
}

export function recentListings() {
  return rows<Listing>(`${listingSelect} WHERE l.status='available' ORDER BY l.id DESC LIMIT 3`);
}
