import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Air Shipping & Delivery Timelines | BDPreOrder",
  description:
    "Learn about our weekly flight schedules from Kuala Lumpur to Dhaka, customs handling, and local Bangladesh delivery times.",
};

export default function ShippingPolicyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-50">
          Air Shipping & Delivery Timelines
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Last updated: October 2026
        </p>
      </div>

      <div className="prose prose-zinc dark:prose-invert max-w-none text-sm leading-relaxed space-y-6">
        <section>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">1. Scheduled Flight Batches</h2>
          <p>
            We operate scheduled air cargo flights departing Kuala Lumpur International Airport (KUL) to Hazrat Shahjalal International Airport (DAC) on a weekly basis. Order cutoff times are strictly communicated for each batch to ensure prompt air freight clearance.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">2. Estimated Delivery Durations</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Dhaka City:</strong> 7 to 10 working days from the weekly batch flight dispatch.</li>
            <li><strong>Chittagong, Sylhet & Major Divisional Cities:</strong> 8 to 12 working days.</li>
            <li><strong>District & Upazila Level:</strong> 10 to 14 working days via local courier networks (e.g. Steadfast, Pathao, or Paperfly).</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">3. Customs Clearance & Import Fees</h2>
          <p>
            All consumer goods are imported through formal commercial air cargo declarations. The quoted price in Bangladeshi Taka (BDT) is <strong>all-inclusive</strong> of airline fuel surcharges, import tariffs, airport clearance fees, and domestic delivery charges. Customers never pay any unexpected extra fees upon receiving their parcels.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">4. Fragile & Perishable Items</h2>
          <p>
            Special packaging (multi-layer bubble wrap, moisture seals, and rigid cardboard cartons) is applied to glassware, electronics, and tea/coffee packaging to ensure items reach you in pristine original store condition.
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
