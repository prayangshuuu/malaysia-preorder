export default function ProductsLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 animate-pulse">
      {/* Title skeleton */}
      <div className="mb-8">
        <div className="h-4 w-32 bg-zinc-200 dark:bg-zinc-800 rounded mb-3" />
        <div className="h-8 w-64 bg-zinc-300 dark:bg-zinc-700 rounded mb-2" />
        <div className="h-4 w-96 bg-zinc-200 dark:bg-zinc-800 rounded" />
      </div>

      {/* Filter skeleton */}
      <div className="h-16 w-full bg-zinc-200 dark:bg-zinc-800 rounded-xl mb-8" />

      {/* Cards skeleton */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="aspect-square w-full rounded-lg bg-zinc-200 dark:bg-zinc-800 mb-4" />
            <div className="h-3 w-20 bg-zinc-200 dark:bg-zinc-800 rounded mb-2" />
            <div className="h-4 w-full bg-zinc-300 dark:bg-zinc-700 rounded mb-2" />
            <div className="h-3 w-3/4 bg-zinc-200 dark:bg-zinc-800 rounded mb-4" />
            <div className="mt-auto flex items-center justify-between pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <div className="h-5 w-24 bg-zinc-300 dark:bg-zinc-700 rounded" />
              <div className="h-7 w-16 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
