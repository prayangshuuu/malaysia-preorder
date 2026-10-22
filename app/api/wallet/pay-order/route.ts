import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { payOrderWithWallet } from "@/lib/wallet/service";
import { payOrderWithWalletSchema } from "@/lib/wallet/validations";

/**
 * POST /api/wallet/pay-order
 * Atomically pays for a customer pre-order using wallet balance.
 * Concurrency-safe balance deduction using pessimistic row locking.
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
    const parseResult = payOrderWithWalletSchema.safeParse(json);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation Error", details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { orderId, idempotencyKey } = parseResult.data;

    const result = await payOrderWithWallet({
      orderId,
      userId: session.userId,
      idempotencyKey,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Payment via wallet failed";
    const statusCode = (error as { statusCode?: number }).statusCode || 400;
    return NextResponse.json(
      { error: "Wallet payment failed", message },
      { status: statusCode }
    );
  }
}
