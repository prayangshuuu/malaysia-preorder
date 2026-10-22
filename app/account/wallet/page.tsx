import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { getCustomerWalletSummary } from "@/lib/wallet/service";
import { WalletTopUpClient } from "./wallet-topup-client";

export const dynamic = "force-dynamic";

interface WalletPageProps {
  searchParams: Promise<{
    page?: string;
    entryType?: string;
    status?: string;
    order?: string;
  }>;
}

export default async function CustomerWalletPage({ searchParams }: WalletPageProps) {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login?next=/account/wallet");
  }

  const resolvedParams = await searchParams;
  const page = parseInt(resolvedParams.page || "1", 10) || 1;

  const data = await getCustomerWalletSummary({
    userId: session.userId,
    page,
    limit: 15,
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Navigation breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-zinc-500 mb-6">
        <Link href="/account" className="hover:text-emerald-600 transition">
          Account
        </Link>
        <span>/</span>
        <span className="text-zinc-800 dark:text-zinc-200 font-medium">Customer Wallet</span>
      </div>

      {/* Header */}
      <div className="pb-8 border-b border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 mb-2">
            Auditable Ledger
          </span>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Wallet & Ledger Balance
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Backed by immutable ledger records. Funds are spendable towards your verified pre-orders.
          </p>
        </div>
      </div>

      {resolvedParams.status === "return" && (
        <div className="my-6 p-4 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900 text-blue-800 dark:text-blue-200 text-sm">
          <strong>Payment Session Completed:</strong> If your payment provider has verified the transaction, your wallet credit will appear below automatically.
        </div>
      )}

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-8">
        {/* Available spendable funds */}
        <div className="p-6 rounded-2xl bg-zinc-900 text-white shadow-sm border border-zinc-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-semibold text-emerald-400 tracking-wider">
                Available Spendable Funds
              </span>
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/20 text-emerald-300">
                Active
              </span>
            </div>
            <div className="text-4xl font-extrabold tracking-tight mt-3">
              ৳ {data.wallet.balanceBDT}
            </div>
            <p className="text-xs text-zinc-400 mt-2">
              Derived from {data.pagination.totalEntries} immutable ledger transaction entries.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-zinc-800 text-xs text-zinc-400">
            • Instant checkout on accepted pre-order quotes
            <br />• 100% auditable; cash withdrawals are restricted by export compliance
          </div>
        </div>

        {/* Top-Up Action Box */}
        <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between">
          <WalletTopUpClient />
        </div>
      </div>

      {/* Pending Top-ups notice (Distinguishing pending funds from available funds) */}
      {data.pendingFunds.count > 0 && (
        <div className="mb-8 p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
            <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              Pending Top-Ups (Awaiting Provider Verification): ৳ {data.pendingFunds.totalBDT}
            </h3>
          </div>
          <p className="text-xs text-amber-800 dark:text-amber-300 mb-3">
            In compliance with ledger security rules, funds are only credited once official payment confirmation is received from the payment gateway.
          </p>
          <div className="space-y-2">
            {data.pendingFunds.items.map((pending) => (
              <div
                key={pending.paymentId}
                className="flex items-center justify-between text-xs bg-white/70 dark:bg-zinc-900/70 p-2.5 rounded-lg border border-amber-200 dark:border-amber-900"
              >
                <div>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    Payment {pending.paymentNumber}
                  </span>
                  <span className="text-zinc-500 ml-2">({pending.status})</span>
                </div>
                <div className="font-semibold text-amber-700 dark:text-amber-400">
                  +৳ {pending.amountBDT}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ledger History Table */}
      <div className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            Immutable Transaction Ledger
          </h2>
          <span className="text-xs text-zinc-500">
            Page {data.pagination.page} of {data.pagination.totalPages} ({data.pagination.totalEntries} entries)
          </span>
        </div>

        {data.entries.length === 0 ? (
          <div className="p-8 text-center rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 text-zinc-500 text-sm">
            No ledger transactions yet. Add funds to your wallet to start.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800 text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-900/60 text-zinc-600 dark:text-zinc-400 font-semibold text-xs uppercase">
                <tr>
                  <th className="py-3 px-4 text-left">Date & Time</th>
                  <th className="py-3 px-4 text-left">Entry Type</th>
                  <th className="py-3 px-4 text-left">Reference / Description</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-right">Balance After</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 bg-white dark:bg-zinc-950">
                {data.entries.map((entry) => {
                  const isCredit = entry.amountMinorUnits > 0;
                  return (
                    <tr key={entry.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition">
                      <td className="py-3.5 px-4 text-xs text-zinc-500 whitespace-nowrap">
                        {new Date(entry.createdAt).toLocaleString("en-GB", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                            isCredit
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                              : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300"
                          }`}
                        >
                          {entry.entryType}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-zinc-700 dark:text-zinc-300 max-w-xs truncate">
                        {entry.referenceNote}
                      </td>
                      <td
                        className={`py-3.5 px-4 text-right font-semibold whitespace-nowrap ${
                          isCredit ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-900 dark:text-zinc-100"
                        }`}
                      >
                        {entry.amountBDT} BDT
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium text-xs text-zinc-500 whitespace-nowrap">
                        ৳ {entry.balanceAfterBDT}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination controls */}
        {data.pagination.totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <Link
              href={`/account/wallet?page=${Math.max(1, page - 1)}`}
              className={`px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 text-xs font-medium ${
                data.pagination.hasPrevPage
                  ? "hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  : "opacity-40 pointer-events-none"
              }`}
            >
              Previous
            </Link>
            <span className="text-xs text-zinc-500">
              Page {page} of {data.pagination.totalPages}
            </span>
            <Link
              href={`/account/wallet?page=${page + 1}`}
              className={`px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 text-xs font-medium ${
                data.pagination.hasNextPage
                  ? "hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  : "opacity-40 pointer-events-none"
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
