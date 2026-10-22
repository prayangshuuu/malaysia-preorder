import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { requireAdminOrStaff, isAdminOrStaffRole } from "@/lib/auth/rbac";
import { getAdminWalletLedgerList } from "@/lib/wallet/service";
import { AdminReconciliationButton } from "./reconciliation-button";

export const dynamic = "force-dynamic";

interface AdminWalletPageProps {
  searchParams: Promise<{
    page?: string;
    onlyDiscrepancies?: string;
    userId?: string;
  }>;
}

export default async function AdminWalletPage({ searchParams }: AdminWalletPageProps) {
  const session = await getCurrentSession();
  if (!session || !isAdminOrStaffRole(session.role)) {
    redirect("/admin/login");
  }

  await requireAdminOrStaff();

  const resolvedParams = await searchParams;
  const page = parseInt(resolvedParams.page || "1", 10) || 1;
  const onlyDiscrepancies = resolvedParams.onlyDiscrepancies === "true";

  const data = await getAdminWalletLedgerList({
    page,
    limit: 20,
    onlyDiscrepancies,
    userId: resolvedParams.userId,
  });

  return (
    <div className="space-y-6">
      {/* Page Title & Explanation */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-6 border-b border-zinc-800 gap-4">
        <div>
          <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20 mb-2">
            Finance & Audit
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
            Customer Wallets & Ledger Reconciliation
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Read-only financial audit explorer. Every balance is strictly reconciled against immutable ledger entries.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={onlyDiscrepancies ? "/admin/wallet" : "/admin/wallet?onlyDiscrepancies=true"}
            className={`px-3.5 py-2 rounded-lg text-xs font-medium border transition ${
              onlyDiscrepancies
                ? "bg-red-500/20 text-red-300 border-red-500/40"
                : "bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800"
            }`}
          >
            {onlyDiscrepancies ? "Show All Accounts" : "Show Discrepancies Only"}
          </Link>
        </div>
      </div>

      {/* Safety Notice Banner */}
      <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 flex items-start gap-3">
        <span className="text-amber-400 font-bold text-base leading-none">ℹ</span>
        <div>
          <strong className="text-zinc-200 block mb-1">Ledger Invariant Enforcement:</strong>
          Direct balance modification is permanently disabled by system design. Balances can only change via verified payment top-ups, order checkout debits, or compensative refund credits.
        </div>
      </div>

      {/* Wallets Table */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-800 text-sm">
            <thead className="bg-zinc-900/80 text-zinc-400 font-semibold text-xs uppercase">
              <tr>
                <th className="py-3 px-4 text-left">Customer</th>
                <th className="py-3 px-4 text-left">Wallet Status</th>
                <th className="py-3 px-4 text-right">Cached Balance</th>
                <th className="py-3 px-4 text-right">Computed Ledger Sum</th>
                <th className="py-3 px-4 text-center">Entries</th>
                <th className="py-3 px-4 text-center">Integrity Status</th>
                <th className="py-3 px-4 text-right">Reconcile</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 bg-zinc-950/60">
              {data.wallets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-zinc-500 text-xs">
                    No wallet accounts matching criteria.
                  </td>
                </tr>
              ) : (
                data.wallets.map((item) => (
                  <tr key={item.wallet.id} className="hover:bg-zinc-900/50 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-zinc-200">{item.user.name}</div>
                      <div className="text-xs text-zinc-500">{item.user.email}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                          item.wallet.isActive
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-red-500/10 text-red-400 border border-red-500/20"
                        }`}
                      >
                        {item.wallet.isActive ? "Active" : "Suspended"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-semibold text-zinc-200">
                      ৳ {item.wallet.balanceBDT}
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-zinc-300">
                      ৳ {item.reconciliation.computedLedgerSumBDT}
                    </td>
                    <td className="py-3.5 px-4 text-center text-xs text-zinc-400">
                      {item.totalEntries}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {item.reconciliation.isConsistent ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          ✓ Balanced
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-300 border border-red-500/40">
                          ⚠ Discrepancy: {item.reconciliation.discrepancyBDT} BDT
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <AdminReconciliationButton walletId={item.wallet.id} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data.pagination.totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-zinc-800 bg-zinc-900/80">
            <Link
              href={`/admin/wallet?page=${Math.max(1, page - 1)}${
                onlyDiscrepancies ? "&onlyDiscrepancies=true" : ""
              }`}
              className={`px-3 py-1.5 rounded-lg border border-zinc-700 text-xs text-zinc-300 font-medium ${
                page > 1 ? "hover:bg-zinc-800" : "opacity-40 pointer-events-none"
              }`}
            >
              Previous
            </Link>
            <span className="text-xs text-zinc-400">
              Page {page} of {data.pagination.totalPages}
            </span>
            <Link
              href={`/admin/wallet?page=${page + 1}${
                onlyDiscrepancies ? "&onlyDiscrepancies=true" : ""
              }`}
              className={`px-3 py-1.5 rounded-lg border border-zinc-700 text-xs text-zinc-300 font-medium ${
                page < data.pagination.totalPages ? "hover:bg-zinc-800" : "opacity-40 pointer-events-none"
              }`}
            >
              Next
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
