import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { requireAdminOrStaff, isAdminOrStaffRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { formatBDT } from "@/lib/formatters";
import Link from "next/link";
import { expireOutdatedQuotes } from "@/lib/quotes/service";

export default async function AdminQuotesDashboardPage() {
  const session = await getCurrentSession();
  if (!session || !isAdminOrStaffRole(session.role)) {
    redirect("/admin/login");
  }

  await requireAdminOrStaff();

  // Run quote expiration maintenance
  await expireOutdatedQuotes();

  const [quotes, pendingInquiries] = await Promise.all([
    prisma.quote.findMany({
      orderBy: [{ createdAt: "desc" }],
      include: {
        inquiry: {
          select: {
            id: true,
            inquiryNumber: true,
            productName: true,
            user: { select: { name: true, email: true } },
          },
        },
        orders: {
          select: { id: true, orderNumber: true, status: true },
        },
      },
    }),
    prisma.productInquiry.findMany({
      where: {
        status: { in: ["SUBMITTED", "UNDER_REVIEW"] },
      },
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { name: true, email: true } },
      },
      take: 10,
    }),
  ]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 py-8 px-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-zinc-800 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Link
                href="/admin"
                className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Admin Console
              </Link>
              <span className="text-zinc-600">/</span>
              <span className="text-xs text-amber-400 font-semibold">Quotations</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-100 mt-1">
              Quotation Management
            </h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              Draft, version, price, and track customer inquiries and formal quotations.
            </p>
          </div>
        </div>

        {/* Pending Inquiries Awaiting Quotes */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
              Customer Inquiries Awaiting Quotation ({pendingInquiries.length})
            </h2>
          </div>

          {pendingInquiries.length === 0 ? (
            <div className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800 text-center text-xs text-zinc-400">
              No pending customer inquiries. All current inquiries have received quotations.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pendingInquiries.map((inq) => (
                <div
                  key={inq.id}
                  className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 flex flex-col justify-between hover:border-zinc-700 transition-colors"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-amber-400">
                        {inq.inquiryNumber}
                      </span>
                      <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
                        {inq.status}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-zinc-100 line-clamp-2">
                      {inq.productName}
                    </h3>

                    <p className="text-xs text-zinc-400">
                      Customer: {inq.user.name} ({inq.user.email})
                    </p>

                    <div className="text-xs text-zinc-500">
                      Qty: {inq.quantityRequested} • Budget:{" "}
                      {inq.targetBudgetBDT ? formatBDT(inq.targetBudgetBDT) : "Open"}
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-zinc-800/80">
                    <Link
                      href={`/admin/inquiries/${inq.id}/quote`}
                      className="block w-full text-center py-2 px-3 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 transition-colors"
                    >
                      Create Quotation →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Existing Issued Quotes Table */}
        <div className="space-y-4">
          <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
            <span>Issued Quotations History</span>
            <span className="text-xs text-zinc-400 font-normal">({quotes.length} total)</span>
          </h2>

          <div className="rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-300">
                <thead className="bg-zinc-950 text-zinc-400 uppercase text-[10px] font-bold tracking-wider border-b border-zinc-800">
                  <tr>
                    <th className="p-4">Quote Ref</th>
                    <th className="p-4">Customer & Inquiry</th>
                    <th className="p-4">Total Amount (BDT)</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Valid Until</th>
                    <th className="p-4">Order Link</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {quotes.map((q) => {
                    const isAccepted = q.status === "ACCEPTED";
                    const isRejected = q.status === "REJECTED";
                    const isSuperseded = q.status === "SUPERSEDED";
                    const isExpired =
                      q.status === "EXPIRED" ||
                      (q.status === "SENT" && new Date(q.validUntil) < new Date());

                    const linkedOrder = q.orders[0];

                    return (
                      <tr key={q.id} className="hover:bg-zinc-800/40 transition-colors">
                        <td className="p-4 font-mono font-semibold text-zinc-100">
                          {q.quoteNumber}{" "}
                          <span className="text-[10px] font-normal text-zinc-500">v{q.version}</span>
                        </td>
                        <td className="p-4">
                          <div className="font-medium text-zinc-200">{q.inquiry.user.name}</div>
                          <div className="text-[11px] text-zinc-400 line-clamp-1">
                            {q.inquiry.productName}
                          </div>
                        </td>
                        <td className="p-4 font-bold text-amber-400">
                          {formatBDT(q.totalAmountBDT)}
                        </td>
                        <td className="p-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              isAccepted
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                : isRejected
                                ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                : isExpired
                                ? "bg-amber-900/40 text-amber-300 border border-amber-800"
                                : isSuperseded
                                ? "bg-zinc-800 text-zinc-400 border border-zinc-700"
                                : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                            }`}
                          >
                            {isExpired ? "EXPIRED" : q.status}
                          </span>
                        </td>
                        <td className="p-4 text-zinc-400">
                          {new Date(q.validUntil).toLocaleDateString()}
                        </td>
                        <td className="p-4">
                          {linkedOrder ? (
                            <span className="font-mono text-emerald-400 font-semibold">
                              {linkedOrder.orderNumber}
                            </span>
                          ) : (
                            <span className="text-zinc-600">—</span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <Link
                            href={`/admin/inquiries/${q.inquiryId}/quote`}
                            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white transition-colors"
                          >
                            Edit / Version →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
