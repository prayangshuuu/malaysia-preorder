"use client";

import React, { useState } from "react";
import { formatBDT } from "@/lib/formatters";
import { ShippingOption, calculateQuoteTotals } from "@/lib/quotes/types";
import { createQuoteAction } from "@/lib/quotes/actions";
import { useRouter } from "next/navigation";

interface AdminQuoteFormProps {
  inquiry: {
    id: string;
    inquiryNumber: string;
    productName: string;
    brandOrModel: string | null;
    referenceUrl: string | null;
    quantityRequested: number;
    targetBudgetBDT: number | null;
    user: {
      name: string;
      email: string;
      phone: string | null;
    };
    quotes: Array<{
      id: string;
      quoteNumber: string;
      version: number;
      status: string;
      totalAmountBDT: number;
      createdAt: string;
    }>;
  };
  initialDefaults?: {
    validityDays?: number;
    serviceFeeBDT?: number;
    customsFeeBDT?: number;
    defaultRateMYRtoBDT?: number;
    shippingOptions?: ShippingOption[];
    standardCustomerNotes?: string;
  };
}

export function AdminQuoteForm({ inquiry, initialDefaults }: AdminQuoteFormProps) {
  const router = useRouter();

  // Active quotation status check
  const latestQuote = inquiry.quotes[0];
  const hasAccepted = inquiry.quotes.some((q) => q.status === "ACCEPTED");

  // Line items state
  const [lineItems, setLineItems] = useState([
    {
      title: inquiry.productName,
      description: inquiry.brandOrModel || "",
      sourceUrl: inquiry.referenceUrl || "",
      quantity: inquiry.quantityRequested || 1,
      unitPriceBDT: 0,
      estUnitCostMYR: 0,
    },
  ]);

  // Pricing & Fees
  const [serviceFeeBDT, setServiceFeeBDT] = useState<number>(initialDefaults?.serviceFeeBDT ?? 500);
  const [customsFeeBDT, setCustomsFeeBDT] = useState<number>(initialDefaults?.customsFeeBDT ?? 0);
  const [discountBDT, setDiscountBDT] = useState<number>(0);

  // Shipping options
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>(
    initialDefaults?.shippingOptions && initialDefaults.shippingOptions.length > 0
      ? initialDefaults.shippingOptions
      : [
          {
            id: "opt-air-std",
            name: "Standard Air Courier (KL → Dhaka)",
            description: "Direct flight cargo, door delivery across Bangladesh",
            costBDT: 850,
            estDaysMin: 7,
            estDaysMax: 10,
            isDefault: true,
          },
          {
            id: "opt-air-exp",
            name: "Express Air Priority (DHL / FedEx)",
            description: "Priority processing and fast courier transit",
            costBDT: 1850,
            estDaysMin: 3,
            estDaysMax: 5,
            isDefault: false,
          },
        ]
  );

  // Private Sourcing Meta (Admin Only)
  const [estCostMYR, setEstCostMYR] = useState<number>(0);
  const [estExchangeRate, setEstExchangeRate] = useState<number>(initialDefaults?.defaultRateMYRtoBDT ?? 28.5);
  const [adminNotes, setAdminNotes] = useState<string>("");

  // Customer Facing Metadata
  const defaultValidDays = initialDefaults?.validityDays ?? 7;
  const [validUntil, setValidUntil] = useState<string>(() => {
    return new Date(Date.now() + defaultValidDays * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
  });
  const [estDispatchDaysMin, setEstDispatchDaysMin] = useState<number>(2);
  const [estDispatchDaysMax, setEstDispatchDaysMax] = useState<number>(5);
  const [customerNotes, setCustomerNotes] = useState<string>(
    initialDefaults?.standardCustomerNotes ??
      "100% original authentic product sourced directly from verified authorized retailers in Kuala Lumpur, Malaysia."
  );
  const [termsAndConditions, setTermsAndConditions] = useState<string>(
    "Pre-order confirmation is locked upon quote acceptance. Full or partial advance payment is required before Malaysia procurement commences. Transit times are estimated and may vary slightly due to airline schedules or Bangladesh customs clearance."
  );

  const [quoteStatus, setQuoteStatus] = useState<"SENT" | "DRAFT">("SENT");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Line item modifiers
  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      {
        title: "",
        description: "",
        sourceUrl: "",
        quantity: 1,
        unitPriceBDT: 0,
        estUnitCostMYR: 0,
      },
    ]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length <= 1) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: string, value: string | number) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setLineItems(updated);
  };

  // Shipping option modifiers
  const addShippingOption = () => {
    const newId = `opt-${Date.now()}`;
    setShippingOptions([
      ...shippingOptions,
      {
        id: newId,
        name: "Sea Cargo / Economy",
        description: "Bulk economy transit",
        costBDT: 400,
        estDaysMin: 21,
        estDaysMax: 30,
        isDefault: false,
      },
    ]);
  };

  const removeShippingOption = (index: number) => {
    if (shippingOptions.length <= 1) return;
    setShippingOptions(shippingOptions.filter((_, i) => i !== index));
  };

  const updateShippingOption = (index: number, field: string, value: string | number | boolean) => {
    const updated = [...shippingOptions];
    updated[index] = { ...updated[index], [field]: value };
    setShippingOptions(updated);
  };

  // Auto calculate exchange rate helper
  const handleMYRChange = (valMYR: number, rate: number) => {
    setEstCostMYR(valMYR);
    // Suggest BDT line item price if line 0 is zero
    if (lineItems.length === 1 && lineItems[0].unitPriceBDT === 0 && valMYR > 0) {
      const suggestedBDT = Math.round(valMYR * rate);
      updateLineItem(0, "unitPriceBDT", suggestedBDT);
    }
  };

  // Totals calculations
  const defaultShipping = shippingOptions.find((o) => o.isDefault) || shippingOptions[0];
  const calculatedTotals = calculateQuoteTotals({
    lineItems,
    serviceFeeBDT,
    shippingFeeBDT: defaultShipping ? defaultShipping.costBDT : 0,
    customsFeeBDT,
    discountBDT,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasAccepted) return;

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const result = await createQuoteAction({
      inquiryId: inquiry.id,
      status: quoteStatus,
      validUntil: new Date(`${validUntil}T23:59:59Z`).toISOString(),
      lineItems,
      serviceFeeBDT,
      customsFeeBDT,
      discountBDT,
      shippingOptions,
      defaultShippingOptionId: defaultShipping?.id,
      estCostMYR: estCostMYR || null,
      estExchangeRate: estExchangeRate || null,
      adminNotes: adminNotes || null,
      estDispatchDaysMin,
      estDispatchDaysMax,
      customerNotes,
      termsAndConditions,
    });

    setIsSubmitting(false);

    if (!result.success) {
      setErrorMsg(result.message || "Failed to create quote.");
    } else {
      setSuccessMsg(result.message || "Quote created successfully!");
      setTimeout(() => {
        router.push("/admin/quotes");
      }, 1500);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {hasAccepted && (
        <div className="p-4 rounded-xl bg-amber-950/60 border border-amber-800 text-amber-200 text-sm">
          ⚠️ An accepted quote already exists for this inquiry. New quotes cannot be generated once the customer has confirmed their order.
        </div>
      )}

      {latestQuote && !hasAccepted && (
        <div className="p-4 rounded-xl bg-blue-950/40 border border-blue-800/80 text-blue-200 text-xs">
          ℹ️ Submitting this form will issue <span className="font-bold">Version {latestQuote.version + 1}</span> and automatically supersede quote #{latestQuote.quoteNumber} (v{latestQuote.version}).
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-200 text-sm">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-200 text-sm">
          {successMsg}
        </div>
      )}

      {/* Inquiry Summary Bar */}
      <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-mono text-amber-400 font-semibold">
            Inquiry Ref: {inquiry.inquiryNumber}
          </div>
          <h2 className="text-lg font-bold text-zinc-100 mt-0.5">{inquiry.productName}</h2>
          <p className="text-xs text-zinc-400 mt-1">
            Customer: <span className="text-zinc-200 font-medium">{inquiry.user.name}</span> ({inquiry.user.email} {inquiry.user.phone ? `• ${inquiry.user.phone}` : ""})
          </p>
        </div>

        <div className="text-right">
          <div className="text-xs text-zinc-400">Target Budget</div>
          <div className="text-sm font-bold text-zinc-200">
            {inquiry.targetBudgetBDT ? formatBDT(inquiry.targetBudgetBDT) : "None specified"}
          </div>
          <div className="text-[11px] text-zinc-500">Qty Requested: {inquiry.quantityRequested}</div>
        </div>
      </div>

      {/* Section 1: Line Items */}
      <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-200">
              Quotation Line Items (BDT)
            </h3>
            <p className="text-xs text-zinc-400">
              Customer-facing item prices. Enter confirmed product title, quantity, and unit price in BDT.
            </p>
          </div>
          <button
            type="button"
            onClick={addLineItem}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-400 border border-zinc-700 transition-colors"
          >
            + Add Another Line Item
          </button>
        </div>

        <div className="space-y-4 pt-2">
          {lineItems.map((item, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
            >
              <div className="md:col-span-5">
                <label className="block text-[11px] font-semibold text-zinc-400">
                  Item Title *
                </label>
                <input
                  type="text"
                  required
                  value={item.title}
                  onChange={(e) => updateLineItem(idx, "title", e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-xs rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 focus:outline-none focus:border-amber-500"
                  placeholder="e.g. Dyson Airwrap Multi-Styler"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-[11px] font-semibold text-zinc-400">Quantity *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={item.quantity}
                  onChange={(e) => updateLineItem(idx, "quantity", parseInt(e.target.value, 10) || 1)}
                  className="w-full mt-1 px-3 py-2 text-xs rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-[11px] font-semibold text-zinc-400">Unit Price (BDT) *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={item.unitPriceBDT}
                  onChange={(e) => updateLineItem(idx, "unitPriceBDT", parseFloat(e.target.value) || 0)}
                  className="w-full mt-1 px-3 py-2 text-xs rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="md:col-span-2 text-right">
                <div className="text-[11px] text-zinc-500">Line Subtotal</div>
                <div className="text-sm font-bold text-amber-400">
                  {formatBDT(item.quantity * item.unitPriceBDT)}
                </div>
              </div>

              <div className="md:col-span-1 text-center">
                <button
                  type="button"
                  disabled={lineItems.length <= 1}
                  onClick={() => removeLineItem(idx)}
                  className="text-xs text-rose-400 hover:text-rose-300 disabled:opacity-30 p-2"
                >
                  ✕
                </button>
              </div>

              <div className="md:col-span-7">
                <input
                  type="text"
                  value={item.description || ""}
                  onChange={(e) => updateLineItem(idx, "description", e.target.value)}
                  placeholder="Item details / variant specifications (e.g. Color: Strawberry Bronze)"
                  className="w-full px-3 py-1.5 text-xs rounded-lg bg-zinc-900/60 border border-zinc-800 text-zinc-300"
                />
              </div>

              <div className="md:col-span-5">
                <input
                  type="url"
                  value={item.sourceUrl || ""}
                  onChange={(e) => updateLineItem(idx, "sourceUrl", e.target.value)}
                  placeholder="Source URL (Malaysia web link)"
                  className="w-full px-3 py-1.5 text-xs rounded-lg bg-zinc-900/60 border border-zinc-800 text-zinc-300"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 2: Shipping Options */}
      <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-200">
              Shipping & Freight Options (Malaysia → Bangladesh)
            </h3>
            <p className="text-xs text-zinc-400">
              Offer one or multiple shipping choices. Customer can compare and choose on their portal.
            </p>
          </div>
          <button
            type="button"
            onClick={addShippingOption}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-400 border border-zinc-700 transition-colors"
          >
            + Add Shipping Tier
          </button>
        </div>

        <div className="space-y-3 pt-2">
          {shippingOptions.map((opt, idx) => (
            <div
              key={opt.id}
              className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 grid grid-cols-1 md:grid-cols-12 gap-3 items-center"
            >
              <div className="md:col-span-4">
                <label className="block text-[11px] font-semibold text-zinc-400">Option Name *</label>
                <input
                  type="text"
                  required
                  value={opt.name}
                  onChange={(e) => updateShippingOption(idx, "name", e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-xs rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-[11px] font-semibold text-zinc-400">Charge (BDT) *</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={opt.costBDT}
                  onChange={(e) => updateShippingOption(idx, "costBDT", parseFloat(e.target.value) || 0)}
                  className="w-full mt-1 px-3 py-2 text-xs rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-[11px] font-semibold text-zinc-400">Est. Transit (Days) *</label>
                <div className="flex items-center gap-1 mt-1">
                  <input
                    type="number"
                    min="1"
                    value={opt.estDaysMin}
                    onChange={(e) => updateShippingOption(idx, "estDaysMin", parseInt(e.target.value, 10) || 1)}
                    className="w-16 px-2 py-2 text-xs rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100"
                  />
                  <span className="text-zinc-500 text-xs">to</span>
                  <input
                    type="number"
                    min="1"
                    value={opt.estDaysMax}
                    onChange={(e) => updateShippingOption(idx, "estDaysMax", parseInt(e.target.value, 10) || 1)}
                    className="w-16 px-2 py-2 text-xs rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100"
                  />
                  <span className="text-zinc-500 text-[11px]">days</span>
                </div>
              </div>

              <div className="md:col-span-2 flex items-center justify-end gap-2">
                <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer">
                  <input
                    type="radio"
                    name="isDefaultShipping"
                    checked={opt.isDefault}
                    onChange={() => {
                      setShippingOptions(
                        shippingOptions.map((o, i) => ({ ...o, isDefault: i === idx }))
                      );
                    }}
                    className="text-amber-500 focus:ring-amber-500"
                  />
                  Default
                </label>
                <button
                  type="button"
                  disabled={shippingOptions.length <= 1}
                  onClick={() => removeShippingOption(idx)}
                  className="text-xs text-rose-400 hover:text-rose-300 disabled:opacity-30 p-1"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 3: Disclosed Fees & Validity */}
      <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-6">
        <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-200 mb-4">
          Fees, Discounts & Validity Deadline
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-400">Service Fee (BDT)</label>
            <input
              type="number"
              min="0"
              value={serviceFeeBDT}
              onChange={(e) => setServiceFeeBDT(parseFloat(e.target.value) || 0)}
              className="w-full mt-1 px-3 py-2 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-400">Customs / Tax Fee (BDT)</label>
            <input
              type="number"
              min="0"
              value={customsFeeBDT}
              onChange={(e) => setCustomsFeeBDT(parseFloat(e.target.value) || 0)}
              className="w-full mt-1 px-3 py-2 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-400">Promotional Discount (BDT)</label>
            <input
              type="number"
              min="0"
              value={discountBDT}
              onChange={(e) => setDiscountBDT(parseFloat(e.target.value) || 0)}
              className="w-full mt-1 px-3 py-2 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-400">Quote Expiry Date *</label>
            <input
              type="date"
              required
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="w-full mt-1 px-3 py-2 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
            />
          </div>
        </div>
      </div>

      {/* Section 4: Internal Sourcing Cost & Exchange Rate (STRICTLY ADMIN ONLY) */}
      <div className="rounded-2xl bg-zinc-900 border border-amber-900/40 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
          <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400">
            Internal Sourcing & Exchange Rate (Strictly Confidential - Admin Only)
          </h3>
        </div>
        <p className="text-xs text-zinc-400">
          These details are never exposed to customers. Used for company margins and financial reporting.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-zinc-400">Estimated Sourcing Cost (MYR)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={estCostMYR}
              onChange={(e) => handleMYRChange(parseFloat(e.target.value) || 0, estExchangeRate)}
              className="w-full mt-1 px-3 py-2 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
              placeholder="e.g. 450"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-400">Exchange Rate (1 MYR to BDT)</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={estExchangeRate}
              onChange={(e) => {
                const newRate = parseFloat(e.target.value) || 28.5;
                setEstExchangeRate(newRate);
                handleMYRChange(estCostMYR, newRate);
              }}
              className="w-full mt-1 px-3 py-2 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
            />
          </div>

          <div>
            <div className="text-xs text-zinc-500">Approx. Sourcing Cost in BDT</div>
            <div className="text-base font-bold text-zinc-200 mt-2">
              {formatBDT(estCostMYR * estExchangeRate)}
            </div>
            <span className="text-[11px] text-zinc-500">Internal baseline cost</span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-400">Internal Admin Notes</label>
          <textarea
            rows={2}
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
            className="w-full mt-1 p-3 text-xs rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-amber-500"
            placeholder="Supplier contact, stock availability remarks, voucher codes used..."
          />
        </div>
      </div>

      {/* Section 5: Customer Visible Notes, Timelines & Terms */}
      <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-6 space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-200">
          Customer-Facing Timeline, Terms & Notes
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-400">
              Estimated Procurement & Dispatch (Working Days)
            </label>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="number"
                min="0"
                value={estDispatchDaysMin}
                onChange={(e) => setEstDispatchDaysMin(parseInt(e.target.value, 10) || 0)}
                className="w-20 px-3 py-2 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
              />
              <span className="text-zinc-500 text-xs">to</span>
              <input
                type="number"
                min="0"
                value={estDispatchDaysMax}
                onChange={(e) => setEstDispatchDaysMax(parseInt(e.target.value, 10) || 0)}
                className="w-20 px-3 py-2 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100"
              />
              <span className="text-zinc-400 text-xs">working days</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-400">Quotation Status</label>
            <div className="flex items-center gap-4 mt-2">
              <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                <input
                  type="radio"
                  name="quoteStatus"
                  value="SENT"
                  checked={quoteStatus === "SENT"}
                  onChange={() => setQuoteStatus("SENT")}
                  className="text-amber-500"
                />
                Send Immediately to Customer
              </label>
              <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                <input
                  type="radio"
                  name="quoteStatus"
                  value="DRAFT"
                  checked={quoteStatus === "DRAFT"}
                  onChange={() => setQuoteStatus("DRAFT")}
                  className="text-amber-500"
                />
                Save as Draft
              </label>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-400">Customer-Visible Notes</label>
          <textarea
            rows={2}
            value={customerNotes}
            onChange={(e) => setCustomerNotes(e.target.value)}
            className="w-full mt-1 p-3 text-xs rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-400">Terms & Conditions</label>
          <textarea
            rows={3}
            value={termsAndConditions}
            onChange={(e) => setTermsAndConditions(e.target.value)}
            className="w-full mt-1 p-3 text-xs rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200"
          />
        </div>
      </div>

      {/* Pricing Summary & Submit Bar */}
      <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <div className="text-xs text-zinc-400">Total Customer Quoted Amount (BDT)</div>
          <div className="text-3xl font-extrabold text-amber-400 mt-1">
            {formatBDT(calculatedTotals.totalAmountBDT)}
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Includes items ({formatBDT(calculatedTotals.itemsSubtotalBDT)}) + default shipping ({formatBDT(calculatedTotals.shippingFeeBDT)}) + service ({formatBDT(calculatedTotals.serviceFeeBDT)})
          </p>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={isSubmitting || hasAccepted}
            className="py-3 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-sm shadow-md transition-colors disabled:opacity-50"
          >
            {isSubmitting
              ? "Generating Quotation..."
              : quoteStatus === "SENT"
              ? "Publish & Send Quote"
              : "Save Quote as Draft"}
          </button>
        </div>
      </div>
    </form>
  );
}
