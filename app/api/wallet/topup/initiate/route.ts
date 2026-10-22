import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { initiateTopUpSchema } from "@/lib/wallet/validations";
import { initiateOrderPayment } from "@/lib/payments/service";
import { Prisma } from "@prisma/client";

/**
 * POST /api/wallet/topup/initiate
 * Creates a pending top-up transaction and initiates payment through the payment provider.
 * Funds are NOT available until verified webhook or payment confirmation is received.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Authentication required" },
        { status: 401 }
      );
    }

    const json = await request.json();
    const parseResult = initiateTopUpSchema.safeParse(json);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation Error", details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { amountBDT, idempotencyKey, providerName, returnUrl, cancelUrl } = parseResult.data;

    // Create an internal TOPUP order that anchors the payment flow
    const topUpOrder = await prisma.$transaction(async (tx) => {
      // Check if top-up order with this idempotency key already exists
      const existing = await tx.order.findFirst({
        where: {
          customerId: session.userId,
          orderNumber: `ORD-TOPUP-${idempotencyKey.slice(0, 16)}`,
        },
      });

      if (existing) {
        return existing;
      }

      const orderNumber = `ORD-TOPUP-${idempotencyKey.slice(0, 16)}`;
      const decimalAmount = new Prisma.Decimal(amountBDT.toFixed(2));

      return await tx.order.create({
        data: {
          orderNumber,
          customerId: session.userId,
          currency: "BDT",
          itemsSubtotalBDT: decimalAmount,
          serviceFeeBDT: new Prisma.Decimal(0),
          shippingFeeBDT: new Prisma.Decimal(0),
          customsFeeBDT: new Prisma.Decimal(0),
          discountBDT: new Prisma.Decimal(0),
          totalAmountBDT: decimalAmount,
          paidAmountBDT: new Prisma.Decimal(0),
          shippingRecipientName: "Customer Wallet",
          shippingPhoneNumber: "N/A",
          shippingStreetAddress: "Wallet Top-up Balance",
          shippingDistrict: "Dhaka",
          shippingDivision: "Dhaka",
          customerNotes: `Wallet top-up for ৳${amountBDT.toFixed(2)}`,
          status: "AWAITING_PAYMENT",
          paymentStatus: "PENDING",
        },
      });
    });

    // Initiate payment through payment subsystem abstraction
    const paymentResult = await initiateOrderPayment({
      orderId: topUpOrder.id,
      providerName: providerName || "safe-dev-payment",
      customerId: session.userId,
      returnUrl: returnUrl || `/account/wallet?status=return&order=${topUpOrder.id}`,
      cancelUrl: cancelUrl || `/account/wallet?status=cancelled&order=${topUpOrder.id}`,
      idempotencyKey: `init-topup-${idempotencyKey}`,
    });

    return NextResponse.json({
      success: true,
      orderId: topUpOrder.id,
      orderNumber: topUpOrder.orderNumber,
      amountBDT: amountBDT.toFixed(2),
      currency: "BDT",
      paymentInitiation: paymentResult,
      message: "Top-up initiated. Balance will reflect once payment is verified.",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to initiate top-up";
    return NextResponse.json(
      { error: "Top-up initiation failed", message },
      { status: 400 }
    );
  }
}
