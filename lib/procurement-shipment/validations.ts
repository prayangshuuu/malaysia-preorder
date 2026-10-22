import { z } from "zod";
import { ProcurementStatus, ShipmentStatus } from "@prisma/client";

// ============================================================================
// SUPPLIER SCHEMAS
// ============================================================================

export const createSupplierSchema = z.object({
  name: z.string().trim().min(2, "Supplier name is required").max(150),
  contactPerson: z.string().trim().max(100).optional().nullable(),
  email: z.string().trim().email("Invalid email").optional().nullable().or(z.literal("")),
  phone: z.string().trim().max(50).optional().nullable(),
  address: z.string().trim().max(255).optional().nullable(),
  city: z.string().trim().max(100).default("Kuala Lumpur"),
  country: z.string().trim().max(100).default("Malaysia"),
  notes: z.string().trim().max(1000).optional().nullable(),
  isActive: z.boolean().default(true),
});

export const updateSupplierSchema = createSupplierSchema.partial().extend({
  supplierId: z.string().uuid("Invalid supplier ID"),
});

// ============================================================================
// PROCUREMENT SCHEMAS
// ============================================================================

export const recordProcurementSchema = z.object({
  orderId: z.string().uuid("Invalid order ID"),
  orderLineItemId: z.string().uuid("Invalid line item ID").optional().nullable(),
  supplierId: z.string().uuid("Invalid supplier ID").optional().nullable(),
  supplierName: z.string().trim().max(150).optional().nullable(), // For on-the-fly supplier creation or reference
  status: z.nativeEnum(ProcurementStatus).default(ProcurementStatus.SOURCING),
  purchaseCostMYR: z.coerce
    .number()
    .min(0, "Purchase cost MYR must be non-negative")
    .max(1_000_000, "Purchase cost exceeds limit"),
  exchangeRateUsed: z.coerce
    .number()
    .positive("Exchange rate must be positive")
    .max(1000, "Unreasonable exchange rate"),
  supplierInvoiceRef: z.string().trim().max(100).optional().nullable(),
  purchasedAt: z.coerce.date().optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  receiptUrl: z.string().trim().url("Invalid receipt URL").optional().nullable().or(z.literal("")),
  updateOrderStatusToProcurement: z.boolean().default(true),
});

export const updateProcurementStatusSchema = z.object({
  procurementId: z.string().uuid("Invalid procurement ID"),
  status: z.nativeEnum(ProcurementStatus),
  notes: z.string().trim().max(1000).optional().nullable(),
  reason: z.string().trim().max(255).optional().nullable(),
});

// ============================================================================
// SHIPMENT SCHEMAS
// ============================================================================

export const createShipmentSchema = z.object({
  orderId: z.string().uuid("Invalid order ID"),
  carrierName: z.string().trim().max(100).optional().nullable(),
  trackingNumber: z.string().trim().max(100).optional().nullable(),
  trackingUrl: z.string().trim().url("Invalid tracking URL").optional().nullable().or(z.literal("")),
  status: z.nativeEnum(ShipmentStatus).default(ShipmentStatus.READY_TO_DISPATCH),
  dispatchOrigin: z.string().trim().max(100).default("Malaysia"),
  destinationCountry: z.string().trim().max(100).default("Bangladesh"),
  estimatedDeparture: z.coerce.date().optional().nullable(),
  actualDeparture: z.coerce.date().optional().nullable(),
  estimatedArrival: z.coerce.date().optional().nullable(),
  actualArrival: z.coerce.date().optional().nullable(),
  weightKg: z.coerce.number().min(0).max(1000).optional().nullable(),
  dimensionsCm: z.string().trim().max(50).optional().nullable(),
  internalCargoNotes: z.string().trim().max(1000).optional().nullable(),
  updateOrderStatus: z.boolean().default(true),
});

export const updateShipmentSchema = z.object({
  shipmentId: z.string().uuid("Invalid shipment ID"),
  carrierName: z.string().trim().max(100).optional().nullable(),
  trackingNumber: z.string().trim().max(100).optional().nullable(),
  trackingUrl: z.string().trim().url("Invalid tracking URL").optional().nullable().or(z.literal("")),
  status: z.nativeEnum(ShipmentStatus).optional(),
  estimatedDeparture: z.coerce.date().optional().nullable(),
  actualDeparture: z.coerce.date().optional().nullable(),
  estimatedArrival: z.coerce.date().optional().nullable(),
  actualArrival: z.coerce.date().optional().nullable(),
  weightKg: z.coerce.number().min(0).max(1000).optional().nullable(),
  dimensionsCm: z.string().trim().max(50).optional().nullable(),
  internalCargoNotes: z.string().trim().max(1000).optional().nullable(),
});

export const addShipmentEventSchema = z.object({
  shipmentId: z.string().uuid("Invalid shipment ID"),
  status: z.nativeEnum(ShipmentStatus),
  location: z.string().trim().max(150).optional().nullable(),
  description: z.string().trim().min(3, "Description is required").max(500),
  isPublic: z.boolean().default(true),
  timestamp: z.coerce.date().default(() => new Date()),
  syncOrderStatus: z.boolean().default(true),
});

export const addOrderTimelineEventSchema = z.object({
  orderId: z.string().uuid("Invalid order ID"),
  eventType: z.string().trim().min(2).max(50).default("MANUAL_UPDATE"),
  title: z.string().trim().min(2, "Title is required").max(100),
  description: z.string().trim().min(2, "Description is required").max(1000),
  location: z.string().trim().max(150).optional().nullable(),
  isCustomerVisible: z.boolean().default(true),
  timestamp: z.coerce.date().default(() => new Date()),
});

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
export type RecordProcurementInput = z.infer<typeof recordProcurementSchema>;
export type UpdateProcurementStatusInput = z.infer<typeof updateProcurementStatusSchema>;
export type CreateShipmentInput = z.infer<typeof createShipmentSchema>;
export type UpdateShipmentInput = z.infer<typeof updateShipmentSchema>;
export type AddShipmentEventInput = z.infer<typeof addShipmentEventSchema>;
export type AddOrderTimelineEventInput = z.infer<typeof addOrderTimelineEventSchema>;
