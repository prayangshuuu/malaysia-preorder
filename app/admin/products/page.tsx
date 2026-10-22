import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentSession } from "@/lib/auth/session";
import { requireAdminOrStaff, isAdminOrStaffRole } from "@/lib/auth/rbac";
import { getAdminProducts, getAdminCategories } from "@/lib/admin-catalog";
import { ProductStatusBadge } from "@/components/admin/ProductStatusBadge";
import { formatBDT } from "@/lib/formatters";
import { ProductStatus, PricingType } from "@prisma/client";
import { setProductStatusAction } from "@/app/actions/admin-catalog";

interface AdminProductsPageProps {
  searchParams: Promise<{
    search?: string;
    categoryId?: string;
    status?: ProductStatus | "ALL";
    sortBy?: "newest" | "oldest" | "title_asc" | "title_desc" | "price_asc" | "price_desc";
    page?: string;
  }>;
}

export default async function AdminProductsListPage({
  searchParams,
}: AdminProductsPageProps) {
  const session = await getCurrentSession();
  if (!session || !isAdminOrStaffRole(session.role)) {
    redirect("/admin/login");
  }

  await requireAdminOrStaff();

  const params = await searchParams;
  const search = params.search || "";
  const categoryId = params.categoryId || "ALL";
  const status = params.status || "ALL";
  const sortBy = params.sortBy || "newest";
  const page = parseInt(params.page || "1", 10) || 1;

  const [categories, { products, pagination }] = await Promise.all([
    getAdminCategories(),
    getAdminProducts(
      {
        search,
        categoryId,
        status,
        sortBy,
        page,
        pageSize: 15,
      },
      session.role
    ),
  ]);

  return (
    <div className="space-y-6">
      {/* Page Title & Add New Button */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-100">Product Catalogue</h1>
          <p className="text-xs text-zinc-400 mt-1">
            Manage Malaysia sourced pre-order products, pricing, publication status, and sourcing terms.
          </p>
        </div>
        <Link
          href="/admin/products/new"
          className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-zinc-950 hover:bg-amber-400 transition shadow"
        >
          + Add New Product
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <form method="GET" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {/* Search Input */}
          <div className="md:col-span-2">
            <input
              type="text"
              name="search"
              defaultValue={search}
              placeholder="Search by title, slug, or summary..."
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
            />
          </div>

          {/* Category Filter */}
          <div>
            <select
              name="categoryId"
              defaultValue={categoryId}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 focus:border-amber-500 focus:outline-none"
            >
              <option value="ALL">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              name="status"
              defaultValue={status}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 focus:border-amber-500 focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value={ProductStatus.PUBLISHED}>Published</option>
              <option value={ProductStatus.DRAFT}>Draft</option>
              <option value={ProductStatus.ARCHIVED}>Archived</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 transition py-2"
            >
              Filter
            </button>
            <Link
              href="/admin/products"
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-400 hover:text-white transition"
            >
              Reset
            </Link>
          </div>
        </form>
      </div>

      {/* Results Meta */}
      <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
        <span>
          Showing {products.length} of {pagination.totalCount} products
        </span>
        <span>Page {pagination.currentPage} of {pagination.totalPages}</span>
      </div>

      {/* Product Table */}
      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950/60 text-zinc-400 uppercase tracking-wider border-b border-zinc-800 font-semibold">
              <tr>
                <th className="px-4 py-3.5">Product</th>
                <th className="px-4 py-3.5">Category</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Display Price (BDT)</th>
                {isAdminOrStaffRole(session.role) && (
                  <th className="px-4 py-3.5">Cost (MYR)</th>
                )}
                <th className="px-4 py-3.5">Sourcing Window</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 text-zinc-300">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-zinc-500">
                    <div className="max-w-sm mx-auto space-y-2">
                      <p className="font-semibold text-zinc-400">No products found</p>
                      <p className="text-[11px] text-zinc-500">
                        Try adjusting your search filters, or click &quot;Add New Product&quot; to list a new item.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                products.map((product) => {
                  const primaryImg = product.images[0]?.imageUrl || "https://placehold.co/100x100/27272a/ffffff?text=No+Img";
                  return (
                    <tr key={product.id} className="hover:bg-zinc-800/40 transition">
                      {/* Product & Thumbnail */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={primaryImg}
                            alt=""
                            className="h-10 w-10 shrink-0 rounded-lg object-cover bg-zinc-950 border border-zinc-800"
                          />
                          <div>
                            <Link
                              href={`/admin/products/${product.id}`}
                              className="font-semibold text-zinc-100 hover:text-amber-400 transition"
                            >
                              {product.title}
                            </Link>
                            <span className="block text-[11px] font-mono text-zinc-500">
                              /{product.slug}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3.5 text-zinc-400">
                        {product.category.name}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <ProductStatusBadge status={product.status} size="sm" />
                      </td>

                      {/* Price BDT */}
                      <td className="px-4 py-3.5 font-mono whitespace-nowrap">
                        {product.pricingType === PricingType.FIXED_PRICE && product.displayPriceBDT != null ? (
                          <span className="font-semibold text-emerald-400">
                            {formatBDT(product.displayPriceBDT)}
                          </span>
                        ) : (
                          <span className="text-zinc-500 italic">Quote only</span>
                        )}
                      </td>

                      {/* Staff Cost MYR */}
                      {isAdminOrStaffRole(session.role) && (
                        <td className="px-4 py-3.5 font-mono text-zinc-400 whitespace-nowrap">
                          {"approxCostMYR" in product && product.approxCostMYR != null ? (
                            <span>RM {Number(product.approxCostMYR).toFixed(2)}</span>
                          ) : (
                            <span className="text-zinc-600">—</span>
                          )}
                        </td>
                      )}

                      {/* Timeline */}
                      <td className="px-4 py-3.5 text-zinc-400 whitespace-nowrap">
                        {product.estimatedDaysMin || product.estimatedDaysMax ? (
                          <span>
                            {product.estimatedDaysMin || "?"}-{product.estimatedDaysMax || "?"} days
                          </span>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap space-x-1.5">
                        {/* Quick Publish / Unpublish Toggle */}
                        {product.status !== ProductStatus.PUBLISHED ? (
                          <form
                            action={async () => {
                              "use server";
                              await setProductStatusAction(product.id, ProductStatus.PUBLISHED);
                            }}
                            className="inline"
                          >
                            <button
                              type="submit"
                              className="rounded px-2 py-1 text-[11px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition"
                            >
                              Publish
                            </button>
                          </form>
                        ) : (
                          <form
                            action={async () => {
                              "use server";
                              await setProductStatusAction(product.id, ProductStatus.DRAFT);
                            }}
                            className="inline"
                          >
                            <button
                              type="submit"
                              className="rounded px-2 py-1 text-[11px] bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition"
                            >
                              Unpublish
                            </button>
                          </form>
                        )}

                        {/* Archive */}
                        {product.status !== ProductStatus.ARCHIVED && (
                          <form
                            action={async () => {
                              "use server";
                              await setProductStatusAction(product.id, ProductStatus.ARCHIVED);
                            }}
                            className="inline"
                          >
                            <button
                              type="submit"
                              className="rounded px-2 py-1 text-[11px] bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition"
                            >
                              Archive
                            </button>
                          </form>
                        )}

                        {/* Edit */}
                        <Link
                          href={`/admin/products/${product.id}`}
                          className="inline-block rounded px-2.5 py-1 text-[11px] font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition"
                        >
                          Edit
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          {pagination.hasPrevPage && (
            <Link
              href={`/admin/products?page=${pagination.currentPage - 1}&search=${encodeURIComponent(
                search
              )}&categoryId=${categoryId}&status=${status}&sortBy=${sortBy}`}
              className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 transition"
            >
              Previous
            </Link>
          )}
          <span className="text-xs text-zinc-500 px-2">
            Page {pagination.currentPage} of {pagination.totalPages}
          </span>
          {pagination.hasNextPage && (
            <Link
              href={`/admin/products?page=${pagination.currentPage + 1}&search=${encodeURIComponent(
                search
              )}&categoryId=${categoryId}&status=${status}&sortBy=${sortBy}`}
              className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 transition"
            >
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
