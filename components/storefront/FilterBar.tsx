"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition, useState } from "react";

interface CategoryOption {
  id: string;
  name: string;
  slug: string;
  _count?: {
    products: number;
  };
}

interface FilterBarProps {
  categories: CategoryOption[];
  currentCategory?: string;
  currentSearch?: string;
  currentSort?: string;
}

export function FilterBar({
  categories,
  currentCategory = "all",
  currentSearch = "",
  currentSort = "newest",
}: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [searchTerm, setSearchTerm] = useState(currentSearch);

  function updateQuery(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    
    // Always reset page to 1 on filter/search change
    if (!updates.page) {
      params.delete("page");
    }

    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === "" || value === "all") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateQuery({ search: searchTerm.trim() });
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 mb-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        {/* Search input */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search products by title or keywords..."
            className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3.5 py-2 pl-9 text-sm text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder-zinc-500"
          />
          <svg
            className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </form>

        <div className="flex flex-wrap items-center gap-3">
          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <label htmlFor="category-select" className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
              Category:
            </label>
            <select
              id="category-select"
              value={currentCategory}
              onChange={(e) => updateQuery({ category: e.target.value })}
              className="rounded-lg border border-zinc-300 bg-zinc-50 py-1.5 px-3 text-xs font-medium text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.slug}>
                  {cat.name} {cat._count ? `(${cat._count.products})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Sort order */}
          <div className="flex items-center gap-2">
            <label htmlFor="sort-select" className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
              Sort by:
            </label>
            <select
              id="sort-select"
              value={currentSort}
              onChange={(e) => updateQuery({ sort: e.target.value })}
              className="rounded-lg border border-zinc-300 bg-zinc-50 py-1.5 px-3 text-xs font-medium text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
            >
              <option value="newest">Newest Arrivals</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="name_asc">Alphabetical (A-Z)</option>
            </select>
          </div>

          {isPending && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400 animate-pulse font-medium">
              Updating...
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
