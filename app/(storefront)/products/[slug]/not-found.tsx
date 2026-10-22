import Link from "next/link";

export default function ProductNotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl dark:bg-emerald-950">
        📦
      </div>
      <h1 className="mt-6 text-2xl font-extrabold text-zinc-900 dark:text-zinc-50">
        Product Not Found
      </h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        The product you requested might have been removed, archived, or is no longer available in our published catalogue.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <Link
          href="/products"
          className="rounded-lg bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
        >
          Browse All Products
        </Link>
        <Link
          href="/inquire"
          className="rounded-lg border border-zinc-300 bg-white px-5 py-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
        >
          Submit Custom Inquiry
        </Link>
      </div>
    </div>
  );
}
