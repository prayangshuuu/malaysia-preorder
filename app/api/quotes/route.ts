import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { requireAdminOrStaff, assertResourceOwnership, AuthorizationError, isAdminOrStaffRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  createOrVersionQuote,
  acceptQuote,
  rejectQuote,
  QuoteServiceError,
  extractShippingOptionsFromQuote,
  extractTermsText,
  expireOutdatedQuotes,
} from "@/lib/quotes/service";
import {
  quoteCreateSchema,
  quoteAcceptSchema,
  quoteRejectSchema,
} from "@/lib/quotes/types";

/**
 * GET /api/quotes
 * Customer gets their quotes; Admin gets all quotes (or filter by inquiryId/status).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const inquiryId = searchParams.get("inquiryId");
    const status = searchParams.get("status");

    // Maintenance check: expire outdated quotes
    await expireOutdatedQuotes(inquiryId || undefined);

    const isStaff = isAdminOrStaffRole(session.role);

    const where: Prisma.QuoteWhereInput = {};
    if (inquiryId) {
      where.inquiryId = inquiryId;
    }
    if (status) {
      where.status = status as Prisma.EnumQuoteStatusFilter["equals"];
    }

    if (!isStaff) {
      // Must be customer's inquiries
      where.inquiry = {
        userId: session.userId,
      };
    }

    const quotes = await prisma.quote.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      include: {
        lineItems: true,
        inquiry: {
          select: {
            id: true,
            inquiryNumber: true,
            productName: true,
            userId: true,
          },
        },
      },
    });

    // Mask admin fields for customers
    const sanitized = quotes.map((q) => {
      const shippingOptions = extractShippingOptionsFromQuote(q);
      const cleanTerms = extractTermsText(q.termsAndConditions);

      if (!isStaff) {
        return {
          id: q.id,
          quoteNumber: q.quoteNumber,
          version: q.version,
          inquiryId: q.inquiryId,
          inquiryNumber: q.inquiry.inquiryNumber,
          productName: q.inquiry.productName,
          status: q.status,
          validUntil: q.validUntil,
          currency: q.currency,
          itemsSubtotalBDT: q.itemsSubtotalBDT,
          serviceFeeBDT: q.serviceFeeBDT,
          shippingFeeBDT: q.shippingFeeBDT,
          customsFeeBDT: q.customsFeeBDT,
          discountBDT: q.discountBDT,
          totalAmountBDT: q.totalAmountBDT,
          shippingMethod: q.shippingMethod,
          estDispatchDaysMin: q.estDispatchDaysMin,
          estDispatchDaysMax: q.estDispatchDaysMax,
          estDeliveryDaysMin: q.estDeliveryDaysMin,
          estDeliveryDaysMax: q.estDeliveryDaysMax,
          customerNotes: q.customerNotes,
          terms: cleanTerms,
          shippingOptions,
          acceptedAt: q.acceptedAt,
          rejectedAt: q.rejectedAt,
          rejectionReason: q.rejectionReason,
          createdAt: q.createdAt,
          updatedAt: q.updatedAt,
        };
      }

      return {
        ...q,
        shippingOptions,
        cleanTerms,
      };
    });

    return NextResponse.json({ quotes: sanitized });
  } catch (err: unknown) {
    console.error("[GET /api/quotes]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/quotes
 * Admin creates or supersedes a quote version.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAdminOrStaff();

    const body = await request.json();
    const parsed = quoteCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const created = await createOrVersionQuote(parsed.data, {
      id: session.userId,
      email: session.email,
      role: session.role,
    });

    return NextResponse.json({ quote: created }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    if (err instanceof QuoteServiceError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    console.error("[POST /api/quotes]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
