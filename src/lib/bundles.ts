import { categories, type Category } from "./listings";
import { UNIVERSITY } from "./universities";

export type BundleItem = { name: string; quantity: number; condition: "Like new" | "Good" | "Fair" | "Used"; category: Category };
export type Bundle = {
  id: string; name: string; description: string; items: BundleItem[];
  priceCents: number; retailCents: number; availableFrom: string; availableUntil: string;
  university: string; sellerName: string; sellerId: number | null;
  status: "available" | "reserved"; claimedByMe: boolean; demo: boolean;
};

const item = (name: string, quantity: number, condition: BundleItem["condition"], category: Category): BundleItem => ({ name, quantity, condition, category });

export const demoBundles: Bundle[] = [
  {
    id: "demo-kitchen", name: "Kitchen Starter Bundle", description: "Everything for the first meals in your new place.",
    items: [item("Plates", 4, "Good", "Kitchen"), item("Bowls", 4, "Good", "Kitchen"), item("Cups", 4, "Good", "Kitchen"), item("Frying Pan", 1, "Good", "Kitchen"), item("Cooking Pot", 1, "Fair", "Kitchen"), item("Utensil Set", 1, "Good", "Kitchen")],
    priceCents: 3500, retailCents: 12000, availableFrom: "2026-12-10", availableUntil: "2026-12-17",
    university: UNIVERSITY, sellerName: "Maya R.", sellerId: null, status: "available", claimedByMe: false, demo: true,
  },
  {
    id: "demo-bedroom", name: "Bedroom Starter Bundle", description: "Make a dorm room feel like yours from day one.",
    items: [item("Bed Sheets", 1, "Good", "Bedroom"), item("Pillows", 2, "Good", "Bedroom"), item("Desk Lamp", 1, "Like new", "Bedroom"), item("Hangers", 12, "Good", "Bedroom"), item("Storage Bins", 2, "Good", "Bedroom")],
    priceCents: 4500, retailCents: 17500, availableFrom: "2026-12-15", availableUntil: "2027-01-03",
    university: UNIVERSITY, sellerName: "Jordan T.", sellerId: null, status: "available", claimedByMe: false, demo: true,
  },
  {
    id: "demo-winter", name: "Winter Starter Bundle", description: "Warm layers ready for a Missouri winter.",
    items: [item("Winter Coat", 1, "Good", "Winter"), item("Gloves", 1, "Good", "Winter"), item("Scarf", 1, "Like new", "Winter"), item("Winter Boots", 1, "Good", "Winter"), item("Thermal Blanket", 1, "Good", "Winter")],
    priceCents: 3000, retailCents: 14000, availableFrom: "2026-12-01", availableUntil: "2026-12-16",
    university: UNIVERSITY, sellerName: "Priya S.", sellerId: null, status: "available", claimedByMe: false, demo: true,
  },
  {
    id: "demo-essentials", name: "Move-in Essentials Bundle", description: "The big everyday items, passed on together.",
    items: [item("Mini Fridge", 1, "Good", "Electronics"), item("Microwave", 1, "Good", "Kitchen"), item("Desk Lamp", 1, "Good", "School"), item("Electric Kettle", 1, "Good", "Kitchen"), item("Storage Bins", 2, "Good", "Bedroom"), item("Bed Sheets", 1, "Good", "Bedroom")],
    priceCents: 6000, retailCents: 23000, availableFrom: "2026-12-17", availableUntil: "2027-01-08",
    university: UNIVERSITY, sellerName: "Alex C.", sellerId: null, status: "available", claimedByMe: false, demo: true,
  },
  {
    id: "demo-study", name: "Study Setup Bundle", description: "A ready-to-go corner for the next semester.",
    items: [item("Desk Lamp", 1, "Good", "School"), item("Monitor Stand", 1, "Good", "Electronics"), item("Whiteboard", 1, "Good", "School"), item("Notebook Set", 3, "Like new", "School"), item("Desk Organizer", 1, "Good", "School")],
    priceCents: 2500, retailCents: 9500, availableFrom: "2026-12-10", availableUntil: "2027-01-15",
    university: UNIVERSITY, sellerName: "Samir K.", sellerId: null, status: "available", claimedByMe: false, demo: true,
  },
];

export const bundleSavings = (bundle: Bundle) => Math.max(0, bundle.retailCents - bundle.priceCents);
export const bundleItemName = (entry: BundleItem) => `${entry.quantity > 1 ? `${entry.quantity} ` : ""}${entry.name}`;

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function moveInNeeds(rawNeeds: string | null, rawCategories: string | null) {
  const specific = (rawNeeds ?? "").split(",").map(value => value.trim()).filter(Boolean).slice(0, 8);
  const selectedCategories = (rawCategories ?? "").split(",").filter(value => categories.includes(value as Category));
  return [...new Map([...specific, ...selectedCategories].map(value => [normalize(value), value])).values()].filter(Boolean).slice(0, 12);
}

export function bundleMatch(bundle: Bundle, needs: string[]) {
  if (!needs.length) return { matched: 0, total: 0, percent: null as number | null };
  const matched = needs.filter(need => {
    const normalized = normalize(need);
    const broad = categories.find(category => normalized.includes(category.toLowerCase())) as Category | undefined;
    return bundle.items.some(entry => broad ? entry.category === broad : ` ${normalize(entry.name)} `.includes(` ${normalized} `));
  }).length;
  return { matched, total: needs.length, percent: Math.round(matched * 100 / needs.length) };
}

export function bundleTiming(bundle: Bundle, arrival: string | null) {
  if (!arrival || !/^\d{4}-\d{2}-\d{2}$/.test(arrival) || Number.isNaN(Date.parse(`${arrival}T00:00:00Z`))) {
    return { label: "Add your arrival date", rank: 0, matches: false };
  }
  const day = (value: string) => Date.parse(`${value}T00:00:00Z`) / 86400000;
  const arriving = day(arrival), from = day(bundle.availableFrom), until = day(bundle.availableUntil);
  if (arriving >= from && arriving <= until) {
    return arriving - from <= 2
      ? { label: "Perfect Timing", rank: 4, matches: true }
      : { label: "Available when you arrive", rank: 3, matches: true };
  }
  if (arriving > until && arriving - until <= 3) {
    const days = arriving - until;
    return { label: `Available ${days} day${days === 1 ? "" : "s"} before your arrival`, rank: 2, matches: false };
  }
  return { label: "Timing conflict", rank: 0, matches: false };
}
