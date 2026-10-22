"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminOrStaff } from "@/lib/auth/rbac";
import { logAudit } from "@/lib/audit";
import {
  categoryCreateSchema,
  categoryUpdateSchema,
  reorderCategoriesSchema,
  productCreateSchema,
  productUpdateSchema,
  CategoryCreateInput,
  CategoryUpdateInput,
  ProductCreateInput,
  ProductUpdateInput,
} from "@/lib/validations/admin-product";
import { ProductStatus } from "@prisma/client";

export interface ActionResult<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  fieldErrors?: Record<string, string[]>;
}

// -----------------------------------------------------------------------------
// CATEGORY ACTIONS
// -----------------------------------------------------------------------------

export async function createCategoryAction(
  rawInput: CategoryCreateInput
): Promise<ActionResult<{ id: string; slug: string }>> {
  try {
    const session = await requireAdminOrStaff();

    const parsed = categoryCreateSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        message: "Invalid category data. Please fix the validation errors.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const { name, slug, description, imageUrl, parentId, displayOrder, isActive } =
      parsed.data;

    // Check slug uniqueness
    const existing = await prisma.productCategory.findUnique({
      where: { slug },
    });

    if (existing) {
      return {
        success: false,
        message: "Category slug already in use. Please enter a unique slug.",
        fieldErrors: { slug: ["This slug is already used by another category."] },
      };
    }

    // Verify parent exists if provided
    if (parentId) {
      const parentExists = await prisma.productCategory.findUnique({
        where: { id: parentId },
      });
      if (!parentExists) {
        return {
          success: false,
          message: "Selected parent category does not exist.",
          fieldErrors: { parentId: ["Selected parent category does not exist."] },
        };
      }
    }

    const category = await prisma.productCategory.create({
      data: {
        name,
        slug,
        description: description || null,
        imageUrl: imageUrl || null,
        parentId: parentId || null,
        displayOrder,
        isActive,
      },
    });

    await logAudit({
      actorId: session.userId,
      actorEmail: session.email,
      actorRole: session.role,
      action: "CATEGORY_CREATED",
      entityType: "ProductCategory",
      entityId: category.id,
      metadata: { name: category.name, slug: category.slug },
    });

    revalidatePath("/admin/categories");
    revalidatePath("/products");
    revalidatePath("/");

    return {
      success: true,
      message: `Category "${category.name}" created successfully.`,
      data: { id: category.id, slug: category.slug },
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to create category.";
    return { success: false, message: errorMsg };
  }
}

export async function updateCategoryAction(
  rawInput: CategoryUpdateInput
): Promise<ActionResult<{ id: string; slug: string }>> {
  try {
    const session = await requireAdminOrStaff();

    const parsed = categoryUpdateSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        message: "Invalid category update data.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const { id, name, slug, description, imageUrl, parentId, displayOrder, isActive } =
      parsed.data;

    const current = await prisma.productCategory.findUnique({
      where: { id },
    });

    if (!current) {
      return { success: false, message: "Category not found." };
    }

    // Check slug uniqueness against other records
    if (slug !== current.slug) {
      const existingSlug = await prisma.productCategory.findUnique({
        where: { slug },
      });
      if (existingSlug && existingSlug.id !== id) {
        return {
          success: false,
          message: "Slug is already taken by another category.",
          fieldErrors: { slug: ["This slug is already used by another category."] },
        };
      }
    }

    // Prevent self-referencing hierarchy
    if (parentId && parentId === id) {
      return {
        success: false,
        message: "A category cannot be its own parent.",
        fieldErrors: { parentId: ["Category cannot be its own parent."] },
      };
    }

    const updated = await prisma.productCategory.update({
      where: { id },
      data: {
        name,
        slug,
        description: description || null,
        imageUrl: imageUrl || null,
        parentId: parentId || null,
        displayOrder,
        isActive,
      },
    });

    await logAudit({
      actorId: session.userId,
      actorEmail: session.email,
      actorRole: session.role,
      action: "CATEGORY_UPDATED",
      entityType: "ProductCategory",
      entityId: updated.id,
      metadata: { name: updated.name, slug: updated.slug, prevSlug: current.slug },
    });

    revalidatePath("/admin/categories");
    revalidatePath("/products");
    revalidatePath("/");

    return {
      success: true,
      message: `Category "${updated.name}" updated successfully.`,
      data: { id: updated.id, slug: updated.slug },
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to update category.";
    return { success: false, message: errorMsg };
  }
}

export async function deleteCategoryAction(
  categoryId: string
): Promise<ActionResult> {
  try {
    const session = await requireAdminOrStaff();

    const category = await prisma.productCategory.findUnique({
      where: { id: categoryId },
      include: {
        _count: {
          select: { products: true, children: true },
        },
      },
    });

    if (!category) {
      return { success: false, message: "Category not found." };
    }

    if (category._count.products > 0) {
      return {
        success: false,
        message: `Cannot delete category because it has ${category._count.products} associated product(s). Reassign them first.`,
      };
    }

    if (category._count.children > 0) {
      return {
        success: false,
        message: `Cannot delete category because it has ${category._count.children} child subcategory(ies).`,
      };
    }

    await prisma.productCategory.delete({
      where: { id: categoryId },
    });

    await logAudit({
      actorId: session.userId,
      actorEmail: session.email,
      actorRole: session.role,
      action: "CATEGORY_DELETED",
      entityType: "ProductCategory",
      entityId: categoryId,
      metadata: { name: category.name, slug: category.slug },
    });

    revalidatePath("/admin/categories");
    revalidatePath("/products");
    revalidatePath("/");

    return { success: true, message: `Category "${category.name}" removed.` };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to delete category.";
    return { success: false, message: errorMsg };
  }
}

export async function reorderCategoriesAction(
  input: { orders: { id: string; displayOrder: number }[] }
): Promise<ActionResult> {
  try {
    const session = await requireAdminOrStaff();
    const parsed = reorderCategoriesSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, message: "Invalid reorder payload." };
    }

    await prisma.$transaction(
      parsed.data.orders.map((item) =>
        prisma.productCategory.update({
          where: { id: item.id },
          data: { displayOrder: item.displayOrder },
        })
      )
    );

    await logAudit({
      actorId: session.userId,
      actorEmail: session.email,
      actorRole: session.role,
      action: "CATEGORIES_REORDERED",
      entityType: "ProductCategory",
      metadata: { count: parsed.data.orders.length },
    });

    revalidatePath("/admin/categories");
    revalidatePath("/products");
    revalidatePath("/");

    return { success: true, message: "Category display orders updated." };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to reorder categories.";
    return { success: false, message: errorMsg };
  }
}

