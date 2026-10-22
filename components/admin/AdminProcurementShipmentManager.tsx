"use client";

import { useState } from "react";
import {
  recordProcurementAction,
  createShipmentAction,
  addShipmentEventAction,
  addOrderTimelineEventAction,
} from "@/app/actions/procurement-shipment";

interface AdminProcurementShipmentManagerProps {
  order: {
    id: string;
    orderNumber: string;
    status: string;
    procurementStatus: string;
    shipmentStatus: string;
    lineItems: Array<{
      id: string;
      itemTitle: string;
      quantity: number;
      unitPriceBDT: any;
    }>;
    procurements: Array<{
      id: string;
      procurementCode: string;
      status: string;
      purchaseCostMYR: any;
      exchangeRateUsed: any;
      purchaseCostBDT: any;
      supplierInvoiceRef: string | null;
      purchasedAt: Date | string | null;
      notes: string | null;
      supplier: {
        name: string;
        contactPerson: string | null;
        phone: string | null;
        city: string | null;
        country: string;
      } | null;
    }>;
    shipments: Array<{
      id: string;
      shipmentNumber: string;
      carrierName: string | null;
      trackingNumber: string | null;
      trackingUrl: string | null;
      status: string;
      dispatchOrigin: string;
      destinationCountry: string;
      weightKg: any;
      events: Array<{
        id: string;
        status: string;
        location: string | null;
        description: string;
        isPublic: boolean;
        timestamp: Date | string;
      }>;
    }>;
  };
  suppliers: Array<{
    id: string;
    name: string;
    city: string | null;
    country: string;
  }>;
  storageConfigured: boolean;
}

