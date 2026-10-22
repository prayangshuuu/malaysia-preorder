import { prisma } from "@/lib/prisma";
import { SupportTicketStatus } from "@prisma/client";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { sendCustomerNotification } from "@/lib/notifications";

export class SupportServiceError extends Error {
  constructor(message: string, public statusCode: number = 400) {
    super(message);
    this.name = "SupportServiceError";
  }
}

/**
 * Validation schema for public/customer contact form submission
 */
export const createSupportTicketSchema = z.object({
  customerName: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name is too long"),
  customerEmail: z
    .string()
    .trim()
    .email("Please provide a valid email address")
    .max(150, "Email is too long"),
  customerPhone: z
    .string()
    .trim()
    .max(30, "Phone number is too long")
    .optional()
    .nullable()
    .transform((val) => (val && val.length > 0 ? val : null)),
  subject: z
    .string()
    .trim()
    .min(4, "Subject must be at least 4 characters")
    .max(150, "Subject cannot exceed 150 characters"),
  message: z
    .string()
    .trim()
    .min(10, "Message must be at least 10 characters")
    .max(3000, "Message cannot exceed 3,000 characters"),
  // Honeypot field for bot/spam defense
  companyWebsite: z.string().max(0, "Spam detected").optional().or(z.literal("")),
});

export type CreateSupportTicketInput = z.infer<typeof createSupportTicketSchema>;

/**
 * Validation schema for replying to an existing support ticket
 */
export const addSupportMessageSchema = z.object({
  ticketId: z.string().uuid("Invalid ticket ID"),
  messageText: z
    .string()
    .trim()
    .min(2, "Message must be at least 2 characters")
    .max(4000, "Message cannot exceed 4,000 characters"),
  isStaffOnlyNote: z.boolean().default(false),
});

export type AddSupportMessageInput = z.infer<typeof addSupportMessageSchema>;

/**
 * Validation schema for updating ticket status
 */
export const updateSupportTicketStatusSchema = z.object({
  ticketId: z.string().uuid("Invalid ticket ID"),
  status: z.nativeEnum(SupportTicketStatus),
  adminNotes: z.string().trim().max(1000).optional(),
});

export type UpdateSupportTicketStatusInput = z.infer<typeof updateSupportTicketStatusSchema>;

/**
 * Generates human-friendly ticket numbers like TKT-2026-10492
 */
export function generateTicketNumber(): string {
  const year = new Date().getFullYear();
  const randomPart = Math.floor(10000 + Math.random() * 90000);
  return `TKT-${year}-${randomPart}`;
}

/**
 * Creates a new support ticket and logs first message.
 */
export async function createSupportTicket(
  input: CreateSupportTicketInput,
  actor?: { userId?: string | null; email?: string | null; ipAddress?: string | null }
) {
  // Honeypot check
  if (input.companyWebsite && input.companyWebsite.length > 0) {
    throw new SupportServiceError("Spam verification failed.", 400);
  }

  const ticketNumber = generateTicketNumber();

  const ticket = await prisma.$transaction(async (tx) => {
    const createdTicket = await tx.supportTicket.create({
      data: {
        ticketNumber,
        userId: actor?.userId || null,
        customerName: input.customerName,
        customerEmail: input.customerEmail.toLowerCase(),
        customerPhone: input.customerPhone,
        subject: input.subject,
        status: SupportTicketStatus.OPEN,
      },
    });

    await tx.supportTicketMessage.create({
      data: {
        ticketId: createdTicket.id,
        senderId: actor?.userId || null,
        messageText: input.message,
        isStaff: false,
      },
    });

    return createdTicket;
  });

  // Notify customer if registered user
  if (actor?.userId) {
    await sendCustomerNotification({
      userId: actor.userId,
      title: `Support Ticket Received: #${ticket.ticketNumber}`,
      message: `We have received your support inquiry regarding "${ticket.subject}". A representative will respond shortly.`,
      linkUrl: `/account/support/${ticket.id}`,
      idempotencyKey: `ticket-created:${ticket.id}`,
    });
  }

  // Audit log
  await logAudit({
    actorId: actor?.userId,
    actorEmail: actor?.email || input.customerEmail,
    actorRole: "CUSTOMER",
    action: "SUPPORT_TICKET_CREATED",
    entityType: "SupportTicket",
    entityId: ticket.id,
    metadata: {
      ticketNumber: ticket.ticketNumber,
      subject: ticket.subject,
    },
    ipAddress: actor?.ipAddress,
  });

  return ticket;
}

/**
 * Adds a message or private internal note to a support ticket.
 * Enforces strict staff vs customer separation.
 */
