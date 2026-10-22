"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireAdminOrStaff, assertResourceOwnership } from "@/lib/auth/rbac";
import { logAudit } from "@/lib/audit";
import { sendCustomerNotification } from "@/lib/notifications";
import {
  createInquirySchema,
  CreateInquiryInput,
  customerInquiryReplySchema,
  CustomerInquiryReplyInput,
  adminUpdateInquiryStatusSchema,
  AdminUpdateInquiryStatusInput,
  adminUpdatePrivateNotesSchema,
  AdminUpdatePrivateNotesInput,
  adminSendInquiryMessageSchema,
  AdminSendInquiryMessageInput,
  canTransitionInquiryStatus,
} from "@/lib/validations/inquiry";
import { InquiryStatus, Prisma } from "@prisma/client";

export interface InquiryActionResult<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  fieldErrors?: Record<string, string[]>;
}

/**
 * Generate formatted Inquiry Number: INQ-YYYY-XXXX
 */
async function generateInquiryNumber(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = `INQ-${currentYear}-`;

  // Find latest inquiry for this year
  const lastInquiry = await prisma.productInquiry.findFirst({
    where: {
      inquiryNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      inquiryNumber: "desc",
    },
    select: {
      inquiryNumber: true,
    },
  });

  let seq = 1;
  if (lastInquiry && lastInquiry.inquiryNumber) {
    const parts = lastInquiry.inquiryNumber.split("-");
    const lastSeq = parseInt(parts[2], 10);
    if (!isNaN(lastSeq)) {
      seq = lastSeq + 1;
    }
  }

  return `${prefix}${seq.toString().padStart(4, "0")}`;
}

// -----------------------------------------------------------------------------
// CUSTOMER ACTIONS
// -----------------------------------------------------------------------------

/**
 * Submit a new customer product inquiry.
 * Requires authenticated customer.
 */
export async function submitProductInquiryAction(
  rawInput: CreateInquiryInput
): Promise<InquiryActionResult<{ id: string; inquiryNumber: string }>> {
  try {
    const session = await requireAuth();

    const parsed = createInquirySchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        message: "Please correct the errors in the form.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const {
      productName,
      referenceUrl,
      brandOrModel,
      specifications,
      preferredOptions,
      notes,
      quantityRequested,
      targetBudgetBDT,
      productId,
      attachmentUrls,
    } = parsed.data;

    // Build consolidated specifications/notes if extra fields provided
    const specSections: string[] = [];
    if (specifications && specifications.trim()) {
      specSections.push(specifications.trim());
    }
    if (preferredOptions && preferredOptions.trim()) {
      specSections.push(`Preferred Options/Variants: ${preferredOptions.trim()}`);
    }
    if (notes && notes.trim()) {
      specSections.push(`Additional Notes: ${notes.trim()}`);
    }
    const consolidatedSpecs = specSections.length > 0 ? specSections.join("\n\n") : null;

    const inquiryNumber = await generateInquiryNumber();

    const newInquiry = await prisma.$transaction(async (tx) => {
      // 1. Create inquiry
      const inq = await tx.productInquiry.create({
        data: {
          inquiryNumber,
          userId: session.userId,
          productName,
          referenceUrl: referenceUrl || null,
          brandOrModel: brandOrModel || null,
          specifications: consolidatedSpecs,
          quantityRequested,
          targetBudgetBDT: targetBudgetBDT ? new Prisma.Decimal(targetBudgetBDT) : null,
          productId: productId || null,
          status: InquiryStatus.SUBMITTED,
        },
      });

      // 2. Add status history record
      await tx.inquiryStatusHistory.create({
        data: {
          inquiryId: inq.id,
          fromStatus: null,
          toStatus: InquiryStatus.SUBMITTED,
          changedById: session.userId,
          reason: "Customer submitted product inquiry",
        },
      });

      // 3. Attach files if provided
      if (attachmentUrls && attachmentUrls.length > 0) {
        await tx.inquiryAttachment.createMany({
          data: attachmentUrls.map((att) => ({
            inquiryId: inq.id,
            fileUrl: att.fileUrl,
            fileType: att.fileType ?? null,
            fileName: att.fileName ?? null,
            fileSizeBytes: att.fileSizeBytes ?? null,
          })),
        });
      }

      return inq;
    });

    // Notify customer in-app that inquiry has been received
    await sendCustomerNotification({
      userId: session.userId,
      title: `Inquiry Received: ${newInquiry.inquiryNumber}`,
      message: `Your inquiry for "${productName}" has been received. Our Kuala Lumpur sourcing team will review availability and prepare a quote.`,
      linkUrl: `/account/inquiries/${newInquiry.id}`,
    });

    // Audit log
    await logAudit({
      actorId: session.userId,
      actorEmail: session.email,
      actorRole: session.role,
      action: "INQUIRY_CREATED",
      entityType: "ProductInquiry",
      entityId: newInquiry.id,
      metadata: {
        inquiryNumber: newInquiry.inquiryNumber,
        productName,
        quantity: quantityRequested,
      },
    });

    revalidatePath("/account/inquiries");
    revalidatePath("/admin/inquiries");

    return {
      success: true,
      message: `Inquiry ${newInquiry.inquiryNumber} successfully submitted! Our team will provide an official quote shortly.`,
      data: {
        id: newInquiry.id,
        inquiryNumber: newInquiry.inquiryNumber,
      },
    };
  } catch (error: unknown) {
    console.error("[submitProductInquiryAction] Error:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "An unexpected error occurred while submitting your inquiry.",
    };
  }
}

