"use client";

import { useState } from "react";
import { formatBDT } from "@/lib/formatters";
import { PricingType } from "@prisma/client";

interface ProductPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: {
    title: string;
    slug: string;
    shortDesc?: string | null;
    description?: string | null;
    pricingType: PricingType;
    displayPriceBDT?: number | null;
    originCountry: string;
    estimatedDaysMin?: number | null;
    estimatedDaysMax?: number | null;
    categoryName?: string;
    images: Array<{
      imageUrl: string;
      altText?: string | null;
      isPrimary?: boolean;
    }>;
  };
}

export function ProductPreviewModal({
  isOpen,
  onClose,
  product,
}: ProductPreviewModalProps) {
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  if (!isOpen) return null;

  const images = product.images.length > 0
    ? product.images
    : [{ imageUrl: "https://placehold.co/600x400/27272a/ffffff?text=No+Image", altText: "Placeholder" }];

  const currentImage = images[activeImageIndex] || images[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl p-6 sm:p-8 text-zinc-100 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-6 border-b border-zinc-800">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-amber-500">
              Customer Storefront Simulation
            </span>
            <h3 className="text-lg font-bold text-zinc-100">
              Live Product Detail Preview
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
            aria-label="Close Preview"
          >
            ✕
          </button>
        </div>

        {/* Product Layout Simulation */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Images */}
          <div>
            <div className="aspect-square w-full rounded-xl overflow-hidden bg-zinc-950 border border-zinc-800 mb-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentImage.imageUrl}
                alt={currentImage.altText || product.title}
                className="w-full h-full object-cover"
              />
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveImageIndex(idx)}
                    className={`h-16 w-16 shrink-0 rounded-lg overflow-hidden border-2 transition ${
                      idx === activeImageIndex
                        ? "border-amber-500"
                        : "border-zinc-800 opacity-60 hover:opacity-100"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.imageUrl}
                      alt="Thumbnail"
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div className="flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 text-xs font-semibold">
                  {product.categoryName || "General Goods"}
                </span>
                <span className="text-xs text-zinc-400">
                  Origin: 🇲🇾 {product.originCountry}
                </span>
              </div>

              <h1 className="text-2xl font-bold text-white mb-2">
                {product.title || "Untitled Product"}
              </h1>

              {product.shortDesc && (
                <p className="text-sm text-zinc-300 mb-4 leading-relaxed">
                  {product.shortDesc}
                </p>
              )}

              {/* Price / Quote Block */}
              <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 mb-6">
                <span className="text-xs text-zinc-400 uppercase tracking-wider font-semibold block mb-1">
                  Estimated Sourced Price
                </span>
                {product.pricingType === PricingType.FIXED_PRICE && product.displayPriceBDT ? (
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-emerald-400 font-mono">
                      {formatBDT(product.displayPriceBDT)}
                    </span>
                    <span className="text-xs text-zinc-500">BDT (Inclusive of import duties)</span>
                  </div>
                ) : (
                  <div>
                    <span className="text-xl font-bold text-amber-400">
                      Request a Quote
                    </span>
                    <p className="text-xs text-zinc-400 mt-1">
                      Our Kuala Lumpur team will source live market pricing for your exact batch.
                    </p>
                  </div>
                )}
              </div>

              {/* Delivery Window */}
              {(product.estimatedDaysMin || product.estimatedDaysMax) && (
                <div className="flex items-center gap-2 text-xs text-zinc-400 mb-4 bg-zinc-800/40 p-2.5 rounded-lg border border-zinc-800">
                  <span>✈️</span>
                  <span>
                    Estimated flight dispatch to Dhaka:{" "}
                    <strong className="text-zinc-200">
                      {product.estimatedDaysMin || 5} - {product.estimatedDaysMax || 14} business days
                    </strong>
                  </span>
                </div>
              )}

              {/* Full Description */}
              {product.description && (
                <div className="border-t border-zinc-800 pt-4 mt-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                    Product Specifications
                  </h4>
                  <div className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">
                    {product.description}
                  </div>
                </div>
              )}
            </div>

            {/* Simulated CTA button */}
            <div className="pt-6 border-t border-zinc-800 mt-6">
              <button
                type="button"
                disabled
                className="w-full rounded-xl bg-emerald-600/80 py-3 text-sm font-semibold text-white cursor-not-allowed opacity-90 text-center"
              >
                {product.pricingType === PricingType.FIXED_PRICE
                  ? "Pre-Order Now (Customer View)"
                  : "Submit Quote Request (Customer View)"}
              </button>
              <p className="text-[11px] text-zinc-500 text-center mt-2">
                🔒 Preview Mode: Internal supplier costs and margin remain completely confidential.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
