"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createProductAction,
  updateProductAction,
} from "@/app/actions/admin-catalog";
import { generateSlug } from "@/lib/validations/admin-product";
import { ImageUploader } from "./ImageUploader";
import { ProductPreviewModal } from "./ProductPreviewModal";
import { ProductStatus, PricingType } from "@prisma/client";

interface ProductFormProps {
  initialProduct?: {
    id: string;
    title: string;
    slug: string;
    shortDesc?: string | null;
    description?: string | null;
    categoryId: string;
    status: ProductStatus;
    pricingType: PricingType;
    displayPriceBDT?: number | string | null;
    originCountry: string;
    estimatedDaysMin?: number | null;
    estimatedDaysMax?: number | null;
    sourceUrl?: string | null;
    defaultSupplierId?: string | null;
    approxCostMYR?: number | string | null;
    adminNotes?: string | null;
    images: Array<{
      id?: string;
      imageUrl: string;
      altText?: string | null;
      isPrimary?: boolean;
      sortOrder?: number;
    }>;
  };
  categories: Array<{ id: string; name: string }>;
  suppliers: Array<{ id: string; name: string }>;
  isStaff: boolean; // Controls confidential supplier and margin field visibility
}

export function ProductForm({
  initialProduct,
  categories,
  suppliers,
  isStaff,
}: ProductFormProps) {
  const router = useRouter();
  const isEditing = Boolean(initialProduct?.id);

  // Form State
  const [title, setTitle] = useState(initialProduct?.title || "");
  const [slug, setSlug] = useState(initialProduct?.slug || "");
  const [autoSlug, setAutoSlug] = useState(!initialProduct?.slug);
  const [shortDesc, setShortDesc] = useState(initialProduct?.shortDesc || "");
  const [description, setDescription] = useState(initialProduct?.description || "");
  const [categoryId, setCategoryId] = useState(
    initialProduct?.categoryId || (categories[0]?.id || "")
  );
  const [status, setStatus] = useState<ProductStatus>(
    initialProduct?.status || ProductStatus.DRAFT
  );
  const [pricingType, setPricingType] = useState<PricingType>(
    initialProduct?.pricingType || PricingType.FIXED_PRICE
  );
  const [displayPriceBDT, setDisplayPriceBDT] = useState<string>(
    initialProduct?.displayPriceBDT ? String(initialProduct.displayPriceBDT) : ""
  );
  const [originCountry, setOriginCountry] = useState(
    initialProduct?.originCountry || "Malaysia"
  );
  const [estimatedDaysMin, setEstimatedDaysMin] = useState<string>(
    initialProduct?.estimatedDaysMin ? String(initialProduct.estimatedDaysMin) : "5"
  );
  const [estimatedDaysMax, setEstimatedDaysMax] = useState<string>(
    initialProduct?.estimatedDaysMax ? String(initialProduct.estimatedDaysMax) : "12"
  );

  // Private Staff Fields
  const [sourceUrl, setSourceUrl] = useState(initialProduct?.sourceUrl || "");
  const [defaultSupplierId, setDefaultSupplierId] = useState(
    initialProduct?.defaultSupplierId || ""
  );
  const [approxCostMYR, setApproxCostMYR] = useState<string>(
    initialProduct?.approxCostMYR ? String(initialProduct.approxCostMYR) : ""
  );
  const [adminNotes, setAdminNotes] = useState(initialProduct?.adminNotes || "");

  // Media
  const [images, setImages] = useState(initialProduct?.images || []);

  // UI State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [previewOpen, setPreviewOpen] = useState(false);

  // Handle Title Change with Automatic Slug Generation
  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (autoSlug) {
      setSlug(generateSlug(val));
    }
  };

  // Internal Margin calculation helper (approx MYR * ~27.5 vs displayPriceBDT)
  const indicativeMYRRate = 27.5;
  const costInBDT = approxCostMYR ? Number(approxCostMYR) * indicativeMYRRate : null;
  const estimatedMargin =
    costInBDT && displayPriceBDT && Number(displayPriceBDT) > 0
      ? Number(displayPriceBDT) - costInBDT
      : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    setFormSuccess(null);
    setFieldErrors({});

    const payload = {
      title,
      slug,
      shortDesc: shortDesc || null,
      description: description || null,
      categoryId,
      status,
      pricingType,
      displayPriceBDT: displayPriceBDT ? Number(displayPriceBDT) : null,
      originCountry,
      estimatedDaysMin: estimatedDaysMin ? Number(estimatedDaysMin) : null,
      estimatedDaysMax: estimatedDaysMax ? Number(estimatedDaysMax) : null,
      sourceUrl: isStaff ? (sourceUrl || null) : null,
      defaultSupplierId: isStaff ? (defaultSupplierId || null) : null,
      approxCostMYR: isStaff && approxCostMYR ? Number(approxCostMYR) : null,
      adminNotes: isStaff ? (adminNotes || null) : null,
      images: images.map((img, idx) => ({
        id: img.id,
        imageUrl: img.imageUrl,
        altText: img.altText || null,
        isPrimary: Boolean(img.isPrimary),
        sortOrder: img.sortOrder ?? idx,
      })),
    };

    try {
      const res = isEditing
        ? await updateProductAction({
            ...payload,
            id: initialProduct!.id,
          })
        : await createProductAction(payload);

      if (!res.success) {
        setFormError(res.message || "Failed to save product.");
        if (res.fieldErrors) {
          setFieldErrors(res.fieldErrors);
        }
        setIsSubmitting(false);
        return;
      }

      setFormSuccess(res.message || "Product saved successfully!");
      setIsSubmitting(false);

      if (!isEditing && res.data?.id) {
        router.push(`/admin/products/${res.data.id}`);
      } else {
        router.refresh();
      }
    } catch {
      setFormError("An unexpected server error occurred while saving the product.");
      setIsSubmitting(false);
    }
  };

  const selectedCategory = categories.find((c) => c.id === categoryId);

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Error / Success Notifications */}
        {formError && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs font-medium text-rose-300">
            {formError}
          </div>
        )}
        {formSuccess && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs font-medium text-emerald-300">
            {formSuccess}
          </div>
        )}

        {/* Top Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 p-4 rounded-2xl sticky top-20 z-30 shadow-lg">
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-zinc-300 uppercase">
              Publication Status:
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ProductStatus)}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs font-medium text-zinc-100 focus:border-amber-500 focus:outline-none"
            >
              <option value={ProductStatus.DRAFT}>Draft (Private)</option>
              <option value={ProductStatus.PUBLISHED}>Published (Live in Catalogue)</option>
              <option value={ProductStatus.ARCHIVED}>Archived (Hidden from Sales)</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-700 hover:text-white transition"
            >
              👁️ Preview Storefront Page
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-amber-500 px-5 py-2 text-xs font-bold text-zinc-950 hover:bg-amber-400 transition shadow disabled:opacity-50"
            >
              {isSubmitting ? "Saving Product..." : isEditing ? "Update Product" : "Create Product"}
            </button>
          </div>
        </div>

        {/* Core Product Information */}
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl space-y-6">
          <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400">
            General Product Information
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Title */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300 mb-2">
                Product Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="e.g. OldTown White Coffee 3-in-1 Classic (15 Sticks)"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
                required
              />
              {fieldErrors.title && (
                <p className="mt-1 text-xs text-rose-400">{fieldErrors.title[0]}</p>
              )}
            </div>

            {/* Slug */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300">
                  URL Slug *
                </label>
                <label className="text-[11px] text-zinc-400 flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={autoSlug}
                    onChange={(e) => setAutoSlug(e.target.checked)}
                    className="rounded border-zinc-700 bg-zinc-950 text-amber-500"
                  />
                  Auto-generate from title
                </label>
              </div>
              <div className="flex items-center rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm">
                <span className="text-zinc-500 text-xs mr-1">/products/</span>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => {
                    setAutoSlug(false);
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
                  }}
                  placeholder="oldtown-white-coffee-classic"
                  className="w-full bg-transparent text-zinc-100 placeholder-zinc-500 focus:outline-none font-mono text-xs"
                  required
                />
              </div>
              {fieldErrors.slug && (
                <p className="mt-1 text-xs text-rose-400">{fieldErrors.slug[0]}</p>
              )}
            </div>
          </div>

          {/* Category & Pricing Type */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300 mb-2">
                Category *
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 focus:border-amber-500 focus:outline-none"
                required
              >
                <option value="">Select a category</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              {fieldErrors.categoryId && (
                <p className="mt-1 text-xs text-rose-400">{fieldErrors.categoryId[0]}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300 mb-2">
                Pricing Mode *
              </label>
              <select
                value={pricingType}
                onChange={(e) => setPricingType(e.target.value as PricingType)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 focus:border-amber-500 focus:outline-none"
              >
                <option value={PricingType.FIXED_PRICE}>Fixed BDT Price</option>
                <option value={PricingType.REQUEST_QUOTE_ONLY}>Request a Quote Only</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300 mb-2">
                Customer Display Price (BDT) {pricingType === PricingType.FIXED_PRICE ? "*" : "(Optional)"}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-xs text-zinc-500 font-bold">৳</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={displayPriceBDT}
                  onChange={(e) => setDisplayPriceBDT(e.target.value)}
                  placeholder={pricingType === PricingType.FIXED_PRICE ? "1850.00" : "Quote on demand"}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 pl-7 pr-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none font-mono"
                  required={pricingType === PricingType.FIXED_PRICE}
                />
              </div>
              {fieldErrors.displayPriceBDT && (
                <p className="mt-1 text-xs text-rose-400">{fieldErrors.displayPriceBDT[0]}</p>
              )}
            </div>
          </div>

          {/* Sourcing Origin & Estimated Timeline */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300 mb-2">
                Origin Country
              </label>
              <input
                type="text"
                value={originCountry}
                onChange={(e) => setOriginCountry(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300 mb-2">
                Est. Min Days to Dispatch
              </label>
              <input
                type="number"
                min="1"
                max="180"
                value={estimatedDaysMin}
                onChange={(e) => setEstimatedDaysMin(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300 mb-2">
                Est. Max Days to Dispatch
              </label>
              <input
                type="number"
                min="1"
                max="180"
                value={estimatedDaysMax}
                onChange={(e) => setEstimatedDaysMax(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Short Description */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300 mb-2">
              Short Summary (Visible on product card preview)
            </label>
            <input
              type="text"
              value={shortDesc}
              onChange={(e) => setShortDesc(e.target.value)}
              placeholder="Crisp 3-in-1 Malaysian roasted coffee imported fresh from Ipoh."
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
            />
          </div>

          {/* Full Description */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300 mb-2">
              Full Product Specifications / Description
            </label>
            <textarea
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed ingredients, package sizes, variant options, and sourcing notes for the customer."
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none leading-relaxed"
            />
          </div>
        </div>

        {/* Media / Image Management */}
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
          <ImageUploader images={images} onChange={setImages} />
        </div>

        {/* Strictly Confidential Admin & Operations Sourcing Data */}
        {isStaff && (
          <div className="bg-zinc-900/90 border border-amber-500/30 p-6 rounded-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-amber-500">
                  Staff Only Access
                </span>
                <h3 className="text-sm font-bold text-zinc-100">
                  Private Procurement, Supplier Cost & Internal Margin
                </h3>
              </div>
              <span className="rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 text-[11px] font-mono">
                CONFIDENTIAL
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Supplier Reference */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300 mb-2">
                  Default Malaysia Supplier
                </label>
                <select
                  value={defaultSupplierId}
                  onChange={(e) => setDefaultSupplierId(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 focus:border-amber-500 focus:outline-none"
                >
                  <option value="">None / Open Market</option>
                  {suppliers.map((sup) => (
                    <option key={sup.id} value={sup.id}>
                      {sup.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Purchase Cost MYR */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300 mb-2">
                  Approx. Sourcing Cost (MYR)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs text-zinc-500 font-bold">RM</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={approxCostMYR}
                    onChange={(e) => setApproxCostMYR(e.target.value)}
                    placeholder="35.50"
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 pl-10 pr-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              {/* Indicative Margin calculation */}
              <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800">
                <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-bold block mb-1">
                  Indicative Gross Margin
                </span>
                {estimatedMargin != null ? (
                  <div>
                    <span
                      className={`text-base font-bold font-mono ${
                        estimatedMargin >= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      ৳ {estimatedMargin.toFixed(2)} BDT
                    </span>
                    <p className="text-[10px] text-zinc-500 mt-0.5">
                      Based on ~27.5 BDT/MYR landed estimate.
                    </p>
                  </div>
                ) : (
                  <span className="text-xs text-zinc-500 italic">
                    Enter display price and MYR cost to calculate.
                  </span>
                )}
              </div>
            </div>

            {/* Sourcing Source URL */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300 mb-2">
                External Malaysian Sourcing / Catalog Reference URL
              </label>
              <input
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://www.lotuss.com.my/en/product/oldtown-coffee..."
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none font-mono"
              />
            </div>

            {/* Private Admin Notes */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300 mb-2">
                Internal Operations Remarks
              </label>
              <textarea
                rows={2}
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="e.g. Sourced via Lotus's Puchong branch; batch shelf life expires 2027."
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>
        )}
      </form>

      {/* Storefront Customer View Simulation Modal */}
      <ProductPreviewModal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        product={{
          title,
          slug,
          shortDesc,
          description,
          pricingType,
          displayPriceBDT: displayPriceBDT ? Number(displayPriceBDT) : null,
          originCountry,
          estimatedDaysMin: estimatedDaysMin ? Number(estimatedDaysMin) : null,
          estimatedDaysMax: estimatedDaysMax ? Number(estimatedDaysMax) : null,
          categoryName: selectedCategory?.name,
          images,
        }}
      />
    </>
  );
}
