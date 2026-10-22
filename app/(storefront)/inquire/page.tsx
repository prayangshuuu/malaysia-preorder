import Link from "next/link";
import { InquireForm } from "@/components/storefront/InquireForm";
import { getCurrentSession } from "@/lib/auth/session";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Request Any Malaysia Product | Custom Sourcing",
  description:
    "Submit a product link, brand, model, or photo from any Malaysian store or marketplace. We verify stock in Kuala Lumpur and provide a guaranteed BDT quote.",
};

export default async function InquirePage() {
  const session = await getCurrentSession();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8 text-center">
        <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
          Personal Shopper Service
        </span>
        <h1 className="mt-2 text-3xl font-extrabold text-zinc-900 dark:text-zinc-50">
          Request Any Product from Malaysia
        </h1>
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Found something on Shopee Malaysia, Lazada MY, Watsons, or Guardian? Share the details below. Our team in Kuala Lumpur will inspect availability, calculate air freight, and issue an official BDT quotation.
        </p>
      </div>

      <InquireForm isAuthenticated={Boolean(session)} />

      <div className="mt-8 flex items-center justify-between text-xs text-zinc-500">
        <Link href="/products" className="font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400">
          ← Return to catalogue
        </Link>
        {session && (
          <Link href="/account/inquiries" className="font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400">
            View My Inquiries →
          </Link>
        )}
      </div>
    </div>
  );
}
