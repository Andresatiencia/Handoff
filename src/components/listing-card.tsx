import Image from "next/image";
import Link from "next/link";
import { ListingActions } from "./listing-actions";
import { formatDate, formatPrice, type Listing } from "@/lib/listings";

export function ListingCard({ listing, onChange }: { listing: Listing; onChange?: () => void }) {
  return <article className="listing-card">
    <div className="listing-photo">
      <Link href={`/listings/${listing.id}`} aria-label={`View ${listing.title}`} className="block">
      {listing.hasImage
        ? <Image unoptimized src={`/api/listings/${listing.id}/image`} alt={listing.title} width={600} height={420} />
        : <div className="listing-photo-empty" role="img" aria-label={`No photo supplied for ${listing.title}`}><span>Handoff</span><strong>{listing.category}</strong><small>Photo not added</small></div>}
      </Link>
      <span className="listing-status">
        <span aria-hidden="true">{listing.status === "available" ? "● " : "◷ "}</span>{listing.status === "available" ? "Available" : listing.status === "sold" ? "Sold" : "Reserved"}
      </span>
    </div>
    <div className="listing-body">
      <div className="mb-3 flex items-start justify-between gap-3"><h3 className="min-w-0 break-words font-semibold"><Link href={`/listings/${listing.id}`} className="hover:text-forest hover:underline">{listing.title}</Link></h3><span className="listing-price">{formatPrice(listing.price)}</span></div>
      <div className="mb-5 flex items-center gap-2 text-xs"><span className="rounded-md bg-sand px-2 py-1 text-forest">{listing.category}</span><span className="text-muted">{listing.condition}</span></div>
      {listing.description && <p className="mb-3 line-clamp-2 break-words text-sm text-muted">{listing.description}</p>}
      {listing.sellerName && <p className="mb-3 break-words text-xs text-muted">Passed on by {listing.sellerName}</p>}
      <p className="availability"><span>Pickup window</span>{formatDate(listing.availableFrom)} – {formatDate(listing.availableUntil)}</p>
      <Link href={`/listings/${listing.id}`} className="text-link mt-4">View listing</Link>
      <ListingActions listing={listing} onChange={onChange} />
    </div>
  </article>;
}
