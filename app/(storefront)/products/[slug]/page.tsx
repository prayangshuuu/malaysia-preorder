import { getProductBySlug } from "@/lib/products";
import { formatBDT, formatDeliveryEstimate } from "@/lib/formatters";
import { PricingType } from "@prisma/client";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

interface ProductPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    return {
      title: "Product Not Found | BDPreOrder",
    };
  }

  const primaryImage = product.images[0]?.imageUrl;

  return {
    title: `${product.title} | Authentic Malaysia Pre-Order`,
    description: product.shortDesc || product.description?.slice(0, 160),
    alternates: {
      canonical: `/products/${product.slug}`,
    },
    openGraph: {
      title: product.title,
      description: product.shortDesc || product.description?.slice(0, 160),
      images: primaryImage ? [{ url: primaryImage }] : [],
    },
  };
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const isQuoteRequired = product.pricingType === PricingType.REQUEST_QUOTE_ONLY;
  const primaryImage = product.images[0]?.imageUrl || "/placeholder-product.svg";
  const deliveryTimeline = formatDeliveryEstimate(product.estimatedDaysMin, product.estimatedDaysMax);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-6">
        <ol className="flex items-center space-x-2 text-xs text-zinc-500">
          <li>
            <Link href="/" className="hover:text-emerald-600">Home</Link>
          </li>
          <li>/</li>
          <li>
            <Link href="/products" className="hover:text-emerald-600">Catalogue</Link>
          </li>
          {product.category && (
            <>
              <li>/</li>
              <li>
                <Link
                  href={`/products?category=${product.category.slug}`}
                  className="hover:text-emerald-600"
                >
                  {product.category.name}
                </Link>
              </li>
            </>
          )}
          <li>/</li>
          <li className="font-semibold text-zinc-800 dark:text-zinc-200 truncate max-w-xs">
            {product.title}
          </li>
        </ol>
      </nav>

      {/* Main Product Grid */}
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        {/* Left: Images */}
        <div className="space-y-4">
          <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 shadow-sm">
            <Image
              src={primaryImage}
              alt={product.images[0]?.altText || product.title}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
            <div className="absolute top-4 left-4">
              <span className="inline-flex items-center rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-zinc-800 shadow-sm backdrop-blur dark:bg-zinc-900/90 dark:text-zinc-200">
                🇲🇾 Origin: {product.originCountry}
              </span>
            </div>
          </div>

          {/* Additional thumbnails if available */}
          {product.images.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {product.images.map((img, idx) => (
                <div
                  key={img.id}
                  className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-800"
                >
                  <Image
                    src={img.imageUrl}
                    alt={img.altText || `${product.title} photo ${idx + 1}`}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Sourcing Authenticity Notice */}
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
            <div className="flex items-start gap-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-white shrink-0 text-sm">
                ✓
              </div>
              <div className="text-xs text-emerald-950 dark:text-emerald-200">
                <p className="font-semibold">Procured Directly Upon Order</p>
                <p className="mt-1 text-emerald-800 dark:text-emerald-300">
                  We don’t stock expired warehouse surpluses. This item is purchased fresh from authorized brand retailers and pharmacies in Malaysia when your pre-order is confirmed.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Product Details & Pre-order Action */}
        <div className="flex flex-col">
          {product.category && (
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              {product.category.name}
            </span>
          )}

          <h1 className="mt-2 text-2xl font-extrabold text-zinc-900 dark:text-zinc-50 sm:text-3xl">
            {product.title}
          </h1>

          {/* Availability and Delivery Badges */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 border border-blue-200 dark:bg-blue-950/80 dark:text-blue-300 dark:border-blue-800">
              ✈️ Air Freight Pre-Order
            </span>
            <span className="inline-flex items-center rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              ⏱ Est. Delivery: {deliveryTimeline}
            </span>
          </div>

          {/* Pricing Box */}
          <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50/70 p-5 dark:border-zinc-800 dark:bg-zinc-900/50">
            {isQuoteRequired ? (
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  Pricing Model
                </span>
                <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                  Request a Quote
                </p>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Due to fluctuating retailer promotional campaigns or live electronics pricing in Malaysia, we provide a customized, guaranteed BDT quote before processing your order.
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  All-Inclusive Pre-Order Price
                </span>
                <div className="flex items-baseline gap-3">
                  <p className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-50">
                    {formatBDT(product.displayPriceBDT)}
                  </p>
                  <span className="text-xs font-medium text-zinc-500">
                    BDT (Taka)
                  </span>
                </div>
                <p className="text-xs text-zinc-500 pt-1">
                  ✓ Includes international air shipping, customs clearance, and import duties into Dhaka.
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href={`/inquire?productId=${product.id}&productTitle=${encodeURIComponent(product.title)}`}
                className="flex-1 rounded-lg bg-emerald-600 px-6 py-3.5 text-center text-sm font-bold text-white shadow-sm hover:bg-emerald-700 transition-colors focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                {isQuoteRequired ? "Request Official Quote" : "Pre-Order This Product"}
              </Link>
              <Link
                href="/how-it-works"
                className="rounded-lg border border-zinc-300 bg-white px-4 py-3.5 text-center text-sm font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 transition-colors"
              >
                Delivery Policy
              </Link>
            </div>
            
            <p className="mt-3 text-center text-[11px] text-zinc-400">
              🔒 No fake checkout. After submitting an inquiry, our team verifies Malaysia availability and issues an official quote version.
            </p>
          </div>

          {/* Description */}
          <div className="mt-8 border-t border-zinc-200 pt-6 dark:border-zinc-800">
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
              Product Overview & Specifications
            </h2>
            <div className="mt-3 prose prose-zinc dark:prose-invert text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed whitespace-pre-line">
              {product.description || product.shortDesc}
            </div>
          </div>

          {/* Sourcing & Logistics Details Table */}
          <div className="mt-8 border-t border-zinc-200 pt-6 dark:border-zinc-800">
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100 mb-3">
              Shipping & Sourcing Details
            </h2>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 text-xs">
              <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                <dt className="text-zinc-500 dark:text-zinc-400 font-medium">Country of Origin</dt>
                <dd className="mt-1 font-semibold text-zinc-900 dark:text-zinc-100">{product.originCountry}</dd>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                <dt className="text-zinc-500 dark:text-zinc-400 font-medium">Estimated Air Transit</dt>
                <dd className="mt-1 font-semibold text-zinc-900 dark:text-zinc-100">{deliveryTimeline}</dd>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                <dt className="text-zinc-500 dark:text-zinc-400 font-medium">Bangladeshi Delivery Hub</dt>
                <dd className="mt-1 font-semibold text-zinc-900 dark:text-zinc-100">Dhaka Hub → All BD Districts</dd>
              </div>
              <div className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
                <dt className="text-zinc-500 dark:text-zinc-400 font-medium">Authenticity Guarantee</dt>
                <dd className="mt-1 font-semibold text-emerald-600 dark:text-emerald-400">100% Genuine Retail Guarantee</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
