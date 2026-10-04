export function UnreadBadge({ count }: { count: number }) {
  if (count < 1) return null;
  return <span className="unread-badge" aria-hidden="true">{count > 99 ? "99+" : count}</span>;
}
