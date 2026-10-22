"use client";

import React, { useState } from "react";
import { formatBDT } from "@/lib/formatters";
import { ShippingOption } from "@/lib/quotes/types";
import { acceptQuoteAction, rejectQuoteAction } from "@/lib/quotes/actions";
import { useRouter } from "next/navigation";

interface QuoteDetailViewProps {
  quote: {
    id: string;
    quoteNumber: string;
    version: number;
    status: string;
    validUntil: string;
    currency: string;
    itemsSubtotalBDT: number;
    serviceFeeBDT: number;
    shippingFeeBDT: number;
    customsFeeBDT: number;
    discountBDT: number;
    totalAmountBDT: number;
    shippingMethod: string | null;
    shippingOptions: ShippingOption[];
    estDispatchDaysMin: number | null;
    estDispatchDaysMax: number | null;
    estDeliveryDaysMin: number | null;
    estDeliveryDaysMax: number | null;
    customerNotes: string | null;
    terms: string | null;
    acceptedAt: string | null;
    rejectedAt: string | null;
    rejectionReason: string | null;
    lineItems: Array<{
      id: string;
      title: string;
      description: string | null;
      sourceUrl: string | null;
      quantity: number;
      unitPriceBDT: number;
      totalPriceBDT: number;
    }>;
    inquiry: {
      id: string;
      inquiryNumber: string;
      productName: string;
      brandOrModel: string | null;
    };
  };
  userAddresses: Array<{
    id: string;
    recipientName: string;
    phoneNumber: string;
    streetAddress: string;
    thanaOrUpazila: string | null;
    district: string;
    division: string;
    postalCode: string | null;
    isDefault: boolean;
  }>;
}