export function AdminProcurementShipmentManager({
  order,
  suppliers,
  storageConfigured,
}: AdminProcurementShipmentManagerProps) {
  const [activeTab, setActiveTab] = useState<"procurement" | "shipment" | "timeline">("procurement");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Procurement form state
  const [purchaseCostMYR, setPurchaseCostMYR] = useState("");
  const [exchangeRate, setExchangeRate] = useState("28.00");
  const costBDT = (parseFloat(purchaseCostMYR) || 0) * (parseFloat(exchangeRate) || 0);

  // Selected shipment for adding milestone
  const [selectedShipmentId, setSelectedShipmentId] = useState<string>(
    order.shipments[0]?.id || ""
  );

  async function handleRecordProcurement(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const formData = new FormData(e.currentTarget);
    formData.append("orderId", order.id);

    try {
      const res = await recordProcurementAction(formData);
      if (res.success) {
        setMessage({ type: "success", text: "Procurement record added successfully!" });
        (e.target as HTMLFormElement).reset();
      } else {
        setMessage({ type: "error", text: res.error || "Failed to record procurement." });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "An error occurred." });
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateShipment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const formData = new FormData(e.currentTarget);
    formData.append("orderId", order.id);

    try {
      const res = await createShipmentAction(formData);
      if (res.success) {
        setMessage({ type: "success", text: "Shipment / Packing manifest created!" });
        if (res.shipmentId) setSelectedShipmentId(res.shipmentId);
        (e.target as HTMLFormElement).reset();
      } else {
        setMessage({ type: "error", text: res.error || "Failed to create shipment." });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "An error occurred." });
    } finally {
      setLoading(false);
    }
  }

  async function handleAddShipmentEvent(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const formData = new FormData(e.currentTarget);
    formData.append("orderId", order.id);

    try {
      const res = await addShipmentEventAction(formData);
      if (res.success) {
        setMessage({ type: "success", text: "Shipment milestone event recorded!" });
        (e.target as HTMLFormElement).reset();
      } else {
        setMessage({ type: "error", text: res.error || "Failed to record event." });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "An error occurred." });
    } finally {
      setLoading(false);
    }
  }

  async function handleAddTimelineEvent(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const formData = new FormData(e.currentTarget);
    formData.append("orderId", order.id);

    try {
      const res = await addOrderTimelineEventAction(formData);
      if (res.success) {
        setMessage({ type: "success", text: "Timeline event successfully added!" });
        (e.target as HTMLFormElement).reset();
      } else {
        setMessage({ type: "error", text: res.error || "Failed to add timeline event." });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "An error occurred." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-zinc-800 gap-4 mb-6">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-amber-400">
            Procurement & Logistics Operations
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Manage Malaysia sourcing, supplier references, packing manifests, and tracking waypoints.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex rounded-lg bg-zinc-950 p-1 border border-zinc-800 text-xs">
          <button
            type="button"
            onClick={() => { setActiveTab("procurement"); setMessage(null); }}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              activeTab === "procurement"
                ? "bg-amber-500 text-zinc-950 font-bold"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Procurement ({order.procurements.length})
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab("shipment"); setMessage(null); }}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              activeTab === "shipment"
                ? "bg-amber-500 text-zinc-950 font-bold"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Shipment & Packing ({order.shipments.length})
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab("timeline"); setMessage(null); }}
            className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
              activeTab === "timeline"
                ? "bg-amber-500 text-zinc-950 font-bold"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Timeline & Advisories
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`p-3 rounded-xl text-xs mb-6 ${
            message.type === "success"
              ? "bg-emerald-950/60 border border-emerald-800 text-emerald-300"
              : "bg-rose-950/60 border border-rose-800 text-rose-300"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* TAB 1: PROCUREMENT */}
      {activeTab === "procurement" && (
        <div className="space-y-6">
          <form onSubmit={handleRecordProcurement} className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
              Record Sourcing / Purchase Details (Malaysia)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">
                  Item Line Reference
                </label>
                <select
                  name="orderLineItemId"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-700 bg-zinc-950 text-zinc-200"
                >
                  <option value="">All Items in Order</option>
                  {order.lineItems.map((li) => (
                    <option key={li.id} value={li.id}>
                      {li.itemTitle} (Qty: {li.quantity})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">
                  Supplier
                </label>
                <select
                  name="supplierId"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-700 bg-zinc-950 text-zinc-200"
                >
                  <option value="">Select Existing Supplier</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.city || "Malaysia"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">
                  Or New Supplier Name
                </label>
                <input
                  type="text"
                  name="supplierName"
                  placeholder="e.g. MidValley Sony Store"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-700 bg-zinc-950 text-zinc-200"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">
                  Procurement Status
                </label>
                <select
                  name="status"
                  defaultValue="PURCHASED"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-700 bg-zinc-950 text-zinc-200"
                >
                  <option value="SOURCING">Sourcing in Progress</option>
                  <option value="PURCHASED">Purchased & Received</option>
                  <option value="UNAVAILABLE">Unavailable / Out of Stock</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">
                  Purchase Cost (MYR) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={purchaseCostMYR}
                  onChange={(e) => setPurchaseCostMYR(e.target.value)}
                  placeholder="e.g. 450.00"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-700 bg-zinc-950 text-zinc-200"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">
                  Exchange Rate (BDT/MYR) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(e.target.value)}
                  placeholder="28.00"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-700 bg-zinc-950 text-zinc-200"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">
                  Calculated Cost (BDT)
                </label>
                <div className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-800 bg-zinc-900 font-mono font-bold text-amber-400">
                  ৳ {costBDT.toFixed(2)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">
                  Supplier Invoice / Tax Receipt Ref
                </label>
                <input
                  type="text"
                  name="supplierInvoiceRef"
                  placeholder="e.g. INV-2026-98124 or Receipt #481"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-700 bg-zinc-950 text-zinc-200"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">
                  Purchase Receipt Attachment (URL)
                </label>
                <input
                  type="text"
                  name="receiptUrl"
                  placeholder={
                    storageConfigured
                      ? "https://storage.bucket/receipt-123.jpg"
                      : "Object storage not configured (Provide direct secure URL)"
                  }
                  className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-700 bg-zinc-950 text-zinc-200"
                />
                {!storageConfigured && (
                  <span className="text-[10px] text-zinc-500 mt-1 block">
                    Cloud upload driver is in unconfigured state; direct receipt URLs are supported.
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1">
                Private Supplier & Warranty Notes (CONFIDENTIAL - Never visible to customer)
              </label>
              <textarea
                name="notes"
                rows={2}
                placeholder="Serial numbers, store location, return window, warranty slip details..."
                className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-700 bg-zinc-950 text-zinc-200"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  name="updateOrderStatusToProcurement"
                  value="true"
                  defaultChecked
                  className="rounded border-zinc-700 text-amber-500 focus:ring-0"
                />
                Sync overall order status to PROCUREMENT if currently PAID
              </label>

              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-zinc-950 disabled:opacity-50 cursor-pointer"
              >
                {loading ? "Recording..." : "Record Procurement"}
              </button>
            </div>
          </form>

          {/* Existing Procurement Records */}
          <div className="pt-6 border-t border-zinc-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">
              Existing Malaysia Sourcing Records ({order.procurements.length})
            </h3>

            {order.procurements.length === 0 ? (
              <p className="text-xs text-zinc-500 italic">No procurement records logged for this order.</p>
            ) : (
              <div className="space-y-3">
                {order.procurements.map((proc) => (
                  <div
                    key={proc.id}
                    className="p-4 rounded-xl border border-zinc-800 bg-zinc-950 text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-amber-400">
                        {proc.procurementCode}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-800 text-zinc-300">
                        {proc.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-zinc-400 text-[11px]">
                      <div>
                        Supplier: <strong className="text-zinc-200">{proc.supplier?.name || "Direct Sourcing"}</strong>
                      </div>
                      <div>
                        Cost (MYR): <strong className="font-mono text-zinc-200">RM {Number(proc.purchaseCostMYR).toFixed(2)}</strong>
                      </div>
                      <div>
                        FX: <strong className="font-mono text-zinc-200">{Number(proc.exchangeRateUsed).toFixed(2)}</strong>
                      </div>
                      <div>
                        Cost (BDT): <strong className="font-mono text-emerald-400">৳ {Number(proc.purchaseCostBDT).toFixed(2)}</strong>
                      </div>
                    </div>

                    {proc.supplierInvoiceRef && (
                      <div className="text-[11px] text-zinc-400">
                        Invoice/Receipt Ref: <span className="font-mono text-zinc-300">{proc.supplierInvoiceRef}</span>
                      </div>
                    )}

                    {proc.notes && (
                      <div className="text-[11px] text-zinc-400 bg-zinc-900/80 p-2 rounded border border-zinc-800/80">
                        <strong>Confidential Staff Notes:</strong> {proc.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: SHIPMENT & PACKING */}
      {activeTab === "shipment" && (
        <div className="space-y-8">
          {/* Create Manifest Form */}
          <form onSubmit={handleCreateShipment} className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
              Create Packing Manifest / Consignment
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">
                  Air Freight Carrier / Cargo Partner
                </label>
                <input
                  type="text"
                  name="carrierName"
                  placeholder="e.g. Malaysia Airlines Cargo / DHL"
                  defaultValue="Consolidated Air Cargo"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-700 bg-zinc-950 text-zinc-200"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">
                  AWB / Tracking Number
                </label>
                <input
                  type="text"
                  name="trackingNumber"
                  placeholder="e.g. MH-84192049"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-700 bg-zinc-950 text-zinc-200"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">
                  Initial Status
                </label>
                <select
                  name="status"
                  defaultValue="READY_TO_DISPATCH"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-700 bg-zinc-950 text-zinc-200"
                >
                  <option value="NOT_READY">Not Ready</option>
                  <option value="READY_TO_DISPATCH">Ready to Dispatch (Packed)</option>
                  <option value="DISPATCHED">Dispatched / Departed</option>
                  <option value="IN_TRANSIT">In Transit</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">
                  Package Weight (KG)
                </label>
                <input
                  type="number"
                  step="0.01"
                  name="weightKg"
                  placeholder="e.g. 1.85"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-700 bg-zinc-950 text-zinc-200"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">
                  Dimensions (L x W x H cm)
                </label>
                <input
                  type="text"
                  name="dimensionsCm"
                  placeholder="e.g. 30 x 20 x 10"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-700 bg-zinc-950 text-zinc-200"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">
                  Estimated Departure
                </label>
                <input
                  type="date"
                  name="estimatedDeparture"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-700 bg-zinc-950 text-zinc-200"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">
                  Estimated Arrival (Dhaka)
                </label>
                <input
                  type="date"
                  name="estimatedArrival"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-700 bg-zinc-950 text-zinc-200"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">
                  Carrier Public Tracking Link
                </label>
                <input
                  type="text"
                  name="trackingUrl"
                  placeholder="https://carrier.com/track?ref=..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-700 bg-zinc-950 text-zinc-200"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">
                  Internal Cargo Notes (Private)
                </label>
                <input
                  type="text"
                  name="internalCargoNotes"
                  placeholder="Master airway bill slot, container tag #, battery label..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-700 bg-zinc-950 text-zinc-200"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  name="updateOrderStatus"
                  value="true"
                  defaultChecked
                  className="rounded border-zinc-700 text-amber-500 focus:ring-0"
                />
                Advance order status to PACKING or DISPATCHED
              </label>

              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-zinc-950 disabled:opacity-50 cursor-pointer"
              >
                {loading ? "Generating..." : "Generate Consignment"}
              </button>
            </div>
          </form>

          {/* Add Waypoint Event Form (if shipments exist) */}
          {order.shipments.length > 0 && (
            <div className="pt-6 border-t border-zinc-800">
              <form onSubmit={handleAddShipmentEvent} className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                  Record Shipment Waypoint / Event (Customer-Safe)
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1">
                      Consignment Package
                    </label>
                    <select
                      name="shipmentId"
                      value={selectedShipmentId}
                      onChange={(e) => setSelectedShipmentId(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-700 bg-zinc-950 text-zinc-200"
                    >
                      {order.shipments.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.shipmentNumber} ({s.status})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1">
                      Event Status
                    </label>
                    <select
                      name="status"
                      defaultValue="IN_TRANSIT"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-700 bg-zinc-950 text-zinc-200"
                    >
                      <option value="READY_TO_DISPATCH">Ready to Dispatch</option>
                      <option value="DISPATCHED">Dispatched (KL Airport Departure)</option>
                      <option value="IN_TRANSIT">In Transit (Air Cargo Flight)</option>
                      <option value="DELAYED">Logistics Delay / Weather</option>
                      <option value="CUSTOMS">Dhaka Customs Clearance</option>
                      <option value="OUT_FOR_DELIVERY">Out for Delivery (BD Domestic Courier)</option>
                      <option value="DELIVERED">Delivered to Customer</option>
                      <option value="RETURNED">Returned to Depot</option>
                      <option value="LOST">Package Lost Incident</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-1">
                      Physical Location
                    </label>
                    <input
                      type="text"
                      name="location"
                      placeholder="e.g. KLIA Cargo Terminal / Dhaka Airport"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-700 bg-zinc-950 text-zinc-200"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">
                    Customer-Safe Description *
                  </label>
                  <input
                    type="text"
                    name="description"
                    required
                    placeholder="e.g. Flight departed Kuala Lumpur. Expected touchdown at Dhaka within 4 hours."
                    className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-700 bg-zinc-950 text-zinc-200"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-4 text-xs text-zinc-300">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        name="syncOrderStatus"
                        value="true"
                        defaultChecked
                        className="rounded border-zinc-700 text-amber-500 focus:ring-0"
                      />
                      Sync overall order milestone status
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        name="isPublic"
                        value="true"
                        defaultChecked
                        className="rounded border-zinc-700 text-amber-500 focus:ring-0"
                      />
                      Customer Visible
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-zinc-950 disabled:opacity-50 cursor-pointer"
                  >
                    {loading ? "Recording..." : "Record Waypoint Event"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* List of Shipments and Waypoint Events */}
          <div className="pt-6 border-t border-zinc-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">
              Consignments ({order.shipments.length})
            </h3>

            {order.shipments.length === 0 ? (
              <p className="text-xs text-zinc-500 italic">No consignments created yet.</p>
            ) : (
              <div className="space-y-4">
                {order.shipments.map((s) => (
                  <div
                    key={s.id}
                    className="p-4 rounded-xl border border-zinc-800 bg-zinc-950 text-xs space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-zinc-100">{s.shipmentNumber}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-950 text-sky-400 border border-sky-800/50">
                          {s.status}
                        </span>
                      </div>
                      <span className="text-[11px] text-zinc-400">
                        {s.dispatchOrigin} → {s.destinationCountry}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-zinc-400 text-[11px]">
                      <div>
                        Carrier: <strong className="text-zinc-200">{s.carrierName || "Air Cargo"}</strong>
                      </div>
                      <div>
                        Tracking Ref: <strong className="font-mono text-zinc-200">{s.trackingNumber || "None"}</strong>
                      </div>
                      <div>
                        Weight: <strong className="font-mono text-zinc-200">{s.weightKg ? `${s.weightKg} kg` : "-"}</strong>
                      </div>
                      <div>
                        Waypoints: <strong className="text-zinc-200">{s.events.length}</strong>
                      </div>
                    </div>

                    {s.events.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-zinc-800/80 space-y-1.5">
                        <span className="text-[10px] uppercase font-bold text-zinc-500">Waypoint Events</span>
                        {s.events.map((e) => (
                          <div key={e.id} className="text-[11px] text-zinc-300 flex justify-between items-baseline">
                            <div>
                              <span className="font-semibold text-amber-400">[{e.status}]</span>{" "}
                              {e.location && <span className="text-zinc-400">({e.location}) </span>}
                              {e.description}
                            </div>
                            <span className="text-[10px] font-mono text-zinc-500 ml-4 shrink-0">
                              {new Date(e.timestamp).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: TIMELINE & ADVISORIES */}
      {activeTab === "timeline" && (
        <div className="space-y-6">
          <form onSubmit={handleAddTimelineEvent} className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
              Publish Timeline Event / Delay / Customs Advisory
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">
                  Event Category
                </label>
                <select
                  name="eventType"
                  defaultValue="LOGISTICS_ADVISORY"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-700 bg-zinc-950 text-zinc-200"
                >
                  <option value="LOGISTICS_ADVISORY">Logistics Advisory</option>
                  <option value="CUSTOMS_CLEARANCE">Customs Inspection Update</option>
                  <option value="DELAY_NOTIFICATION">Delay Notice</option>
                  <option value="DELIVERY_DISPATCH">Local Courier Handover</option>
                  <option value="INCIDENT_REPORT">Damage / Loss Advisory</option>
                  <option value="RETURN_NOTICE">Return to Origin</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">
                  Event Headline *
                </label>
                <input
                  type="text"
                  name="title"
                  required
                  placeholder="e.g. Customs Clearance Assessment In Progress"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-700 bg-zinc-950 text-zinc-200"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">
                  Location (Optional)
                </label>
                <input
                  type="text"
                  name="location"
                  placeholder="e.g. Hazrat Shahjalal International Airport, Dhaka"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-700 bg-zinc-950 text-zinc-200"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1">
                Customer-Safe Explanation / Resolution Steps *
              </label>
              <textarea
                name="description"
                rows={3}
                required
                placeholder="Detailed customer explanation. Do not include internal wholesale margins, supplier bank accounts, or sensitive staff details."
                className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-700 bg-zinc-950 text-zinc-200"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  name="isCustomerVisible"
                  value="true"
                  defaultChecked
                  className="rounded border-zinc-700 text-amber-500 focus:ring-0"
                />
                Customer-Visible on Order Tracking Timeline
              </label>

              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-zinc-950 disabled:opacity-50 cursor-pointer"
              >
                {loading ? "Publishing..." : "Publish Timeline Event"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
