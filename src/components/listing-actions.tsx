"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Listing } from "@/lib/listings";
import type { Conversation } from "@/lib/contracts";
import { api } from "@/lib/api-client";
import { useAuth } from "./auth-provider";

export function ListingActions({ listing, onChange }: { listing: Listing; onChange?: () => void }) {
  const { user } = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  async function contact() {
    setBusy(true); setError("");
    try {
      const result = await api<{ conversation: Conversation }>("conversations", { method: "POST", body: JSON.stringify({ listingId: listing.id }) });
      router.push(`/messages?conversation=${result.conversation.id}`);
    } catch (error) { setError(error instanceof Error ? error.message : "Could not start conversation."); }
    finally { setBusy(false); }
  }
  async function status(value: string) {
    setBusy(true); setError(""); setNotice("");
    try { await api(`listings/${listing.id}`, { method: "PATCH", body: JSON.stringify({ status: value }) }); setNotice("Listing status updated."); onChange?.(); router.refresh(); }
    catch (error) { setError(error instanceof Error ? error.message : "Could not update item."); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!window.confirm("Delete this listing? Its photo and all related conversations and messages will also be deleted. This cannot be undone.")) return;
    setBusy(true); setError("");
    try { await api(`listings/${listing.id}`, { method: "DELETE" }); onChange?.(); router.refresh(); }
    catch (error) { setError(error instanceof Error ? error.message : "Could not delete item."); }
    finally { setBusy(false); }
  }
  if (user?.emailVerificationRequired && user.id !== listing.sellerId) return <div className="mt-4"><Link className="button-secondary w-full" href="/account">Verify email to message</Link></div>;
  return <div className="mt-4">
    {user?.id === listing.sellerId ? <div><label className="block text-xs font-semibold">Your listing status<select className="form-input mt-2" value={listing.status} disabled={busy} onChange={event => status(event.target.value)}><option value="available">Available</option><option value="reserved">Reserved</option><option value="sold">Sold / handed off</option></select></label><button type="button" disabled={busy} onClick={remove} className="mt-3 text-xs font-semibold text-red-700 underline-offset-2 hover:underline disabled:opacity-50">Delete listing</button></div> : !user ? <Link className="button-secondary w-full" href={`/account?next=${encodeURIComponent(`/messages?item=${listing.id}`)}`}>Sign in to message</Link> : <button disabled={busy || listing.status !== "available"} className="button-secondary w-full disabled:cursor-not-allowed disabled:opacity-50" onClick={contact}>{busy ? "Opening…" : listing.status === "available" ? "Message seller" : "Currently unavailable"}</button>}
    {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
    {notice && <p role="status" className="mt-2 text-xs text-muted">{notice}</p>}
  </div>;
}
