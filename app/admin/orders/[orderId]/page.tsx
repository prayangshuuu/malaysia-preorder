import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { requireAdminOrStaff, isAdminOrStaffRole } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { formatBDT } from "@/lib/formatters";
import {
  ALLOWED_ORDER_STATUS_TRANSITIONS,
  ALLOWED_PROCUREMENT_STATUS_TRANSITIONS,
  ALLOWED_SHIPMENT_STATUS_TRANSITIONS,
  formatStatusLabel,
} from "@/lib/orders";
import { updateOrderStateAction } from "@/app/actions/orders";
import { AdminProcurementShipmentManager } from "@/components/admin/AdminProcurementShipmentManager";
import { getSuppliers } from "@/lib/procurement-shipment";
import { getStorageConfig } from "@/lib/storage";

export const metadata = {
  title: "Admin Order Inspection & Transition | Malaysia Pre-Order",
};

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const session = await getCurrentSession();
  if (!session || !isAdminOrStaffRole(session.role)) {
    redirect("/admin/login");
  }

  await requireAdminOrStaff();

  const { orderId } = await params;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
      lineItems: true,
      events: {
        orderBy: { createdAt: "desc" },
      },
      statusHistory: {
        orderBy: { createdAt: "desc" },
      },
      payments: {
        orderBy: { createdAt: "desc" },
      },
      procurements: {
        include: { supplier: true },
      },
      shipments: {
        include: { events: true },
      },
      quote: {
        select: {
          id: true,
          quoteNumber: true,
          estCostMYR: true,
          estExchangeRate: true,
          adminNotes: true,
          shippingMethod: true,
        },
      },
    },
  });

  if (!order) {
    notFound();
  }

  // Allowed transitions
  const allowedOrderTransitions = ALLOWED_ORDER_STATUS_TRANSITIONS[order.status] || [];
  const allowedProcurementTransitions = ALLOWED_PROCUREMENT_STATUS_TRANSITIONS[order.procurementStatus] || [];
  const allowedShipmentTransitions = ALLOWED_SHIPMENT_STATUS_TRANSITIONS[order.shipmentStatus] || [];

  const suppliers = await getSuppliers(true);
  const storageConfig = getStorageConfig();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-2 text-xs text-zinc-500 mb-6">
          <Link href="/admin" className="hover:underline">
            Admin Console
          </Link>
          <span>/</span>
          <Link href="/admin/orders" className="hover:underline">
            Orders
          </Link>
          <span>/</span>
          <span className="font-mono text-zinc-200">{order.orderNumber}</span>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-zinc-800 gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
                Order {order.orderNumber}
              </h1>
              <span className="px-3 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-400">
                {formatStatusLabel(order.status)}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-1">
              Customer: <strong className="text-zinc-200">{order.customer.name}</strong> ({order.customer.email}) • Placed {new Date(order.createdAt).toLocaleString()}
            </p>
          </div>
        </div>

        {/* State Machine Transition Panel */}
        <div className="mb-8 rounded-2xl border border-amber-500/30 bg-amber-950/10 p-6 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wider text-amber-400 mb-2">
            Permitted State Machine Transitions
          </h2>
          <p className="text-xs text-zinc-400 mb-6">
            Only transitions permitted by server rules are accepted. Every transition appends an immutable event log.
          </p>

          <form
            action={async (formData: FormData) => {
              "use server";
              await updateOrderStateAction(formData);
            }}
            className="space-y-4"
          >
            <input type="hidden" name="orderId" value={order.id} />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Order Status Transition */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Update Order Status
                </label>
                <select
                  name="status"
                  defaultValue=""
                  className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">Keep Current ({order.status})</option>
                  {allowedOrderTransitions.map((st) => (
                    <option key={st} value={st}>
                      Transition to → {formatStatusLabel(st)}
                    </option>
                  ))}
                </select>
                {allowedOrderTransitions.length === 0 && (
                  <span className="text-[10px] text-zinc-500 mt-1 block">
                    Terminal state reached.
                  </span>
                )}
              </div>

              {/* Procurement Status Transition */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Update Procurement Status
                </label>
                <select
                  name="procurementStatus"
                  defaultValue=""
                  className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">Keep Current ({order.procurementStatus})</option>
                  {allowedProcurementTransitions.map((pst) => (
                    <option key={pst} value={pst}>
                      Transition to → {formatStatusLabel(pst)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Shipment Status Transition */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Update Shipment Status
                </label>
                <select
                  name="shipmentStatus"
                  defaultValue=""
                  className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">Keep Current ({order.shipmentStatus})</option>
                  {allowedShipmentTransitions.map((sst) => (
                    <option key={sst} value={sst}>
                      Transition to → {formatStatusLabel(sst)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Customer-Safe Progress Note (Visible on Customer Timeline)
                </label>
                <input
                  type="text"
                  name="customerSafeNote"
                  placeholder="e.g. Flight MH196 departed KLIA for Dhaka Hazrat Shahjalal Airport"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Private Admin / Operations Notes (CONFIDENTIAL - Never Visible to Customer)
                </label>
                <input
                  type="text"
                  name="adminNotes"
                  placeholder="e.g. Purchased from MidValley Megamall branch invoice #84912"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-zinc-950 transition-colors shadow-sm cursor-pointer"
              >
                Apply Validated Transition
              </button>
            </div>
          </form>
        </div>

        {/* Procurement, Packing & Shipment Management Panel */}
        <div className="mb-8">
          <AdminProcurementShipmentManager
            order={order}
            suppliers={suppliers}
            storageConfigured={storageConfig.isConfigured}
          />
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column (2 Cols): Items & Audit Logs */}
          <div className="lg:col-span-2 space-y-6">
            {/* Snapshotted Items */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
              <h2 className="text-sm font-bold text-zinc-200 mb-4 uppercase tracking-wider">
                Snapshotted Agreed Items
              </h2>
              <div className="divide-y divide-zinc-800">
                {order.lineItems.map((li) => (
                  <div key={li.id} className="py-3 flex justify-between items-center text-xs">
                    <div>
                      <span className="font-semibold text-zinc-200">{li.itemTitle}</span>
                      <div className="text-zinc-500 text-[11px] mt-0.5">
                        Qty: {li.quantity} × {formatBDT(li.unitPriceBDT)}
                        {li.sourceUrl && (
                          <a
                            href={li.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="ml-2 text-amber-400 hover:underline"
                          >
                            Source Link ↗
                          </a>
                        )}
                      </div>
                    </div>
                    <span className="font-mono font-bold text-zinc-100">
                      {formatBDT(li.totalPriceBDT)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Append-Only Order Events */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
              <h2 className="text-sm font-bold text-zinc-200 mb-4 uppercase tracking-wider">
                Append-Only Order Events ({order.events.length})
              </h2>
              <div className="space-y-4">
                {order.events.map((evt) => (
                  <div
                    key={evt.id}
                    className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-950 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-400">{evt.title}</span>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {new Date(evt.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {evt.description && (
                      <p className="text-zinc-300 mt-1 text-[11px]">{evt.description}</p>
                    )}
                    <div className="mt-2 text-[10px] text-zinc-500 flex gap-3">
                      <span>Type: {evt.eventType}</span>
                      <span>Visible to Customer: {evt.isCustomerVisible ? "Yes" : "No"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Status History */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
              <h2 className="text-sm font-bold text-zinc-200 mb-4 uppercase tracking-wider">
                Status History Machine Transitions
              </h2>
              <div className="space-y-3">
                {order.statusHistory.map((sh) => (
                  <div
                    key={sh.id}
                    className="p-3 rounded-xl border border-zinc-800 bg-zinc-950 text-xs flex justify-between items-center"
                  >
                    <div>
                      <span className="font-mono text-zinc-400">
                        {sh.fromStatus || "START"} →{" "}
                        <strong className="text-emerald-400">{sh.toStatus}</strong>
                      </span>
                      {sh.reason && (
                        <p className="text-[11px] text-zinc-500 mt-0.5">{sh.reason}</p>
                      )}
                    </div>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {new Date(sh.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column (1 Col): Confidential Sourcing & Delivery Details */}
          <div className="space-y-6">
            {/* Financial Summary */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 text-xs space-y-2">
              <h3 className="font-bold text-zinc-200 mb-2 uppercase tracking-wider">
                Financial Details (BDT)
              </h3>
              <div className="flex justify-between text-zinc-400">
                <span>Items Subtotal:</span>
                <span>{formatBDT(order.itemsSubtotalBDT)}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Air Freight:</span>
                <span>{formatBDT(order.shippingFeeBDT)}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Service Fee:</span>
                <span>{formatBDT(order.serviceFeeBDT)}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Customs Fee:</span>
                <span>{formatBDT(order.customsFeeBDT)}</span>
              </div>
              <div className="pt-2 border-t border-zinc-800 flex justify-between font-bold text-zinc-100">
                <span>Total Amount:</span>
                <span className="text-amber-400">{formatBDT(order.totalAmountBDT)}</span>
              </div>
              <div className="flex justify-between text-zinc-400 pt-1">
                <span>Paid Amount:</span>
                <span className="text-emerald-400 font-bold">{formatBDT(order.paidAmountBDT)}</span>
              </div>
            </div>

            {/* Confidential Malaysia Sourcing Info */}
            <div className="rounded-2xl border border-rose-900/40 bg-rose-950/10 p-6 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-rose-300 uppercase tracking-wider">
                  Confidential Staff Data
                </h3>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-900/60 text-rose-200">
                  PRIVATE
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Never exposed to customer responses or customer-facing API views.
              </p>
              {order.quote?.estCostMYR && (
                <div className="flex justify-between pt-2 text-zinc-300">
                  <span>Est. Supplier Cost (MYR):</span>
                  <span className="font-mono font-bold">RM {Number(order.quote.estCostMYR).toFixed(2)}</span>
                </div>
              )}
              {order.quote?.estExchangeRate && (
                <div className="flex justify-between text-zinc-300">
                  <span>Internal FX Rate:</span>
                  <span className="font-mono">1 MYR = {Number(order.quote.estExchangeRate).toFixed(2)} BDT</span>
                </div>
              )}
              {order.adminNotes && (
                <div className="pt-2 border-t border-rose-900/40">
                  <span className="text-zinc-400 block font-semibold">Admin Notes:</span>
                  <p className="text-zinc-200 mt-0.5">{order.adminNotes}</p>
                </div>
              )}
            </div>

            {/* Delivery Destination */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 text-xs space-y-2">
              <h3 className="font-bold text-zinc-200 uppercase tracking-wider mb-2">
                Shipping Destination
              </h3>
              <div className="text-zinc-300 font-semibold">{order.shippingRecipientName}</div>
              <div className="text-zinc-400">{order.shippingPhoneNumber}</div>
              <div className="text-zinc-400 pt-1">
                {order.shippingStreetAddress}
                {order.shippingThanaOrUpazila ? `, ${order.shippingThanaOrUpazila}` : ""}
                <br />
                {order.shippingDistrict}, {order.shippingDivision}
                <br />
                {order.shippingCountry}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
