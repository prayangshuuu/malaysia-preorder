import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { requireAdminOrStaff, isAdminOrStaffRole } from "@/lib/auth/rbac";
import { getMasterOperationalReport } from "@/lib/reports";
import { OperationalReportsView } from "@/components/admin/OperationalReportsView";

interface AdminReportsPageProps {
  searchParams: Promise<{
    startDate?: string;
    endDate?: string;
  }>;
}

export default async function AdminReportsPage({ searchParams }: AdminReportsPageProps) {
  const session = await getCurrentSession();
  if (!session || !isAdminOrStaffRole(session.role)) {
    redirect("/admin/login");
  }

  await requireAdminOrStaff();

  const { startDate, endDate } = await searchParams;

  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const defaultTo = now.toISOString().slice(0, 10);

  const fromParam = startDate || defaultFrom;
  const toParam = endDate || defaultTo;

  const masterReport = await getMasterOperationalReport(fromParam, toParam);

  return (
    <div className="space-y-6">
      <div className="border-b border-zinc-800 pb-5">
        <h1 className="text-2xl font-bold text-zinc-100">Operational & Financial Reports</h1>
        <p className="text-xs text-zinc-400 mt-1">
          Database-derived operational metrics, quotation lifecycle, realized collections, ledger liabilities, and procurement performance.
        </p>
      </div>

      <OperationalReportsView
        initialReport={masterReport}
        initialStartDate={fromParam}
        initialEndDate={toParam}
      />
    </div>
  );
}
