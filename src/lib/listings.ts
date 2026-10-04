export const categories = ["Kitchen", "Bedroom", "Winter", "School", "Electronics", "Furniture"] as const;
export type Category = (typeof categories)[number];
export type Listing = {
  id: number; title: string; category: Category; price: number;
  condition: "Like new" | "Good" | "Used"; availableFrom: string;
  availableUntil: string; status: "available" | "reserved" | "sold";
  illustration: "fridge" | "coat" | "kitchen" | "lamp" | "microwave" | "chair" | "books" | "bedding";
  color: string;
  sellerName?: string;
  university?: string;
  description?: string;
  sellerId?: number;
};
export function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}