export function QuoteDetailView({ quote, userAddresses }: QuoteDetailViewProps) {
  const router = useRouter();

  // Find default or first shipping option
  const initialOption =
    quote.shippingOptions.find((opt) => opt.name === quote.shippingMethod) ||
    quote.shippingOptions.find((opt) => opt.isDefault) ||
    quote.shippingOptions[0];

  const [selectedOptionId, setSelectedOptionId] = useState<string>(initialOption?.id || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Address fields
  const defaultAddr = userAddresses.find((a) => a.isDefault) || userAddresses[0];
  const [recipientName, setRecipientName] = useState(defaultAddr?.recipientName || "");
  const [phoneNumber, setPhoneNumber] = useState(defaultAddr?.phoneNumber || "");
  const [streetAddress, setStreetAddress] = useState(defaultAddr?.streetAddress || "");
  const [thanaOrUpazila, setThanaOrUpazila] = useState(defaultAddr?.thanaOrUpazila || "");
  const [district, setDistrict] = useState(defaultAddr?.district || "Dhaka");
  const [division, setDivision] = useState(defaultAddr?.division || "Dhaka");
  const [postalCode, setPostalCode] = useState(defaultAddr?.postalCode || "");
  const [customerDeliveryNotes, setCustomerDeliveryNotes] = useState("");

  // Rejection modal state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  // Active option calculations
  const activeOption = quote.shippingOptions.find((o) => o.id === selectedOptionId) || initialOption;
  const currentShippingCost = activeOption ? activeOption.costBDT : Number(quote.shippingFeeBDT);

  const subtotal = Number(quote.itemsSubtotalBDT);
  const serviceFee = Number(quote.serviceFeeBDT);
  const customsFee = Number(quote.customsFeeBDT);
  const discount = Number(quote.discountBDT);
  const calculatedGrandTotal = Math.max(0, subtotal + serviceFee + currentShippingCost + customsFee - discount);

  const isSent = quote.status === "SENT";
  const isAccepted = quote.status === "ACCEPTED";
  const isRejected = quote.status === "REJECTED";
  const isSuperseded = quote.status === "SUPERSEDED";
  const isExpired =
    quote.status === "EXPIRED" ||
    (isSent && new Date(quote.validUntil) < new Date());

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSent || isExpired) return;

    setIsSubmitting(true);
    setActionError(null);
    setActionSuccess(null);

    const result = await acceptQuoteAction({
      quoteId: quote.id,
      selectedShippingOptionId: selectedOptionId,
      shippingRecipientName: recipientName,
      shippingPhoneNumber: phoneNumber,
      shippingStreetAddress: streetAddress,
      shippingThanaOrUpazila: thanaOrUpazila || null,
      shippingDistrict: district,
      shippingDivision: division,
      shippingPostalCode: postalCode || null,
      customerNotes: customerDeliveryNotes || null,
    });

    setIsSubmitting(false);

    if (!result.success) {
      setActionError(result.message || "Failed to accept quotation.");
    } else {
      setActionSuccess(result.message || "Quotation accepted successfully!");
      if (result.data?.orderId) {
        setTimeout(() => {
          router.push(`/account?orderId=${result.data?.orderId}`);
        }, 1500);
      }
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;

    setIsSubmitting(true);
    setActionError(null);

    const result = await rejectQuoteAction({
      quoteId: quote.id,
      rejectionReason: rejectReason,
    });

    setIsSubmitting(false);

    if (!result.success) {
      setActionError(result.message || "Failed to decline quote.");
    } else {
      setShowRejectModal(false);
      setActionSuccess("Quote has been declined. Our team will review your comments.");
      router.refresh();
    }
  };

  return (
    <div className="space-y-8">
      {/* Status banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-zinc-900 border border-zinc-800">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-zinc-100">
              Quotation #{quote.quoteNumber}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              Version {quote.version}
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
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
              {isExpired ? "EXPIRED" : quote.status}
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Reference Inquiry: <span className="text-zinc-200 font-medium">{quote.inquiry.inquiryNumber}</span> • {quote.inquiry.productName}
          </p>
        </div>

        <div className="text-right">
          <div className="text-xs text-zinc-400">Validity Deadline</div>
          <div className={`text-sm font-semibold ${isExpired ? "text-rose-400" : "text-zinc-200"}`}>
            {new Date(quote.validUntil).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
          {isExpired && (
            <span className="text-[11px] text-rose-400 font-medium">Quote is expired</span>
          )}
        </div>
      </div>

      {actionError && (
        <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-200 text-sm">
          {actionError}
        </div>
      )}

      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-200 text-sm">
          {actionSuccess}
        </div>
      )}

      {/* Main Breakdown Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Line Items, Shipping Options, and Logistics */}
        <div className="lg:col-span-2 space-y-6">
          {/* Confirmed Line Items */}
          <div className="rounded-2xl bg-zinc-900/70 border border-zinc-800 p-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400 mb-4">
              Quoted Items & Quantities
            </h2>
            <div className="divide-y divide-zinc-800">
              {quote.lineItems.map((item) => (
                <div key={item.id} className="py-4 first:pt-0 last:pb-0 flex justify-between items-start gap-4">
                  <div>
                    <h3 className="text-base font-semibold text-zinc-100">{item.title}</h3>
                    {item.description && (
                      <p className="text-xs text-zinc-400 mt-1">{item.description}</p>
                    )}
                    {item.sourceUrl && (
                      <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-amber-400 hover:underline mt-1 inline-block"
                      >
                        View Source Link ↗
                      </a>
                    )}
                    <div className="text-xs text-zinc-400 mt-2">
                      Quantity: <span className="text-zinc-200 font-bold">{item.quantity}</span> × {formatBDT(item.unitPriceBDT)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-zinc-100">
                      {formatBDT(item.totalPriceBDT)}
                    </div>
                    <span className="text-[10px] text-zinc-500 uppercase font-medium">Confirmed Price</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Shipping Options Selector */}
          <div className="rounded-2xl bg-zinc-900/70 border border-zinc-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">
                  Select Shipping Method (Malaysia → Bangladesh)
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Choose your preferred transit speed and carrier option.
                </p>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-zinc-800 text-amber-400">
                {quote.shippingOptions.length} Option{quote.shippingOptions.length > 1 ? "s" : ""} Available
              </span>
            </div>

            <div className="space-y-3">
              {quote.shippingOptions.map((opt) => {
                const isSelected = opt.id === selectedOptionId;
                return (
                  <label
                    key={opt.id}
                    className={`block p-4 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? "border-amber-500 bg-amber-500/10 shadow-sm"
                        : "border-zinc-800 bg-zinc-950/40 hover:border-zinc-700"
                    } ${!isSent ? "pointer-events-none opacity-80" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="shippingOption"
                          value={opt.id}
                          checked={isSelected}
                          disabled={!isSent}
                          onChange={() => setSelectedOptionId(opt.id)}
                          className="w-4 h-4 text-amber-500 border-zinc-700 focus:ring-amber-500 bg-zinc-900"
                        />
                        <div>
                          <div className="font-semibold text-zinc-100 text-sm flex items-center gap-2">
                            {opt.name}
                            {opt.isDefault && (
                              <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                                Recommended
                              </span>
                            )}
                          </div>
                          {opt.description && (
                            <p className="text-xs text-zinc-400 mt-0.5">{opt.description}</p>
                          )}
                          <div className="text-xs text-amber-300/80 mt-1 flex items-center gap-1 font-medium">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                            Estimated Transit: {opt.estDaysMin}–{opt.estDaysMax} working days
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-base font-bold text-zinc-100">
                          {formatBDT(opt.costBDT)}
                        </div>
                        <span className="text-[10px] text-zinc-500 uppercase">Confirmed Shipping</span>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Timeline & Estimates Card (Clearly distinguishing confirmed vs estimated values) */}
          <div className="rounded-2xl bg-zinc-900/70 border border-zinc-800 p-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400 mb-4">
              Estimated Timeline & Terms
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800">
                <div className="text-[11px] font-semibold uppercase text-amber-400/90 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                  Estimated Procurement & Dispatch
                </div>
                <div className="text-lg font-bold text-zinc-100 mt-1">
                  {quote.estDispatchDaysMin || quote.estDispatchDaysMax
                    ? `${quote.estDispatchDaysMin || 2}–${quote.estDispatchDaysMax || 5} working days`
                    : "Approx. 3–5 working days"}
                </div>
                <p className="text-xs text-zinc-500 mt-1">
                  Malaysia warehouse sourcing and packing upon payment confirmation.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800">
                <div className="text-[11px] font-semibold uppercase text-amber-400/90 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                  Estimated Delivery Window
                </div>
                <div className="text-lg font-bold text-zinc-100 mt-1">
                  {activeOption
                    ? `${activeOption.estDaysMin}–${activeOption.estDaysMax} working days`
                    : "7–14 working days"}
                </div>
                <p className="text-xs text-zinc-500 mt-1">
                  Direct cross-border flight and door delivery to your address in Bangladesh.
                </p>
              </div>
            </div>

            {quote.customerNotes && (
              <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/80 mb-4">
                <div className="text-xs font-semibold text-zinc-300">Quotation Notes from Staff</div>
                <p className="text-xs text-zinc-400 mt-1 whitespace-pre-wrap">{quote.customerNotes}</p>
              </div>
            )}

            {quote.terms && (
              <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
                <div className="text-xs font-semibold text-zinc-300">Terms & Conditions</div>
                <p className="text-xs text-zinc-400 mt-1 whitespace-pre-wrap">{quote.terms}</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Pricing Summary & Acceptance Form */}
        <div className="space-y-6">
          <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-6 sticky top-6">
            <h2 className="text-base font-bold text-zinc-100 pb-4 border-b border-zinc-800">
              Quotation Summary
            </h2>

            <div className="py-4 space-y-3 text-sm">
              <div className="flex justify-between text-zinc-400">
                <span>Items Subtotal</span>
                <span className="font-medium text-zinc-200">{formatBDT(subtotal)}</span>
              </div>

              <div className="flex justify-between text-zinc-400">
                <span>Service & Handling Fee</span>
                <span className="font-medium text-zinc-200">{formatBDT(serviceFee)}</span>
              </div>

              <div className="flex justify-between text-zinc-400">
                <div className="flex flex-col">
                  <span>Shipping Fee</span>
                  <span className="text-[11px] text-amber-400">
                    {activeOption ? activeOption.name : quote.shippingMethod}
                  </span>
                </div>
                <span className="font-medium text-zinc-200">{formatBDT(currentShippingCost)}</span>
              </div>

              {customsFee > 0 && (
                <div className="flex justify-between text-zinc-400">
                  <span>Customs & Disclosed Taxes</span>
                  <span className="font-medium text-zinc-200">{formatBDT(customsFee)}</span>
                </div>
              )}

              {discount > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>Promotional Discount</span>
                  <span className="font-medium">-{formatBDT(discount)}</span>
                </div>
              )}

              <div className="pt-4 border-t border-zinc-800 flex justify-between items-baseline">
                <div>
                  <div className="text-sm font-semibold text-zinc-300">Final Total (BDT)</div>
                  <div className="text-[11px] text-zinc-500">All fees disclosed</div>
                </div>
                <div className="text-2xl font-black text-amber-400">
                  {formatBDT(calculatedGrandTotal)}
                </div>
              </div>
            </div>

            {/* If SENT and not expired: Show Acceptance Form */}
            {isSent && !isExpired && (
              <form onSubmit={handleAccept} className="pt-4 border-t border-zinc-800 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                  Confirm Delivery Destination
                </h3>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400">
                    Recipient Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    className="w-full mt-1 px-3 py-2 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-amber-500"
                    placeholder="Recipient's name"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400">
                    Recipient Phone Number (Bangladesh) *
                  </label>
                  <input
                    type="tel"
                    required
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full mt-1 px-3 py-2 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-amber-500"
                    placeholder="01XXXXXXXXX"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400">
                    Street Address & House/Flat *
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={streetAddress}
                    onChange={(e) => setStreetAddress(e.target.value)}
                    className="w-full mt-1 px-3 py-2 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-amber-500"
                    placeholder="Street, Building, Flat"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-400">District *</label>
                    <input
                      type="text"
                      required
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      className="w-full mt-1 px-3 py-2 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-400">Division *</label>
                    <input
                      type="text"
                      required
                      value={division}
                      onChange={(e) => setDivision(e.target.value)}
                      className="w-full mt-1 px-3 py-2 text-xs rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-sm shadow-md transition-colors disabled:opacity-50"
                  >
                    {isSubmitting
                      ? "Locking & Confirming Quote..."
                      : `Accept Quote (v${quote.version}) • ${formatBDT(calculatedGrandTotal)}`}
                  </button>
                  <p className="text-[11px] text-zinc-500 text-center mt-2">
                    Creates an immutable order. Sourcing proceeds after verified payment.
                  </p>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => setShowRejectModal(true)}
                    className="w-full py-2 px-3 rounded-lg border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs transition-colors"
                  >
                    Decline or Request Revision
                  </button>
                </div>
              </form>
            )}

            {isAccepted && (
              <div className="mt-4 p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/80 text-center">
                <span className="text-xs font-bold uppercase text-emerald-400">
                  Quote Accepted & Locked
                </span>
                <p className="text-xs text-zinc-400 mt-1">
                  Accepted on {new Date(quote.acceptedAt || "").toLocaleString()}
                </p>
              </div>
            )}

            {isRejected && (
              <div className="mt-4 p-4 rounded-xl bg-rose-950/40 border border-rose-800/80 text-center">
                <span className="text-xs font-bold uppercase text-rose-400">Quote Declined</span>
                <p className="text-xs text-zinc-400 mt-1">
                  Reason: {quote.rejectionReason || "No reason given"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Rejection Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-zinc-100">Decline Quotation</h3>
            <p className="text-xs text-zinc-400">
              Please tell us why you are declining Quote #{quote.quoteNumber}. Our sourcing team will review your comments.
            </p>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Price is higher than expected, delivery timeframe too long..."
              className="w-full p-3 text-xs rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-rose-500"
            />
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 text-xs rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting || !rejectReason.trim()}
                onClick={handleReject}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-50"
              >
                {isSubmitting ? "Declining..." : "Confirm Decline"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