// -----------------------------------------------------------------------------
// PRODUCT ACTIONS
// -----------------------------------------------------------------------------

export async function createProductAction(
  rawInput: ProductCreateInput
): Promise<ActionResult<{ id: string; slug: string }>> {
  try {
    const session = await requireAdminOrStaff();

    const parsed = productCreateSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        message: "Invalid product information. Please review the highlighted fields.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const {
      title,
      slug,
      shortDesc,
      description,
      categoryId,
      status,
      pricingType,
      displayPriceBDT,
      originCountry,
      estimatedDaysMin,
      estimatedDaysMax,
      sourceUrl,
      defaultSupplierId,
      approxCostMYR,
      adminNotes,
      images,
    } = parsed.data;

    // Check slug uniqueness
    const existing = await prisma.product.findUnique({
      where: { slug },
    });

    if (existing) {
      return {
        success: false,
        message: "A product with this slug already exists. Please customize the slug.",
        fieldErrors: { slug: ["Slug must be globally unique."] },
      };
    }

    // Verify category exists
    const category = await prisma.productCategory.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      return {
        success: false,
        message: "Selected category does not exist.",
        fieldErrors: { categoryId: ["Selected category does not exist."] },
      };
    }

    // Create product and its image records in transaction
    const newProduct = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          title,
          slug,
          shortDesc: shortDesc || null,
          description: description || null,
          categoryId,
          status,
          pricingType,
          displayPriceBDT: displayPriceBDT != null ? displayPriceBDT : null,
          originCountry: originCountry || "Malaysia",
          estimatedDaysMin: estimatedDaysMin ?? null,
          estimatedDaysMax: estimatedDaysMax ?? null,
          sourceUrl: sourceUrl || null,
          defaultSupplierId: defaultSupplierId || null,
          approxCostMYR: approxCostMYR != null ? approxCostMYR : null,
          adminNotes: adminNotes || null,
          images: {
            create: images.map((img, idx) => ({
              imageUrl: img.imageUrl,
              altText: img.altText || null,
              isPrimary: img.isPrimary ?? (idx === 0),
              sortOrder: img.sortOrder ?? idx,
            })),
          },
        },
      });

      return created;
    });

    await logAudit({
      actorId: session.userId,
      actorEmail: session.email,
      actorRole: session.role,
      action: "PRODUCT_CREATED",
      entityType: "Product",
      entityId: newProduct.id,
      metadata: {
        title: newProduct.title,
        slug: newProduct.slug,
        status: newProduct.status,
      },
    });

    revalidatePath("/admin/products");
    revalidatePath("/products");
    revalidatePath(`/products/${newProduct.slug}`);
    revalidatePath("/");

    return {
      success: true,
      message: `Product "${newProduct.title}" created successfully.`,
      data: { id: newProduct.id, slug: newProduct.slug },
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to create product.";
    return { success: false, message: errorMsg };
  }
}

