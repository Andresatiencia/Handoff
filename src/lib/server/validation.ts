import { categories, type Category, type Listing } from "../listings";
import { UNIVERSITY } from "../universities";

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function text(value: unknown, label: string, max: number) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) {
    throw new HttpError(400, `${label} is required and must be at most ${max} characters.`);
  }
  return value.trim();
}

export function date(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)
    || value < "2020-01-01" || value > "2100-12-31"
    || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) {
    throw new HttpError(400, "Choose a valid date between 2020 and 2100.");
  }
  return value;
}

export function university(value: unknown) {
  if (value !== UNIVERSITY) throw new HttpError(400, "Choose University of Central Missouri.");
  return UNIVERSITY;
}

export function listingInput(data: Record<string, unknown>) {
  const title = text(data.title, "Title", 80);
  const description = text(data.description, "Description", 1500);
  const campus = university(data.university);
  const category = data.category as Category;
  if (!categories.includes(category)) throw new HttpError(400, "Choose a valid category.");
  if (typeof data.condition !== "string" || !["Good", "Like new", "Used"].includes(data.condition)) throw new HttpError(400, "Choose a valid condition.");
  if (typeof data.price !== "number" || !Number.isFinite(data.price) || data.price < 0 || data.price > 100000
    || Math.abs(data.price * 100 - Math.round(data.price * 100)) > 0.000001) {
    throw new HttpError(400, "Enter a price between $0 and $100,000 with at most two decimals.");
  }
  const availableFrom = date(data.availableFrom);
  const availableUntil = date(data.availableUntil);
  if (availableFrom > availableUntil) throw new HttpError(400, "Availability must end on or after its start date.");
  if (data.departure && availableUntil > date(data.departure)) throw new HttpError(400, "Availability must end by your leaving date.");
  const art: Record<Category, Listing["illustration"]> = {
    Kitchen: "kitchen", Bedroom: "bedding", Winter: "coat", School: "books", Electronics: "microwave", Furniture: "chair",
  };
  // A title that names the object beats its category default, so a mini fridge
  // and a microwave do not share one drawing just because both are Electronics.
  const named: [RegExp, Listing["illustration"]][] = [
    [/fridge|refrigerator/, "fridge"], [/microwave/, "microwave"], [/lamp/, "lamp"],
    [/chair|stool/, "chair"], [/coat|jacket|parka/, "coat"], [/book|textbook/, "books"],
    [/bedding|sheet|pillow|duvet|blanket|comforter|mattress/, "bedding"],
    [/pan|pot|dish|plate|mug|cutlery|kettle/, "kitchen"],
  ];
  const haystack = title.toLowerCase();
  const illustration = named.find(([pattern]) => pattern.test(haystack))?.[1] ?? art[category];
  // Each category gets its own muted ground so a grid of cards reads as a set
  // rather than one repeated tile.
  const tint: Record<Category, string> = {
    Kitchen: "#f2e7d5", Bedroom: "#e6ebe4", Winter: "#dfe7ec",
    School: "#ece6dc", Electronics: "#e3eaea", Furniture: "#eee4dc",
  };
  return { title, description, university: campus, category, condition: String(data.condition),
    priceCents: Math.round(data.price * 100), availableFrom, availableUntil, illustration, color: tint[category] };
}
