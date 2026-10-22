import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How It Works | Cross-Border Pre-Order Process",
  description:
    "Learn about our transparent process for purchasing products in Malaysia and delivering them to your door in Bangladesh.",
};

export default function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="text-center max-w-2xl mx-auto mb-16">
        <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
          Transparency & Assurance
        </span>
        <h1 className="mt-2 text-3xl font-extrabold text-zinc-900 dark:text-zinc-50 sm:text-4xl">
          How Malaysia Pre-Ordering Works
        </h1>
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          We operate as your personal procurement specialist and logistics partner in Kuala Lumpur.
        </p>
      </div>

      <div className="space-y-12">
        <div className="flex flex-col sm:flex-row gap-6 items-start rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 shadow-sm">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-lg font-bold text-white">
            01
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
              Select or Request Any Malaysia Product
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Browse our curated catalogue of popular items or use our Custom Request tool. You can request any legitimate product sold in Malaysia—from skincare at Guardian/Watsons to gourmet tea, coffee, baby products, electronics, or shoes.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-6 items-start rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 shadow-sm">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-lg font-bold text-white">
            02
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
              Get an All-Inclusive BDT Quotation
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              We never show confusing currency conversions or surprise fees at your doorstep. We give you a single, firm price in Bangladeshi Taka (BDT) that includes the product cost, air shipping, customs clearance, and courier delivery to your address.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-6 items-start rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 shadow-sm">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-lg font-bold text-white">
            03
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
              Procurement & Scheduled Air Freight
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Our Malaysian team physically procures your order from brand stores and authorized distributors in Selangor and Kuala Lumpur. Each item is inspected, safely bubble-wrapped, and loaded onto our scheduled weekly air cargo flight to Dhaka.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-6 items-start rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 shadow-sm">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-lg font-bold text-white">
            04
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
              Dhaka Warehouse Receipt & Home Delivery
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Once customs clears the shipment at Hazrat Shahjalal International Airport, items are received at our Dhaka Hub and promptly handed to nationwide delivery couriers. You receive SMS/email updates at every stage.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-16 text-center">
        <Link
          href="/products"
          className="rounded-lg bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow hover:bg-emerald-700 transition-colors"
        >
          Explore Catalogue Items Now
        </Link>
      </div>
    </div>
  );
}
