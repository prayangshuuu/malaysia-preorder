import { z } from "zod";
import { QuoteStatus } from "@prisma/client";

// ============================================================================
// SHIPPING OPTION TYPE & SCHEMA
// ============================================================================

export const shippingOptionSchema = z.object({
  id: z.string().min(1, "Option ID is required"),
  name: z.string().min(1, "Option name is required (e.g. Standard Air Cargo)"),
  description: z.string().optional(),
  costBDT: z.number().min(0, "Shipping cost cannot be negative"),
  estDaysMin: z.number().int().min(1, "Minimum delivery days must be >= 1"),
  estDaysMax: z.number().int().min(1, "Maximum delivery days must be >= 1"),
  isDefault: z.boolean().optional().default(false),
});

export type ShippingOption = z.infer<typeof shippingOptionSchema>;

// ============================================================================
// QUOTE LINE ITEM SCHEMA
// ============================================================================

export const quoteLineItemInputSchema = z.object({
  productId: z.string().uuid().optional().nullable(),
  title: z.string().min(1, "Line item title is required").max(300),
  description: z.string().max(1000).optional().nullable(),
  sourceUrl: z.string().url("Must be a valid URL").optional().nullable().or(z.literal("")),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  unitPriceBDT: z.number().min(0, "Unit price in BDT must be non-negative"),
  estUnitCostMYR: z.number().min(0, "Internal unit cost in MYR must be non-negative").optional().nullable(),
});

export type QuoteLineItemInput = z.infer<typeof quoteLineItemInputSchema>;

// ============================================================================
// CREATE & UPDATE QUOTE SCHEMA (ADMIN)
// ============================================================================

export const quoteCreateSchema = z.object({
  inquiryId: z.string().uuid("A valid inquiry ID is required"),
  status: z.enum([QuoteStatus.DRAFT, QuoteStatus.SENT]).default(QuoteStatus.SENT),
  validUntil: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Valid until date is required and must be a valid date",
  }),
  
  // Line items
  lineItems: z.array(quoteLineItemInputSchema).min(1, "At least one line item is required"),

  // Disclosed Fees & Discounts in BDT
  serviceFeeBDT: z.number().min(0, "Service fee cannot be negative").default(0),
  customsFeeBDT: z.number().min(0, "Customs/tax fee cannot be negative").default(0),
  discountBDT: z.number().min(0, "Discount cannot be negative").default(0),

  // Shipping options
  shippingOptions: z.array(shippingOptionSchema).min(1, "At least one shipping option is required"),
  defaultShippingOptionId: z.string().optional(),

  // Internal Admin Sourcing Estimate (Strictly Confidential)
  estCostMYR: z.number().min(0, "Internal sourcing cost in MYR cannot be negative").optional().nullable(),
  estExchangeRate: z.number().min(0.0001, "Exchange rate must be positive").optional().nullable(),
  adminNotes: z.string().max(3000, "Admin notes too long").optional().nullable(),

  // Customer facing notes, dates & terms
  estDispatchDaysMin: z.number().int().min(0, "Min dispatch days cannot be negative").optional().nullable(),
  estDispatchDaysMax: z.number().int().min(0, "Max dispatch days cannot be negative").optional().nullable(),
  customerNotes: z.string().max(2000, "Customer notes too long").optional().nullable(),
  termsAndConditions: z.string().max(4000, "Terms and conditions too long").optional().nullable(),
});

export type QuoteCreateInput = z.infer<typeof quoteCreateSchema>;

// ============================================================================
// CUSTOMER ACCEPTANCE SCHEMA
// ============================================================================

export const quoteAcceptSchema = z.object({
  quoteId: z.string().uuid("Invalid quote ID"),
  selectedShippingOptionId: z.string().min(1, "Please select a shipping option"),
  shippingRecipientName: z.string().min(2, "Recipient name is required").max(120),
  shippingPhoneNumber: z.string().min(10, "Valid phone number is required").max(20),
  shippingStreetAddress: z.string().min(5, "Street address is required").max(300),
  shippingThanaOrUpazila: z.string().max(100).optional().nullable(),
  shippingDistrict: z.string().min(2, "District is required").max(100),
  shippingDivision: z.string().min(2, "Division is required").max(100),
  shippingPostalCode: z.string().max(20).optional().nullable(),
  customerNotes: z.string().max(1000).optional().nullable(),
});

