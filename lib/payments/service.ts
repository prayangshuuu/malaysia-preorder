import { Prisma, PaymentStatus, OrderStatus, PaymentMethodType } from "@prisma/client";
import { prisma } from "../prisma";
import { paymentRegistry } from "./registry";
import { ParsedWebhookEvent } from "./types";
import { sanitizePayload, safePaymentLog } from "./sanitizer";

export interface ProcessWebhookResult {
  success: boolean;
  duplicate: boolean;
  status: PaymentStatus;
  message: string;
  paymentId?: string;
  orderId?: string;
  reconciliationError?: string;
}

export interface ReconcileParams {
  expectedAmount: number;
  actualAmount: number;
  expectedCurrency: string;
  actualCurrency: string;
}

/**
 * Reconciles expected financial details against actual payload values.
 * Uses minor units or 2-decimal precision comparison.
 */
export function reconcileAmounts(params: ReconcileParams): { isMatch: boolean; reason?: string } {
  if (params.expectedCurrency.toUpperCase() !== params.actualCurrency.toUpperCase()) {
    return {
      isMatch: false,
      reason: `Currency mismatch: expected ${params.expectedCurrency}, received ${params.actualCurrency}`,
    };
  }

  const diff = Math.abs(params.expectedAmount - params.actualAmount);
  // Allow at most 0.009 difference due to rounding of 2 decimals
  if (diff > 0.01) {
    return {
      isMatch: false,
      reason: `Amount mismatch: expected ${params.expectedAmount.toFixed(2)}, received ${params.actualAmount.toFixed(2)}`,
    };
  }

  return { isMatch: true };
}

/**
 * Core Service to handle Webhook events with idempotency, verification,
 * atomic database transactions, state machine progression, and audit logs.
 */