/**
 * Customer replies to an inquiry (e.g. providing requested information).
 */
export async function customerReplyInquiryAction(
  rawInput: CustomerInquiryReplyInput
): Promise<InquiryActionResult> {
  try {
    const session = await requireAuth();

    const parsed = customerInquiryReplySchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        message: "Invalid reply content.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const { inquiryId, messageText } = parsed.data;

    // Check ownership
    const inquiry = await prisma.productInquiry.findUnique({
      where: { id: inquiryId },
      select: { id: true, userId: true, inquiryNumber: true, status: true },
    });

    if (!inquiry) {
      return { success: false, message: "Inquiry not found." };
    }

    // IDOR Protection: only owner can reply as customer
    await assertResourceOwnership(inquiry.userId, { allowStaff: false });

    // Check inquiry is not already completed/cancelled
    if (inquiry.status === InquiryStatus.CANCELLED || inquiry.status === InquiryStatus.DECLINED) {
      return {
        success: false,
        message: `Cannot reply to an inquiry with status ${inquiry.status}.`,
      };
    }

    await prisma.$transaction(async (tx) => {
      // 1. Create message
      await tx.inquiryMessage.create({
        data: {
          inquiryId,
          senderId: session.userId,
          messageText,
          isStaffOnly: false,
        },
      });

      // 2. If inquiry was NEEDS_INFORMATION, update status back to UNDER_REVIEW
      if (inquiry.status === InquiryStatus.NEEDS_INFORMATION) {
        await tx.productInquiry.update({
          where: { id: inquiryId },
          data: { status: InquiryStatus.UNDER_REVIEW },
        });

        await tx.inquiryStatusHistory.create({
          data: {
            inquiryId,
            fromStatus: InquiryStatus.NEEDS_INFORMATION,
            toStatus: InquiryStatus.UNDER_REVIEW,
            changedById: session.userId,
            reason: "Customer replied with requested information",
          },
        });
      }
    });

    // Audit log
    await logAudit({
      actorId: session.userId,
      actorEmail: session.email,
      actorRole: session.role,
      action: "INQUIRY_CUSTOMER_REPLY",
      entityType: "ProductInquiry",
      entityId: inquiryId,
      metadata: {
        inquiryNumber: inquiry.inquiryNumber,
      },
    });

    revalidatePath(`/account/inquiries/${inquiryId}`);
    revalidatePath(`/admin/inquiries/${inquiryId}`);
    revalidatePath("/admin/inquiries");

    return {
      success: true,
      message: "Your reply has been sent to our sourcing team.",
    };
  } catch (error: unknown) {
    console.error("[customerReplyInquiryAction] Error:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to post reply.",
    };
  }
}