export type QuoteAcceptInput = z.infer<typeof quoteAcceptSchema>;

// ============================================================================
// CUSTOMER REJECTION SCHEMA
// ============================================================================

export const quoteRejectSchema = z.object({
  quoteId: z.string().uuid("Invalid quote ID"),
  rejectionReason: z.string().min(3, "Please provide a reason for rejecting the quote").max(1000),
});

export type QuoteRejectInput = z.infer<typeof quoteRejectSchema>;

// ============================================================================
// SNAPSHOT TYPE STORED IN ACCEPTED QUOTES & ORDERS
// ============================================================================

export interface ImmutableQuoteAcceptanceSnapshot {
  quoteId: string;
  quoteNumber: string;
  version: number;
  inquiryId: string;
  inquiryNumber: string;
  acceptedAt: string;
  acceptedById: string;
  acceptedByEmail: string;
  acceptedByName: string;
  
  // Selected Shipping Option
  selectedShippingOption: ShippingOption;

  // Exact Confirmed Financials
  currency: string;
  itemsSubtotalBDT: number;
  serviceFeeBDT: number;
  shippingFeeBDT: number;
  customsFeeBDT: number;
  discountBDT: number;
  totalAmountBDT: number;

  // Snapshot Line items
  lineItems: Array<{
    productId?: string | null;
    title: string;
    description?: string | null;
    sourceUrl?: string | null;
    quantity: number;
    unitPriceBDT: number;
    totalPriceBDT: number;
  }>;

  // Logistics & Terms Snapshotted
  estDispatchDaysMin?: number | null;
  estDispatchDaysMax?: number | null;
  estDeliveryDaysMin?: number | null;
  estDeliveryDaysMax?: number | null;
  termsAndConditions?: string | null;
  customerNotes?: string | null;

  // Recipient Snapshot
  shippingAddress: {
    recipientName: string;
    phoneNumber: string;
    streetAddress: string;
    thanaOrUpazila?: string | null;
    district: string;
    division: string;
    postalCode?: string | null;
    country: string;
  };
}

// ============================================================================
// PURE TOTAL CALCULATOR UTILITY
// ============================================================================

export function calculateQuoteTotals(params: {
  lineItems: Array<{ quantity: number; unitPriceBDT: number }>;
  serviceFeeBDT?: number;
  shippingFeeBDT?: number;
  customsFeeBDT?: number;
  discountBDT?: number;
}) {
  const serviceFeeBDT = Math.max(0, Number(params.serviceFeeBDT || 0));
  const shippingFeeBDT = Math.max(0, Number(params.shippingFeeBDT || 0));
  const customsFeeBDT = Math.max(0, Number(params.customsFeeBDT || 0));
  const discountBDT = Math.max(0, Number(params.discountBDT || 0));

  let itemsSubtotalBDT = 0;
  for (const item of params.lineItems) {
    const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
    const unitPrice = Math.max(0, Number(item.unitPriceBDT) || 0);
    // Integer / 2 decimal arithmetic
    itemsSubtotalBDT += Math.round(qty * unitPrice * 100) / 100;
  }

  const grossTotal = itemsSubtotalBDT + serviceFeeBDT + shippingFeeBDT + customsFeeBDT;
  const totalAmountBDT = Math.max(0, Math.round((grossTotal - discountBDT) * 100) / 100);

  return {
    itemsSubtotalBDT: Math.round(itemsSubtotalBDT * 100) / 100,
    serviceFeeBDT: Math.round(serviceFeeBDT * 100) / 100,
    shippingFeeBDT: Math.round(shippingFeeBDT * 100) / 100,
    customsFeeBDT: Math.round(customsFeeBDT * 100) / 100,
    discountBDT: Math.round(discountBDT * 100) / 100,
    totalAmountBDT,
  };
}
