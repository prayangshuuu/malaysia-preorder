import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { requireAdminOrStaff, isAdminOrStaffRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { formatBDT } from "@/lib/formatters";
import { formatStatusLabel } from "@/lib/orders";
import { OrderStatus } from "@prisma/client";

export const metadata = {
  title: "Order Management | Operations Portal",
};

const statusColors: Record<OrderStatus, string> = {
  AWAITING_PAYMENT: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  PAYMENT_REVIEW: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  PAID: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  PROCUREMENT: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  PACKING: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
  DISPATCHED: "bg-sky-500/10 text-sky-400 border-sky-500/30",
  IN_TRANSIT: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
  CUSTOMS: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  OUT_FOR_DELIVERY: "bg-teal-500/10 text-teal-400 border-teal-500/30",
  DELIVERED: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold",
  CANCELLED: "bg-rose-500/10 text-rose-400 border-rose-500/30",
  REFUND_PENDING: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  PARTIALLY_REFUNDED: "bg-zinc-800 text-zinc-300 border-zinc-700",
  REFUNDED: "bg-zinc-800 text-zinc-300 border-zinc-700",
};

export default async function AdminOrdersListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await getCurrentSession();
  if (!session || !isAdminOrStaffRole(session.role)) {
    redirect("/admin/login");
  }

  await requireAdminOrStaff();

  const { status: filterStatus } = await searchParams;

  const where: { status?: OrderStatus } = {};
  if (filterStatus && Object.values(OrderStatus).includes(filterStatus as OrderStatus)) {
    where.status = filterStatus as OrderStatus;
  }

  const [orders, counts] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        customer: {
          select: { name: true, email: true, phone: true },
        },
        _count: {
          select: { lineItems: true },
        },
      },
      take: 50,
    }),
    prisma.order.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);

  const countByStatus = counts.reduce((acc, c) => {
    acc[c.status] = c._count._all;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-2 text-xs text-zinc-500 mb-6">
          <Link href="/admin" className="hover:underline">
            Admin Console
          </Link>
          <span>/</span>
          <span className="text-zinc-200 font-medium">Orders</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-zinc-800 gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
              Orders Management
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              Cross-border pre-order pipeline: procurement in Malaysia, air freight, customs, and delivery.
            </p>
          </div>
        </div>

        {/* Status Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          <Link
            href="/admin/orders"
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              !filterStatus
                ? "bg-amber-500 text-zinc-950 font-bold"
                : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            All Orders ({orders.length})
          </Link>
          {["AWAITING_PAYMENT", "PAID", "PROCUREMENT", "PACKING", "DISPATCHED", "CUSTOMS", "DELIVERED"].map((st) => (
            <Link
              key={st}
              href={`/admin/orders?status=${st}`}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterStatus === st
                  ? "bg-amber-500 text-zinc-950 font-bold"
                  : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {formatStatusLabel(st)} {countByStatus[st] ? `(${countByStatus[st]})` : ""}
            </Link>
          ))}
        </div>

        {/* Orders Table */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-900 border-b border-zinc-800 text-zinc-400 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-6 py-4">Order Ref</th>
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Payment</th>
                  <th className="px-6 py-4">Procurement</th>
                  <th className="px-6 py-4">Shipment</th>
                  <th className="px-6 py-4 text-right">Total BDT</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-zinc-500">
                      No orders match the selected filter.
                    </td>
                  </tr>
                ) : (
                  orders.map((ord) => {
                    const statusClass = statusColors[ord.status] || "bg-zinc-800 text-zinc-400";
                    return (
                      <tr key={ord.id} className="hover:bg-zinc-900/80 transition-colors">
                        <td className="px-6 py-4 font-mono font-bold text-zinc-200">
                          {ord.orderNumber}
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-zinc-200">{ord.customer.name}</div>
                          <div className="text-[11px] text-zinc-500">{ord.customer.email}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-0.5 rounded-full border text-[11px] font-semibold ${statusClass}`}>
                            {formatStatusLabel(ord.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono text-[11px] text-zinc-300">
                          {ord.paymentStatus}
                        </td>
                        <td className="px-6 py-4 text-[11px] text-zinc-400">
                          {formatStatusLabel(ord.procurementStatus)}
                        </td>
                        <td className="px-6 py-4 text-[11px] text-zinc-400">
                          {formatStatusLabel(ord.shipmentStatus)}
                        </td>
                        <td className="px-6 py-4 text-right font-mono font-bold text-zinc-100">
                          {formatBDT(ord.totalAmountBDT)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link
                            href={`/admin/orders/${ord.id}`}
                            className="px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold transition-colors"
                          >
                            Manage →
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
