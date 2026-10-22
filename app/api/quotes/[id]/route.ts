import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { assertResourceOwnership, AuthorizationError, isAdminOrStaffRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import {
  extractShippingOptionsFromQuote,
  extractTermsText,
  expireOutdatedQuotes,
} from "@/lib/quotes/service";

/**
 * GET /api/quotes/[id]
 * Retrieves specific quote version with IDOR ownership check.
 * Strips admin internal sourcing data for customer requests.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    const quote = await prisma.quote.findUnique({
      where: { id },
      include: {
        lineItems: true,
        inquiry: {
          select: {
            id: true,
            inquiryNumber: true,
            productName: true,
            brandOrModel: true,
            quantityRequested: true,
            userId: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
              },
            },
          },
        },
      },
    });

    if (!quote) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    // IDOR Protection: Must be the inquiry owner or an admin/staff
    await assertResourceOwnership(quote.inquiry.userId, {
      errorMessage: "Access denied. You do not have permission to view this quotation.",
    });

    // Check if expired
    if (
      quote.status === "SENT" &&
      new Date(quote.validUntil) < new Date()
    ) {
      await expireOutdatedQuotes(quote.inquiryId);
      quote.status = "EXPIRED";
    }

    const isStaff = isAdminOrStaffRole(session.role);
    const shippingOptions = extractShippingOptionsFromQuote(quote);
    const cleanTerms = extractTermsText(quote.termsAndConditions);

    if (!isStaff) {
      // Customer Safe Payload (No internal MYR sourcing cost, no exchange rate, no admin notes)
      return NextResponse.json({
        quote: {
          id: quote.id,
          quoteNumber: quote.quoteNumber,
          version: quote.version,
          inquiryId: quote.inquiryId,
          inquiryNumber: quote.inquiry.inquiryNumber,
          productName: quote.inquiry.productName,
          brandOrModel: quote.inquiry.brandOrModel,
          status: quote.status,
          validUntil: quote.validUntil,
          currency: quote.currency,
          itemsSubtotalBDT: quote.itemsSubtotalBDT,
          serviceFeeBDT: quote.serviceFeeBDT,
          shippingFeeBDT: quote.shippingFeeBDT,
          customsFeeBDT: quote.customsFeeBDT,
          discountBDT: quote.discountBDT,
          totalAmountBDT: quote.totalAmountBDT,
          shippingMethod: quote.shippingMethod,
          shippingOptions,
          estDispatchDaysMin: quote.estDispatchDaysMin,
          estDispatchDaysMax: quote.estDispatchDaysMax,
          estDeliveryDaysMin: quote.estDeliveryDaysMin,
          estDeliveryDaysMax: quote.estDeliveryDaysMax,
          terms: cleanTerms,
          customerNotes: quote.customerNotes,
          acceptedAt: quote.acceptedAt,
          rejectedAt: quote.rejectedAt,
          rejectionReason: quote.rejectionReason,
          lineItems: quote.lineItems.map((item) => ({
            id: item.id,
            productId: item.productId,
            title: item.title,
            description: item.description,
            sourceUrl: item.sourceUrl,
            quantity: item.quantity,
            unitPriceBDT: item.unitPriceBDT,
            totalPriceBDT: item.totalPriceBDT,
          })),
          createdAt: quote.createdAt,
        },
      });
    }

    // Admin/Staff sees complete object
    return NextResponse.json({
      quote: {
        ...quote,
        shippingOptions,
        cleanTerms,
      },
    });
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("[GET /api/quotes/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
