import { z } from "zod";
import { ProductStatus, PricingType } from "@prisma/client";

// Regex for clean URL slugs: lowercase letters, numbers, hyphens
export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Generate a clean URL slug from title string
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // remove non-alphanumeric except hyphen and space
    .replace(/[\s_-]+/g, "-") // collapse dashes and spaces to single dash
    .replace(/^-+|-+$/g, ""); // trim leading/trailing dashes
}

// -----------------------------------------------------------------------------
// CATEGORY SCHEMAS
// -----------------------------------------------------------------------------

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(2, "Category name must be at least 2 characters").max(100),
  slug: z
    .string()
    .trim()
    .min(2, "Slug must be at least 2 characters")
    .max(120)
    .regex(SLUG_REGEX, "Slug must contain only lowercase letters, numbers, and single hyphens"),
  description: z.string().trim().max(1000).nullable().optional(),
  imageUrl: z
    .string()
    .trim()
    .url("Image must be a valid URL")
    .or(z.literal(""))
    .nullable()
    .optional(),
  parentId: z.string().uuid("Invalid parent category ID").nullable().optional(),
  displayOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export const categoryUpdateSchema = categoryCreateSchema.extend({
  id: z.string().uuid("Invalid category ID"),
});

export const reorderCategoriesSchema = z.object({
  orders: z.array(
    z.object({
      id: z.string().uuid("Invalid category ID"),
      displayOrder: z.number().int().min(0),
    })
  ).min(1, "At least one category order must be provided"),
});

// -----------------------------------------------------------------------------
// PRODUCT IMAGE SCHEMA
// -----------------------------------------------------------------------------

export const productImageSchema = z.object({
  id: z.string().uuid().optional(),
  imageUrl: z.string().trim().url("Product image must be a valid URL"),
  altText: z.string().trim().max(200).nullable().optional(),
  isPrimary: z.boolean().default(false).optional(),
  sortOrder: z.coerce.number().int().min(0).default(0).optional(),
});

// -----------------------------------------------------------------------------
// PRODUCT SCHEMAS
// -----------------------------------------------------------------------------

export const productCreateSchema = z.object({
  title: z.string().trim().min(3, "Product title must be at least 3 characters").max(255),
  slug: z
    .string()
    .trim()
    .min(3, "Slug must be at least 3 characters")
    .max(255)
    .regex(SLUG_REGEX, "Slug must contain only lowercase letters, numbers, and single hyphens"),
  shortDesc: z.string().trim().max(500).nullable().optional(),
  description: z.string().trim().max(20000).nullable().optional(),
  categoryId: z.string().uuid("A valid category must be selected"),
  status: z.nativeEnum(ProductStatus).default(ProductStatus.DRAFT),
  pricingType: z.nativeEnum(PricingType).default(PricingType.FIXED_PRICE),

  // Customer facing pricing in BDT (Required if FIXED_PRICE, optional if REQUEST_QUOTE_ONLY)
  displayPriceBDT: z
    .coerce
    .number()
    .positive("Price in BDT must be greater than zero")
    .max(10000000, "Price exceeds allowable threshold")
    .nullable()
    .optional(),

  // Sourcing & Estimated Timelines
  originCountry: z.string().trim().min(2).max(100).default("Malaysia"),
  estimatedDaysMin: z.coerce.number().int().min(1).max(180).nullable().optional(),
  estimatedDaysMax: z.coerce.number().int().min(1).max(180).nullable().optional(),

  // Sourcing & Private Supplier Information (Admin/Operations Only)
  sourceUrl: z.string().trim().url("Source URL must be valid").or(z.literal("")).nullable().optional(),
  defaultSupplierId: z.string().uuid("Invalid supplier ID").nullable().optional(),
  approxCostMYR: z
    .coerce
    .number()
    .positive("Approximate cost in MYR must be positive")
    .max(1000000)
    .nullable()
    .optional(),
  adminNotes: z.string().trim().max(5000).nullable().optional(),

  // Images list
  images: z.array(productImageSchema).default([]),
}).refine(
  (data) => {
    // If pricingType is FIXED_PRICE, displayPriceBDT must be provided and > 0
    if (data.pricingType === PricingType.FIXED_PRICE) {
      return typeof data.displayPriceBDT === "number" && data.displayPriceBDT > 0;
    }
    return true;
  },
  {
    message: "Display price in BDT is required when pricing type is 'Fixed Price'",
    path: ["displayPriceBDT"],
  }
).refine(
  (data) => {
    if (
      data.estimatedDaysMin != null &&
      data.estimatedDaysMax != null &&
      data.estimatedDaysMin > data.estimatedDaysMax
    ) {
      return false;
    }
    return true;
  },
  {
    message: "Minimum estimated sourcing days cannot exceed maximum days",
    path: ["estimatedDaysMin"],
  }
);

export const productUpdateSchema = productCreateSchema.extend({
  id: z.string().uuid("Invalid product ID"),
});

export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;
export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
export type ProductImageInput = z.infer<typeof productImageSchema>;
