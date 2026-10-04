"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Conversation, Message } from "@/lib/contracts";
import { api, useRemote } from "@/lib/api-client";
import { useAuth, AccountGate } from "./auth-provider";
import { UnreadBadge } from "./unread-badge";

export function Messages() {
  const params = useSearchParams();
  return <AccountGate next={`/messages?${params}`}><Inbox /></AccountGate>;
}

function Inbox() {
  const params = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const { data, error, refresh } = useRemote<{ conversations: Conversation[] }>("conversations", 3000);
  const item = params.get("item");
  const threadId = params.get("conversation");
  const [openError, setOpenError] = useState("");
  const [opening, setOpening] = useState(false);
  const [firstMessage, setFirstMessage] = useState("");
  async function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (opening || !firstMessage.trim()) return;
    setOpening(true); setOpenError("");
    try {
      const result = await api<{ conversation: Conversation }>("conversations", { method: "POST", body: JSON.stringify({ listingId: Number(item), text: firstMessage }) });
      refresh(); router.replace(`/messages?conversation=${result.conversation.id}`);
    } catch (error) { setOpenError(error instanceof Error ? error.message : "Could not open conversation."); }
    finally { setOpening(false); }
  }
  return <main className="page-width task-page py-10 sm:py-14">
    <Link href="/marketplace" className="nav-link">← Back to marketplace</Link>
    <h1 className="mt-6 text-4xl font-semibold tracking-tight">A good handoff starts with hello.</h1>
    <p className="mt-4 text-sm text-muted">Private conversations between you and another student. New messages appear automatically.</p>
    {error && <p role="alert" className="mt-4 text-red-700">{error} <button onClick={refresh} className="underline">Retry</button></p>}
    <div className="inbox-layout">
      <aside className="inbox-sidebar"><h2 className="mb-4 font-semibold">Conversations</h2>
        {data?.conversations.length ? <nav aria-label="Conversations" className="space-y-2">{data.conversations.map(thread => <Link href={`/messages?conversation=${thread.id}`} key={thread.id} aria-current={Number(threadId) === thread.id ? "page" : undefined} className={`block rounded-xl p-3 text-sm transition hover:bg-sand ${Number(threadId) === thread.id ? "bg-sand text-forest" : "text-muted"}`}><span className="flex items-start justify-between gap-2"><span className="break-words font-semibold">{thread.title}</span><UnreadBadge count={Number(thread.unreadCount)} /></span><span className="mt-1 block text-xs">{user?.id === thread.sellerId ? thread.buyerName : thread.sellerName}</span>{thread.unreadCount > 0 && <span className="sr-only">{thread.unreadCount} unread messages</span>}</Link>)}</nav> : <p className="text-sm leading-6 text-muted">{data ? "Choose Message seller on an item to start a conversation. Buyers who contact you appear here too." : "Loading conversations…"}</p>}
      </aside>
      {threadId ? <Thread key={`${user?.id}:${threadId}`} id={threadId} onRead={refresh} /> : <section className="empty-state"><h2 className="text-xl font-semibold">{item ? "Ready to ask about this item?" : "Your next handoff starts here."}</h2><p className="mt-3 text-sm text-muted">{item ? "Send a question to the seller to start the conversation." : "Select a conversation or contact a seller from the marketplace."}</p>{item ? <form onSubmit={start} className="mt-6 text-left"><label htmlFor="first-message" className="text-sm font-semibold">Your message</label><textarea id="first-message" value={firstMessage} onChange={event => setFirstMessage(event.target.value)} disabled={opening} required maxLength={2000} rows={4} className="form-input mt-2 resize-y" placeholder="Hi! Is this still available? I arrive on…" /><div className="mt-3 flex items-center justify-between gap-3"><span className="text-xs text-muted">{firstMessage.length}/2000</span><button type="submit" disabled={opening || !firstMessage.trim()} className="button-primary disabled:cursor-not-allowed disabled:opacity-50">{opening ? "Sending…" : "Send message"}</button></div></form> : <Link href="/marketplace" className="button-primary mt-6">Browse items</Link>}{openError && <p role="alert" className="mt-4 text-sm text-red-700">{openError}</p>}</section>}
    </div>
  </main>;
}