// -----------------------------------------------------------------------------
// ADMIN ACTIONS
// -----------------------------------------------------------------------------

/**
 * Admin updates inquiry status with transition validation, status history, and audit log.
 */
export async function adminUpdateInquiryStatusAction(
  rawInput: AdminUpdateInquiryStatusInput
): Promise<InquiryActionResult> {
  try {
    const session = await requireAdminOrStaff();

    const parsed = adminUpdateInquiryStatusSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        message: "Invalid status update data.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const { inquiryId, targetStatus, reason } = parsed.data;

    const inquiry = await prisma.productInquiry.findUnique({
      where: { id: inquiryId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    if (!inquiry) {
      return { success: false, message: "Inquiry not found." };
    }

    // Validate state transition
    if (!canTransitionInquiryStatus(inquiry.status, targetStatus)) {
      return {
        success: false,
        message: `Illegal transition from ${inquiry.status} to ${targetStatus}.`,
      };
    }

    if (inquiry.status === targetStatus) {
      return {
        success: true,
        message: `Inquiry is already in ${targetStatus} status.`,
      };
    }

    await prisma.$transaction(async (tx) => {
      // 1. Update status
      await tx.productInquiry.update({
        where: { id: inquiryId },
        data: { status: targetStatus },
      });

      // 2. Append status history
      await tx.inquiryStatusHistory.create({
        data: {
          inquiryId,
          fromStatus: inquiry.status,
          toStatus: targetStatus,
          changedById: session.userId,
          reason: reason || `Status changed to ${targetStatus} by ${session.role}`,
        },
      });
    });

    // 3. Notify customer of status change via notification service
    const statusMessages: Record<InquiryStatus, string> = {
      SUBMITTED: "Your inquiry has been submitted.",
      UNDER_REVIEW: "Our Kuala Lumpur team is currently reviewing supplier availability for your requested item.",
      NEEDS_INFORMATION: "Our sourcing team needs more information to locate or verify this item. Please check your inquiry details to reply.",
      QUOTED: "A formal price quotation has been prepared for your requested item.",
      ACCEPTED: "Your quote has been accepted. Order preparation has commenced.",
      DECLINED: "Our sourcing team was unable to procure this item from our Malaysian suppliers.",
      CANCELLED: "This inquiry has been cancelled.",
    };

    await sendCustomerNotification({
      userId: inquiry.userId,
      title: `Inquiry Status Update: ${inquiry.inquiryNumber}`,
      message: statusMessages[targetStatus] || `Status updated to ${targetStatus}`,
      linkUrl: `/account/inquiries/${inquiry.id}`,
    });

    // 4. Audit Log
    await logAudit({
      actorId: session.userId,
      actorEmail: session.email,
      actorRole: session.role,
      action: "INQUIRY_STATUS_UPDATED",
      entityType: "ProductInquiry",
      entityId: inquiryId,
      metadata: {
        inquiryNumber: inquiry.inquiryNumber,
        fromStatus: inquiry.status,
        toStatus: targetStatus,
        reason: reason ?? null,
      },
    });

    revalidatePath(`/admin/inquiries/${inquiryId}`);
    revalidatePath("/admin/inquiries");
    revalidatePath(`/account/inquiries/${inquiryId}`);
    revalidatePath("/account/inquiries");

    return {
      success: true,
      message: `Inquiry status changed to ${targetStatus}.`,
    };
  } catch (error: unknown) {
    console.error("[adminUpdateInquiryStatusAction] Error:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to update status.",
    };
  }
}

/**
 * Admin updates private internal notes on an inquiry.
 * Guaranteed never visible to customer.
 */
export async function adminUpdatePrivateNotesAction(
  rawInput: AdminUpdatePrivateNotesInput
): Promise<InquiryActionResult> {
  try {
    const session = await requireAdminOrStaff();

    const parsed = adminUpdatePrivateNotesSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        message: "Invalid private notes data.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const { inquiryId, adminPrivateNotes } = parsed.data;

    const inquiry = await prisma.productInquiry.findUnique({
      where: { id: inquiryId },
      select: { id: true, inquiryNumber: true },
    });

    if (!inquiry) {
      return { success: false, message: "Inquiry not found." };
    }

    await prisma.productInquiry.update({
      where: { id: inquiryId },
      data: { adminPrivateNotes },
    });

    // Audit log
    await logAudit({
      actorId: session.userId,
      actorEmail: session.email,
      actorRole: session.role,
      action: "INQUIRY_INTERNAL_NOTES_UPDATED",
      entityType: "ProductInquiry",
      entityId: inquiryId,
      metadata: {
        inquiryNumber: inquiry.inquiryNumber,
      },
    });

    revalidatePath(`/admin/inquiries/${inquiryId}`);

    return {
      success: true,
      message: "Internal private notes saved successfully.",
    };
  } catch (error: unknown) {
    console.error("[adminUpdatePrivateNotesAction] Error:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to save internal notes.",
    };
  }
}

/**
 * Admin sends a message on the inquiry.
 * Can be customer-visible or staff-only.
 * Can optionally update inquiry status to NEEDS_INFORMATION.
 */
export async function adminSendInquiryMessageAction(
  rawInput: AdminSendInquiryMessageInput
): Promise<InquiryActionResult> {
  try {
    const session = await requireAdminOrStaff();

    const parsed = adminSendInquiryMessageSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        message: "Invalid message data.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const { inquiryId, messageText, isStaffOnly, setNeedsInformation } = parsed.data;

    const inquiry = await prisma.productInquiry.findUnique({
      where: { id: inquiryId },
      select: { id: true, userId: true, inquiryNumber: true, status: true },
    });

    if (!inquiry) {
      return { success: false, message: "Inquiry not found." };
    }

    await prisma.$transaction(async (tx) => {
      // 1. Create message
      await tx.inquiryMessage.create({
        data: {
          inquiryId,
          senderId: session.userId,
          messageText,
          isStaffOnly,
        },
      });

      // 2. Optionally switch status to NEEDS_INFORMATION if requested by staff
      if (!isStaffOnly && setNeedsInformation && inquiry.status !== InquiryStatus.NEEDS_INFORMATION) {
        if (canTransitionInquiryStatus(inquiry.status, InquiryStatus.NEEDS_INFORMATION)) {
          await tx.productInquiry.update({
            where: { id: inquiryId },
            data: { status: InquiryStatus.NEEDS_INFORMATION },
          });

          await tx.inquiryStatusHistory.create({
            data: {
              inquiryId,
              fromStatus: inquiry.status,
              toStatus: InquiryStatus.NEEDS_INFORMATION,
              changedById: session.userId,
              reason: "Staff requested additional information from customer",
            },
          });
        }
      }
    });

    // 3. If customer-visible, dispatch notification
    if (!isStaffOnly) {
      await sendCustomerNotification({
        userId: inquiry.userId,
        title: `Message on Inquiry ${inquiry.inquiryNumber}`,
        message: setNeedsInformation
          ? `Our sourcing team needs more information regarding your inquiry: "${messageText.slice(0, 80)}..."`
          : `New update from sourcing team: "${messageText.slice(0, 80)}..."`,
        linkUrl: `/account/inquiries/${inquiry.id}`,
      });
    }

    // 4. Audit Log
    await logAudit({
      actorId: session.userId,
      actorEmail: session.email,
      actorRole: session.role,
      action: isStaffOnly ? "INQUIRY_STAFF_NOTE_ADDED" : "INQUIRY_CUSTOMER_MESSAGE_SENT",
      entityType: "ProductInquiry",
      entityId: inquiryId,
      metadata: {
        inquiryNumber: inquiry.inquiryNumber,
        isStaffOnly,
        setNeedsInformation: Boolean(setNeedsInformation),
      },
    });

    revalidatePath(`/admin/inquiries/${inquiryId}`);
    revalidatePath("/admin/inquiries");
    if (!isStaffOnly) {
      revalidatePath(`/account/inquiries/${inquiryId}`);
    }

    return {
      success: true,
      message: isStaffOnly
        ? "Internal staff note recorded."
        : "Message sent to customer successfully.",
    };
  } catch (error: unknown) {
    console.error("[adminSendInquiryMessageAction] Error:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to send message.",
    };
  }
}
