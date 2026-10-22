import Link from "next/link";

export default function UnauthorizedPage({
  searchParams,
}: {
  searchParams?: Promise<{ reason?: string }>;
}) {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-white dark:bg-zinc-900 shadow-md rounded-2xl border border-zinc-200 dark:border-zinc-800 p-8 text-center">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">
          Access Denied
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
          You do not have administrative permissions to view this resource.
          Staff privileges are required.
        </p>
        <div className="flex flex-col gap-3">
          <Link
            href="/"
            className="w-full inline-flex justify-center items-center px-4 py-2.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
          >
            Return to Homepage
          </Link>
          <Link
            href="/admin/login"
            className="w-full inline-flex justify-center items-center px-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            Sign In with Staff Account
          </Link>
        </div>
      </div>
    </div>
  );
}
