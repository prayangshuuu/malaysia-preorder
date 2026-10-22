import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { requireAdminOrStaff, isAdminOrStaffRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const metadata = {
  title: "Admin Procurement Backlog | Malaysia Pre-Order",
};

export default async function AdminProcurementListPage() {
  const session = await getCurrentSession();
  if (!session || !isAdminOrStaffRole(session.role)) {
    redirect("/admin/login");
  }

  await requireAdminOrStaff();

  const [procurements, pendingOrders] = await Promise.all([
    prisma.procurementRecord.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        supplier: true,
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            customer: { select: { name: true } },
          },
        },
      },
      take: 50,
    }),
    prisma.order.findMany({
      where: {
        status: { in: ["PAID", "PROCUREMENT"] },
        procurementStatus: { in: ["NOT_STARTED", "SOURCING"] },
      },
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { name: true } },
        lineItems: true,
      },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-zinc-800 gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
            Malaysia Procurement & Supplier Operations
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Track Malaysia purchasing, confidential supplier invoices, and local stock acquisition.
          </p>
        </div>

        <Link
          href="/admin/orders"
          className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-zinc-950 hover:bg-amber-400 transition shadow"
        >
          View All Orders
        </Link>
      </div>

      {/* Sourcing Backlog Queue */}
      <div className="rounded-2xl border border-amber-500/30 bg-amber-950/10 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-amber-400">
              Procurement Backlog ({pendingOrders.length} Orders Awaiting Sourcing)
            </h2>
          </div>
        </div>

        {pendingOrders.length === 0 ? (
          <p className="text-xs text-zinc-400 italic">No paid orders currently waiting for procurement.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingOrders.map((ord) => (
              <div
                key={ord.id}
                className="p-4 rounded-xl border border-zinc-800 bg-zinc-900 text-xs flex justify-between items-center"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-zinc-100">{ord.orderNumber}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-800 text-zinc-300">
                      {ord.procurementStatus}
                    </span>
                  </div>
                  <div className="text-zinc-400 text-[11px] mt-1">
                    Customer: {ord.customer.name} • {ord.lineItems.length} item line(s)
                  </div>
                </div>

                <Link
                  href={`/admin/orders/${ord.id}`}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs"
                >
                  Record Sourcing →
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Existing Procurement Log */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-300">
          Recent Malaysia Procurement Records
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950/70 text-zinc-400 uppercase tracking-wider border-b border-zinc-800 font-semibold">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Cost (MYR)</th>
                <th className="px-4 py-3">Cost (BDT)</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Invoice Ref</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 text-zinc-300">
              {procurements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-zinc-500">
                    No procurement records logged yet.
                  </td>
                </tr>
              ) : (
                procurements.map((p) => (
                  <tr key={p.id} className="hover:bg-zinc-800/40">
                    <td className="px-4 py-3 font-mono font-bold text-amber-400">{p.procurementCode}</td>
                    <td className="px-4 py-3 font-mono">
                      <Link href={`/admin/orders/${p.order.id}`} className="hover:underline">
                        {p.order.orderNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{p.supplier?.name || "Direct Sourcing"}</td>
                    <td className="px-4 py-3 font-mono">RM {Number(p.purchaseCostMYR).toFixed(2)}</td>
                    <td className="px-4 py-3 font-mono font-bold text-emerald-400">৳ {Number(p.purchaseCostBDT).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-800 text-zinc-300">
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-zinc-400">{p.supplierInvoiceRef || "None"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
