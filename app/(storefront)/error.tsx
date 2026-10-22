"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function StorefrontError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Storefront error boundary caught:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-2xl text-red-600 dark:bg-red-950 dark:text-red-400">
        ⚠️
      </div>
      <h2 className="mt-4 text-xl font-bold text-zinc-900 dark:text-zinc-50">
        Failed to load catalogue
      </h2>
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        We encountered a momentary issue retrieving product information. Please try reloading or check back shortly.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <button
          onClick={() => reset()}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
        >
          Try Again
        </button>
        <Link
          href="/"
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
        >
          Return Home
        </Link>
      </div>
    </div>
  );
}
