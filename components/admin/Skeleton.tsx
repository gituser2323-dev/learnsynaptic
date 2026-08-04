/**
 * Skeleton loaders — content-shaped placeholders shown while a page's
 * first fetch is in flight, replacing DataStates.tsx's spinner-based
 * LoadingState for the pages that request it. Shimmer via globals.css's
 * `.adm-skeleton` (already collapses under `prefers-reduced-motion:
 * reduce` there — no separate handling needed here).
 *
 * `role="status"` + `aria-label` on each top-level skeleton announces
 * "loading" once to screen readers; the shimmering bars themselves are
 * `aria-hidden` since they carry no information of their own.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`adm-skeleton rounded-[var(--adm-radius-sm)] ${className}`} />;
}

export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div role="status" aria-label="Loading stats" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} aria-hidden="true" className="adm-card p-5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-4 h-8 w-20" />
          <Skeleton className="mt-3 h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 6, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div role="status" aria-label="Loading table data" className="adm-card overflow-hidden">
      <table className="w-full text-sm" aria-hidden="true">
        <thead>
          <tr style={{ borderBottom: "1px solid var(--adm-border)" }}>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="px-4 py-3">
                <Skeleton className="h-3 w-20" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r} style={{ borderTop: "1px solid var(--adm-border)" }}>
              {Array.from({ length: columns }).map((_, c) => (
                <td key={c} className="px-4 py-3.5">
                  <Skeleton className="h-3.5 w-full max-w-[8rem]" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
