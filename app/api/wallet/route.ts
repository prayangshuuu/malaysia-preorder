import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { getCustomerWalletSummary } from "@/lib/wallet/service";
import { walletHistoryQuerySchema } from "@/lib/wallet/validations";

/**
 * GET /api/wallet
 * Returns customer's wallet balance, pending top-up funds, and paginated transaction history.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Authentication required" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const parsedQuery = walletHistoryQuerySchema.safeParse({
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      entryType: searchParams.get("entryType") ?? undefined,
    });

    if (!parsedQuery.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: parsedQuery.error.format() },
        { status: 400 }
      );
    }

    const summary = await getCustomerWalletSummary({
      userId: session.userId,
      page: parsedQuery.data.page,
      limit: parsedQuery.data.limit,
      entryType: parsedQuery.data.entryType,
    });

    return NextResponse.json(summary);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load wallet data";
    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 }
    );
  }
}
