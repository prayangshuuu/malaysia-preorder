import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { requireAdminOrStaff, AuthorizationError } from "@/lib/auth/rbac";
import {
  getMasterOperationalReport,
  getOrdersByStatusReport,
  getQuotesPerformanceReport,
  getFinancialCollectionsReport,
  getWalletLiabilityReport,
  getLogisticsPerformanceReport,
  getInquiryConversionReport,
} from "@/lib/reports";

/**
 * GET /api/reports
 * Returns verified operational metrics.
 * Query params:
 * - startDate: ISO string (e.g. 2026-01-01)
 * - endDate: ISO string (e.g. 2026-10-22)
 * - section: 'all' | 'orders' | 'quotes' | 'financial' | 'wallet' | 'logistics' | 'inquiries'
 *
 * RBAC: Admin, Operations, Finance, or Support staff.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requireAdminOrStaff();

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const section = searchParams.get("section") || "all";

    switch (section) {
      case "orders": {
        const data = await getOrdersByStatusReport(startDate, endDate);
        return NextResponse.json({ report: data });
      }
      case "quotes": {
        const data = await getQuotesPerformanceReport(startDate, endDate);
        return NextResponse.json({ report: data });
      }
      case "financial": {
        const data = await getFinancialCollectionsReport(startDate, endDate);
        return NextResponse.json({ report: data });
      }
      case "wallet": {
        const data = await getWalletLiabilityReport();
        return NextResponse.json({ report: data });
      }
      case "logistics": {
        const data = await getLogisticsPerformanceReport(startDate, endDate);
        return NextResponse.json({ report: data });
      }
      case "inquiries": {
        const data = await getInquiryConversionReport(startDate, endDate);
        return NextResponse.json({ report: data });
      }
      case "all":
      default: {
        const data = await getMasterOperationalReport(startDate, endDate);
        return NextResponse.json({ report: data });
      }
    }
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("[API GET /api/reports] Error:", err);
    return NextResponse.json({ error: "Failed to load operational report" }, { status: 500 });
  }
}