export async function processVerifiedWebhookEvent(
  event: ParsedWebhookEvent,
  rawHeaders?: Record<string, string | string[] | undefined>
): Promise<ProcessWebhookResult> {
  const sanitized = sanitizePayload(event.sanitizedPayload);

  // 1. Signature Check
  if (!event.isValidSignature) {
    safePaymentLog("WEBHOOK_INVALID_SIGNATURE", {
      provider: event.provider,
      eventId: event.eventId,
      reason: event.rejectionReason,
    });
    return {
      success: false,
      duplicate: false,
      status: PaymentStatus.FAILED,
      message: event.rejectionReason || "Invalid webhook signature",
    };
  }

  // 2. Check & Record WebhookEvent for unique provider event idempotency
  const existingEvent = await prisma.webhookEvent.findUnique({
    where: {
      provider_eventId: {
        provider: event.provider,
        eventId: event.eventId,
      },
    },
  });

  if (existingEvent && existingEvent.isProcessed) {
    safePaymentLog("WEBHOOK_DUPLICATE_IGNORED", {
      provider: event.provider,
      eventId: event.eventId,
      processedAt: existingEvent.processedAt,
    });
    return {
      success: true,
      duplicate: true,
      status: event.status,
      message: "Duplicate webhook event already processed. Ignored idempotently.",
    };
  }

  // Record initial receipt if not present
  if (!existingEvent) {
    try {
      await prisma.webhookEvent.create({
        data: {
          provider: event.provider,
          eventId: event.eventId,
          eventType: event.eventType,
          payload: sanitized as Prisma.InputJsonValue,
          headers: rawHeaders ? (sanitizePayload(rawHeaders) as Prisma.InputJsonValue) : undefined,
          isProcessed: false,
        },
      });
    } catch (err: unknown) {
      // Race condition safety: if another thread created it
      const isUniqueConstraint = (err as { code?: string })?.code === "P2002";
      if (!isUniqueConstraint) {
        throw err;
      }
    }
  }

  // 3. Find the associated Order
  let order = null;
  if (event.orderId) {
    order = await prisma.order.findUnique({
      where: { id: event.orderId },
      include: { payments: true },
    });
  } else if (event.orderNumber) {
    order = await prisma.order.findUnique({
      where: { orderNumber: event.orderNumber },
      include: { payments: true },
    });
  } else if (event.providerTrxId) {
    const existingPayment = await prisma.payment.findUnique({
      where: { providerTrxId: event.providerTrxId },
      include: { order: { include: { payments: true } } },
    });
    if (existingPayment) {
      order = existingPayment.order;
    }
  }

  if (!order) {
    await prisma.webhookEvent.update({
      where: { provider_eventId: { provider: event.provider, eventId: event.eventId } },
      data: {
        errorMessage: "Associated order not found",
        isProcessed: false,
      },
    });

    safePaymentLog("WEBHOOK_ORDER_NOT_FOUND", {
      provider: event.provider,
      eventId: event.eventId,
      orderNumber: event.orderNumber,
      orderId: event.orderId,
    });

    return {
      success: false,
      duplicate: false,
      status: PaymentStatus.FAILED,
      message: `Order reference not found for event ${event.eventId}`,
    };
  }

  // 4. Amount & Currency Reconciliation
  const orderAmount = Number(order.totalAmountBDT);
  const eventAmount = event.amount ?? orderAmount;
  const eventCurrency = event.currency ?? order.currency;

  const reconciliation = reconcileAmounts({
    expectedAmount: orderAmount,
    actualAmount: eventAmount,
    expectedCurrency: order.currency,
    actualCurrency: eventCurrency,
  });

  if (!reconciliation.isMatch) {
    // Audit & mark event as failed reconciliation
    await prisma.$transaction(async (tx) => {
      await tx.webhookEvent.update({
        where: { provider_eventId: { provider: event.provider, eventId: event.eventId } },
        data: {
          errorMessage: reconciliation.reason,
          isProcessed: true,
          processedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          action: "PAYMENT_RECONCILIATION_FAILED",
          entityType: "Order",
          entityId: order.id,
          metadata: {
            reason: reconciliation.reason,
            expected: { amount: orderAmount, currency: order.currency },
            received: { amount: eventAmount, currency: eventCurrency },
            provider: event.provider,
            eventId: event.eventId,
          },
        },
      });
    });

    return {
      success: false,
      duplicate: false,
      status: PaymentStatus.FAILED,
      message: reconciliation.reason || "Reconciliation failed",
      reconciliationError: reconciliation.reason,
      orderId: order.id,
    };
  }

  // 5. Atomic State Machine Updates inside Database Transaction
  const result = await prisma.$transaction(async (tx) => {
    // Map event.status to PaymentStatus
    const targetStatus = event.status;

    // Check existing payment record or create one
    let payment = order.payments.find(
      (p) =>
        (event.providerTrxId && p.providerTrxId === event.providerTrxId) ||
        (event.providerPaymentId && p.providerPaymentId === event.providerPaymentId) ||
        p.idempotencyKey === `evt-${event.eventId}`
    );

    if (!payment) {
      payment = await tx.payment.create({
        data: {
          paymentNumber: `PAY-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`,
          orderId: order.id,
          method: PaymentMethodType.MANUAL_VERIFICATION,
          status: targetStatus,
          currency: eventCurrency,
          amount: new Prisma.Decimal(eventAmount),
          provider: event.provider,
          providerTrxId: event.providerTrxId || `TRX-${Date.now()}`,
          providerPaymentId: event.providerPaymentId,
          providerPayload: sanitized as Prisma.InputJsonValue,
          idempotencyKey: `evt-${event.eventId}`,
          verifiedAt: targetStatus === PaymentStatus.SUCCEEDED ? new Date() : null,
        },
      });
    } else {
      payment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: targetStatus,
          providerTrxId: event.providerTrxId || payment.providerTrxId,
          providerPayload: sanitized as Prisma.InputJsonValue,
          verifiedAt: targetStatus === PaymentStatus.SUCCEEDED ? new Date() : payment.verifiedAt,
        },
      });
    }

    // Record immutable PaymentAttempt
    await tx.paymentAttempt.create({
      data: {
        paymentId: payment.id,
        method: payment.method,
        gatewayRef: event.providerTrxId || event.providerPaymentId,
        rawStatus: event.eventType,
        requestData: rawHeaders ? (sanitizePayload(rawHeaders) as Prisma.InputJsonValue) : undefined,
        responseData: sanitized as Prisma.InputJsonValue,
      },
    });

    // Update Order state according to state transitions
    let nextOrderStatus = order.status;
    let nextPaidAmount = Number(order.paidAmountBDT);

    if (targetStatus === PaymentStatus.SUCCEEDED) {
      nextPaidAmount = eventAmount;
      // State transition: If AWAITING_PAYMENT / PAYMENT_REVIEW -> PAID
      if (
        order.status === OrderStatus.AWAITING_PAYMENT ||
        order.status === OrderStatus.PAYMENT_REVIEW
      ) {
        nextOrderStatus = OrderStatus.PAID;
      }
    } else if (targetStatus === PaymentStatus.FAILED) {
      if (order.status === OrderStatus.PAYMENT_REVIEW) {
        nextOrderStatus = OrderStatus.AWAITING_PAYMENT;
      }
    } else if (targetStatus === PaymentStatus.CANCELLED) {
      if (order.status === OrderStatus.AWAITING_PAYMENT) {
        nextOrderStatus = OrderStatus.CANCELLED;
      }
    } else if (targetStatus === PaymentStatus.REFUNDED) {
      nextOrderStatus = OrderStatus.REFUNDED;
      nextPaidAmount = 0;
    } else if (targetStatus === PaymentStatus.PARTIALLY_REFUNDED) {
      nextOrderStatus = OrderStatus.PARTIALLY_REFUNDED;
    }

    if (nextOrderStatus !== order.status || nextPaidAmount !== Number(order.paidAmountBDT)) {
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: nextOrderStatus,
          paymentStatus: targetStatus,
          paidAmountBDT: new Prisma.Decimal(nextPaidAmount),
        },
      });

      // Status history record
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: nextOrderStatus,
          reason: `Payment transition from provider webhook event: ${event.eventType} (${targetStatus})`,
        },
      });

      // Customer-visible order event
      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          eventType: "PAYMENT_UPDATE",
          title: `Payment ${targetStatus}`,
          description: `Provider ${event.provider} confirmed status ${targetStatus} (Trx: ${event.providerTrxId || "N/A"})`,
          isCustomerVisible: true,
        },
      });
    }

    // Special check: If this order is a wallet top-up order and payment succeeded,
    // post top-up credit to customer's wallet ledger automatically
    if (
      targetStatus === PaymentStatus.SUCCEEDED &&
      order.orderNumber.startsWith("ORD-TOPUP-")
    ) {
      const topUpIdempotencyKey = `wallet-topup-${payment.id}`;
      const existingLedger = await tx.walletLedgerEntry.findUnique({
        where: { idempotencyKey: topUpIdempotencyKey },
      });

      if (!existingLedger) {
        // Find or create customer wallet
        let wallet = await tx.walletAccount.findUnique({
          where: { userId: order.customerId },
        });

        if (!wallet) {
          wallet = await tx.walletAccount.create({
            data: {
              userId: order.customerId,
              currency: order.currency,
              balance: new Prisma.Decimal(0),
              isActive: true,
            },
          });
        }

        // Row lock wallet for concurrency safety
        const walletRows: Array<{
          id: string;
          balance: string | number;
        }> = await tx.$queryRaw`
          SELECT id, balance
          FROM "WalletAccount"
          WHERE id = ${wallet.id}
          FOR UPDATE
        `;

        const currentBalNum = Number(walletRows[0].balance);
        const creditAmountNum = Number(payment.amount);
        const newBalNum = currentBalNum + creditAmountNum;

        await tx.walletLedgerEntry.create({
          data: {
            walletId: wallet.id,
            entryType: "TOP_UP",
            amount: payment.amount,
            balanceAfter: new Prisma.Decimal(newBalNum.toFixed(2)),
            currency: order.currency,
            idempotencyKey: topUpIdempotencyKey,
            referenceNote: `Verified top-up from payment ${payment.paymentNumber} (${event.provider})`,
            paymentId: payment.id,
            orderId: order.id,
            createdById: order.customerId,
          },
        });

        await tx.walletAccount.update({
          where: { id: wallet.id },
          data: {
            balance: new Prisma.Decimal(newBalNum.toFixed(2)),
          },
        });
      }
    }

    // Mark WebhookEvent as processed
    await tx.webhookEvent.update({
      where: { provider_eventId: { provider: event.provider, eventId: event.eventId } },
      data: {
        isProcessed: true,
        processedAt: new Date(),
      },
    });

    // Record immutable audit log
    await tx.auditLog.create({
      data: {
        action: `PAYMENT_${targetStatus}`,
        entityType: "Payment",
        entityId: payment.id,
        metadata: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          provider: event.provider,
          eventId: event.eventId,
          amount: eventAmount,
          currency: eventCurrency,
          status: targetStatus,
        },
      },
    });

    return {
      paymentId: payment.id,
      orderId: order.id,
      status: targetStatus,
    };
  });

  safePaymentLog("WEBHOOK_PROCESSED_SUCCESS", {
    provider: event.provider,
    eventId: event.eventId,
    orderId: result.orderId,
    status: result.status,
  });

  return {
    success: true,
    duplicate: false,
    status: result.status,
    paymentId: result.paymentId,
    orderId: result.orderId,
    message: `Payment successfully updated to ${result.status}`,
  };
}

