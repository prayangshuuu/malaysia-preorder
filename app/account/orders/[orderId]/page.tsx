import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { assertResourceOwnership, AuthorizationError } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { formatBDT } from "@/lib/formatters";
import { sanitizeCustomerOrder, formatStatusLabel } from "@/lib/orders";
import { OrderStatus } from "@prisma/client";

export const metadata = {
  title: "Order Tracking & Details | Malaysia Pre-Order",
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

const progressSteps: { key: OrderStatus; label: string }[] = [
  { key: OrderStatus.AWAITING_PAYMENT, label: "Order Placed" },
  { key: OrderStatus.PAID, label: "Payment Confirmed" },
  { key: OrderStatus.PROCUREMENT, label: "Malaysia Sourcing" },
  { key: OrderStatus.PACKING, label: "Packed in KL" },
  { key: OrderStatus.DISPATCHED, label: "Air Transit" },
  { key: OrderStatus.CUSTOMS, label: "Dhaka Customs" },
  { key: OrderStatus.OUT_FOR_DELIVERY, label: "Out for Delivery" },
  { key: OrderStatus.DELIVERED, label: "Delivered" },
];

export default async function CustomerOrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login");
  }

  const { orderId } = await params;

  const rawOrder = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      lineItems: true,
      events: {
        where: { isCustomerVisible: true },
        orderBy: { createdAt: "desc" },
      },
      quote: {
        select: {
          quoteNumber: true,
          shippingMethod: true,
          estDeliveryDaysMin: true,
          estDeliveryDaysMax: true,
          estDispatchDaysMin: true,
          estDispatchDaysMax: true,
        },
      },
      payments: {
        select: {
          id: true,
          paymentNumber: true,
          amount: true,
          currency: true,
          method: true,
          status: true,
          providerTrxId: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
      shipments: {
        include: {
          events: {
            where: { isPublic: true },
            orderBy: { timestamp: "desc" },
          },
        },
      },
    },
  });

  if (!rawOrder) {
    notFound();
  }

  // IDOR Protection: asserts customer owns the resource
  try {
    await assertResourceOwnership(rawOrder.customerId, {
      errorMessage: "You do not have permission to view this order.",
    });
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      redirect("/account/orders");
    }
    throw err;
  }

  // Security guarantee: Strictly strip supplier costs and private admin notes
  const order = sanitizeCustomerOrder(rawOrder);

  // Determine current step index in the progress stepper
  const orderStatusIdx = progressSteps.findIndex((s) => s.key === order.status);
  const currentStep = orderStatusIdx >= 0 ? orderStatusIdx : 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-zinc-500 mb-6">
        <Link href="/account" className="hover:underline">
          Dashboard
        </Link>
        <span>/</span>
        <Link href="/account/orders" className="hover:underline">
          Orders
        </Link>
        <span>/</span>
        <span className="font-mono text-zinc-900 dark:text-zinc-100 font-medium">
          {order.orderNumber}
        </span>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-6 border-b border-zinc-200 dark:border-zinc-800 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Order {order.orderNumber}
            </h1>
            <span
              className={`px-3 py-0.5 rounded-full text-xs font-semibold border ${
                statusColors[order.status] || "bg-zinc-100"
              }`}
            >
              {formatStatusLabel(order.status)}
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Created on{" "}
            {new Date(order.createdAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}
            {order.quote?.quoteNumber ? `• Sourced from Quote ${order.quote.quoteNumber}` : ""}
          </p>
        </div>

        {/* Payment CTA if still awaiting payment */}
        {order.status === OrderStatus.AWAITING_PAYMENT && (
          <div className="flex items-center gap-3">
            <Link
              href={`/checkout?orderId=${order.id}`}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-600 text-zinc-950 transition-colors shadow-sm"
            >
              Pay Now ({formatBDT(order.totalAmountBDT)})
            </Link>
          </div>
        )}
      </div>

      {/* Visual Stepper / Progress Bar */}
      {order.status !== OrderStatus.CANCELLED && (
        <div className="my-8 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-6">
            Fulfillment Progress
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {progressSteps.map((step, idx) => {
              const isPast = idx < currentStep;
              const isCurrent = idx === currentStep;
              return (
                <div key={step.key} className="flex flex-col items-center text-center">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mb-2 transition-colors ${
                      isPast
                        ? "bg-emerald-600 text-white"
                        : isCurrent
                        ? "bg-amber-500 text-zinc-950 ring-4 ring-amber-100 dark:ring-amber-950/60"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    {isPast ? "✓" : idx + 1}
                  </div>
                  <span
                    className={`text-[11px] font-medium leading-tight ${
                      isCurrent
                        ? "text-zinc-900 dark:text-zinc-100 font-bold"
                        : isPast
                        ? "text-zinc-700 dark:text-zinc-300"
                        : "text-zinc-400"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Grid: Details & History */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 my-8">
        {/* Left Column (2 Cols): Line Items & Append-Only Progress Events */}
        <div className="lg:col-span-2 space-y-6">
          {/* Agreed Item Lines */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-4">
              Agreed Items & Quantities
            </h2>
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {order.lineItems.map((item) => (
                <div key={item.id} className="py-3 flex items-start justify-between gap-4">
                  <div>
                    <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 block">
                      {item.itemTitle}
                    </span>
                    {item.itemDescription && (
                      <p className="text-xs text-zinc-500 mt-0.5">{item.itemDescription}</p>
                    )}
                    <div className="text-xs text-zinc-400 mt-1">
                      Quantity: <strong className="text-zinc-600 dark:text-zinc-300">{item.quantity}</strong> × {formatBDT(item.unitPriceBDT)}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-sm text-zinc-900 dark:text-zinc-100">
                      {formatBDT(item.totalPriceBDT)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Append-Only Order Event Timeline */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-4">
              Order Timeline & Safe Event Log
            </h2>

            {order.events.length === 0 ? (
              <p className="text-xs text-zinc-400">No events logged yet.</p>
            ) : (
              <div className="relative pl-4 space-y-6 before:absolute before:left-1 before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-200 dark:before:bg-zinc-800">
                {order.events.map((evt) => (
                  <div key={evt.id} className="relative">
                    <div className="absolute -left-[19px] top-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-white dark:ring-zinc-900" />
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100">
                          {evt.title}
                        </span>
                        <span className="text-[10px] text-zinc-400 font-mono">
                          {new Date(evt.createdAt).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      {evt.description && (
                        <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 leading-relaxed">
                          {evt.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Shipment Consignment Details (if created) */}
          {order.shipments && order.shipments.length > 0 && (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Air Freight Consignments
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                  Manually Verified Timeline
                </span>
              </div>
              <p className="text-xs text-zinc-500 mb-4">
                Milestones below are directly maintained and verified by our logistics operations team in Malaysia and Dhaka.
              </p>
              <div className="space-y-4">
                {order.shipments.map((shp) => (
                  <div
                    key={shp.id}
                    className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 text-xs"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                        {shp.shipmentNumber}
                      </span>
                      <span className="px-2 py-0.5 rounded font-semibold bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                        {formatStatusLabel(shp.status)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-zinc-600 dark:text-zinc-400 mt-2">
                      <div>
                        Carrier: <strong className="text-zinc-700 dark:text-zinc-300">{shp.carrierName || "Consolidated Air Cargo"}</strong>
                      </div>
                      <div>
                        Tracking Ref:{" "}
                        {shp.trackingNumber ? (
                          shp.trackingUrl ? (
                            <a
                              href={shp.trackingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono font-bold text-amber-600 dark:text-amber-400 hover:underline"
                            >
                              {shp.trackingNumber} ↗
                            </a>
                          ) : (
                            <strong className="font-mono text-zinc-700 dark:text-zinc-300">{shp.trackingNumber}</strong>
                          )
                        ) : (
                          <span className="text-zinc-400 italic">Assigned at dispatch</span>
                        )}
                      </div>
                      <div>
                        Origin: <strong className="text-zinc-700 dark:text-zinc-300">{shp.dispatchOrigin}</strong>
                      </div>
                      <div>
                        Destination: <strong className="text-zinc-700 dark:text-zinc-300">{shp.destinationCountry}</strong>
                      </div>
                    </div>

                    {shp.events && shp.events.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                        <span className="text-[11px] font-bold text-zinc-500 block mb-2">
                          Logistics Waypoints (Operations Logged)
                        </span>
                        <div className="space-y-2">
                          {shp.events.map((e) => (
                            <div key={e.id} className="text-[11px] text-zinc-600 dark:text-zinc-400">
                              <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                                {e.location ? `[${e.location}] ` : ""}{e.description}
                              </span>
                              <span className="text-zinc-400 text-[10px] ml-2 font-mono">
                                {new Date(e.timestamp).toLocaleDateString("en-GB", {
                                  day: "numeric",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column (1 Col): Financial Breakdown & Delivery Address */}
        <div className="space-y-6">
          {/* Financial Breakdown (BDT) */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-3">
              Guaranteed Amount Breakdown
            </h2>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span>Items Subtotal</span>
                <span>{formatBDT(order.itemsSubtotalBDT)}</span>
              </div>
              <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span>Shipping / Air Freight</span>
                <span>{formatBDT(order.shippingFeeBDT)}</span>
              </div>
              <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span>Service & Sourcing Fee</span>
                <span>{formatBDT(order.serviceFeeBDT)}</span>
              </div>
              <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span>Customs & Import Duties</span>
                <span>{formatBDT(order.customsFeeBDT)}</span>
              </div>
              {order.discountBDT > 0 && (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Discount</span>
                  <span>-{formatBDT(order.discountBDT)}</span>
                </div>
              )}

              <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-baseline">
                <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                  Total Payable
                </span>
                <span className="font-extrabold text-lg text-emerald-600 dark:text-emerald-400">
                  {formatBDT(order.totalAmountBDT)}
                </span>
              </div>

              <div className="flex justify-between text-xs text-zinc-500 pt-1">
                <span>Paid Amount:</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {formatBDT(order.paidAmountBDT)}
                </span>
              </div>
            </div>

            {/* Logistics Estimates */}
            {order.quote && (
              <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 text-[11px] text-zinc-500 space-y-1">
                <div>
                  <strong>Shipping Method: </strong>
                  {order.quote.shippingMethod || "Standard Air Cargo"}
                </div>
                {order.quote.estDeliveryDaysMax && (
                  <div>
                    <strong>Est. Delivery Window: </strong>
                    {order.quote.estDeliveryDaysMin || 3} to {order.quote.estDeliveryDaysMax} business days
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Immutable Delivery Address */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-3">
              Delivery Address (Snapshotted)
            </h2>
            <div className="text-xs text-zinc-700 dark:text-zinc-300 space-y-1">
              <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                {order.shippingAddress.recipientName}
              </div>
              <div className="text-zinc-500">{order.shippingAddress.phoneNumber}</div>
              <div className="pt-1">
                {order.shippingAddress.streetAddress}
                {order.shippingAddress.thanaOrUpazila ? `, ${order.shippingAddress.thanaOrUpazila}` : ""}
                <br />
                {order.shippingAddress.district}, {order.shippingAddress.division}
                {order.shippingAddress.postalCode ? ` - ${order.shippingAddress.postalCode}` : ""}
                <br />
                {order.shippingAddress.country}
              </div>
            </div>

            {order.customerNotes && (
              <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 text-[11px] text-zinc-500">
                <strong>Delivery Notes: </strong>
                {order.customerNotes}
              </div>
            )}
          </div>

          {/* Payment History Record */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-3">
              Payment Record
            </h2>
            {order.payments.length === 0 ? (
              <p className="text-xs text-zinc-400">No payment records yet.</p>
            ) : (
              <div className="space-y-2">
                {order.payments.map((p) => (
                  <div
                    key={p.id}
                    className="p-2.5 rounded-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 text-xs"
                  >
                    <div className="flex items-center justify-between font-medium">
                      <span>{p.method}</span>
                      <span className="font-mono font-bold text-emerald-600">
                        {formatBDT(p.amount)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-zinc-400 mt-1">
                      <span>Trx: {p.providerTrxId || "Pending"}</span>
                      <span className="uppercase">{p.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