export async function addTicketMessage(
  input: AddSupportMessageInput,
  actor: { userId: string; email: string; role: string; name?: string | null }
) {
  const isStaff = ["ADMIN", "OPERATIONS", "FINANCE", "SUPPORT"].includes(actor.role);

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: input.ticketId },
    include: { user: true },
  });

  if (!ticket) {
    throw new SupportServiceError("Support ticket not found.", 404);
  }

  // Customer IDOR Protection
  if (!isStaff) {
    if (ticket.userId !== actor.userId && ticket.customerEmail !== actor.email.toLowerCase()) {
      throw new SupportServiceError("Access denied to this ticket.", 403);
    }
    // Customers can NEVER create staff-only notes
    if (input.isStaffOnlyNote) {
      throw new SupportServiceError("Customers cannot submit staff-only notes.", 403);
    }
  }

  // Format internal staff note if requested
  const messageText =
    isStaff && input.isStaffOnlyNote
      ? `[INTERNAL STAFF NOTE]\n${input.messageText}`
      : input.messageText;

  const newMessage = await prisma.$transaction(async (tx) => {
    const msg = await tx.supportTicketMessage.create({
      data: {
        ticketId: ticket.id,
        senderId: actor.userId,
        messageText,
        isStaff,
      },
    });

    // Auto-update status if staff replied publicly
    if (isStaff && !input.isStaffOnlyNote && ticket.status === SupportTicketStatus.OPEN) {
      await tx.supportTicket.update({
        where: { id: ticket.id },
        data: { status: SupportTicketStatus.IN_PROGRESS },
      });
    }

    return msg;
  });

  // Notify customer only if staff replied PUBLICLY (never notify for staff-only internal notes)
  if (isStaff && !input.isStaffOnlyNote && ticket.userId) {
    await sendCustomerNotification({
      userId: ticket.userId,
      title: `New Reply on Ticket #${ticket.ticketNumber}`,
      message: `Our support team has posted a reply regarding: "${ticket.subject}".`,
      linkUrl: `/account/support/${ticket.id}`,
    });
  }

  await logAudit({
    actorId: actor.userId,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: input.isStaffOnlyNote ? "SUPPORT_INTERNAL_NOTE_ADDED" : "SUPPORT_MESSAGE_POSTED",
    entityType: "SupportTicket",
    entityId: ticket.id,
    metadata: {
      ticketNumber: ticket.ticketNumber,
      isStaffOnly: input.isStaffOnlyNote,
    },
  });

  return newMessage;
}

/**
 * Admin status update (e.g., RESOLVED, CLOSED, IN_PROGRESS)
 */
export async function updateTicketStatus(
  input: UpdateSupportTicketStatusInput,
  actor: { userId: string; email: string; role: string }
) {
  const isStaff = ["ADMIN", "OPERATIONS", "FINANCE", "SUPPORT"].includes(actor.role);
  if (!isStaff) {
    throw new SupportServiceError("Administrative privileges required.", 403);
  }

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: input.ticketId },
  });

  if (!ticket) {
    throw new SupportServiceError("Support ticket not found.", 404);
  }

  const updatedTicket = await prisma.$transaction(async (tx) => {
    const updated = await tx.supportTicket.update({
      where: { id: ticket.id },
      data: { status: input.status },
    });

    if (input.adminNotes) {
      await tx.supportTicketMessage.create({
        data: {
          ticketId: ticket.id,
          senderId: actor.userId,
          messageText: `[INTERNAL STAFF NOTE - STATUS UPDATE: ${input.status}]\n${input.adminNotes}`,
          isStaff: true,
        },
      });
    }

    return updated;
  });

  // Notify customer if resolved
  if (input.status === SupportTicketStatus.RESOLVED && ticket.userId) {
    await sendCustomerNotification({
      userId: ticket.userId,
      title: `Support Ticket Resolved: #${ticket.ticketNumber}`,
      message: `Your ticket regarding "${ticket.subject}" has been marked as resolved. Please reply if you need further assistance.`,
      linkUrl: `/account/support/${ticket.id}`,
      idempotencyKey: `ticket-resolved:${ticket.id}`,
    });
  }

  await logAudit({
    actorId: actor.userId,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: "SUPPORT_TICKET_STATUS_UPDATED",
    entityType: "SupportTicket",
    entityId: ticket.id,
    metadata: {
      ticketNumber: ticket.ticketNumber,
      fromStatus: ticket.status,
      toStatus: input.status,
    },
  });

  return updatedTicket;
}

/**
 * Filter messages to protect staff confidentiality.
 * Customer-visible messages must strip internal staff notes.
 */
export function sanitizeSupportMessagesForCustomer<
  T extends { isStaff: boolean; messageText: string }
>(messages: T[]): T[] {
  return messages.filter((msg) => {
    // If it's a staff message marked as internal note, hide from customer
    if (msg.isStaff && msg.messageText.startsWith("[INTERNAL STAFF NOTE")) {
      return false;
    }
    return true;
  });
}
