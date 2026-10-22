import Link from "next/link";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
      {/* Top Banner Notice */}
      <div className="bg-emerald-700 px-4 py-1.5 text-center text-xs font-medium text-white tracking-wide">
        <span>🇲🇾 Authentic Malaysia Procurement ✈️ Scheduled Air Cargo to Dhaka 🇧🇩 Direct Doorstep Delivery</span>
      </div>

      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 group">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 font-bold text-white shadow-sm transition-transform group-hover:scale-105">
              MY
            </span>
            <div className="flex flex-col">
              <span className="text-base font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 leading-none">
                BDPreOrder
              </span>
              <span className="text-[10px] uppercase font-semibold text-zinc-500 dark:text-zinc-400 tracking-wider">
                Malaysia Hub
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <Link
              href="/products"
              className="text-zinc-700 hover:text-emerald-600 dark:text-zinc-300 dark:hover:text-emerald-400 transition-colors"
            >
              All Products
            </Link>
            <Link
              href="/products?category=snacks-food"
              className="text-zinc-700 hover:text-emerald-600 dark:text-zinc-300 dark:hover:text-emerald-400 transition-colors"
            >
              Food & Snacks
            </Link>
            <Link
              href="/products?category=beauty-skincare"
              className="text-zinc-700 hover:text-emerald-600 dark:text-zinc-300 dark:hover:text-emerald-400 transition-colors"
            >
              Beauty & Care
            </Link>
            <Link
              href="/how-it-works"
              className="text-zinc-700 hover:text-emerald-600 dark:text-zinc-300 dark:hover:text-emerald-400 transition-colors"
            >
              How It Works
            </Link>
            <Link
              href="/contact"
              className="text-zinc-700 hover:text-emerald-600 dark:text-zinc-300 dark:hover:text-emerald-400 transition-colors"
            >
              Support Desk
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/inquire"
            className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:hover:bg-emerald-500"
          >
            Custom Product Request
          </Link>
        </div>
      </div>
    </header>
  );
}
