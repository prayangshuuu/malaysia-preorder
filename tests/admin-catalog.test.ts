import test from "node:test";
import assert from "node:assert/strict";
import { UserRole, ProductStatus, PricingType } from "@prisma/client";
import {
  categoryCreateSchema,
  productCreateSchema,
  generateSlug,
} from "../lib/validations/admin-product";
import { validateUploadFile, getStorageConfig } from "../lib/storage";
import { isAdminOrStaffRole, AuthorizationError } from "../lib/auth/rbac";
import { customerSafeProductSelect } from "../lib/products";

// -----------------------------------------------------------------------------
// 1. RBAC & PERMISSION CHECKS
// -----------------------------------------------------------------------------
test("Admin & Staff RBAC Permissions for Catalog Management", () => {
  // Only Admin, Operations, Finance, and Support are staff roles
  assert.equal(isAdminOrStaffRole(UserRole.ADMIN), true);
  assert.equal(isAdminOrStaffRole(UserRole.OPERATIONS), true);
  assert.equal(isAdminOrStaffRole(UserRole.FINANCE), true);
  assert.equal(isAdminOrStaffRole(UserRole.SUPPORT), true);

  // Customer role has NO administrative catalogue mutation permissions
  assert.equal(isAdminOrStaffRole(UserRole.CUSTOMER), false);

  function simulateCatalogMutation(role: UserRole) {
    if (!isAdminOrStaffRole(role)) {
      throw new AuthorizationError("Forbidden: Administrative permissions required", 403);
    }
    return true;
  }

  assert.equal(simulateCatalogMutation(UserRole.ADMIN), true);
  assert.equal(simulateCatalogMutation(UserRole.OPERATIONS), true);

  assert.throws(
    () => simulateCatalogMutation(UserRole.CUSTOMER),
    (err: unknown) => {
      assert.ok(err instanceof AuthorizationError);
      assert.equal(err.statusCode, 403);
      return true;
    }
  );
});

// -----------------------------------------------------------------------------
// 2. SLUG GENERATION & VALIDATION
// -----------------------------------------------------------------------------
test("Slug Generator & Validation Rules", () => {
  assert.equal(generateSlug("OldTown White Coffee 3-in-1!"), "oldtown-white-coffee-3-in-1");
  assert.equal(generateSlug("Milo Active-Go 1kg (Malaysia Pack)"), "milo-active-go-1kg-malaysia-pack");
  assert.equal(generateSlug("Special %$# Offer @ KL"), "special-offer-kl");

  // Category Schema Slug checks
  const validCat = categoryCreateSchema.safeParse({
    name: "Snacks & Confectionery",
    slug: "snacks-confectionery",
    displayOrder: 1,
  });
  assert.equal(validCat.success, true);

  const invalidCatSlug = categoryCreateSchema.safeParse({
    name: "Invalid Slug Category",
    slug: "Snacks & Confectionery!!", // spaces and symbols not allowed
  });
  assert.equal(invalidCatSlug.success, false);
});

// -----------------------------------------------------------------------------
// 3. PRODUCT VALIDATION (ZOD)
// -----------------------------------------------------------------------------
test("Product Validation Schema Enforces Business Invariants", () => {
  const dummyCategoryId = "e2d83a15-4a6c-4b6e-82be-920f32145e69";

  // Fixed price product MUST require a positive displayPriceBDT
  const fixedPriceWithoutPrice = productCreateSchema.safeParse({
    title: "Aik Cheong Kopi O",
    slug: "aik-cheong-kopi-o",
    categoryId: dummyCategoryId,
    status: ProductStatus.DRAFT,
    pricingType: PricingType.FIXED_PRICE,
    displayPriceBDT: null,
    originCountry: "Malaysia",
  });
  assert.equal(fixedPriceWithoutPrice.success, false);

  // Quote-only product does NOT require displayPriceBDT
  const quoteOnly = productCreateSchema.safeParse({
    title: "Bespoke Royal Selangor Pewter Vase",
    slug: "bespoke-royal-selangor-pewter-vase",
    categoryId: dummyCategoryId,
    status: ProductStatus.DRAFT,
    pricingType: PricingType.REQUEST_QUOTE_ONLY,
    originCountry: "Malaysia",
  });
  assert.equal(quoteOnly.success, true);

  // Dispatch days min cannot exceed max
  const invalidDispatchDays = productCreateSchema.safeParse({
    title: "Test Item",
    slug: "test-item-days",
    categoryId: dummyCategoryId,
    status: ProductStatus.DRAFT,
    pricingType: PricingType.FIXED_PRICE,
    displayPriceBDT: 1200,
    originCountry: "Malaysia",
    estimatedDaysMin: 20,
    estimatedDaysMax: 10, // Invalid: min > max
  });
  assert.equal(invalidDispatchDays.success, false);
});

// -----------------------------------------------------------------------------
// 4. STORAGE CONFIGURATION & UPLOAD INTEGRATION SAFETIES
// -----------------------------------------------------------------------------
test("Storage Provider Configuration Safety Checks", () => {
  const config = getStorageConfig();
  // In development with placeholder credentials, it should cleanly identify unconfigured state
  assert.ok(typeof config.isConfigured === "boolean");
  assert.ok(Array.isArray(config.missingKeys));

  // File validator rejects invalid mime types and excessive sizes
  const validUpload = validateUploadFile("image/jpeg", 2 * 1024 * 1024);
  assert.equal(validUpload.valid, true);

  const invalidMime = validateUploadFile("application/x-msdownload", 1024);
  assert.equal(invalidMime.valid, false);

  const oversizedFile = validateUploadFile("image/png", 10 * 1024 * 1024, 5 * 1024 * 1024);
  assert.equal(oversizedFile.valid, false);
});

// -----------------------------------------------------------------------------
// 5. PUBLIC CATALOGUE VISIBILITY & DATA PROJECTION LEAK PREVENTION
// -----------------------------------------------------------------------------
test("Public Customer Catalogue Security: Private Fields Never Leak", () => {
  // Confirm customerSafeProductSelect strictly omits confidential supplier data
  const publicKeys = Object.keys(customerSafeProductSelect);
  assert.equal(publicKeys.includes("approxCostMYR"), false);
  assert.equal(publicKeys.includes("sourceUrl"), false);
  assert.equal(publicKeys.includes("adminNotes"), false);
  assert.equal(publicKeys.includes("defaultSupplierId"), false);
  assert.equal(publicKeys.includes("defaultSupplier"), false);

  // Status simulation: Only PUBLISHED products should be visible to customers
  function canCustomerViewProduct(product: { status: ProductStatus }) {
    return product.status === ProductStatus.PUBLISHED;
  }

  assert.equal(canCustomerViewProduct({ status: ProductStatus.PUBLISHED }), true);
  assert.equal(canCustomerViewProduct({ status: ProductStatus.DRAFT }), false);
  assert.equal(canCustomerViewProduct({ status: ProductStatus.ARCHIVED }), false);
});
