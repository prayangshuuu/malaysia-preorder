import { getStorageConfig } from "@/lib/storage";

interface ImageUploaderProps {
  images: Array<{
    id?: string;
    imageUrl: string;
    altText?: string | null;
    isPrimary?: boolean;
    sortOrder?: number;
  }>;
  onChange: (images: Array<{
    id?: string;
    imageUrl: string;
    altText?: string | null;
    isPrimary?: boolean;
    sortOrder?: number;
  }>) => void;
  error?: string;
}

export function ImageUploader({ images, onChange, error }: ImageUploaderProps) {
  const storageConfig = getStorageConfig();

  const handleAddUrl = (url: string) => {
    if (!url.trim()) return;
    const isFirst = images.length === 0;
    onChange([
      ...images,
      {
        imageUrl: url.trim(),
        altText: "",
        isPrimary: isFirst,
        sortOrder: images.length,
      },
    ]);
  };

  const handleRemove = (index: number) => {
    const updated = images.filter((_, i) => i !== index);
    // If the removed item was primary and there are remaining items, make the first one primary
    if (images[index]?.isPrimary && updated.length > 0) {
      updated[0].isPrimary = true;
    }
    onChange(updated);
  };

  const handleSetPrimary = (index: number) => {
    const updated = images.map((img, i) => ({
      ...img,
      isPrimary: i === index,
    }));
    onChange(updated);
  };

  const handleAltChange = (index: number, altText: string) => {
    const updated = [...images];
    updated[index] = { ...updated[index], altText };
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300">
          Product Images & Media
        </label>
        <span className="text-xs text-zinc-400">
          {images.length} {images.length === 1 ? "image" : "images"} added
        </span>
      </div>

      {/* Cloud Object Storage Provider Status Alert */}
      {!storageConfig.isConfigured ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-200">
          <div className="flex items-start space-x-2">
            <span className="text-base leading-none">⚠️</span>
            <div>
              <p className="font-semibold text-amber-300">
                Direct File Upload Disabled: Object Storage Not Configured
              </p>
              <p className="mt-1 text-amber-200/80 leading-relaxed">
                Production-ready S3 object storage credentials are not yet configured in environment variables (missing:{" "}
                <code className="text-amber-300 font-mono">
                  {storageConfig.missingKeys.join(", ")}
                </code>
                ). Local serverless uploads are intentionally disallowed in compliance with production data standards.
                You can safely paste secure, verified image URLs directly below.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-200">
          <p className="font-semibold text-emerald-300">✓ S3 Storage Connected</p>
          <p className="mt-0.5 text-emerald-200/80">
            Storage bucket: <code className="font-mono">{storageConfig.bucketName}</code> ({storageConfig.region})
          </p>
        </div>
      )}

      {/* URL Input Form */}
      <div className="flex gap-2">
        <input
          id="new-image-url-input"
          type="url"
          placeholder="https://example.com/images/product-sample.jpg"
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              const target = e.currentTarget;
              handleAddUrl(target.value);
              target.value = "";
            }
          }}
        />
        <button
          type="button"
          onClick={() => {
            const input = document.getElementById("new-image-url-input") as HTMLInputElement;
            if (input && input.value) {
              handleAddUrl(input.value);
              input.value = "";
            }
          }}
          className="rounded-lg bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-700 transition"
        >
          Add Image URL
        </button>
      </div>

      {error && <p className="text-xs text-rose-400 font-medium">{error}</p>}

      {/* Image Previews Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
          {images.map((img, index) => (
            <div
              key={index}
              className={`group relative rounded-xl border p-2.5 transition ${
                img.isPrimary
                  ? "border-amber-500/70 bg-amber-500/5"
                  : "border-zinc-800 bg-zinc-900/60"
              }`}
            >
              <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-zinc-950 mb-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.imageUrl}
                  alt={img.altText || `Product image ${index + 1}`}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    // Fallback visual indicator on broken link
                    (e.target as HTMLImageElement).src =
                      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='60' viewBox='0 0 100 60'%3E%3Crect width='100' height='60' fill='%2327272a'/%3E%3Ctext x='50' y='32' font-size='10' fill='%23a1a1aa' text-anchor='middle'%3EBroken URL%3C/text%3E%3C/svg%3E";
                  }}
                />
                {img.isPrimary && (
                  <span className="absolute top-1.5 left-1.5 rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold uppercase text-zinc-950 shadow">
                    Primary
                  </span>
                )}
              </div>

              <div className="space-y-1.5">
                <input
                  type="text"
                  placeholder="Alt / descriptive text"
                  value={img.altText || ""}
                  onChange={(e) => handleAltChange(index, e.target.value)}
                  className="w-full rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-[11px] text-zinc-200 placeholder-zinc-600 focus:border-amber-500 focus:outline-none"
                />

                <div className="flex items-center justify-between pt-1">
                  {!img.isPrimary ? (
                    <button
                      type="button"
                      onClick={() => handleSetPrimary(index)}
                      className="text-[11px] text-amber-400 hover:text-amber-300 transition"
                    >
                      ★ Set as primary
                    </button>
                  ) : (
                    <span className="text-[11px] text-amber-500 font-medium">
                      ★ Primary Cover
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => handleRemove(index)}
                    className="text-[11px] text-rose-400 hover:text-rose-300 transition"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
