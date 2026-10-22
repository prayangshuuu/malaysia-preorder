import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrStaff } from "@/lib/auth/rbac";
import { getAdminWalletLedgerList, reconcileWallet } from "@/lib/wallet/service";
import { adminReconciliationQuerySchema } from "@/lib/wallet/validations";

/**
 * GET /api/wallet/reconcile
 * Admin/Staff only: Returns wallet balances verified against immutable ledger sums.
 * No arbitrary balance manipulation allowed.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdminOrStaff();

    const { searchParams } = new URL(request.url);
    const parseResult = adminReconciliationQuerySchema.safeParse({
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      onlyDiscrepancies: searchParams.get("onlyDiscrepancies") === "true",
      userId: searchParams.get("userId") ?? undefined,
    });

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const result = await getAdminWalletLedgerList(parseResult.data);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Reconciliation query failed";
    const statusCode = (error as { statusCode?: number }).statusCode || 500;
    return NextResponse.json({ error: "Reconciliation query failed", message }, { status: statusCode });
  }
}

/**
 * POST /api/wallet/reconcile
 * Admin/Staff only: Run on-demand reconciliation audit for a specific walletId.
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdminOrStaff();

    const body = await request.json();
    const { walletId } = body;

    if (!walletId) {
      return NextResponse.json({ error: "walletId is required" }, { status: 400 });
    }

    const report = await reconcileWallet(walletId);
    return NextResponse.json(report);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Reconciliation check failed";
    const statusCode = (error as { statusCode?: number }).statusCode || 500;
    return NextResponse.json({ error: "Reconciliation check failed", message }, { status: statusCode });
  }
}
