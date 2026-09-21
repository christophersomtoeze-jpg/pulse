/** Lightweight loading placeholders for slower views. */
export function LoadingSkeleton({ rows = 4, label = 'Loading…' }: { rows?: number; label?: string }) {
  return (
    <div className="mx-auto max-w-3xl space-y-3 px-4 pt-5" role="status" aria-live="polite">
      <p className="text-xs text-ink-500">{label}</p>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="glass animate-pulse rounded-2xl p-4">
          <div className="h-3 w-1/3 rounded bg-white/10" />
          <div className="mt-3 h-2 w-full rounded bg-white/5" />
          <div className="mt-2 h-2 w-2/3 rounded bg-white/5" />
        </div>
      ))}
    </div>
  );
}

export function FullPageLoader({ label = 'Loading PULSE…' }: { label?: string }) {
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="text-center">
        <div className="mx-auto h-10 w-10 animate-pulse rounded-2xl bg-gradient-to-br from-[#7c3aed] to-[#06b6d4]" />
        <p className="mt-4 text-sm text-ink-400">{label}</p>
      </div>
    </div>
  );
}
