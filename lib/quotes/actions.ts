"use server";

import { revalidatePath } from "next/cache";
import { requireAdminOrStaff, requireAuth } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import {
  quoteCreateSchema,
  quoteAcceptSchema,
  quoteRejectSchema,
  QuoteCreateInput,
  QuoteAcceptInput,
  QuoteRejectInput,
} from "./types";
import {
  createOrVersionQuote,
  acceptQuote,
  rejectQuote,
  QuoteServiceError,
  expireOutdatedQuotes,
} from "./service";

export interface QuoteActionResult<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  fieldErrors?: Record<string, string[]>;
}

/**
 * Admin action: Create a new quote or supersede prior quote for an inquiry.
 */
export async function createQuoteAction(
  rawInput: QuoteCreateInput
): Promise<QuoteActionResult<{ quoteId: string; quoteNumber: string; version: number }>> {
  try {
    const session = await requireAdminOrStaff();

    const parsed = quoteCreateSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        message: "Invalid quote data. Please check required fields.",
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const created = await createOrVersionQuote(parsed.data, {
      id: session.userId,
      email: session.email,
      role: session.role,
    });

    revalidatePath("/admin");
    revalidatePath("/admin/quotes");
    revalidatePath(`/admin/inquiries/${created.inquiryId}`);
    revalidatePath(`/account/quotes`);

    return {
      success: true,
      message: `Quote #${created.quoteNumber} (v${created.version}) successfully ${
        created.status === "SENT" ? "sent to customer" : "saved as draft"
      }.`,
      data: {
        quoteId: created.id,
        quoteNumber: created.quoteNumber,
        version: created.version,
      },
    };
  } catch (error: unknown) {
    if (error instanceof QuoteServiceError) {
      return {
        success: false,
        message: error.message,
      };
    }
    console.error("[createQuoteAction] Error:", error);
    return {
      success: false,
      message: "An unexpected error occurred while creating the quotation.",
    };
  }
}

/**
 * Customer action: Explicitly accept a specific quote version.
 */
export async function acceptQuoteAction(
  rawInput: QuoteAcceptInput
): Promise<QuoteActionResult<{ orderId: string; orderNumber: string }>> {
  try {
    const session = await requireAuth();

    const parsed = quoteAcceptSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        message: "Please complete delivery and shipping selections correctly.",
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const result = await acceptQuote(parsed.data, {
      id: session.userId,
      email: session.email,
      name: session.name || "Valued Customer",
    });

    revalidatePath("/account");
    revalidatePath("/account/quotes");
    revalidatePath(`/account/quotes/${result.quote.id}`);
    revalidatePath(`/quotes/${result.quote.id}`);
    revalidatePath(`/api/orders/${result.order.id}`);

    return {
      success: true,
      message: `Quote #${result.quote.quoteNumber} (v${result.quote.version}) accepted! Order #${result.order.orderNumber} has been generated.`,
      data: {
        orderId: result.order.id,
        orderNumber: result.order.orderNumber,
      },
    };
  } catch (error: unknown) {
    if (error instanceof QuoteServiceError) {
      return {
        success: false,
        message: error.message,
      };
    }
    console.error("[acceptQuoteAction] Error:", error);
    return {
      success: false,
      message: "Failed to accept quote. Please try again or contact support.",
    };
  }
}

/**
 * Customer action: Reject a quote version.
 */
export async function rejectQuoteAction(
  rawInput: QuoteRejectInput
): Promise<QuoteActionResult<{ quoteId: string }>> {
  try {
    const session = await requireAuth();

    const parsed = quoteRejectSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        message: "Please provide a valid reason for rejection.",
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const result = await rejectQuote(parsed.data, {
      id: session.userId,
      email: session.email,
      name: session.name || "Customer",
    });

    revalidatePath("/account/quotes");
    revalidatePath(`/account/quotes/${result.id}`);
    revalidatePath(`/quotes/${result.id}`);

    return {
      success: true,
      message: `Quote #${result.quoteNumber} (v${result.version}) has been declined.`,
      data: {
        quoteId: result.id,
      },
    };
  } catch (error: unknown) {
    if (error instanceof QuoteServiceError) {
      return {
        success: false,
        message: error.message,
      };
    }
    console.error("[rejectQuoteAction] Error:", error);
    return {
      success: false,
      message: "Failed to decline quote.",
    };
  }
}

/**
 * Helper to run expiration maintenance on quotes.
 */
export async function triggerQuoteExpirationAction(): Promise<QuoteActionResult<{ expiredCount: number }>> {
  try {
    const session = await requireAdminOrStaff();
    const count = await expireOutdatedQuotes();
    return {
      success: true,
      message: `Expired ${count} overdue quotation(s).`,
      data: { expiredCount: count },
    };
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to run expiration check.",
    };
  }
}
