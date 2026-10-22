import { prisma } from "./prisma";
import { ProductStatus, Prisma } from "@prisma/client";

/**
 * Customer-Safe Product Select Projection.
 * 
 * STRICT SECURITY INVARIANT (from MASTER_PROMPT.md):
 * - MUST NOT expose approxCostMYR, supplier details (sourceUrl, defaultSupplier, defaultSupplierId),
 *   internal margin, or adminNotes.
 * - Sourced only from saved, published database records.
 */
export const customerSafeProductSelect = {
  id: true,
  title: true,
  slug: true,
  shortDesc: true,
  description: true,
  status: true,
  pricingType: true,
  displayPriceBDT: true,
  estimatedDaysMin: true,
  estimatedDaysMax: true,
  originCountry: true,
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
  images: {
    select: {
      id: true,
      imageUrl: true,
      altText: true,
      isPrimary: true,
      sortOrder: true,
    },
    orderBy: [
      { isPrimary: "desc" as const },
      { sortOrder: "asc" as const },
    ],
  },
  createdAt: true,
  updatedAt: true,
};

export type CustomerSafeProduct = Awaited<
  ReturnType<typeof getProductBySlug>
>;

export interface ProductCatalogQuery {
  categorySlug?: string;
  search?: string;
  sortBy?: "featured" | "newest" | "price_asc" | "price_desc" | "name_asc";
  page?: number;
  pageSize?: number;
}

export async function getPublishedProducts(query: ProductCatalogQuery = {}) {
  const {
    categorySlug,
    search,
    sortBy = "newest",
    page = 1,
    pageSize = 12,
  } = query;

  const currentPage = Math.max(1, page);
  const skip = (currentPage - 1) * pageSize;

  const whereClause: Prisma.ProductWhereInput = {
    status: ProductStatus.PUBLISHED,
  };

  if (categorySlug && categorySlug !== "all") {
    whereClause.category = {
      slug: categorySlug,
      isActive: true,
    };
  }

  if (search && search.trim() !== "") {
    const q = search.trim();
    whereClause.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { shortDesc: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ];
  }

  let orderBy: Prisma.ProductOrderByWithRelationInput[] = [
    { createdAt: "desc" },
  ];

  if (sortBy === "price_asc") {
    orderBy = [{ displayPriceBDT: "asc" }, { createdAt: "desc" }];
  } else if (sortBy === "price_desc") {
    orderBy = [{ displayPriceBDT: "desc" }, { createdAt: "desc" }];
  } else if (sortBy === "name_asc") {
    orderBy = [{ title: "asc" }];
  } else if (sortBy === "featured" || sortBy === "newest") {
    orderBy = [{ createdAt: "desc" }];
  }

  const [products, totalCount] = await Promise.all([
    prisma.product.findMany({
      where: whereClause,
      select: customerSafeProductSelect,
      orderBy,
      take: pageSize,
      skip,
    }),
    prisma.product.count({
      where: whereClause,
    }),
  ]);

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  return {
    products,
    pagination: {
      currentPage,
      pageSize,
      totalCount,
      totalPages,
      hasNextPage: currentPage < totalPages,
      hasPrevPage: currentPage > 1,
    },
  };
}

export async function getProductBySlug(slug: string) {
  return prisma.product.findFirst({
    where: {
      slug,
      status: ProductStatus.PUBLISHED,
    },
    select: customerSafeProductSelect,
  });
}

export async function getAllCategories() {
  return prisma.productCategory.findMany({
    where: {
      isActive: true,
    },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    include: {
      _count: {
        select: {
          products: {
            where: {
              status: ProductStatus.PUBLISHED,
            },
          },
        },
      },
    },
  });
}

export async function getFeaturedProducts(limit = 4) {
  return prisma.product.findMany({
    where: {
      status: ProductStatus.PUBLISHED,
    },
    select: customerSafeProductSelect,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