/**
 * Initiates payment flow for an order using a chosen provider.
 */
export async function initiateOrderPayment(params: {
  orderId: string;
  providerName?: string;
  customerId: string;
  returnUrl?: string;
  cancelUrl?: string;
  idempotencyKey?: string;
}) {
  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
    include: {
      customer: true,
      payments: {
        where: {
          status: {
            in: [PaymentStatus.SUCCEEDED, PaymentStatus.PENDING, PaymentStatus.REQUIRES_ACTION],
          },
        },
      },
    },
  });

  if (!order) {
    throw new Error("Order not found");
  }

  // IDOR check
  if (order.customerId !== params.customerId) {
    throw new Error("Access denied: Order belongs to another customer");
  }

  if (order.paymentStatus === PaymentStatus.SUCCEEDED || order.status === OrderStatus.PAID) {
    throw new Error("Order is already paid");
  }

  const provider = paymentRegistry.getProvider(params.providerName);
  const config = provider.getConfigState();

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const returnUrl = params.returnUrl || `${baseUrl}/orders/${order.id}?payment=return`;
  const cancelUrl = params.cancelUrl || `${baseUrl}/orders/${order.id}?payment=cancelled`;
  const idempotencyKey = params.idempotencyKey || `init-${order.id}-${Date.now()}`;

  const initiationResult = await provider.initiatePayment({
    orderId: order.id,
    orderNumber: order.orderNumber,
    amountBDT: Number(order.totalAmountBDT),
    currency: order.currency as "BDT",
    customer: {
      id: order.customer.id,
      name: order.customer.name,
      email: order.customer.email,
      phone: order.customer.phone,
    },
    returnUrl,
    cancelUrl,
    idempotencyKey,
  });

  // Record payment attempt / pending record in database
  if (initiationResult.success) {
    await prisma.$transaction(async (tx) => {
      const paymentNumber = `PAY-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;
      const payment = await tx.payment.create({
        data: {
          paymentNumber,
          orderId: order.id,
          method: provider.methodType,
          status: initiationResult.status,
          currency: order.currency,
          amount: order.totalAmountBDT,
          provider: provider.providerName,
          providerPaymentId: initiationResult.gatewayReference,
          idempotencyKey,
          providerPayload: sanitizePayload(initiationResult.actionDetails || {}) as Prisma.InputJsonValue,
        },
      });

      await tx.paymentAttempt.create({
        data: {
          paymentId: payment.id,
          method: provider.methodType,
          gatewayRef: initiationResult.gatewayReference,
          rawStatus: initiationResult.status,
          responseData: sanitizePayload(initiationResult) as unknown as Prisma.InputJsonValue,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: params.customerId,
          actorRole: "CUSTOMER",
          action: "PAYMENT_INITIATED",
          entityType: "Order",
          entityId: order.id,
          metadata: {
            provider: provider.providerName,
            status: initiationResult.status,
            paymentNumber,
            idempotencyKey,
          },
        },
      });
    });
  }

  return {
    ...initiationResult,
    configState: config,
  };
}
