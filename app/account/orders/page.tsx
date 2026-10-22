import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { formatBDT } from "@/lib/formatters";
import { formatStatusLabel } from "@/lib/orders";
import { OrderStatus, PaymentStatus } from "@prisma/client";

export const metadata = {
  title: "My Pre-Orders | Malaysia Pre-Order",
};

const statusColors: Record<OrderStatus, string> = {
  AWAITING_PAYMENT: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-900/50",
  PAYMENT_REVIEW: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-900/50",
  PAID: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/50",
  PROCUREMENT: "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-900/50",
  PACKING: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900/50",
  DISPATCHED: "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200 dark:border-sky-900/50",
  IN_TRANSIT: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300 border-cyan-200 dark:border-cyan-900/50",
  CUSTOMS: "bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border-orange-200 dark:border-orange-900/50",
  OUT_FOR_DELIVERY: "bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border-teal-200 dark:border-teal-900/50",
  DELIVERED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/50 font-bold",
  CANCELLED: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-900/50",
  REFUND_PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/60 dark:text-yellow-300 border-yellow-200 dark:border-yellow-900/50",
  PARTIALLY_REFUNDED: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200",
  REFUNDED: "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200",
};

const paymentStatusBadges: Record<PaymentStatus, string> = {
  PENDING: "text-amber-600 bg-amber-50 dark:bg-amber-950/40 border border-amber-200",
  REQUIRES_ACTION: "text-amber-600 bg-amber-50 border border-amber-200",
  SUCCEEDED: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200",
  FAILED: "text-rose-600 bg-rose-50 border border-rose-200",
  CANCELLED: "text-zinc-500 bg-zinc-50 border border-zinc-200",
  PARTIALLY_REFUNDED: "text-purple-600 bg-purple-50 border border-purple-200",
  REFUNDED: "text-zinc-600 bg-zinc-50 border border-zinc-200",
  REVERSED: "text-zinc-600 bg-zinc-50 border border-zinc-200",
};

export default async function CustomerOrdersPage() {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login");
  }

  const orders = await prisma.order.findMany({
    where: { customerId: session.userId },
    orderBy: { createdAt: "desc" },
    include: {
      lineItems: true,
      quote: {
        select: {
          quoteNumber: true,
          shippingMethod: true,
          estDeliveryDaysMin: true,
          estDeliveryDaysMax: true,
        },
      },
      shipments: {
        select: {
          trackingNumber: true,
          status: true,
        },
      },
    },
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center gap-2 text-xs text-zinc-500 mb-6">
        <Link href="/account" className="hover:underline">
          Dashboard
        </Link>
        <span>/</span>
        <span className="text-zinc-900 dark:text-zinc-100 font-medium">Orders</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-zinc-200 dark:border-zinc-800 gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            My Pre-Orders
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Track sourcing progress, air shipment status, and delivery milestones from Malaysia to Bangladesh.
          </p>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-16 px-4 my-8 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40">
          <div className="w-12 h-12 mx-auto rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 mb-4 text-xl">
            📦
          </div>
          <h2 className="text-base font-semibold text-zinc-800 dark:text-zinc-200">
            No pre-orders placed yet
          </h2>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1 mb-6">
            When you accept a quotation for an inquiry or catalog item, your order will appear here with transparent milestone tracking.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/products"
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
            >
              Browse Catalogue
            </Link>
            <Link
              href="/inquire"
              className="px-4 py-2 text-xs font-semibold rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Request Custom Quote
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4 my-8">
          {orders.map((order) => {
            const badgeClass = statusColors[order.status] || "bg-zinc-100 text-zinc-800";
            const paymentBadge = paymentStatusBadges[order.paymentStatus] || "text-zinc-500";
            return (
              <div
                key={order.id}
                className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-sm hover:border-emerald-500/50 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-zinc-100 dark:border-zinc-800/60">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-bold text-sm text-zinc-900 dark:text-zinc-100">
                      {order.orderNumber}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badgeClass}`}>
                      {formatStatusLabel(order.status)}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${paymentBadge}`}>
                      Payment: {formatStatusLabel(order.paymentStatus)}
                    </span>
                  </div>

                  <div className="text-xs text-zinc-400">
                    Placed on{" "}
                    {new Date(order.createdAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </div>
                </div>

                {/* Items and Summary */}
                <div className="py-4 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                  <div className="md:col-span-2 space-y-2">
                    {order.lineItems.map((li) => (
                      <div key={li.id} className="text-xs flex items-center justify-between text-zinc-700 dark:text-zinc-300">
                        <span className="font-medium truncate max-w-sm">
                          {li.quantity}x {li.itemTitle}
                        </span>
                        <span className="font-mono text-zinc-500">
                          {formatBDT(li.totalPriceBDT)}
                        </span>
                      </div>
                    ))}
                    {order.quote?.shippingMethod && (
                      <div className="text-[11px] text-zinc-400 pt-1">
                        ✈️ {order.quote.shippingMethod}
                        {order.quote.estDeliveryDaysMax && (
                          <span> (Est. {order.quote.estDeliveryDaysMin || 3}–{order.quote.estDeliveryDaysMax} days delivery)</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-start md:items-end justify-between border-t md:border-t-0 pt-3 md:pt-0 border-zinc-100 dark:border-zinc-800/60">
                    <span className="text-xs text-zinc-400">Total Payable</span>
                    <span className="text-lg font-extrabold text-zinc-900 dark:text-zinc-100">
                      {formatBDT(order.totalAmountBDT)}
                    </span>
                    <div className="mt-3">
                      <Link
                        href={`/account/orders/${order.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
                      >
                        Track & Details ↗
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
