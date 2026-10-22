import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { requireAdminOrStaff, isAdminOrStaffRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { formatBDT } from "@/lib/formatters";
import Link from "next/link";
import { reconcilePaymentAction } from "@/app/actions/admin-operations";
import { Prisma } from "@prisma/client";

export const metadata = {
  title: "Admin Payment Operations & Reconciliation | Malaysia Pre-Order",
};

interface PaymentsPageProps {
  searchParams: Promise<{
    status?: string;
    page?: string;
    search?: string;
  }>;
}

export default async function AdminPaymentsPage({ searchParams }: PaymentsPageProps) {
  const session = await getCurrentSession();
  if (!session || !isAdminOrStaffRole(session.role)) {
    redirect("/admin/login");
  }

  await requireAdminOrStaff();

  const { status, page: pageParam, search } = await searchParams;
  const page = parseInt(pageParam || "1", 10) || 1;
  const pageSize = 15;

  const where: Prisma.PaymentWhereInput = {};
  if (status && status !== "ALL") {
    where.status = status as Prisma.EnumPaymentStatusFilter["equals"];
  }
  if (search) {
    where.OR = [
      { paymentNumber: { contains: search, mode: "insensitive" } },
      { providerTrxId: { contains: search, mode: "insensitive" } },
      { order: { orderNumber: { contains: search, mode: "insensitive" } } },
    ];
  }

  const [payments, totalCount, statusCounts] = await Promise.all([
    prisma.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            customer: { select: { name: true, email: true } },
          },
        },
      },
    }),
    prisma.payment.count({ where }),
    prisma.payment.groupBy({
      by: ["status"],
      _count: true,
    }),
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-zinc-800 gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
            Payment Records & Reconciliation
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Audit gateway payment attempts, manual proof verifications, and ledger settlements.
          </p>
        </div>

        {/* Quick Filter Tabs */}
        <div className="flex rounded-lg bg-zinc-900 p-1 border border-zinc-800 text-xs">
          <Link
            href="/admin/payments"
            className={`px-3 py-1.5 rounded-md font-medium transition ${
              !status || status === "ALL" ? "bg-amber-500 text-zinc-950 font-bold" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            All ({totalCount})
          </Link>
          <Link
            href="/admin/payments?status=PENDING"
            className={`px-3 py-1.5 rounded-md font-medium transition ${
              status === "PENDING" ? "bg-amber-500 text-zinc-950 font-bold" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Pending
          </Link>
          <Link
            href="/admin/payments?status=SUCCEEDED"
            className={`px-3 py-1.5 rounded-md font-medium transition ${
              status === "SUCCEEDED" ? "bg-amber-500 text-zinc-950 font-bold" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Succeeded
          </Link>
          <Link
            href="/admin/payments?status=FAILED"
            className={`px-3 py-1.5 rounded-md font-medium transition ${
              status === "FAILED" ? "bg-amber-500 text-zinc-950 font-bold" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Failed
          </Link>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950/70 text-zinc-400 uppercase tracking-wider border-b border-zinc-800 font-semibold">
              <tr>
                <th className="px-4 py-3.5">Payment Ref</th>
                <th className="px-4 py-3.5">Order & Customer</th>
                <th className="px-4 py-3.5">Method</th>
                <th className="px-4 py-3.5">Amount (BDT)</th>
                <th className="px-4 py-3.5">Provider Trx ID</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Reconciliation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 text-zinc-300">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                    No payment records matching filter.
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className="hover:bg-zinc-800/40">
                    <td className="px-4 py-3.5 font-mono font-bold text-zinc-100">
                      {p.paymentNumber}
                      <span className="text-[10px] text-zinc-500 block font-normal font-sans">
                        {new Date(p.createdAt).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <Link
                        href={`/admin/orders/${p.order.id}`}
                        className="font-mono text-amber-400 hover:underline font-bold"
                      >
                        {p.order.orderNumber}
                      </Link>
                      <div className="text-[11px] text-zinc-400">
                        {p.order.customer.name} ({p.order.customer.email})
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-medium">{p.method}</td>
                    <td className="px-4 py-3.5 font-mono font-bold text-zinc-100">
                      {formatBDT(p.amount)}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-zinc-400">
                      {p.providerTrxId || <span className="text-zinc-600 italic">None</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                          p.status === "SUCCEEDED"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : p.status === "PENDING"
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      {p.status === "PENDING" || p.status === "REQUIRES_ACTION" ? (
                        <div className="flex items-center justify-end gap-2">
                          <form
                            action={async () => {
                              "use server";
                              const fd = new FormData();
                              fd.append("paymentId", p.id);
                              fd.append("action", "APPROVE");
                              await reconcilePaymentAction(fd);
                            }}
                          >
                            <button
                              type="submit"
                              className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] cursor-pointer"
                            >
                              Verify
                            </button>
                          </form>

                          <form
                            action={async () => {
                              "use server";
                              const fd = new FormData();
                              fd.append("paymentId", p.id);
                              fd.append("action", "FAIL");
                              await reconcilePaymentAction(fd);
                            }}
                          >
                            <button
                              type="submit"
                              className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-rose-400 font-bold text-[11px] cursor-pointer"
                            >
                              Reject
                            </button>
                          </form>
                        </div>
                      ) : (
                        <span className="text-[11px] text-zinc-500">
                          {p.verifiedAt ? `Reconciled ${new Date(p.verifiedAt).toLocaleDateString()}` : "Settled"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs pt-2">
          <Link
            href={`/admin/payments?page=${Math.max(1, page - 1)}${status ? `&status=${status}` : ""}`}
            className={`px-3 py-1.5 rounded-lg border border-zinc-700 ${
              page <= 1 ? "opacity-40 pointer-events-none" : "hover:bg-zinc-800 text-zinc-300"
            }`}
          >
            Previous
          </Link>
          <span className="text-zinc-500">
            Page {page} of {totalPages}
          </span>
          <Link
            href={`/admin/payments?page=${page + 1}${status ? `&status=${status}` : ""}`}
            className={`px-3 py-1.5 rounded-lg border border-zinc-700 ${
              page >= totalPages ? "opacity-40 pointer-events-none" : "hover:bg-zinc-800 text-zinc-300"
            }`}
          >
            Next
          </Link>
        </div>
      )}
    </div>
  );
}
