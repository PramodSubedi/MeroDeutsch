/**
 * Skeleton loader component for lazy-loaded routes
 * Prevents layout shift during code-split chunk loading
 */

export function SkeletonLoader() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header skeleton */}
      <div className="animate-pulse">
        <div className="h-8 w-64 rounded-sm bg-ink-200 dark:bg-ink-700"></div>
        <div className="mt-2 h-4 w-96 rounded-sm bg-ink-200 dark:bg-ink-700"></div>
      </div>

      {/* Content skeleton */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-lg border border-ink-200 bg-white p-6 shadow-sm dark:bg-ink-900 dark:border-ink-800"
          >
            <div className="h-6 w-3/4 rounded-sm bg-ink-200 dark:bg-ink-700"></div>
            <div className="mt-3 h-4 w-full rounded-sm bg-ink-200 dark:bg-ink-700"></div>
            <div className="mt-2 h-4 w-5/6 rounded-sm bg-ink-200 dark:bg-ink-700"></div>
          </div>
        ))}
      </div>
    </div>
  );
}
