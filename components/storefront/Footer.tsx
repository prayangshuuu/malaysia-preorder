import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          {/* Brand info */}
          <div className="space-y-4 md:col-span-1">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 font-bold text-white text-sm">
                MY
              </span>
              <span className="text-base font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
                BDPreOrder
              </span>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Dedicated cross-border sourcing service from Malaysia directly to Bangladesh.
              100% genuine retail items with transparent BDT pricing and dedicated logistics.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-900 dark:text-zinc-200">
              Catalogue
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link
                  href="/products"
                  className="text-zinc-600 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400"
                >
                  All Pre-Order Products
                </Link>
              </li>
              <li>
                <Link
                  href="/products?category=beauty-skincare"
                  className="text-zinc-600 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400"
                >
                  Beauty & Skincare
                </Link>
              </li>
              <li>
                <Link
                  href="/products?category=snacks-food"
                  className="text-zinc-600 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400"
                >
                  Snacks & Groceries
                </Link>
              </li>
              <li>
                <Link
                  href="/products?category=health-supplements"
                  className="text-zinc-600 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400"
                >
                  Health & Pharmacy
                </Link>
              </li>
            </ul>
          </div>

          {/* Customer Service & Request */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-900 dark:text-zinc-200">
              Services
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link
                  href="/inquire"
                  className="text-zinc-600 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400"
                >
                  Request Any Malaysia Product
                </Link>
              </li>
              <li>
                <Link
                  href="/how-it-works"
                  className="text-zinc-600 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400"
                >
                  How Sourcing & Delivery Works
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="text-zinc-600 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400"
                >
                  Contact & Support
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="text-zinc-600 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400"
                >
                  Contact & Support Desk
                </Link>
              </li>
              <li>
                <Link
                  href="/policies/shipping"
                  className="text-zinc-600 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400"
                >
                  Air Shipping & Delivery Timelines
                </Link>
              </li>
              <li>
                <Link
                  href="/policies/authenticity"
                  className="text-zinc-600 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400"
                >
                  100% Authenticity Guarantee
                </Link>
              </li>
              <li>
                <Link
                  href="/policies/terms"
                  className="text-zinc-600 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400"
                >
                  Terms & Conditions
                </Link>
              </li>
              <li>
                <Link
                  href="/policies/refund"
                  className="text-zinc-600 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400"
                >
                  Refund & Cancellation Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/policies/privacy"
                  className="text-zinc-600 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/policies/wallet"
                  className="text-zinc-600 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400"
                >
                  Wallet & Ledger Policy
                </Link>
              </li>
            </ul>
          </div>

          {/* Logistics & Trust */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-900 dark:text-zinc-200">
              Procurement Transparency
            </h3>
            <p className="mt-4 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              All items are purchased in ringgit (MYR) by our Kuala Lumpur operations team and quoted to you in Bangladeshi Taka (BDT) inclusive of customs clearance and courier delivery.
            </p>
            <div className="mt-4 rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
              <span className="block text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                Weekly Air Batch Departs Every Friday
              </span>
              <span className="block text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                Typical transit time: 7–12 business days
              </span>
            </div>
          </div>
        </div>

        <div className="mt-12 border-t border-zinc-200 pt-6 text-center text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-500">
          <p>© 2026 Malaysia-Bangladesh Pre-Order Platform. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
