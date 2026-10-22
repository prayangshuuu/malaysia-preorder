import Link from "next/link";
import { getCurrentSession } from "@/lib/auth/session";

export default async function Navbar() {
  const session = await getCurrentSession();

  return (
    <nav className="border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="font-bold text-lg tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
          <span>🇲🇾 ✈️ 🇧🇩</span>
          <span>Malaysia Pre-Order</span>
        </Link>

        <div className="flex items-center gap-4 text-sm font-medium">
          {session ? (
            <>
              {session.role === "ADMIN" ||
              session.role === "OPERATIONS" ||
              session.role === "FINANCE" ||
              session.role === "SUPPORT" ? (
                <Link
                  href="/admin"
                  className="px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition"
                >
                  Admin Portal
                </Link>
              ) : null}
              <Link
                href="/account"
                className="px-3.5 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition"
              >
                My Account
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="px-3.5 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition"
              >
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
