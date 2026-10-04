export function PageLoading({ label = "Getting things ready…" }: { label?: string }) {
  return <main className="page-width task-page py-16"><div className="empty-state" role="status"><h1>One moment.</h1><p className="mt-4 text-muted">{label}</p></div></main>;
}
