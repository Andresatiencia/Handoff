import Link from "next/link";
import { bundleItemName, bundleMatch, bundleSavings, bundleTiming, type Bundle } from "@/lib/bundles";
import { formatDate, formatPrice } from "@/lib/listings";

export function BundleCard({ bundle, arrival, needs, href }: { bundle: Bundle; arrival: string | null; needs: string[]; href: string }) {
  const match = bundleMatch(bundle, needs);
  const timing = bundleTiming(bundle, arrival);
  return <article className="bundle-card">
    <div className="bundle-summary">
      <div className="flex items-start justify-between gap-3"><span className="rounded-full bg-white/85 px-3 py-1 text-xs font-semibold text-forest">{bundle.demo ? "Demo bundle" : "Move-in kit"} · {bundle.items.length} items</span><span className={`rounded-full px-3 py-1 text-xs font-semibold ${bundle.status === "reserved" ? "bg-sand text-amber" : "bg-forest text-white"}`}>{bundle.status === "reserved" ? "Reserved" : "Available"}</span></div>
      <h3 className="mt-5 text-2xl font-semibold tracking-tight">{bundle.name}</h3>
      <p className="mt-2 text-sm text-muted">{bundle.description}</p>
      <div className="mt-5 flex flex-wrap gap-2">{bundle.items.slice(0, 3).map((item, index) => <span key={`${item.name}-${index}`} className="rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-ink">{bundleItemName(item)}</span>)}{bundle.items.length > 3 && <span className="rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-forest">+{bundle.items.length - 3} more</span>}</div>
    </div>
    <div className="bundle-details">
      <div className="bundle-facts">
        <div className="min-w-0"><p className="text-2xl font-bold text-forest">{match.percent === null ? "—" : `${match.percent}%`}</p><p className="text-xs font-semibold">{match.percent === null ? "Set your needs" : "Needs match"}</p><p className="mt-1 text-xs text-muted">{match.total ? `Matches ${match.matched} of your ${match.total} needs` : "Choose needs to see your match"}</p></div>
        <div className="min-w-0"><p className="text-sm font-bold text-amber">{timing.label}</p><p className="mt-2 text-xs text-muted">{arrival ? `For ${formatDate(arrival)}` : "Add your arrival date"}</p></div>
      </div>
      <div className="mt-5 flex items-end justify-between gap-3"><div><p className="text-xs text-muted">Bundle price</p><p className="text-3xl font-bold tracking-tight">{formatPrice(bundle.priceCents / 100)}</p></div><div className="text-right"><p className="text-xs text-muted">Estimated new: {formatPrice(bundle.retailCents / 100)}</p><p className="mt-1 text-sm font-bold text-forest">Save {formatPrice(bundleSavings(bundle) / 100)}</p></div></div>
      <p className="mt-5 border-t border-ink/10 pt-4 text-xs leading-5 text-muted">Passed on by {bundle.sellerName} · {formatDate(bundle.availableFrom)} – {formatDate(bundle.availableUntil)}{bundle.demo && " · Demo bundle"}</p>
      <Link href={href} className="button-secondary mt-5 w-full">View bundle →</Link>
    </div>
  </article>;
}
