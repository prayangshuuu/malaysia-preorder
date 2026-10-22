import { ProductStatus } from "@prisma/client";

interface ProductStatusBadgeProps {
  status: ProductStatus;
  size?: "sm" | "md";
}

export function ProductStatusBadge({ status, size = "md" }: ProductStatusBadgeProps) {
  const sizeClasses = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";

  switch (status) {
    case ProductStatus.PUBLISHED:
      return (
        <span
          className={`inline-flex items-center gap-1 font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 ${sizeClasses}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Published
        </span>
      );
    case ProductStatus.DRAFT:
      return (
        <span
          className={`inline-flex items-center gap-1 font-semibold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 ${sizeClasses}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          Draft
        </span>
      );
    case ProductStatus.ARCHIVED:
      return (
        <span
          className={`inline-flex items-center gap-1 font-semibold rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700 ${sizeClasses}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
          Archived
        </span>
      );
    default:
      return (
        <span className={`inline-flex items-center font-medium rounded-full bg-zinc-800 text-zinc-400 ${sizeClasses}`}>
          {status}
        </span>
      );
  }
}
