import { z } from "zod";
import { InquiryStatus } from "@prisma/client";

// URL validation helper (allows standard HTTP/HTTPS URLs)
export const optionalUrlSchema = z
  .string()
  .trim()
  .url("Please enter a valid website URL starting with http:// or https://")
  .max(1000, "URL cannot exceed 1000 characters")
  .or(z.literal(""))
  .nullable()
  .optional();

/**
 * Customer Inquiry Submission Schema
 */
export const createInquirySchema = z.object({
  productName: z
    .string()
    .trim()
    .min(2, "Product name or description must be at least 2 characters")
    .max(255, "Product name cannot exceed 255 characters"),
  referenceUrl: optionalUrlSchema,
  brandOrModel: z
    .string()
    .trim()
    .max(200, "Brand or model cannot exceed 200 characters")
    .or(z.literal(""))
    .nullable()
    .optional(),
  specifications: z
    .string()
    .trim()
    .max(2000, "Specifications/notes cannot exceed 2000 characters")
    .or(z.literal(""))
    .nullable()
    .optional(),
  preferredOptions: z
    .string()
    .trim()
    .max(500, "Preferred options cannot exceed 500 characters")
    .or(z.literal(""))
    .nullable()
    .optional(),
  notes: z
    .string()
    .trim()
    .max(2000, "Customer notes cannot exceed 2000 characters")
    .or(z.literal(""))
    .nullable()
    .optional(),
  quantityRequested: z.coerce
    .number()
    .int("Quantity must be a whole number")
    .min(1, "Quantity must be at least 1")
    .max(10000, "Quantity cannot exceed 10,000 units"),
  targetBudgetBDT: z.coerce
    .number()
    .positive("Budget must be a positive number")
    .max(10000000, "Target budget exceeds maximum limit")
    .nullable()
    .optional(),
  productId: z
    .string()
    .uuid("Invalid linked product ID")
    .or(z.literal(""))
    .nullable()
    .optional(),
  // Uploaded attachment references (if cloud storage uploaded)
  attachmentUrls: z
    .array(
      z.object({
        fileUrl: z.string().trim().url("Attachment must be a valid URL"),
        fileType: z.string().trim().max(100).optional(),
        fileName: z.string().trim().max(255).optional(),
        fileSizeBytes: z.number().int().min(0).max(10 * 1024 * 1024).optional(),
      })
    )
    .max(5, "Maximum 5 attachments allowed per inquiry")
    .optional(),
});

export type CreateInquiryInput = z.infer<typeof createInquirySchema>;

/**
 * Customer Inquiry Reply Schema (Replying to request for more information)
 */
export const customerInquiryReplySchema = z.object({
  inquiryId: z.string().uuid("Invalid inquiry ID"),
  messageText: z
    .string()
    .trim()
    .min(1, "Message cannot be empty")
    .max(2000, "Message cannot exceed 2000 characters"),
});

export type CustomerInquiryReplyInput = z.infer<typeof customerInquiryReplySchema>;

/**
 * Admin Status Transitions Validation Schema
 */
export const validInquiryTransitions: Record<InquiryStatus, InquiryStatus[]> = {
  SUBMITTED: [
    InquiryStatus.UNDER_REVIEW,
    InquiryStatus.NEEDS_INFORMATION,
    InquiryStatus.QUOTED,
    InquiryStatus.DECLINED,
    InquiryStatus.CANCELLED,
  ],
  UNDER_REVIEW: [
    InquiryStatus.NEEDS_INFORMATION,
    InquiryStatus.QUOTED,
    InquiryStatus.DECLINED,
    InquiryStatus.CANCELLED,
  ],
  NEEDS_INFORMATION: [
    InquiryStatus.UNDER_REVIEW,
    InquiryStatus.QUOTED,
    InquiryStatus.DECLINED,
    InquiryStatus.CANCELLED,
  ],
  QUOTED: [
    InquiryStatus.ACCEPTED,
    InquiryStatus.DECLINED,
    InquiryStatus.CANCELLED,
  ],
  ACCEPTED: [
    // Once accepted, transitions are typically controlled via Quote/Order workflows
    InquiryStatus.CANCELLED,
  ],
  DECLINED: [
    InquiryStatus.UNDER_REVIEW, // Admin can re-open declined inquiry if reconsidered
  ],
  CANCELLED: [],
};

export function canTransitionInquiryStatus(
  current: InquiryStatus,
  target: InquiryStatus
): boolean {
  if (current === target) return true;
  const allowed = validInquiryTransitions[current];
  return allowed ? allowed.includes(target) : false;
}

export const adminUpdateInquiryStatusSchema = z.object({
  inquiryId: z.string().uuid("Invalid inquiry ID"),
  targetStatus: z.nativeEnum(InquiryStatus),
  reason: z.string().trim().max(500).optional(),
});

export type AdminUpdateInquiryStatusInput = z.infer<typeof adminUpdateInquiryStatusSchema>;

/**
 * Admin Private Notes Schema (Separated from customer messages)
 */
export const adminUpdatePrivateNotesSchema = z.object({
  inquiryId: z.string().uuid("Invalid inquiry ID"),
  adminPrivateNotes: z
    .string()
    .trim()
    .max(5000, "Internal notes cannot exceed 5000 characters"),
});

export type AdminUpdatePrivateNotesInput = z.infer<typeof adminUpdatePrivateNotesSchema>;

/**
 * Admin Message Schema (Can be customer-visible or staff-only)
 */
export const adminSendInquiryMessageSchema = z.object({
  inquiryId: z.string().uuid("Invalid inquiry ID"),
  messageText: z
    .string()
    .trim()
    .min(1, "Message text cannot be empty")
    .max(3000, "Message cannot exceed 3000 characters"),
  isStaffOnly: z.boolean().default(false),
  // Optionally update status to NEEDS_INFORMATION when requesting details
  setNeedsInformation: z.boolean().optional(),
});

export type AdminSendInquiryMessageInput = z.infer<typeof adminSendInquiryMessageSchema>;

/**
 * Admin Inquiry Filter Schema
 */
export const adminInquiryFilterSchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.nativeEnum(InquiryStatus).or(z.literal("ALL")).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type AdminInquiryFilterInput = z.infer<typeof adminInquiryFilterSchema>;
