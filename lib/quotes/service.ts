import { prisma } from "@/lib/prisma";
import {
  QuoteStatus,
  InquiryStatus,
  OrderStatus,
  PaymentStatus,
  ProcurementStatus,
  ShipmentStatus,
  Prisma,
} from "@prisma/client";
import {
  QuoteCreateInput,
  QuoteAcceptInput,
  QuoteRejectInput,
  ShippingOption,
  calculateQuoteTotals,
  ImmutableQuoteAcceptanceSnapshot,
} from "./types";
import { logAudit } from "@/lib/audit";
import { sendCustomerNotification, NotificationTemplates } from "@/lib/notifications";

export class QuoteServiceError extends Error {
  public code: string;
  public statusCode: number;

  constructor(message: string, code: string, statusCode = 400) {
    super(message);
    this.name = "QuoteServiceError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Generate sequential, unique quote number.
 * Format: QUO-YYYY-XXXX (e.g. QUO-2026-0002)
 */
export async function generateQuoteNumber(tx?: Prisma.TransactionClient): Promise<string> {
  const db = tx || prisma;
  const currentYear = new Date().getFullYear();
  const prefix = `QUO-${currentYear}-`;

  const latestQuote = await db.quote.findFirst({
    where: {
      quoteNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      quoteNumber: "desc",
    },
    select: {
      quoteNumber: true,
    },
  });

  let nextSequence = 1;
  if (latestQuote && latestQuote.quoteNumber.startsWith(prefix)) {
    const seqStr = latestQuote.quoteNumber.slice(prefix.length);
    const parsedSeq = parseInt(seqStr, 10);
    if (!isNaN(parsedSeq)) {
      nextSequence = parsedSeq + 1;
    }
  }

  return `${prefix}${nextSequence.toString().padStart(4, "0")}`;
}

/**
 * Generate sequential, unique order number.
 * Format: ORD-YYYY-XXXX (e.g. ORD-2026-0002)
 */
export async function generateOrderNumber(tx?: Prisma.TransactionClient): Promise<string> {
  const db = tx || prisma;
  const currentYear = new Date().getFullYear();
  const prefix = `ORD-${currentYear}-`;

  const latestOrder = await db.order.findFirst({
    where: {
      orderNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      orderNumber: "desc",
    },
    select: {
      orderNumber: true,
    },
  });

  let nextSequence = 1;
  if (latestOrder && latestOrder.orderNumber.startsWith(prefix)) {
    const seqStr = latestOrder.orderNumber.slice(prefix.length);
    const parsedSeq = parseInt(seqStr, 10);
    if (!isNaN(parsedSeq)) {
      nextSequence = parsedSeq + 1;
    }
  }

  return `${prefix}${nextSequence.toString().padStart(4, "0")}`;
}

/**
 * Helper to parse shipping options from termsAndConditions or fallback to default single option.
 */
export function extractShippingOptionsFromQuote(quote: {
  shippingMethod: string | null;
  shippingFeeBDT: Prisma.Decimal | number;
  estDeliveryDaysMin: number | null;
  estDeliveryDaysMax: number | null;
  termsAndConditions: string | null;
}): ShippingOption[] {
  if (quote.termsAndConditions) {
    try {
      const parsed = JSON.parse(quote.termsAndConditions);
      if (Array.isArray(parsed?.shippingOptions) && parsed.shippingOptions.length > 0) {
        return parsed.shippingOptions;
      }
    } catch {
      // not JSON or does not contain options, fallback
    }
  }

  // Fallback single option from legacy columns
  return [
    {
      id: "default-option",
      name: quote.shippingMethod || "Standard Sourcing & Air Freight",
      description: "Direct air cargo courier from Malaysia to Dhaka Hub",
      costBDT: Number(quote.shippingFeeBDT || 0),
      estDaysMin: quote.estDeliveryDaysMin || 7,
      estDaysMax: quote.estDeliveryDaysMax || 14,
      isDefault: true,
    },
  ];
}

/**
 * Helper to extract terms text (excluding shipping options metadata).
 */
export function extractTermsText(termsAndConditions: string | null): string {
  if (!termsAndConditions) return "";
  try {
    const parsed = JSON.parse(termsAndConditions);
    if (parsed && typeof parsed === "object" && "termsText" in parsed) {
      return parsed.termsText || "";
    }
  } catch {
    // raw string
  }
  return termsAndConditions;
}

/**
 * Automatically update expired quotes to QuoteStatus.EXPIRED if validUntil < now and still SENT or DRAFT.
 */
export async function expireOutdatedQuotes(inquiryId?: string, tx?: Prisma.TransactionClient): Promise<number> {
  const db = tx || prisma;
  const now = new Date();

  const whereClause: Prisma.QuoteWhereInput = {
    validUntil: { lt: now },
    status: { in: [QuoteStatus.SENT, QuoteStatus.DRAFT] },
  };

  if (inquiryId) {
    whereClause.inquiryId = inquiryId;
  }

  const result = await db.quote.updateMany({
    where: whereClause,
    data: {
      status: QuoteStatus.EXPIRED,
    },
  });

  return result.count;
}

/**
 * Create or supersede a Quote (Admin action).
 * If prior active quotes exist for the inquiry, creates a higher version number
 * and supersedes the prior non-accepted quote.
 */
export async function createOrVersionQuote(
  input: QuoteCreateInput,
  actor: { id: string; email: string; role: string }
) {
  return await prisma.$transaction(async (tx) => {
    // 1. Verify Inquiry exists
    const inquiry = await tx.productInquiry.findUnique({
      where: { id: input.inquiryId },
      include: {
        quotes: {
          orderBy: { version: "desc" },
        },
      },
    });

    if (!inquiry) {
      throw new QuoteServiceError("The specified product inquiry does not exist.", "INQUIRY_NOT_FOUND", 404);
    }

    // Check if an accepted quote already exists for this inquiry
    const existingAccepted = inquiry.quotes.find((q) => q.status === QuoteStatus.ACCEPTED);
    if (existingAccepted) {
      throw new QuoteServiceError(
        `Cannot issue a new quote version because quote #${existingAccepted.quoteNumber} v${existingAccepted.version} has already been accepted and locked.`,
        "QUOTE_ALREADY_ACCEPTED",
        400
      );
    }

    // 2. Determine Version Number
    const highestVersion = inquiry.quotes.length > 0 ? inquiry.quotes[0].version : 0;
    const newVersion = highestVersion + 1;

    // 3. Mark previous active (SENT or DRAFT) quotes as SUPERSEDED
    await tx.quote.updateMany({
      where: {
        inquiryId: input.inquiryId,
        status: { in: [QuoteStatus.SENT, QuoteStatus.DRAFT] },
      },
      data: {
        status: QuoteStatus.SUPERSEDED,
      },
    });

    // 4. Determine default shipping option & costs
    const shippingOptions = input.shippingOptions;
    const selectedDefaultShipping =
      shippingOptions.find((opt) => opt.id === input.defaultShippingOptionId) ||
      shippingOptions.find((opt) => opt.isDefault) ||
      shippingOptions[0];

    // Calculate Totals using default shipping option
    const totals = calculateQuoteTotals({
      lineItems: input.lineItems,
      serviceFeeBDT: input.serviceFeeBDT,
      shippingFeeBDT: selectedDefaultShipping.costBDT,
      customsFeeBDT: input.customsFeeBDT,
      discountBDT: input.discountBDT,
    });

    // 5. Generate unique quote number
    const quoteNumber = await generateQuoteNumber(tx);

    // Embed shipping options inside terms metadata
    const termsJsonData = JSON.stringify({
      termsText: input.termsAndConditions || null,
      shippingOptions: input.shippingOptions,
    });

    // 6. Create the Quote record
    const createdQuote = await tx.quote.create({
      data: {
        quoteNumber,
        version: newVersion,
        inquiryId: input.inquiryId,
        createdById: actor.id,
        status: input.status,
        validUntil: new Date(input.validUntil),
        currency: "BDT",
        itemsSubtotalBDT: new Prisma.Decimal(totals.itemsSubtotalBDT),
        serviceFeeBDT: new Prisma.Decimal(totals.serviceFeeBDT),
        shippingFeeBDT: new Prisma.Decimal(totals.shippingFeeBDT),
        customsFeeBDT: new Prisma.Decimal(totals.customsFeeBDT),
        discountBDT: new Prisma.Decimal(totals.discountBDT),
        totalAmountBDT: new Prisma.Decimal(totals.totalAmountBDT),

        // Internal sourcing estimates
        estCostMYR: input.estCostMYR !== undefined && input.estCostMYR !== null ? new Prisma.Decimal(input.estCostMYR) : null,
        estExchangeRate: input.estExchangeRate !== undefined && input.estExchangeRate !== null ? new Prisma.Decimal(input.estExchangeRate) : null,
        adminNotes: input.adminNotes || null,

        // Logistics & Terms
        shippingMethod: selectedDefaultShipping.name,
        estDispatchDaysMin: input.estDispatchDaysMin || null,
        estDispatchDaysMax: input.estDispatchDaysMax || null,
        estDeliveryDaysMin: selectedDefaultShipping.estDaysMin,
        estDeliveryDaysMax: selectedDefaultShipping.estDaysMax,
        termsAndConditions: termsJsonData,
        customerNotes: input.customerNotes || null,

        // Line Items
        lineItems: {
          create: input.lineItems.map((item) => {
            const qty = Math.max(1, Math.floor(item.quantity));
            const unitPrice = Math.max(0, item.unitPriceBDT);
            const totalPrice = Math.round(qty * unitPrice * 100) / 100;

            return {
              productId: item.productId || null,
              title: item.title,
              description: item.description || null,
              sourceUrl: item.sourceUrl || null,
              quantity: qty,
              unitPriceBDT: new Prisma.Decimal(unitPrice),
              totalPriceBDT: new Prisma.Decimal(totalPrice),
              estUnitCostMYR: item.estUnitCostMYR !== undefined && item.estUnitCostMYR !== null ? new Prisma.Decimal(item.estUnitCostMYR) : null,
            };
          }),
        },
      },
      include: {
        lineItems: true,
        inquiry: true,
      },
    });

    // 7. Update inquiry status to QUOTED if sending
    if (input.status === QuoteStatus.SENT) {
      await tx.productInquiry.update({
        where: { id: input.inquiryId },
        data: {
          status: InquiryStatus.QUOTED,
        },
      });

      await tx.inquiryStatusHistory.create({
        data: {
          inquiryId: input.inquiryId,
          fromStatus: inquiry.status,
          toStatus: InquiryStatus.QUOTED,
          changedById: actor.id,
          reason: `Quote ${quoteNumber} v${newVersion} sent to customer with total ${totals.totalAmountBDT} BDT.`,
        },
      });
    }

    // 8. Log Audit
    await logAudit({
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: "QUOTE_CREATED",
      entityType: "Quote",
      entityId: createdQuote.id,
      metadata: {
        quoteNumber,
        version: newVersion,
        status: input.status,
        inquiryId: input.inquiryId,
        totalBDT: totals.totalAmountBDT,
      },
    });

    // 9. Dispatch Customer Notification if quote was SENT
    if (input.status === QuoteStatus.SENT && inquiry.userId) {
      const template = NotificationTemplates.quoteSent(
        createdQuote.quoteNumber,
        createdQuote.validUntil.toLocaleDateString(),
        createdQuote.id
      );
      await sendCustomerNotification({
        userId: inquiry.userId,
        title: template.title,
        message: template.message,
        linkUrl: template.linkUrl,
        emailSubject: template.emailSubject,
        category: template.category,
        idempotencyKey: `quote-sent:${createdQuote.id}:v${createdQuote.version}`,
      });
    }

    return createdQuote;
  });
}

/**
 * Customer Quote Acceptance Workflow:
 * 1. Concurrency-safe database transaction.
 * 2. Strict IDOR check: must belong to the customer.
 * 3. Strict Expiry check: cannot accept expired quotes.
 * 4. Active status check: must be in SENT status.
 * 5. Concurrency check: locks quote & verifies inquiry has not had another quote accepted.
 * 6. Creates immutable snapshot of financials, terms, selected shipping option, dates, and recipient.
 * 7. Transitions Quote -> ACCEPTED and Inquiry -> ACCEPTED.
 * 8. Generates an Order in AWAITING_PAYMENT status without automatically marking it as paid or purchased.
 */
export async function acceptQuote(
  input: QuoteAcceptInput,
  actor: { id: string; email: string; name: string }
) {
  return await prisma.$transaction(async (tx) => {
    // 1. Fetch quote with line items and inquiry
    const quote = await tx.quote.findUnique({
      where: { id: input.quoteId },
      include: {
        lineItems: true,
        inquiry: {
          include: {
            user: true,
            quotes: {
              where: { status: QuoteStatus.ACCEPTED },
              select: { id: true, version: true, quoteNumber: true },
            },
          },
        },
      },
    });

    if (!quote) {
      throw new QuoteServiceError("Quote not found.", "QUOTE_NOT_FOUND", 404);
    }

    // 2. IDOR Ownership Check: Inquiry user must match the acting customer
    if (quote.inquiry.userId !== actor.id) {
      throw new QuoteServiceError(
        "You do not have permission to accept this quote. Ownership mismatch.",
        "FORBIDDEN_OWNERSHIP",
        403
      );
    }

    // 3. Status Check: Must be in SENT status
    if (quote.status === QuoteStatus.ACCEPTED) {
      throw new QuoteServiceError(
        `This quote (v${quote.version}) has already been accepted on ${quote.acceptedAt?.toISOString()}.`,
        "ALREADY_ACCEPTED",
        400
      );
    }

    if (quote.status === QuoteStatus.SUPERSEDED) {
      throw new QuoteServiceError(
        "This quote version has been superseded by a newer version. Please review the latest quote.",
        "QUOTE_SUPERSEDED",
        400
      );
    }

    if (quote.status === QuoteStatus.REJECTED) {
      throw new QuoteServiceError(
        "This quote was previously rejected and cannot be accepted.",
        "QUOTE_REJECTED",
        400
      );
    }

    if (quote.status !== QuoteStatus.SENT) {
      throw new QuoteServiceError(
        `Quote is not in a valid state for acceptance (Current status: ${quote.status}).`,
        "INVALID_QUOTE_STATUS",
        400
      );
    }

    // 4. Expiry Check
    const now = new Date();
    if (new Date(quote.validUntil) < now) {
      // Mark as expired immediately
      await tx.quote.update({
        where: { id: quote.id },
        data: { status: QuoteStatus.EXPIRED },
      });
      throw new QuoteServiceError(
        `This quote expired on ${quote.validUntil.toISOString()} and can no longer be accepted. Please request an updated quote.`,
        "QUOTE_EXPIRED",
        400
      );
    }

    // 5. Concurrency Check: Has another quote for this inquiry been accepted concurrently?
    if (quote.inquiry.quotes.length > 0) {
      const alreadyAccepted = quote.inquiry.quotes[0];
      throw new QuoteServiceError(
        `Quote #${alreadyAccepted.quoteNumber} (v${alreadyAccepted.version}) has already been accepted for this inquiry. Only one quote version may be accepted.`,
        "CONCURRENT_ACCEPTANCE_CONFLICT",
        409
      );
    }

    // 6. Resolve Selected Shipping Option
    const availableShippingOptions = extractShippingOptionsFromQuote(quote);
    const selectedOption = availableShippingOptions.find(
      (opt) => opt.id === input.selectedShippingOptionId
    );

    if (!selectedOption) {
      throw new QuoteServiceError(
        `Selected shipping option '${input.selectedShippingOptionId}' is not available for this quote.`,
        "INVALID_SHIPPING_OPTION",
        400
      );
    }

    // Recalculate totals with the chosen shipping option
    const calculatedTotals = calculateQuoteTotals({
      lineItems: quote.lineItems.map((li) => ({
        quantity: li.quantity,
        unitPriceBDT: Number(li.unitPriceBDT),
      })),
      serviceFeeBDT: Number(quote.serviceFeeBDT),
      shippingFeeBDT: selectedOption.costBDT,
      customsFeeBDT: Number(quote.customsFeeBDT),
      discountBDT: Number(quote.discountBDT),
    });

    const acceptedAt = new Date();

    // 7. Create Immutable Acceptance Snapshot
    const acceptanceSnapshot: ImmutableQuoteAcceptanceSnapshot = {
      quoteId: quote.id,
      quoteNumber: quote.quoteNumber,
      version: quote.version,
      inquiryId: quote.inquiryId,
      inquiryNumber: quote.inquiry.inquiryNumber,
      acceptedAt: acceptedAt.toISOString(),
      acceptedById: actor.id,
      acceptedByEmail: actor.email,
      acceptedByName: actor.name,
      selectedShippingOption: selectedOption,
      currency: "BDT",
      itemsSubtotalBDT: calculatedTotals.itemsSubtotalBDT,
      serviceFeeBDT: calculatedTotals.serviceFeeBDT,
      shippingFeeBDT: calculatedTotals.shippingFeeBDT,
      customsFeeBDT: calculatedTotals.customsFeeBDT,
      discountBDT: calculatedTotals.discountBDT,
      totalAmountBDT: calculatedTotals.totalAmountBDT,
      lineItems: quote.lineItems.map((li) => ({
        productId: li.productId,
        title: li.title,
        description: li.description,
        sourceUrl: li.sourceUrl,
        quantity: li.quantity,
        unitPriceBDT: Number(li.unitPriceBDT),
        totalPriceBDT: Number(li.totalPriceBDT),
      })),
      estDispatchDaysMin: quote.estDispatchDaysMin,
      estDispatchDaysMax: quote.estDispatchDaysMax,
      estDeliveryDaysMin: selectedOption.estDaysMin,
      estDeliveryDaysMax: selectedOption.estDaysMax,
      termsAndConditions: extractTermsText(quote.termsAndConditions),
      customerNotes: input.customerNotes || quote.customerNotes,
      shippingAddress: {
        recipientName: input.shippingRecipientName,
        phoneNumber: input.shippingPhoneNumber,
        streetAddress: input.shippingStreetAddress,
        thanaOrUpazila: input.shippingThanaOrUpazila || null,
        district: input.shippingDistrict,
        division: input.shippingDivision,
        postalCode: input.shippingPostalCode || null,
        country: "Bangladesh",
      },
    };

    // 8. Update the Quote with acceptance timestamp and final confirmed shipping option/totals
    const updatedQuote = await tx.quote.update({
      where: { id: quote.id },
      data: {
        status: QuoteStatus.ACCEPTED,
        acceptedAt,
        acceptedById: actor.id,
        shippingMethod: selectedOption.name,
        shippingFeeBDT: new Prisma.Decimal(calculatedTotals.shippingFeeBDT),
        totalAmountBDT: new Prisma.Decimal(calculatedTotals.totalAmountBDT),
        estDeliveryDaysMin: selectedOption.estDaysMin,
        estDeliveryDaysMax: selectedOption.estDaysMax,
        // Embed the full snapshot into termsAndConditions alongside existing data
        termsAndConditions: JSON.stringify({
          ...JSON.parse(quote.termsAndConditions || "{}"),
          acceptanceSnapshot,
        }),
      },
    });

    // 9. Update the Inquiry status -> ACCEPTED
    await tx.productInquiry.update({
      where: { id: quote.inquiryId },
      data: {
        status: InquiryStatus.ACCEPTED,
      },
    });

    await tx.inquiryStatusHistory.create({
      data: {
        inquiryId: quote.inquiryId,
        fromStatus: quote.inquiry.status,
        toStatus: InquiryStatus.ACCEPTED,
        changedById: actor.id,
        reason: `Customer accepted Quote #${quote.quoteNumber} v${quote.version} with shipping option: ${selectedOption.name}. Total: ${calculatedTotals.totalAmountBDT} BDT.`,
      },
    });

    // 10. Supersede any other unaccepted versions of quotes for this inquiry
    await tx.quote.updateMany({
      where: {
        inquiryId: quote.inquiryId,
        id: { not: quote.id },
        status: { in: [QuoteStatus.SENT, QuoteStatus.DRAFT] },
      },
      data: {
        status: QuoteStatus.SUPERSEDED,
      },
    });

    // 11. Create Order in AWAITING_PAYMENT (Do NOT automatically mark as paid or purchased)
    const orderNumber = await generateOrderNumber(tx);

    const createdOrder = await tx.order.create({
      data: {
        orderNumber,
        customerId: actor.id,
        quoteId: quote.id,
        status: OrderStatus.AWAITING_PAYMENT,
        paymentStatus: PaymentStatus.PENDING,
        procurementStatus: ProcurementStatus.NOT_STARTED,
        shipmentStatus: ShipmentStatus.NOT_READY,

        // Snapshotted Agreed Financials (BDT)
        currency: "BDT",
        itemsSubtotalBDT: new Prisma.Decimal(calculatedTotals.itemsSubtotalBDT),
        serviceFeeBDT: new Prisma.Decimal(calculatedTotals.serviceFeeBDT),
        shippingFeeBDT: new Prisma.Decimal(calculatedTotals.shippingFeeBDT),
        customsFeeBDT: new Prisma.Decimal(calculatedTotals.customsFeeBDT),
        discountBDT: new Prisma.Decimal(calculatedTotals.discountBDT),
        totalAmountBDT: new Prisma.Decimal(calculatedTotals.totalAmountBDT),
        paidAmountBDT: new Prisma.Decimal(0),

        // Immutable Snapshotted Delivery Address
        shippingRecipientName: input.shippingRecipientName,
        shippingPhoneNumber: input.shippingPhoneNumber,
        shippingStreetAddress: input.shippingStreetAddress,
        shippingThanaOrUpazila: input.shippingThanaOrUpazila || null,
        shippingDistrict: input.shippingDistrict,
        shippingDivision: input.shippingDivision,
        shippingPostalCode: input.shippingPostalCode || null,
        shippingCountry: "Bangladesh",

        customerNotes: input.customerNotes || null,
        adminNotes: quote.adminNotes || null,

        // Snapshotted Line Items
        lineItems: {
          create: quote.lineItems.map((li) => ({
            productId: li.productId,
            itemTitle: li.title,
            itemDescription: li.description,
            sourceUrl: li.sourceUrl,
            quantity: li.quantity,
            unitPriceBDT: li.unitPriceBDT,
            totalPriceBDT: li.totalPriceBDT,
          })),
        },

        // Events
        events: {
          create: [
            {
              eventType: "ORDER_CREATED_FROM_QUOTE",
              title: "Pre-Order Created from Quote",
              description: `Order created following customer acceptance of Quote #${quote.quoteNumber} (v${quote.version}). Awaiting payment verification.`,
              isCustomerVisible: true,
              createdById: actor.id,
            },
          ],
        },

        statusHistory: {
          create: [
            {
              fromStatus: null,
              toStatus: OrderStatus.AWAITING_PAYMENT,
              changedById: actor.id,
              reason: "Order generated upon quote acceptance.",
            },
          ],
        },
      },
      include: {
        lineItems: true,
      },
    });

    // 12. Log Auditable Event
    await logAudit({
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: "CUSTOMER",
      action: "QUOTE_ACCEPTED",
      entityType: "Quote",
      entityId: quote.id,
      metadata: {
        quoteNumber: quote.quoteNumber,
        version: quote.version,
        orderId: createdOrder.id,
        orderNumber: createdOrder.orderNumber,
        selectedShippingOption: selectedOption.name,
        totalBDT: calculatedTotals.totalAmountBDT,
        acceptedAt: acceptedAt.toISOString(),
      },
    });

    // 13. Notify Customer of Order Creation upon Acceptance
    const acceptedTemplate = NotificationTemplates.quoteAccepted(
      quote.quoteNumber,
      createdOrder.orderNumber,
      createdOrder.id
    );
    await sendCustomerNotification({
      userId: actor.id,
      title: acceptedTemplate.title,
      message: acceptedTemplate.message,
      linkUrl: acceptedTemplate.linkUrl,
      emailSubject: acceptedTemplate.emailSubject,
      category: acceptedTemplate.category,
      idempotencyKey: `quote-accepted:${quote.id}:order:${createdOrder.id}`,
    });

    return {
      quote: updatedQuote,
      order: createdOrder,
      snapshot: acceptanceSnapshot,
    };
  });
}

/**
 * Customer Quote Rejection Workflow
 */
export async function rejectQuote(
  input: QuoteRejectInput,
  actor: { id: string; email: string; name: string }
) {
  return await prisma.$transaction(async (tx) => {
    const quote = await tx.quote.findUnique({
      where: { id: input.quoteId },
      include: {
        inquiry: true,
      },
    });

    if (!quote) {
      throw new QuoteServiceError("Quote not found.", "QUOTE_NOT_FOUND", 404);
    }

    // Ownership check
    if (quote.inquiry.userId !== actor.id) {
      throw new QuoteServiceError(
        "You do not have permission to reject this quote.",
        "FORBIDDEN_OWNERSHIP",
        403
      );
    }

    if (quote.status === QuoteStatus.ACCEPTED) {
      throw new QuoteServiceError(
        "This quote has already been accepted and cannot be rejected.",
        "QUOTE_ALREADY_ACCEPTED",
        400
      );
    }

    if (quote.status === QuoteStatus.SUPERSEDED) {
      throw new QuoteServiceError(
        "This quote version has been superseded by a newer version.",
        "QUOTE_SUPERSEDED",
        400
      );
    }

    const rejectedAt = new Date();

    const updated = await tx.quote.update({
      where: { id: quote.id },
      data: {
        status: QuoteStatus.REJECTED,
        rejectedAt,
        rejectionReason: input.rejectionReason,
      },
    });

    // Update inquiry status history
    await tx.inquiryStatusHistory.create({
      data: {
        inquiryId: quote.inquiryId,
        fromStatus: quote.inquiry.status,
        toStatus: quote.inquiry.status, // stays quoted or user can discuss
        changedById: actor.id,
        reason: `Customer declined Quote #${quote.quoteNumber} v${quote.version}. Reason: ${input.rejectionReason}`,
      },
    });

    await logAudit({
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: "CUSTOMER",
      action: "QUOTE_REJECTED",
      entityType: "Quote",
      entityId: quote.id,
      metadata: {
        quoteNumber: quote.quoteNumber,
        version: quote.version,
        reason: input.rejectionReason,
        rejectedAt: rejectedAt.toISOString(),
      },
    });

    return updated;
  });
}
