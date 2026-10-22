import { z } from "zod";
import { OrderStatus, ProcurementStatus, ShipmentStatus } from "@prisma/client";

export const shippingAddressSchema = z.object({
  recipientName: z.string().trim().min(2, "Recipient name must be at least 2 characters").max(100),
  phoneNumber: z.string().trim().min(8, "Phone number must be at least 8 characters").max(20),
  streetAddress: z.string().trim().min(5, "Street address must be at least 5 characters").max(255),
  thanaOrUpazila: z.string().trim().max(100).optional().nullable(),
  district: z.string().trim().min(2, "District is required").max(100),
  division: z.string().trim().min(2, "Division is required").max(100),
  postalCode: z.string().trim().max(20).optional().nullable(),
  country: z.string().trim().default("Bangladesh"),
});

export const createOrderFromQuoteSchema = z.object({
  quoteId: z.string().uuid("Invalid quote ID"),
  shippingAddress: shippingAddressSchema,
  customerNotes: z.string().trim().max(500).optional().nullable(),
});

export const updateOrderStatusSchema = z.object({
  orderId: z.string().uuid("Invalid order ID"),
  status: z.nativeEnum(OrderStatus).optional(),
  procurementStatus: z.nativeEnum(ProcurementStatus).optional(),
  shipmentStatus: z.nativeEnum(ShipmentStatus).optional(),
  adminNotes: z.string().trim().max(1000).optional().nullable(),
  customerSafeNote: z.string().trim().max(500).optional().nullable(),
  reason: z.string().trim().max(255).optional().nullable(),
});

export type ShippingAddressInput = z.infer<typeof shippingAddressSchema>;
export type CreateOrderFromQuoteInput = z.infer<typeof createOrderFromQuoteSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
