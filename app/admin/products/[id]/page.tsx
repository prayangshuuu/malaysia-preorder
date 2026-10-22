import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentSession } from "@/lib/auth/session";
import { requireAdminOrStaff, isAdminOrStaffRole } from "@/lib/auth/rbac";
import { getAdminProductById, getAdminCategories } from "@/lib/admin-catalog";
import { prisma } from "@/lib/prisma";
import { ProductForm } from "@/components/admin/ProductForm";
import { ProductStatusBadge } from "@/components/admin/ProductStatusBadge";

interface AdminEditProductPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminEditProductPage({
  params,
}: AdminEditProductPageProps) {
  const session = await getCurrentSession();
  if (!session || !isAdminOrStaffRole(session.role)) {
    redirect("/admin/login");
  }

  await requireAdminOrStaff();

  const { id } = await params;

  const [product, categories, suppliers] = await Promise.all([
    getAdminProductById(id, session.role),
    getAdminCategories(),
    prisma.supplier.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!product) {
    notFound();
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Breadcrumb Navigation & Status */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-2 text-xs text-zinc-400">
          <Link href="/admin/products" className="hover:text-amber-400 transition">
            Products
          </Link>
          <span>/</span>
          <span className="text-zinc-200 font-semibold">{product.title}</span>
        </div>

        <div className="flex items-center gap-2">
          <ProductStatusBadge status={product.status} size="sm" />
          <Link
            href={`/products/${product.slug}`}
            target="_blank"
            className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold"
          >
            Storefront URL ↗
          </Link>
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Edit Product: {product.title}</h1>
        <p className="text-xs text-zinc-400 mt-1 font-mono">
          Product ID: {product.id} • Slug: /{product.slug}
        </p>
      </div>

      <ProductForm
        initialProduct={{
          id: product.id,
          title: product.title,
          slug: product.slug,
          shortDesc: product.shortDesc,
          description: product.description,
          categoryId: product.categoryId,
          status: product.status,
          pricingType: product.pricingType,
          displayPriceBDT: product.displayPriceBDT ? Number(product.displayPriceBDT) : null,
          originCountry: product.originCountry,
          estimatedDaysMin: product.estimatedDaysMin,
          estimatedDaysMax: product.estimatedDaysMax,
          sourceUrl: "sourceUrl" in product ? (product.sourceUrl as string | null) : null,
          defaultSupplierId:
            "defaultSupplierId" in product ? (product.defaultSupplierId as string | null) : null,
          approxCostMYR:
            "approxCostMYR" in product && product.approxCostMYR != null
              ? Number(product.approxCostMYR)
              : null,
          adminNotes: "adminNotes" in product ? (product.adminNotes as string | null) : null,
          images: product.images.map((img) => ({
            id: img.id,
            imageUrl: img.imageUrl,
            altText: img.altText,
            isPrimary: img.isPrimary,
            sortOrder: img.sortOrder,
          })),
        }}
        categories={categories}
        suppliers={suppliers}
        isStaff={isAdminOrStaffRole(session.role)}
      />
    </div>
  );
}
