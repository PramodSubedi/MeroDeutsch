/**
 * Skeleton loader component for lazy-loaded routes
 * Prevents layout shift during code-split chunk loading
 */

export function SkeletonLoader() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header skeleton */}
      <div className="animate-pulse">
        <div className="h-8 w-64 rounded-lg bg-slate-200 dark:bg-slate-700"></div>
        <div className="mt-2 h-4 w-96 rounded bg-slate-200 dark:bg-slate-700"></div>
      </div>

      {/* Content skeleton */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-[24px] bg-white p-6 shadow-sm dark:bg-slate-900"
          >
            <div className="h-6 w-3/4 rounded bg-slate-200 dark:bg-slate-700"></div>
            <div className="mt-3 h-4 w-full rounded bg-slate-200 dark:bg-slate-700"></div>
            <div className="mt-2 h-4 w-5/6 rounded bg-slate-200 dark:bg-slate-700"></div>
          </div>
        ))}
      </div>
    </div>
  );
}
