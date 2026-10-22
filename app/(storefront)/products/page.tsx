import { getPublishedProducts, getAllCategories } from "@/lib/products";
import { ProductCard } from "@/components/storefront/ProductCard";
import { FilterBar } from "@/components/storefront/FilterBar";
import { Pagination } from "@/components/storefront/Pagination";
import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Product Catalogue | Direct Malaysia Sourced Goods",
  description:
    "Browse authentic Malaysian snacks, coffee, cosmetics, wellness vitamins, and electronics with transparent BDT pricing and scheduled delivery to Bangladesh.",
  alternates: {
    canonical: "/products",
  },
  openGraph: {
    title: "Malaysia Pre-Order Catalogue - Bangladesh Delivery",
    description:
      "Explore verified Malaysian products available for pre-order. Sourced directly in MYR, delivered to Dhaka & nationwide in BDT.",
  },
};

interface ProductsPageProps {
  searchParams: Promise<{
    category?: string;
    search?: string;
    sort?: "featured" | "newest" | "price_asc" | "price_desc" | "name_asc";
    page?: string;
  }>;
}

export default async function ProductsCataloguePage({
  searchParams,
}: ProductsPageProps) {
  const resolvedParams = await searchParams;
  const currentCategory = resolvedParams.category || "all";
  const currentSearch = resolvedParams.search || "";
  const currentSort = resolvedParams.sort || "newest";
  const currentPage = parseInt(resolvedParams.page || "1", 10) || 1;

  const [categories, { products, pagination }] = await Promise.all([
    getAllCategories(),
    getPublishedProducts({
      categorySlug: currentCategory,
      search: currentSearch,
      sortBy: currentSort,
      page: currentPage,
      pageSize: 12,
    }),
  ]);

  const activeCategoryObject = categories.find((c) => c.slug === currentCategory);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <nav aria-label="Breadcrumb" className="mb-2">
          <ol className="flex items-center space-x-2 text-xs text-zinc-500">
            <li>
              <Link href="/" className="hover:text-emerald-600">Home</Link>
            </li>
            <li>/</li>
            <li className="font-semibold text-zinc-800 dark:text-zinc-200">
              Catalogue
            </li>
            {activeCategoryObject && (
              <>
                <li>/</li>
                <li className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  {activeCategoryObject.name}
                </li>
              </>
            )}
          </ol>
        </nav>

        <h1 className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-50">
          {activeCategoryObject ? activeCategoryObject.name : "Pre-Order Catalogue"}
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 max-w-3xl">
          {activeCategoryObject?.description ||
            "All items are sourced directly from authorized retailers and hypermarkets across Malaysia upon order confirmation, flown to Dhaka, and delivered straight to you."}
        </p>
      </div>

      {/* Filter and Search Bar */}
      <Suspense fallback={<div className="h-16 w-full bg-zinc-100 dark:bg-zinc-800 rounded-xl mb-8 animate-pulse" />}>
        <FilterBar
          categories={categories}
          currentCategory={currentCategory}
          currentSearch={currentSearch}
          currentSort={currentSort}
        />
      </Suspense>

      {/* Results Count & Current Active Filters */}
      <div className="mb-6 flex items-center justify-between text-xs text-zinc-500">
        <span>
          Showing {products.length} of {pagination.totalCount} products
        </span>
        {(currentSearch || currentCategory !== "all") && (
          <Link
            href="/products"
            className="font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
          >
            Clear all filters
          </Link>
        )}
      </div>

      {/* Product Grid */}
      {products.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-2xl dark:bg-zinc-800">
            🔍
          </div>
          <h3 className="mt-4 text-base font-bold text-zinc-900 dark:text-zinc-100">
            No matching products found
          </h3>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
            We couldn’t find any listed products matching your criteria. But don’t worry—our team in Malaysia can source almost anything!
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/inquire"
              className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
            >
              Request This Product
            </Link>
            <Link
              href="/products"
              className="rounded-lg border border-zinc-300 bg-zinc-50 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            >
              Reset Filters
            </Link>
          </div>
        </div>
      )}

      {/* Pagination */}
      <Pagination
        currentPage={pagination.currentPage}
        totalPages={pagination.totalPages}
        baseUrl="/products"
        queryParams={{
          category: currentCategory !== "all" ? currentCategory : undefined,
          search: currentSearch || undefined,
          sort: currentSort !== "newest" ? currentSort : undefined,
        }}
      />
    </div>
  );
}
