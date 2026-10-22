import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "100% Authenticity Guarantee | BDPreOrder",
  description:
    "Our ironclad promise of genuine retail products sourced directly from verified Malaysian shopping malls, pharmacies, and brand outlets.",
};

export default function AuthenticityPolicyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-50">
          100% Authenticity Guarantee
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Zero tolerance for counterfeits, expired lots, or grey-market replicas.
        </p>
      </div>

      <div className="prose prose-zinc dark:prose-invert max-w-none text-sm leading-relaxed space-y-6">
        <section>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">1. Direct Physical Procurement</h2>
          <p>
            Unlike open drop-shipping marketplaces, our on-the-ground operations team in Kuala Lumpur directly visits authorized brand outlets (e.g., Guardian, Watsons, Caring Pharmacy, Official Brand Boutiques in Pavilion KL / Mid Valley Megamall, and Lotus’s Malaysia) to make purchases.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">2. Malaysian Ministry of Health (KKM) Verification</h2>
          <p>
            All pharmaceuticals, supplements, and certified cosmetic items must carry official holographic Meditag or KKM authentication stickers before our staff clears them for international air shipment.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">3. Purchase Invoices & Receipts</h2>
          <p>
            We retain official store purchase receipts for all items. Should you require proof of store origin for manufacturer warranty or verification, digital copies of retail receipts can be provided upon request.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">4. Money-Back Guarantee</h2>
          <p>
            If any delivered product is demonstrably unauthentic or fails brand authentication checks, we provide an immediate 100% refund of all funds paid.
          </p>
        </section>
      </div>

      <div className="mt-12 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <Link href="/products" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400">
          ← Return to catalogue
        </Link>
      </div>
    </div>
  );
}
