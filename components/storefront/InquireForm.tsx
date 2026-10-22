"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitProductInquiryAction } from "@/lib/../app/actions/inquiry";

interface InquireFormProps {
  isAuthenticated?: boolean;
}

export function InquireForm({ isAuthenticated = false }: InquireFormProps) {
  const router = useRouter();

  const [productName, setProductName] = useState("");
  const [referenceUrl, setReferenceUrl] = useState("");
  const [brandOrModel, setBrandOrModel] = useState("");
  const [specifications, setSpecifications] = useState("");
  const [preferredOptions, setPreferredOptions] = useState("");
  const [notes, setNotes] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [targetBudgetBDT, setTargetBudgetBDT] = useState("");

  // Attachments state
  const [attachmentUrls, setAttachmentUrls] = useState<
    Array<{
      fileUrl: string;
      fileName: string;
      fileType: string;
      fileSizeBytes: number;
    }>
  >([]);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);

  // Form submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [successInfo, setSuccessInfo] = useState<{
    inquiryNumber: string;
    id: string;
  } | null>(null);

  // Handle file selection and upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (attachmentUrls.length + files.length > 5) {
      setUploadNotice("Maximum 5 attachments are allowed per inquiry.");
      return;
    }

    setUploadLoading(true);
    setUploadNotice(null);

    const newAttachments = [...attachmentUrls];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // File validation: format & size
      const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
      if (!allowedTypes.includes(file.type)) {
        setUploadNotice(`File "${file.name}" is unsupported. Only JPEG, PNG, WEBP, GIF, and AVIF are allowed.`);
        continue;
      }

      if (file.size > 5 * 1024 * 1024) {
        setUploadNotice(`File "${file.name}" exceeds the 5MB size limit.`);
        continue;
      }

      // Upload attempt to API
      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (res.ok && data.url) {
          newAttachments.push({
            fileUrl: data.url,
            fileName: data.fileName || file.name,
            fileType: data.fileType || file.type,
            fileSizeBytes: data.fileSizeBytes || file.size,
          });
        } else if (data.requiresConfiguration) {
          setUploadNotice(
            "Cloud object storage is not configured yet. You can still submit your inquiry with product links and descriptions, and our KL sourcing team will find the item!"
          );
        } else {
          setUploadNotice(data.error || "Failed to upload file.");
        }
      } catch {
        setUploadNotice("Network error while uploading attachment.");
      }
    }

    setAttachmentUrls(newAttachments);
    setUploadLoading(false);
    e.target.value = "";
  };

  const removeAttachment = (indexToRemove: number) => {
    setAttachmentUrls((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setFieldErrors({});

    if (!isAuthenticated) {
      router.push(`/login?redirect=/inquire`);
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await submitProductInquiryAction({
        productName,
        referenceUrl: referenceUrl || undefined,
        brandOrModel: brandOrModel || undefined,
        specifications: specifications || undefined,
        preferredOptions: preferredOptions || undefined,
        notes: notes || undefined,
        quantityRequested: parseInt(quantity, 10) || 1,
        targetBudgetBDT: targetBudgetBDT ? parseFloat(targetBudgetBDT) : undefined,
        attachmentUrls: attachmentUrls.length > 0 ? attachmentUrls : undefined,
      });

      if (!result.success) {
        setErrorMessage(result.message || "Failed to submit inquiry.");
        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors);
        }
      } else if (result.data) {
        setSuccessInfo({
          inquiryNumber: result.data.inquiryNumber,
          id: result.data.id,
        });
      }
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "An unexpected error occurred."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (successInfo) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-8 text-center dark:border-emerald-900/60 dark:bg-emerald-950/20">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400">
          ✓
        </div>
        <h2 className="mt-4 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Inquiry Submitted Successfully!
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          Your request has been registered with reference ID:
        </p>
        <div className="mt-3 inline-block rounded-lg bg-zinc-900 px-4 py-2 font-mono text-base font-bold text-amber-400 dark:bg-zinc-800">
          {successInfo.inquiryNumber}
        </div>
        <p className="mx-auto mt-4 max-w-md text-xs text-zinc-500 dark:text-zinc-400">
          Our Kuala Lumpur procurement team will inspect supplier availability, verify genuine batch stock, and issue an official BDT quotation with transparent air cargo freight.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => router.push(`/account/inquiries/${successInfo.id}`)}
            className="w-full sm:w-auto rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition"
          >
            Track Inquiry & View Status →
          </button>
          <button
            type="button"
            onClick={() => {
              setSuccessInfo(null);
              setProductName("");
              setReferenceUrl("");
              setBrandOrModel("");
              setSpecifications("");
              setPreferredOptions("");
              setNotes("");
              setQuantity("1");
              setTargetBudgetBDT("");
              setAttachmentUrls([]);
            }}
            className="w-full sm:w-auto rounded-lg border border-zinc-300 dark:border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            Submit Another Request
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
      {!isAuthenticated && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
          <strong>Account Required:</strong> You will be prompted to log in or register so your inquiry and quotes can be securely tracked in your dashboard.
        </div>
      )}

      {errorMessage && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Product Name */}
        <div>
          <label
            htmlFor="productName"
            className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300"
          >
            Product Name / Description *
          </label>
          <input
            type="text"
            id="productName"
            required
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="e.g. Dyson Airwrap Multi-Styler Strawberry Bronze or OldTown White Coffee Extra Rich"
            className="mt-2 w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3.5 py-2.5 text-sm text-zinc-900 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          />
          {fieldErrors.productName && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              {fieldErrors.productName[0]}
            </p>
          )}
        </div>

        {/* Reference URL and Brand/Model */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label
              htmlFor="referenceUrl"
              className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300"
            >
              Malaysia Web Link / Reference URL
            </label>
            <input
              type="url"
              id="referenceUrl"
              value={referenceUrl}
              onChange={(e) => setReferenceUrl(e.target.value)}
              placeholder="https://shopee.com.my/... or watsons.com.my/..."
              className="mt-2 w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3.5 py-2.5 text-sm text-zinc-900 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            />
            {fieldErrors.referenceUrl && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                {fieldErrors.referenceUrl[0]}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="brandOrModel"
              className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300"
            >
              Brand / Model
            </label>
            <input
              type="text"
              id="brandOrModel"
              value={brandOrModel}
              onChange={(e) => setBrandOrModel(e.target.value)}
              placeholder="e.g. Dyson, Apple, Nestlé, Padini"
              className="mt-2 w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3.5 py-2.5 text-sm text-zinc-900 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            />
            {fieldErrors.brandOrModel && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                {fieldErrors.brandOrModel[0]}
              </p>
            )}
          </div>
        </div>

        {/* Quantity and Target Budget */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label
              htmlFor="quantity"
              className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300"
            >
              Quantity Requested *
            </label>
            <input
              type="number"
              id="quantity"
              required
              min="1"
              max="10000"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="mt-2 w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3.5 py-2.5 text-sm text-zinc-900 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            />
            {fieldErrors.quantityRequested && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                {fieldErrors.quantityRequested[0]}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="targetBudgetBDT"
              className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300"
            >
              Target Budget (Optional BDT)
            </label>
            <input
              type="number"
              id="targetBudgetBDT"
              min="0"
              step="any"
              value={targetBudgetBDT}
              onChange={(e) => setTargetBudgetBDT(e.target.value)}
              placeholder="e.g. 15000"
              className="mt-2 w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3.5 py-2.5 text-sm text-zinc-900 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            />
            {fieldErrors.targetBudgetBDT && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                {fieldErrors.targetBudgetBDT[0]}
              </p>
            )}
          </div>
        </div>

        {/* Preferred Options & Variants */}
        <div>
          <label
            htmlFor="preferredOptions"
            className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300"
          >
            Preferred Options (Color, Size, Variant)
          </label>
          <input
            type="text"
            id="preferredOptions"
            value={preferredOptions}
            onChange={(e) => setPreferredOptions(e.target.value)}
            placeholder="e.g. Strawberry Bronze color, 256GB Midnight, Size 42, 500g pouch"
            className="mt-2 w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3.5 py-2.5 text-sm text-zinc-900 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
          />
          {fieldErrors.preferredOptions && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              {fieldErrors.preferredOptions[0]}
            </p>
          )}
        </div>

        {/* Specifications and Notes */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label
              htmlFor="specifications"
              className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300"
            >
              Product Specifications
            </label>
            <textarea
              id="specifications"
              rows={3}
              value={specifications}
              onChange={(e) => setSpecifications(e.target.value)}
              placeholder="Technical specs, voltage requirements, packaging details..."
              className="mt-2 w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3.5 py-2.5 text-sm text-zinc-900 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            />
            {fieldErrors.specifications && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                {fieldErrors.specifications[0]}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="notes"
              className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300"
            >
              Additional Notes / Sourcing Instructions
            </label>
            <textarea
              id="notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Preferred retailer (e.g. Sunway Pyramid branch, Official Store), urgency..."
              className="mt-2 w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3.5 py-2.5 text-sm text-zinc-900 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            />
            {fieldErrors.notes && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                {fieldErrors.notes[0]}
              </p>
            )}
          </div>
        </div>

        {/* Multiple Image / File Attachments */}
        <div className="border-t border-zinc-200 pt-6 dark:border-zinc-800">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
              Reference Images & Screenshots (Optional, max 5)
            </label>
            <span className="text-xs text-zinc-400">
              {attachmentUrls.length}/5 attached
            </span>
          </div>

          <div className="space-y-3">
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
              onChange={handleFileUpload}
              disabled={uploadLoading || attachmentUrls.length >= 5}
              className="block w-full text-xs text-zinc-500 file:mr-4 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-zinc-700 hover:file:bg-zinc-200 dark:file:bg-zinc-800 dark:file:text-zinc-200"
            />

            {uploadLoading && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 animate-pulse">
                Uploading image...
              </p>
            )}

            {uploadNotice && (
              <div className="p-3 rounded-lg text-xs bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                {uploadNotice}
              </div>
            )}

            {/* List of uploaded attachments */}
            {attachmentUrls.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                {attachmentUrls.map((att, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800/50 text-xs"
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <span className="text-zinc-400">📎</span>
                      <span className="truncate font-medium text-zinc-700 dark:text-zinc-300">
                        {att.fileName}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(idx)}
                      className="ml-2 text-red-500 hover:text-red-700 font-bold px-1"
                      title="Remove attachment"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-emerald-600 px-6 py-3.5 text-center text-sm font-bold text-white shadow-sm hover:bg-emerald-700 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
          >
            {isSubmitting ? "Submitting Inquiry..." : "Submit Product Request for Free Quote"}
          </button>
          <p className="mt-3 text-center text-xs text-zinc-500">
            Our Kuala Lumpur team will source authentic Malaysian stock and issue a guaranteed BDT quote within 2–6 hours.
          </p>
        </div>
      </form>
    </div>
  );
}
