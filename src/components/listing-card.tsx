import { ListingActions } from "./listing-actions";
import { formatDate, type Listing } from "@/lib/listings";
import { ItemArt } from "./item-art";

export function ListingCard({ listing, onChange }: { listing: Listing; onChange?: () => void }) {
  return <article className="listing-card flex h-full flex-col overflow-hidden rounded-2xl border border-ink/10 bg-white/60">
    <div className="relative aspect-[5/4]" style={{ backgroundColor: listing.color }}>
      <ItemArt kind={listing.illustration} className="h-full w-full" />
      {/* Only unusual states earn a badge; "Available" on every card is noise. */}
      {listing.status !== "available" && <span className="absolute left-4 top-4 rounded-full bg-cream/90 px-3 py-1 text-xs font-medium text-ink">
        {listing.status === "sold" ? "Sold" : "Reserved"}
      </span>}
    </div>
    <div className="flex flex-1 flex-col p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="display-sm min-w-0 break-words">{listing.title}</h3>
        <span className="display-sm shrink-0 tabular-nums text-forest">
          {listing.price === 0 ? "Free" : `$${listing.price}`}
        </span>
      </div>
      <p className="label mt-2">
        {listing.category}<span className="mx-2 text-ink/20">/</span>{listing.condition}
      </p>
      {listing.description && <p className="mt-3 line-clamp-2 break-words text-sm leading-6 text-muted">{listing.description}</p>}
      <div className="rule mt-auto pt-4">
        <p className="label">{formatDate(listing.availableFrom)} – {formatDate(listing.availableUntil)}</p>
        {listing.sellerName && <p className="label mt-1">Passed on by {listing.sellerName}</p>}
        <ListingActions listing={listing} onChange={onChange} />
      </div>
    </div>
  </article>;
}