function Thread({ id, onRead }: { id: string; onRead: () => void }) {
  const { user } = useAuth();
  const { data, error, loading, refresh } = useRemote<{ conversation: Conversation; messages: Message[] }>(`conversations/${encodeURIComponent(id)}/messages`, 3000);
  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState("");
  const [busy, setBusy] = useState(false);
  const log = useRef<HTMLDivElement>(null);
  const lastMarked = useRef(0);
  useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight; }, [data?.messages.length]);
  const lastMessageId = data?.messages.at(-1)?.id ?? 0;
  useEffect(() => {
    if (!user || !data?.messages.some(message => message.senderId !== user.id)) return;
    const markVisibleMessages = async () => {
      if (document.visibilityState !== "visible" || lastMessageId <= lastMarked.current) return;
      lastMarked.current = lastMessageId;
      try {
        await api(`conversations/${encodeURIComponent(id)}/read`, { method: "POST", body: JSON.stringify({ lastMessageId }) });
        onRead();
        window.dispatchEvent(new Event("handoff:messages-changed"));
      } catch { lastMarked.current = 0; }
    };
    void markVisibleMessages();
    document.addEventListener("visibilitychange", markVisibleMessages);
    window.addEventListener("focus", markVisibleMessages);
    return () => { document.removeEventListener("visibilitychange", markVisibleMessages); window.removeEventListener("focus", markVisibleMessages); };
  }, [data?.messages, id, lastMessageId, onRead, user]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !draft.trim()) return;
    setBusy(true); setSendError("");
    try {
      await api(`conversations/${id}/messages`, { method: "POST", body: JSON.stringify({ text: draft }) });
      setDraft(""); refresh();
    } catch (error) { setSendError(error instanceof Error ? error.message : "Could not send message."); }
    finally { setBusy(false); }
  }

  if (loading) return <p role="status" className="p-8">Loading messages…</p>;
  if (!data) return <div role="alert" className="rounded-xl bg-white p-8">{error}<button onClick={refresh} className="button-secondary mt-4">Try again</button></div>;
  const other = user?.id === data.conversation.sellerId ? data.conversation.buyerName : data.conversation.sellerName;
  return <section className="thread-panel">
    <div className="border-b border-ink/10 p-5"><h2 className="break-words text-xl font-semibold">{data.conversation.title}</h2><p className="mt-1 text-sm text-muted">Chatting with {other}<span className="ml-2 rounded-md bg-sand px-2 py-0.5 text-xs font-semibold capitalize text-forest">{data.conversation.status}</span></p></div>
    {error && <p role="alert" className="p-4 text-sm text-red-700">Connection interrupted. {error}</p>}
    <div ref={log} role="log" aria-label="Conversation messages" aria-live="polite" className="message-log space-y-4">
      {!data.messages.length && <div className="py-14 text-center"><h3 className="font-semibold">Start with a hello.</h3><p className="mt-2 text-sm text-muted">Ask about the item or arrange a pickup date.</p></div>}
      {data.messages.map(message => <div key={message.id} className={`message-row flex ${message.senderId === user?.id ? "justify-end" : "justify-start"}`}><div className={`max-w-[85%] rounded-2xl px-4 py-3 ${message.senderId === user?.id ? "bg-forest text-white" : "bg-sand text-ink"}`}><p className="mb-1 text-[11px] font-semibold">{message.senderName}</p><p className="whitespace-pre-wrap break-words text-sm leading-6">{message.text}</p><time dateTime={message.createdAt} className="mt-1 block text-[10px] opacity-75">{new Date(message.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</time></div></div>)}
    </div>
    <form onSubmit={submit} className="border-t border-ink/10 p-5"><label htmlFor="message" className="text-sm font-semibold">Your message</label><textarea id="message" value={draft} onChange={event => setDraft(event.target.value)} disabled={busy} required maxLength={2000} rows={3} className="form-input mt-2 resize-y" placeholder="Hi! Is this still available? I arrive on…" />
      {sendError && <p role="alert" className="mt-2 text-sm text-red-700">{sendError}</p>}
      <div className="mt-3 flex items-center justify-between gap-3"><span className="text-xs text-muted">{draft.length}/2000</span><button type="submit" disabled={busy || !draft.trim()} className="button-primary disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Sending…" : "Send message"}</button></div>
    </form>
  </section>;
}
