"use client";

import React, { useState } from "react";
import { MasterOperationalReport } from "@/lib/reports";
import { formatBDT } from "@/lib/formatters";

interface OperationalReportsViewProps {
  initialReport: MasterOperationalReport;
  initialStartDate: string;
  initialEndDate: string;
}

export function OperationalReportsView({
  initialReport,
  initialStartDate,
  initialEndDate,
}: OperationalReportsViewProps) {
  const [report, setReport] = useState<MasterOperationalReport>(initialReport);
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchReport = async (start: string, end: string) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/reports?startDate=${start}&endDate=${end}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load report");
      }
      setReport(data.report);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Error refreshing report");
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyFilter = (e: React.FormEvent) => {
    e.preventDefault();
    fetchReport(startDate, endDate);
  };

  return (
    <div className="space-y-8">
      {/* Date Filter & Export Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
        <form onSubmit={handleApplyFilter} className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-[10px] uppercase font-mono text-zinc-400">Date Range From</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-1.5 text-xs text-zinc-100"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase font-mono text-zinc-400">Date Range To</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-1.5 text-xs text-zinc-100"
            />
          </div>
          <div className="pt-3.5">
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs rounded-lg transition disabled:opacity-50"
            >
              {isLoading ? "Calculating..." : "Apply Range"}
            </button>
          </div>
        </form>

        <div className="flex items-center gap-3">
          <a
            href={`/api/reports/export?startDate=${startDate}&endDate=${endDate}`}
            download
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-semibold text-zinc-200 transition"
          >
            📥 Export Report (CSV)
          </a>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl text-xs bg-red-950/40 border border-red-500/40 text-red-300">
          {errorMsg}
        </div>
      )}

      {/* METRIC CARD HIGHLIGHTS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">
            Gross Collections
          </span>
          <p className="text-2xl font-black text-zinc-100 mt-2 font-mono">
            {formatBDT(report.financialReport.grossPaymentsCollectedBDT)}
          </p>
          <span className="text-[11px] text-zinc-400 block mt-1">
            Net: {formatBDT(report.financialReport.netCollectionsBDT)} after refunds
          </span>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">
            Total Orders & Value
          </span>
          <p className="text-2xl font-black text-zinc-100 mt-2 font-mono">
            {report.ordersReport.totalOrdersCount}{" "}
            <span className="text-xs font-normal text-zinc-400">Orders</span>
          </p>
          <span className="text-[11px] text-zinc-400 block mt-1">
            Agreed: {formatBDT(report.ordersReport.totalAgreedValueBDT)}
          </span>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">
            Quote Acceptance
          </span>
          <p className="text-2xl font-black text-zinc-100 mt-2 font-mono">
            {report.quotesReport.acceptanceRatePercent}%
          </p>
          <span className="text-[11px] text-zinc-400 block mt-1">
            {report.quotesReport.acceptedCount} of {report.quotesReport.totalQuotesIssued} issued quotes
          </span>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">
            Wallet Liability
          </span>
          <p className="text-2xl font-black text-zinc-100 mt-2 font-mono">
            {formatBDT(report.walletReport.totalLedgerLiabilityBDT)}
          </p>
          <div className="flex items-center gap-1.5 mt-1">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                report.walletReport.isReconciled ? "bg-emerald-500" : "bg-red-500"
              }`}
            />
            <span className="text-[11px] text-zinc-400">
              {report.walletReport.isReconciled ? "Ledger Verified" : "Discrepancy Detected"}
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 1: FINANCIAL RECONCILIATION */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
        <div className="border-b border-zinc-800 pb-3 flex justify-between items-center">
          <div>
            <h2 className="text-base font-bold text-zinc-100">
              Financial Collections, Outstanding, Failures & Refunds
            </h2>
            <p className="text-xs text-zinc-400">
              Formula: Net Collections = Gross Verified Payments − Completed Refunds. No double-counting.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 py-2">
          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800">
            <span className="text-xs text-zinc-400">Gross Verified Inflow</span>
            <p className="text-lg font-bold text-emerald-400 font-mono mt-1">
              +{formatBDT(report.financialReport.grossPaymentsCollectedBDT)}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800">
            <span className="text-xs text-zinc-400">Processed Refunds</span>
            <p className="text-lg font-bold text-red-400 font-mono mt-1">
              -{formatBDT(report.financialReport.totalRefundsProcessedBDT)}
            </p>
            <span className="text-[10px] text-zinc-500">
              {report.financialReport.refundsBreakdown.completedCount} completed payouts
            </span>
          </div>
          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800">
            <span className="text-xs text-zinc-400">Net Realized Cash</span>
            <p className="text-lg font-bold text-zinc-100 font-mono mt-1">
              {formatBDT(report.financialReport.netCollectionsBDT)}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800">
            <span className="text-xs text-zinc-400">Uncollected Order Dues</span>
            <p className="text-lg font-bold text-amber-400 font-mono mt-1">
              {formatBDT(report.financialReport.totalOutstandingOrdersBDT)}
            </p>
            <span className="text-[10px] text-zinc-500">On active in-flight pre-orders</span>
          </div>
        </div>

        {/* Payment Methods Breakdown */}
        <div className="pt-2">
          <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
            Collections by Payment Channel
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-950 border-b border-zinc-800 text-zinc-400 uppercase font-mono text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Channel / Method</th>
                  <th className="py-2.5 px-3">Successful Payments</th>
                  <th className="py-2.5 px-3">Total Collected (BDT)</th>
                  <th className="py-2.5 px-3">Failed / Cancelled Attempts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 font-sans">
                {report.financialReport.paymentMethodBreakdown.map((m) => (
                  <tr key={m.method} className="hover:bg-zinc-850/50">
                    <td className="py-2.5 px-3 font-semibold text-zinc-200">{m.method}</td>
                    <td className="py-2.5 px-3 text-zinc-300">{m.successfulCount}</td>
                    <td className="py-2.5 px-3 font-mono font-medium text-emerald-400">
                      {formatBDT(m.successfulAmountBDT)}
                    </td>
                    <td className="py-2.5 px-3 text-zinc-400">{m.failedCount}</td>
                  </tr>
                ))}
                {report.financialReport.paymentMethodBreakdown.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-zinc-500">
                      No payment transactions recorded in selected date range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* SECTION 2: ORDERS BY STATUS */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
        <div className="border-b border-zinc-800 pb-3">
          <h2 className="text-base font-bold text-zinc-100">Orders by Status & Volume</h2>
          <p className="text-xs text-zinc-400">
            Total active, procurement, transit, delivered, and cancelled pre-orders within range.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950 border-b border-zinc-800 text-zinc-400 uppercase font-mono text-[10px]">
              <tr>
                <th className="py-2.5 px-3">Order Status</th>
                <th className="py-2.5 px-3">Count</th>
                <th className="py-2.5 px-3">Total Value (BDT)</th>
                <th className="py-2.5 px-3">% of Orders</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {report.ordersReport.statusBreakdown
                .filter((s) => s.count > 0)
                .map((s) => (
                  <tr key={s.status} className="hover:bg-zinc-850/50">
                    <td className="py-2.5 px-3 font-semibold text-zinc-200 font-mono text-xs">
                      {s.status}
                    </td>
                    <td className="py-2.5 px-3 text-zinc-300">{s.count}</td>
                    <td className="py-2.5 px-3 font-mono font-medium text-amber-400">
                      {formatBDT(s.totalAmountBDT)}
                    </td>
                    <td className="py-2.5 px-3 text-zinc-400">{s.percentageOfTotal}%</td>
                  </tr>
                ))}
              {report.ordersReport.totalOrdersCount === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-zinc-500">
                    No orders created within selected date range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 3: QUOTES PERFORMANCE */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
        <div className="border-b border-zinc-800 pb-3">
          <h2 className="text-base font-bold text-zinc-100">Quotation Lifecycle & Expirations</h2>
          <p className="text-xs text-zinc-400">
            Quoted, Accepted, Expired, and Superseded quotation records.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 py-2 text-center">
          <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
            <span className="text-[10px] text-zinc-400 uppercase font-mono">Total Issued</span>
            <p className="text-lg font-bold text-zinc-100 mt-1 font-mono">
              {report.quotesReport.totalQuotesIssued}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
            <span className="text-[10px] text-emerald-400 uppercase font-mono">Accepted</span>
            <p className="text-lg font-bold text-emerald-400 mt-1 font-mono">
              {report.quotesReport.acceptedCount}
            </p>
            <span className="text-[10px] text-zinc-500 font-mono">
              {formatBDT(report.quotesReport.acceptedValueBDT)}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
            <span className="text-[10px] text-amber-400 uppercase font-mono">Active (Sent)</span>
            <p className="text-lg font-bold text-amber-400 mt-1 font-mono">
              {report.quotesReport.quotedCount}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
            <span className="text-[10px] text-red-400 uppercase font-mono">Expired</span>
            <p className="text-lg font-bold text-red-400 mt-1 font-mono">
              {report.quotesReport.expiredCount}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
            <span className="text-[10px] text-zinc-400 uppercase font-mono">Rejected</span>
            <p className="text-lg font-bold text-zinc-400 mt-1 font-mono">
              {report.quotesReport.rejectedCount}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
            <span className="text-[10px] text-zinc-400 uppercase font-mono">Superseded</span>
            <p className="text-lg font-bold text-zinc-400 mt-1 font-mono">
              {report.quotesReport.supersededCount}
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 4: INQUIRY CONVERSION FUNNEL */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
        <div className="border-b border-zinc-800 pb-3">
          <h2 className="text-base font-bold text-zinc-100">Inquiry Volume & Conversion Funnel</h2>
          <p className="text-xs text-zinc-400">
            Track inquiries progressing to issued quotes, quote acceptance, and final order placement.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-2">
          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800">
            <span className="text-xs text-zinc-400">Inquiry → Quoted</span>
            <p className="text-xl font-bold text-zinc-100 font-mono mt-1">
              {report.inquiryReport.conversionInquiryToQuotePercent}%
            </p>
            <span className="text-[11px] text-zinc-500">
              {report.inquiryReport.inquiriesQuotedCount} of {report.inquiryReport.totalInquiriesSubmitted} inquiries quoted
            </span>
          </div>
          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800">
            <span className="text-xs text-zinc-400">Quoted → Accepted</span>
            <p className="text-xl font-bold text-zinc-100 font-mono mt-1">
              {report.inquiryReport.conversionQuoteToAcceptedPercent}%
            </p>
            <span className="text-[11px] text-zinc-500">
              {report.inquiryReport.inquiriesAcceptedQuoteCount} accepted quotes
            </span>
          </div>
          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800">
            <span className="text-xs text-zinc-400">Overall Inquiry → Order Conversion</span>
            <p className="text-xl font-bold text-amber-400 font-mono mt-1">
              {report.inquiryReport.overallFunnelConversionPercent}%
            </p>
            <span className="text-[11px] text-zinc-500">
              {report.inquiryReport.inquiriesConvertedToOrderCount} total confirmed pre-orders
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 5: LOGISTICS & SHIPPING PERFORMANCE */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
        <div className="border-b border-zinc-800 pb-3">
          <h2 className="text-base font-bold text-zinc-100">Procurement & Shipping Performance</h2>
          <p className="text-xs text-zinc-400">
            Carrier metrics, transit times, delayed shipments, and delivered orders.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-2">
          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800">
            <span className="text-xs text-zinc-400">Total Shipments</span>
            <p className="text-xl font-bold text-zinc-100 font-mono mt-1">
              {report.logisticsReport.totalShipments}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800">
            <span className="text-xs text-zinc-400">Delivered Safely</span>
            <p className="text-xl font-bold text-emerald-400 font-mono mt-1">
              {report.logisticsReport.deliveredShipmentsCount}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800">
            <span className="text-xs text-zinc-400">Delayed Air Cargo</span>
            <p className="text-xl font-bold text-amber-400 font-mono mt-1">
              {report.logisticsReport.delayedShipmentsCount}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800">
            <span className="text-xs text-zinc-400">Average Delivery Time</span>
            <p className="text-xl font-bold text-zinc-100 font-mono mt-1">
              {report.logisticsReport.averageDeliveryDays !== null
                ? `${report.logisticsReport.averageDeliveryDays} Days`
                : "N/A"}
            </p>
            <span className="text-[10px] text-zinc-500">KL departure to Bangladesh doorstep</span>
          </div>
        </div>

        {/* Carrier Breakdown */}
        {report.logisticsReport.carrierBreakdown.length > 0 && (
          <div className="pt-2">
            <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
              Performance by Carrier / Consolidator
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-950 border-b border-zinc-800 text-zinc-400 uppercase font-mono text-[10px]">
                  <tr>
                    <th className="py-2 px-3">Carrier</th>
                    <th className="py-2 px-3">Shipments</th>
                    <th className="py-2 px-3">Delivered</th>
                    <th className="py-2 px-3">Delayed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {report.logisticsReport.carrierBreakdown.map((c) => (
                    <tr key={c.carrierName} className="hover:bg-zinc-850/50">
                      <td className="py-2 px-3 font-semibold text-zinc-200">{c.carrierName}</td>
                      <td className="py-2 px-3 text-zinc-300">{c.shipmentCount}</td>
                      <td className="py-2 px-3 text-emerald-400">{c.deliveredCount}</td>
                      <td className="py-2 px-3 text-amber-400">{c.delayedCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 6: WALLET LEDGER AUDIT LIABILITY */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
        <div className="border-b border-zinc-800 pb-3 flex justify-between items-center">
          <div>
            <h2 className="text-base font-bold text-zinc-100">Wallet Liability Ledger Audit</h2>
            <p className="text-xs text-zinc-400">
              Derived strictly from immutable double-entry ledger entries. Zero mock estimates.
            </p>
          </div>
          <span
            className={`px-3 py-1 text-xs font-bold rounded-lg ${
              report.walletReport.isReconciled
                ? "bg-emerald-950 border border-emerald-500/40 text-emerald-400"
                : "bg-red-950 border border-red-500/40 text-red-400"
            }`}
          >
            {report.walletReport.isReconciled ? "LEDGER RECONCILED (0.00 BDT Discrepancy)" : "AUDIT DISCREPANCY DETECTED"}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-2">
          <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
            <span className="text-[10px] text-zinc-400 uppercase font-mono">Total Ledger Liability</span>
            <p className="text-lg font-bold text-amber-400 font-mono mt-1">
              {formatBDT(report.walletReport.totalLedgerLiabilityBDT)}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
            <span className="text-[10px] text-zinc-400 uppercase font-mono">Total Account Balances</span>
            <p className="text-lg font-bold text-zinc-100 font-mono mt-1">
              {formatBDT(report.walletReport.totalAccountBalancesBDT)}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
            <span className="text-[10px] text-zinc-400 uppercase font-mono">Cumulative Credits</span>
            <p className="text-lg font-bold text-emerald-400 font-mono mt-1">
              +{formatBDT(report.walletReport.ledgerActivitySummary.totalCreditsBDT)}
            </p>
            <span className="text-[10px] text-zinc-500">
              {report.walletReport.ledgerActivitySummary.totalCreditsCount} credit ledger events
            </span>
          </div>
          <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800">
            <span className="text-[10px] text-zinc-400 uppercase font-mono">Cumulative Debits</span>
            <p className="text-lg font-bold text-red-400 font-mono mt-1">
              -{formatBDT(report.walletReport.ledgerActivitySummary.totalDebitsBDT)}
            </p>
            <span className="text-[10px] text-zinc-500">
              {report.walletReport.ledgerActivitySummary.totalDebitsCount} order spend events
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
