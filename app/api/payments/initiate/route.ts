import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { initiateOrderPayment } from "@/lib/payments";

/**
 * POST /api/payments/initiate
 * Initiates payment session for a verified customer order.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Authentication required to pay." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { orderId, providerName, returnUrl, cancelUrl, idempotencyKey } = body;

    if (!orderId) {
      return NextResponse.json(
        { error: "Bad Request", message: "orderId is required" },
        { status: 400 }
      );
    }

    const result = await initiateOrderPayment({
      orderId,
      providerName,
      customerId: session.userId,
      returnUrl,
      cancelUrl,
      idempotencyKey,
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Payment initiation failed";
    return NextResponse.json(
      { error: "Bad Request", message },
      { status: 400 }
    );
  }
}