export async function updateProductAction(
  rawInput: ProductUpdateInput
): Promise<ActionResult<{ id: string; slug: string }>> {
  try {
    const session = await requireAdminOrStaff();

    const parsed = productUpdateSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        message: "Invalid product information. Please review the highlighted fields.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const {
      id,
      title,
      slug,
      shortDesc,
      description,
      categoryId,
      status,
      pricingType,
      displayPriceBDT,
      originCountry,
      estimatedDaysMin,
      estimatedDaysMax,
      sourceUrl,
      defaultSupplierId,
      approxCostMYR,
      adminNotes,
      images,
    } = parsed.data;

    const existing = await prisma.product.findUnique({
      where: { id },
      include: { images: true },
    });

    if (!existing) {
      return { success: false, message: "Product not found." };
    }

    // Check slug uniqueness against other records
    if (slug !== existing.slug) {
      const slugClash = await prisma.product.findUnique({
        where: { slug },
      });
      if (slugClash && slugClash.id !== id) {
        return {
          success: false,
          message: "This slug is already used by another product.",
          fieldErrors: { slug: ["Slug must be globally unique."] },
        };
      }
    }

    // Verify category exists
    const category = await prisma.productCategory.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      return {
        success: false,
        message: "Selected category does not exist.",
        fieldErrors: { categoryId: ["Selected category does not exist."] },
      };
    }

    // Update product and replace images atomically
    const updated = await prisma.$transaction(async (tx) => {
      // Delete old images
      await tx.productImage.deleteMany({
        where: { productId: id },
      });

      // Update product with new images
      return tx.product.update({
        where: { id },
        data: {
          title,
          slug,
          shortDesc: shortDesc || null,
          description: description || null,
          categoryId,
          status,
          pricingType,
          displayPriceBDT: displayPriceBDT != null ? displayPriceBDT : null,
          originCountry: originCountry || "Malaysia",
          estimatedDaysMin: estimatedDaysMin ?? null,
          estimatedDaysMax: estimatedDaysMax ?? null,
          sourceUrl: sourceUrl || null,
          defaultSupplierId: defaultSupplierId || null,
          approxCostMYR: approxCostMYR != null ? approxCostMYR : null,
          adminNotes: adminNotes || null,
          images: {
            create: images.map((img, idx) => ({
              imageUrl: img.imageUrl,
              altText: img.altText || null,
              isPrimary: img.isPrimary ?? (idx === 0),
              sortOrder: img.sortOrder ?? idx,
            })),
          },
        },
      });
    });

    await logAudit({
      actorId: session.userId,
      actorEmail: session.email,
      actorRole: session.role,
      action: "PRODUCT_UPDATED",
      entityType: "Product",
      entityId: updated.id,
      metadata: {
        title: updated.title,
        slug: updated.slug,
        prevSlug: existing.slug,
        status: updated.status,
      },
    });

    revalidatePath("/admin/products");
    revalidatePath(`/admin/products/${updated.id}`);
    revalidatePath("/products");
    revalidatePath(`/products/${existing.slug}`);
    revalidatePath(`/products/${updated.slug}`);
    revalidatePath("/");

    return {
      success: true,
      message: `Product "${updated.title}" updated successfully.`,
      data: { id: updated.id, slug: updated.slug },
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to update product.";
    return { success: false, message: errorMsg };
  }
}

export async function setProductStatusAction(
  productId: string,
  newStatus: ProductStatus
): Promise<ActionResult> {
  try {
    const session = await requireAdminOrStaff();

    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return { success: false, message: "Product not found." };
    }

    const updated = await prisma.product.update({
      where: { id: productId },
      data: { status: newStatus },
    });

    await logAudit({
      actorId: session.userId,
      actorEmail: session.email,
      actorRole: session.role,
      action: `PRODUCT_STATUS_${newStatus}`,
      entityType: "Product",
      entityId: product.id,
      metadata: {
        title: product.title,
        previousStatus: product.status,
        newStatus,
      },
    });

    revalidatePath("/admin/products");
    revalidatePath(`/admin/products/${productId}`);
    revalidatePath("/products");
    revalidatePath(`/products/${product.slug}`);
    revalidatePath("/");

    return {
      success: true,
      message: `Product "${updated.title}" status changed to ${newStatus}.`,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to change product status.";
    return { success: false, message: errorMsg };
  }
}
