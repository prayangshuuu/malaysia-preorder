import { prisma } from "./prisma";
import { Prisma, ProductStatus, UserRole } from "@prisma/client";
import { isAdminOrStaffRole } from "./auth/rbac";

/**
 * Filter and pagination query parameters for admin product listing
 */
export interface AdminProductListQuery {
  search?: string;
  categoryId?: string;
  status?: ProductStatus | "ALL";
  sortBy?: "newest" | "oldest" | "title_asc" | "title_desc" | "price_asc" | "price_desc";
  page?: number;
  pageSize?: number;
}

/**
 * Admin Product Projection:
 * - Can include admin supplier cost and sourcing URL ONLY if requesting role has staff permissions.
 * - Enforces zero leakage if user role is not staff.
 */
export async function getAdminProducts(
  query: AdminProductListQuery = {},
  userRole?: UserRole
) {
  const isStaff = userRole ? isAdminOrStaffRole(userRole) : false;
  const {
    search,
    categoryId,
    status = "ALL",
    sortBy = "newest",
    page = 1,
    pageSize = 15,
  } = query;

  const currentPage = Math.max(1, page);
  const skip = (currentPage - 1) * pageSize;

  const whereClause: Prisma.ProductWhereInput = {};

  if (status !== "ALL" && Object.values(ProductStatus).includes(status as ProductStatus)) {
    whereClause.status = status as ProductStatus;
  }

  if (categoryId && categoryId !== "ALL") {
    whereClause.categoryId = categoryId;
  }

  if (search && search.trim() !== "") {
    const q = search.trim();
    whereClause.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { slug: { contains: q, mode: "insensitive" } },
      { shortDesc: { contains: q, mode: "insensitive" } },
    ];
  }

  let orderBy: Prisma.ProductOrderByWithRelationInput[] = [{ createdAt: "desc" }];
  switch (sortBy) {
    case "oldest":
      orderBy = [{ createdAt: "asc" }];
      break;
    case "title_asc":
      orderBy = [{ title: "asc" }];
      break;
    case "title_desc":
      orderBy = [{ title: "desc" }];
      break;
    case "price_asc":
      orderBy = [{ displayPriceBDT: "asc" }];
      break;
    case "price_desc":
      orderBy = [{ displayPriceBDT: "desc" }];
      break;
    case "newest":
    default:
      orderBy = [{ createdAt: "desc" }];
      break;
  }

  const [products, totalCount] = await Promise.all([
    prisma.product.findMany({
      where: whereClause,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        images: {
          orderBy: [
            { isPrimary: "desc" },
            { sortOrder: "asc" },
          ],
          take: 1,
        },
        defaultSupplier: isStaff
          ? {
              select: {
                id: true,
                name: true,
                city: true,
              },
            }
          : false,
      },
      orderBy,
      take: pageSize,
      skip,
    }),
    prisma.product.count({ where: whereClause }),
  ]);

  // If not staff, strip private supplier cost and admin notes completely
  const sanitizedProducts = products.map((product) => {
    if (!isStaff) {
      const copy = { ...product };
      delete (copy as { approxCostMYR?: unknown }).approxCostMYR;
      delete (copy as { sourceUrl?: unknown }).sourceUrl;
      delete (copy as { adminNotes?: unknown }).adminNotes;
      delete (copy as { defaultSupplierId?: unknown }).defaultSupplierId;
      return copy;
    }
    return product;
  });

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  return {
    products: sanitizedProducts,
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

/**
 * Get full product by ID for admin editor
 */
export async function getAdminProductById(id: string, userRole?: UserRole) {
  const isStaff = userRole ? isAdminOrStaffRole(userRole) : false;

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: true,
      images: {
        orderBy: [
          { isPrimary: "desc" },
          { sortOrder: "asc" },
        ],
      },
      defaultSupplier: isStaff ? true : false,
    },
  });

  if (!product) return null;

  if (!isStaff) {
    const copy = { ...product };
    delete (copy as { approxCostMYR?: unknown }).approxCostMYR;
    delete (copy as { sourceUrl?: unknown }).sourceUrl;
    delete (copy as { adminNotes?: unknown }).adminNotes;
    delete (copy as { defaultSupplierId?: unknown }).defaultSupplierId;
    return copy;
  }

  return product;
}

/**
 * Get category tree and list with product counts for admin
 */
export async function getAdminCategories() {
  return prisma.productCategory.findMany({
    orderBy: [
      { displayOrder: "asc" },
      { name: "asc" },
    ],
    include: {
      parent: {
        select: {
          id: true,
          name: true,
        },
      },
      _count: {
        select: {
          products: true,
          children: true,
        },
      },
    },
  });
}
