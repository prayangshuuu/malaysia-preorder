import Image from "next/image";
import Link from "next/link";
import { formatBDT, formatDeliveryEstimate } from "@/lib/formatters";
import { PricingType } from "@prisma/client";

interface ProductCardProps {
  product: {
    id: string;
    title: string;
    slug: string;
    shortDesc?: string | null;
    pricingType: PricingType;
    displayPriceBDT?: { toString(): string } | number | null;
    estimatedDaysMin?: number | null;
    estimatedDaysMax?: number | null;
    originCountry: string;
    category?: {
      name: string;
      slug: string;
    } | null;
    images: Array<{
      imageUrl: string;
      altText?: string | null;
    }>;
  };
}

export function ProductCard({ product }: ProductCardProps) {
  const primaryImage = product.images[0]?.imageUrl || "/placeholder-product.svg";
  const imageAlt = product.images[0]?.altText || product.title;
  const isQuoteRequired = product.pricingType === PricingType.REQUEST_QUOTE_ONLY;
  const deliveryText = formatDeliveryEstimate(product.estimatedDaysMin, product.estimatedDaysMax);

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white transition-all hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700">
      {/* Product Image */}
      <Link href={`/products/${product.slug}`} className="relative aspect-square w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
        <Image
          src={primaryImage}
          alt={imageAlt}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {/* Origin Badge */}
        <div className="absolute top-2.5 left-2.5">
          <span className="inline-flex items-center rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-medium text-zinc-800 shadow-sm backdrop-blur dark:bg-zinc-900/90 dark:text-zinc-200">
            🇲🇾 {product.originCountry}
          </span>
        </div>

        {/* Pricing Mode Badge */}
        {isQuoteRequired && (
          <div className="absolute top-2.5 right-2.5">
            <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-200 dark:bg-blue-950/80 dark:text-blue-300 dark:border-blue-800">
              Custom Quote
            </span>
          </div>
        )}
      </Link>

      {/* Product Details */}
      <div className="flex flex-1 flex-col p-4">
        {product.category && (
          <span className="text-[11px] font-semibold tracking-wider uppercase text-emerald-600 dark:text-emerald-400">
            {product.category.name}
          </span>
        )}

        <h3 className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50 line-clamp-2 leading-snug">
          <Link href={`/products/${product.slug}`} className="hover:underline">
            {product.title}
          </Link>
        </h3>

        {product.shortDesc && (
          <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">
            {product.shortDesc}
          </p>
        )}

        {/* Delivery Timeline info */}
        <div className="mt-3 flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          <svg className="h-3.5 w-3.5 text-zinc-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="truncate">Est: {deliveryText}</span>
        </div>

        {/* Pricing & CTA */}
        <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3 dark:border-zinc-800/80">
          <div>
            {isQuoteRequired ? (
              <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                Request a quote
              </span>
            ) : (
              <div className="flex flex-col">
                <span className="text-xs text-zinc-400">All-inclusive BDT</span>
                <span className="text-base font-bold text-zinc-900 dark:text-zinc-50">
                  {formatBDT(product.displayPriceBDT)}
                </span>
              </div>
            )}
          </div>

          <Link
            href={`/products/${product.slug}`}
            className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            {isQuoteRequired ? "Get Quote" : "Details"}
          </Link>
        </div>
      </div>
    </article>
  );
}
