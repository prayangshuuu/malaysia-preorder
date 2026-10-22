"use client";

import Link from "next/link";

export default function AdminErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isUnauthorized =
    error.message.includes("FORBIDDEN") || error.message.includes("UNAUTHORIZED");

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-8 text-center max-w-lg mx-auto">
      <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 text-2xl mb-4 font-mono">
        🛡️
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">
        {isUnauthorized ? "Administrative Access Required" : "Staff Portal Error"}
      </h2>
      <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
        {isUnauthorized
          ? "You do not have administrative or operations permissions to access this view. Please sign in with an authorized staff account."
          : error.message || "An unexpected error occurred while loading this administrative view."}
      </p>
      <div className="flex gap-4">
        {isUnauthorized ? (
          <Link
            href="/admin/login"
            className="px-5 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium transition shadow-sm"
          >
            Go to Staff Login
          </Link>
        ) : (
          <button
            onClick={() => reset()}
            className="px-5 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium transition border border-zinc-700"
          >
            Retry
          </button>
        )}
        <Link
          href="/"
          className="px-5 py-2.5 rounded-lg border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900 text-sm font-medium transition"
        >
          Return to Platform
        </Link>
      </div>
    </div>
  );
}
