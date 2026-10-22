import { z } from "zod";

export const reportDateRangeSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export type ReportDateRange = z.infer<typeof reportDateRangeSchema>;

/**
 * Standard sanitized date boundaries helper.
 * - If startDate is not provided, defaults to past 30 days.
 * - If endDate is not provided, defaults to current time.
 * - Ensures boundary covers full days (00:00:00 to 23:59:59.999).
 */
export function parseDateBoundaries(start?: string | null, end?: string | null): {
  from: Date;
  to: Date;
} {
  let from: Date;
  let to: Date;

  if (start) {
    // If formatted as YYYY-MM-DD, parse as UTC midnight to avoid local timezone offset shifting the day
    if (/^\d{4}-\d{2}-\d{2}$/.test(start)) {
      from = new Date(`${start}T00:00:00.000Z`);
    } else {
      from = new Date(start);
      if (isNaN(from.getTime())) {
        from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      }
    }
  } else {
    from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    from.setUTCHours(0, 0, 0, 0);
  }

  if (end) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(end)) {
      to = new Date(`${end}T23:59:59.999Z`);
    } else {
      to = new Date(end);
      if (isNaN(to.getTime())) {
        to = new Date();
      }
    }
  } else {
    to = new Date();
    to.setUTCHours(23, 59, 59, 999);
  }

  return { from, to };
}

/**
 * Orders by Status Report Structure
 */
export interface OrdersByStatusReport {
  dateRange: { from: string; to: string };
  totalOrdersCount: number;
  totalAgreedValueBDT: number;
  totalCollectedValueBDT: number;
  statusBreakdown: Array<{
    status: string;
    count: number;
    totalAmountBDT: number;
    percentageOfTotal: number;
  }>;
  dailyTrend: Array<{
    date: string;
    orderCount: number;
    totalAmountBDT: number;
  }>;
}

/**
 * Quotes Lifecycle & Performance Report Structure
 */
export interface QuotesPerformanceReport {
  dateRange: { from: string; to: string };
  totalQuotesIssued: number;
  totalQuotedValueBDT: number;
  quotedCount: number;
  acceptedCount: number;
  rejectedCount: number;
  expiredCount: number;
  supersededCount: number;
  draftCount: number;
  acceptanceRatePercent: number; // (acceptedCount / totalEligibleQuotes) * 100
  acceptedValueBDT: number;
}

/**
 * Payments, Collections, Failures & Refunds Structure
 * Note: Avoids double-counting by strictly segregating:
 * - Collected Payments (SUCCEEDED)
 * - Processed/Completed Refunds (Deducted from net collections)
 * - Pending/Failed Attempts
 * - Outstanding/Uncollected balances on active orders
 */
export interface FinancialCollectionsReport {
  dateRange: { from: string; to: string };
  grossPaymentsCollectedBDT: number; // Sum of Payment records with status = SUCCEEDED
  totalRefundsProcessedBDT: number; // Sum of Refund records with status = COMPLETED or APPROVED
  netCollectionsBDT: number; // grossPaymentsCollectedBDT - totalRefundsProcessedBDT
  totalOutstandingOrdersBDT: number; // Sum of (totalAmountBDT - paidAmountBDT) for active, unpaid orders in range
  paymentMethodBreakdown: Array<{
    method: string;
    successfulCount: number;
    successfulAmountBDT: number;
    failedCount: number;
  }>;
  refundsBreakdown: {
    completedCount: number;
    completedAmountBDT: number;
    pendingCount: number;
    pendingAmountBDT: number;
  };
  totalFailedPaymentsCount: number;
}

/**
 * Wallet Liability Report Structure
 * Formulated directly from WalletLedgerEntry immutable double-entry ledger:
 * Total Liability = SUM(Ledger Credits) - SUM(Ledger Debits)
 * Verified against SUM(WalletAccount.balance)
 */
export interface WalletLiabilityReport {
  asOfTimestamp: string;
  totalWalletsCount: number;
  activeWalletsCount: number;
  totalLedgerLiabilityBDT: number; // Derived purely from SUM(ledger entry amounts)
  totalAccountBalancesBDT: number; // Checksum from WalletAccount cached balance
  isReconciled: boolean;
  reconciliationDiscrepancyBDT: number;
  ledgerActivitySummary: {
    totalCreditsBDT: number;
    totalCreditsCount: number;
    totalDebitsBDT: number;
    totalDebitsCount: number;
    topupCreditsBDT: number;
    refundCreditsBDT: number;
    orderPaymentDebitsBDT: number;
    adminAdjustmentsBDT: number;
  };
}

/**
 * Procurement & Logistics Performance Report Structure
 */
export interface LogisticsPerformanceReport {
  dateRange: { from: string; to: string };
  totalProcurementRecords: number;
  procurementStatusBreakdown: Array<{
    status: string;
    count: number;
    totalCostMYR: number;
    totalCostBDT: number;
  }>;
  totalShipments: number;
  deliveredShipmentsCount: number;
  delayedShipmentsCount: number;
  inTransitShipmentsCount: number;
  averageDeliveryDays: number | null; // From actualDeparture to actualArrival
  carrierBreakdown: Array<{
    carrierName: string;
    shipmentCount: number;
    delayedCount: number;
    deliveredCount: number;
  }>;
}

/**
 * Inquiry Volume & Funnel Conversion Report Structure
 */
export interface InquiryConversionReport {
  dateRange: { from: string; to: string };
  totalInquiriesSubmitted: number;
  inquiriesQuotedCount: number;
  inquiriesAcceptedQuoteCount: number;
  inquiriesConvertedToOrderCount: number;
  conversionInquiryToQuotePercent: number; // (inquiriesQuotedCount / totalInquiries) * 100
  conversionQuoteToAcceptedPercent: number; // (inquiriesAcceptedQuoteCount / inquiriesQuotedCount) * 100
  overallFunnelConversionPercent: number; // (inquiriesConvertedToOrderCount / totalInquiries) * 100
  inquiryStatusBreakdown: Array<{
    status: string;
    count: number;
  }>;
}

/**
 * Complete Master Operational Report
 */
export interface MasterOperationalReport {
  generatedAt: string;
  dateRange: { from: string; to: string };
  ordersReport: OrdersByStatusReport;
  quotesReport: QuotesPerformanceReport;
  financialReport: FinancialCollectionsReport;
  walletReport: WalletLiabilityReport;
  logisticsReport: LogisticsPerformanceReport;
  inquiryReport: InquiryConversionReport;
}
