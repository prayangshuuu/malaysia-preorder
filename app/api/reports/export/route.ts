import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";
import { requireAdminOrStaff, AuthorizationError } from "@/lib/auth/rbac";
import { getMasterOperationalReport, generateOperationalReportCSV } from "@/lib/reports";

/**
 * GET /api/reports/export
 * Downloads sanitized, standard RFC-4180 CSV export of operational metrics.
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

    const report = await getMasterOperationalReport(startDate, endDate);
    const csvContent = generateOperationalReportCSV(report);

    const filename = `operational-report-${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode });
    }
    console.error("[API GET /api/reports/export] Error:", err);
    return NextResponse.json({ error: "Failed to export report CSV" }, { status: 500 });
  }
}
