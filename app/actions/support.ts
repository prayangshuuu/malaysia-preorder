"use server";

import { getCurrentSession } from "@/lib/auth/session";
import { isAdminOrStaffRole } from "@/lib/auth/rbac";
import {
  createSupportTicketSchema,
  addSupportMessageSchema,
  updateSupportTicketStatusSchema,
  createSupportTicket,
  addTicketMessage,
  updateTicketStatus,
} from "@/lib/support";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

/**
 * Public Contact / Support Ticket Form Submission
 */
export async function submitSupportTicketAction(formData: FormData) {
  const reqHeaders = await headers();
  const forwarded = reqHeaders.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : "127.0.0.1";

  // Spam & Rate Limit Protection: 5 submissions per 10 minutes per IP
  const rateLimitResult = checkRateLimit(`support-submit:${ip}`, 5, 10 * 60);

  if (!rateLimitResult.success) {
    return {
      success: false,
      error: "Too many contact submissions. Please wait a few minutes before trying again.",
    };
  }

  const session = await getCurrentSession();

  const raw = {
    customerName: formData.get("customerName") as string,
    customerEmail: formData.get("customerEmail") as string,
    customerPhone: (formData.get("customerPhone") as string) || null,
    subject: formData.get("subject") as string,
    message: formData.get("message") as string,
    companyWebsite: (formData.get("companyWebsite") as string) || "",
  };

  const parsed = createSupportTicketSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid contact form input",
    };
  }

  try {
    const ticket = await createSupportTicket(parsed.data, {
      userId: session?.userId,
      email: session?.email,
      ipAddress: ip,
    });

    return {
      success: true,
      ticketNumber: ticket.ticketNumber,
      ticketId: ticket.id,
      message: `Your inquiry #${ticket.ticketNumber} has been received. Our team will contact you shortly.`,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to submit contact inquiry",
    };
  }
}

/**
 * Add a message or internal note to a ticket
 */
export async function addTicketMessageAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, error: "Authentication required to reply." };
  }

  const raw = {
    ticketId: formData.get("ticketId") as string,
    messageText: formData.get("messageText") as string,
    isStaffOnlyNote: formData.get("isStaffOnlyNote") === "true",
  };

  const parsed = addSupportMessageSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid message format",
    };
  }

  try {
    await addTicketMessage(parsed.data, {
      userId: session.userId,
      email: session.email,
      role: session.role,
      name: session.name,
    });

    revalidatePath(`/admin/support/${parsed.data.ticketId}`);
    revalidatePath(`/account/support/${parsed.data.ticketId}`);
    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to post message",
    };
  }
}

/**
 * Admin update of ticket status
 */
export async function updateTicketStatusAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session || !isAdminOrStaffRole(session.role)) {
    return { success: false, error: "Administrative privileges required." };
  }

  const raw = {
    ticketId: formData.get("ticketId") as string,
    status: formData.get("status") as unknown,
    adminNotes: (formData.get("adminNotes") as string) || undefined,
  };

  const parsed = updateSupportTicketStatusSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid status transition parameters",
    };
  }

  try {
    await updateTicketStatus(parsed.data, {
      userId: session.userId,
      email: session.email,
      role: session.role,
    });

    revalidatePath(`/admin/support/${parsed.data.ticketId}`);
    revalidatePath("/admin/support");
    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update ticket status",
    };
  }
}
