import Link from "next/link";
import Image from "next/image";
import { getFeaturedProducts, getAllCategories } from "@/lib/products";
import { ProductCard } from "@/components/storefront/ProductCard";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "BDPreOrder | Authentic Malaysia to Bangladesh Pre-Order Service",
  description:
    "Direct cross-border procurement from Kuala Lumpur retail stores to Dhaka doorstep. Transparent BDT pricing, scheduled weekly air batches, and 100% genuine products.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "BDPreOrder - Direct Malaysia Procurement to Bangladesh",
    description:
      "Order authentic Malaysian coffee, tea, skincare, vitamins, and gadgets. Procured in MYR, delivered to your door in Bangladesh with transparent BDT pricing.",
    type: "website",
    locale: "en_BD",
  },
};

export default async function HomePage() {
  const [featuredProducts, categories] = await Promise.all([
    getFeaturedProducts(6),
    getAllCategories(),
  ]);

  return (
    <div className="flex flex-col gap-16 pb-16">
      {/* 1. Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-emerald-50/60 via-white to-white py-16 dark:from-emerald-950/20 dark:via-zinc-950 dark:to-zinc-950 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Next Weekly Air Freight Batch: Departing this Friday
              </div>

              <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 sm:text-5xl dark:text-zinc-50 leading-tight">
                Authentic Malaysia Goods, Delivered Direct to{" "}
                <span className="text-emerald-600 dark:text-emerald-400">Bangladesh</span>.
              </h1>

              <p className="text-base text-zinc-600 sm:text-lg dark:text-zinc-400 leading-relaxed">
                Direct cross-border procurement without middlemen. We buy from verified
                retailers in Kuala Lumpur, handle customs clearance, and courier straight
                to your door across Bangladesh in transparent BDT.
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Link
                  href="/products"
                  className="rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 dark:hover:bg-emerald-500 transition-colors"
                >
                  Browse Catalogue
                </Link>
                <Link
                  href="/inquire"
                  className="rounded-lg border border-zinc-300 bg-white px-6 py-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                >
                  Custom Product Request →
                </Link>
              </div>

              {/* Trust highlights */}
              <div className="grid grid-cols-3 gap-4 border-t border-zinc-200 pt-6 text-left dark:border-zinc-800">
                <div>
                  <p className="text-xl font-bold text-zinc-900 dark:text-zinc-50">100%</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Original Receipts</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-zinc-900 dark:text-zinc-50">7–12 Days</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Air Delivery to Dhaka</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-zinc-900 dark:text-zinc-50">BDT All-In</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">No Hidden Customs</p>
                </div>
              </div>
            </div>

            {/* Visual banner */}
            <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
              <div className="aspect-[4/3] relative rounded-2xl overflow-hidden border border-zinc-200 shadow-xl dark:border-zinc-800">
                <Image
                  src="https://images.unsplash.com/photo-1559056199-641a0ac8b55e?q=80&w=1000&auto=format&fit=crop"
                  alt="Malaysian authentic products showcase"
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 rounded-xl bg-white/95 p-4 backdrop-blur dark:bg-zinc-900/95">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        Kuala Lumpur → Dhaka Air Logistics
                      </p>
                      <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                        Fresh Batches Sourced Weekly
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      Verified
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. How It Works Section */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Simple 4-Step Pre-Order Flow
          </span>
          <h2 className="mt-2 text-3xl font-extrabold text-zinc-900 dark:text-zinc-50">
            How Cross-Border Ordering Works
          </h2>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            We operate transparently with scheduled shipments and genuine store receipts.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 font-bold dark:bg-emerald-950 dark:text-emerald-400">
              1
            </div>
            <h3 className="mt-4 text-base font-bold text-zinc-900 dark:text-zinc-100">
              Pick or Request
            </h3>
            <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Choose from our curated catalogue or submit a link/photo of any product available in Malaysia.
            </p>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 font-bold dark:bg-emerald-950 dark:text-emerald-400">
              2
            </div>
            <h3 className="mt-4 text-base font-bold text-zinc-900 dark:text-zinc-100">
              Transparent BDT Quote
            </h3>
            <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              We check Malaysian retail availability and provide a finalized BDT total covering air freight and duties.
            </p>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 font-bold dark:bg-emerald-950 dark:text-emerald-400">
              3
            </div>
            <h3 className="mt-4 text-base font-bold text-zinc-900 dark:text-zinc-100">
              KL Procurement & Air Freight
            </h3>
            <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Our Kuala Lumpur team personally purchases fresh genuine stock and dispatches via scheduled air cargo.
            </p>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 font-bold dark:bg-emerald-950 dark:text-emerald-400">
              4
            </div>
            <h3 className="mt-4 text-base font-bold text-zinc-900 dark:text-zinc-100">
              Dhaka Clearance & Delivery
            </h3>
            <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Packages are received at our Dhaka distribution hub and dispatched directly to your address.
            </p>
          </div>
        </div>
      </section>

      {/* 3. Browse By Category */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              Popular Sourcing Categories
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Procured from certified stores across Subang Jaya, Mid Valley, and Kuala Lumpur
            </p>
          </div>
          <Link
            href="/products"
            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
          >
            View all →
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/products?category=${cat.slug}`}
              className="group flex flex-col justify-between rounded-xl border border-zinc-200 bg-white p-5 transition-all hover:border-emerald-500 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-500"
            >
              <div>
                <h3 className="text-base font-bold text-zinc-900 group-hover:text-emerald-600 dark:text-zinc-100 dark:group-hover:text-emerald-400">
                  {cat.name}
                </h3>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">
                  {cat.description}
                </p>
              </div>
              <span className="mt-4 inline-flex items-center text-xs font-medium text-emerald-600 dark:text-emerald-400">
                {cat._count.products} Products Available →
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* 4. Featured Published Products */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              Featured Pre-Order Items
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Top requested items with confirmed sourcing channels in Malaysia
            </p>
          </div>
          <Link
            href="/products"
            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
          >
            Explore all products ({featuredProducts.length}+) →
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {featuredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* 5. Custom Product Request CTA */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl bg-gradient-to-r from-emerald-700 to-teal-800 p-8 sm:p-12 text-white shadow-lg">
          <div className="max-w-2xl">
            <span className="rounded-full bg-emerald-500/30 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-100">
              Specialized Sourcing Service
            </span>
            <h2 className="mt-4 text-3xl font-extrabold sm:text-4xl">
              Can’t find what you’re looking for in our catalogue?
            </h2>
            <p className="mt-3 text-sm text-emerald-100 sm:text-base leading-relaxed">
              We can purchase virtually any legitimate consumer product, skincare line,
              specialty food item, or gadget sold in Malaysia. Simply share a Shopee MY link,
              retail website URL, or photo with us.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/inquire"
                className="rounded-lg bg-white px-6 py-3 text-sm font-bold text-emerald-900 shadow hover:bg-emerald-50 transition-colors"
              >
                Submit Custom Sourcing Request
              </Link>
              <Link
                href="/how-it-works"
                className="rounded-lg border border-white/30 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
              >
                Learn How Sourcing Quotes Work
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Trust & Policies Section */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="text-2xl mb-2">🧾</div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
              Original Receipts & Packaging
            </h3>
            <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Every item is purchased over-the-counter or from verified brand retailers. We include original packaging and can provide store receipts upon request.
            </p>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="text-2xl mb-2">🛡️</div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
              Customs & Inspection Assured
            </h3>
            <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Quotes in BDT cover commercial air cargo handling, customs import fees, and Dhaka warehouse intake. No surprise extra payments at your doorstep.
            </p>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="text-2xl mb-2">📦</div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
              Safe Bubble & Shock Packaging
            </h3>
            <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Every shipment is packed in air-cushioned bubble mailers or heavy-duty boxes in Kuala Lumpur to withstand air transit to Bangladesh safely.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
