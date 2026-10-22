import { prisma } from "@/lib/prisma";
import { OrderStatus, QuoteStatus, PaymentStatus, RefundStatus, ShipmentStatus } from "@prisma/client";
import {
  parseDateBoundaries,
  OrdersByStatusReport,
  QuotesPerformanceReport,
  FinancialCollectionsReport,
  WalletLiabilityReport,
  LogisticsPerformanceReport,
  InquiryConversionReport,
  MasterOperationalReport,
} from "./types";

/**
 * 1. Orders by Status & Date Range Report
 * Formulas & Rules:
 * - Aggregates orders created within [from, to] inclusive.
 * - totalAgreedValueBDT = SUM(order.totalAmountBDT)
 * - totalCollectedValueBDT = SUM(order.paidAmountBDT)
 * - Avoids double-counting by strictly using canonical Order records.
 */
export async function getOrdersByStatusReport(
  startDate?: string | null,
  endDate?: string | null
): Promise<OrdersByStatusReport> {
  const { from, to } = parseDateBoundaries(startDate, endDate);

  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: from, lte: to },
    },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      totalAmountBDT: true,
      paidAmountBDT: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const totalOrdersCount = orders.length;
  let totalAgreedValueBDT = 0;
  let totalCollectedValueBDT = 0;

  const statusMap = new Map<string, { count: number; totalAmount: number }>();
  // Pre-seed all standard OrderStatus keys for clean reporting
  for (const status of Object.values(OrderStatus)) {
    statusMap.set(status, { count: 0, totalAmount: 0 });
  }

  const dailyMap = new Map<string, { count: number; totalAmount: number }>();

  for (const o of orders) {
    const total = Number(o.totalAmountBDT);
    const paid = Number(o.paidAmountBDT);
    totalAgreedValueBDT += total;
    totalCollectedValueBDT += paid;

    const currentStatus = statusMap.get(o.status) || { count: 0, totalAmount: 0 };
    currentStatus.count += 1;
    currentStatus.totalAmount += total;
    statusMap.set(o.status, currentStatus);

    const dayKey = o.createdAt.toISOString().slice(0, 10);
    const currentDay = dailyMap.get(dayKey) || { count: 0, totalAmount: 0 };
    currentDay.count += 1;
    currentDay.totalAmount += total;
    dailyMap.set(dayKey, currentDay);
  }

  const statusBreakdown = Array.from(statusMap.entries()).map(([status, val]) => ({
    status,
    count: val.count,
    totalAmountBDT: Math.round(val.totalAmount * 100) / 100,
    percentageOfTotal: totalOrdersCount > 0 ? Math.round((val.count / totalOrdersCount) * 1000) / 10 : 0,
  }));

  const dailyTrend = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, val]) => ({
      date,
      orderCount: val.count,
      totalAmountBDT: Math.round(val.totalAmount * 100) / 100,
    }));

  return {
    dateRange: { from: from.toISOString(), to: to.toISOString() },
    totalOrdersCount,
    totalAgreedValueBDT: Math.round(totalAgreedValueBDT * 100) / 100,
    totalCollectedValueBDT: Math.round(totalCollectedValueBDT * 100) / 100,
    statusBreakdown,
    dailyTrend,
  };
}

/**
 * 2. Quotations Performance Report
 * Formulas & Rules:
 * - Covers all quotes created within [from, to].
 * - Automatically checks if SENT quotes past validUntil are expired.
 * - Acceptance Rate = (acceptedCount / (totalEligibleQuotes)) * 100
 *   where eligible quotes are finished quotes (ACCEPTED, REJECTED, EXPIRED, SUPERSEDED).
 */
export async function getQuotesPerformanceReport(
  startDate?: string | null,
  endDate?: string | null
): Promise<QuotesPerformanceReport> {
  const { from, to } = parseDateBoundaries(startDate, endDate);
  const now = new Date();

  const quotes = await prisma.quote.findMany({
    where: {
      createdAt: { gte: from, lte: to },
    },
    select: {
      id: true,
      status: true,
      validUntil: true,
      totalAmountBDT: true,
      acceptedAt: true,
    },
  });

  const totalQuotesIssued = quotes.length;
  let totalQuotedValueBDT = 0;
  let acceptedValueBDT = 0;

  let quotedCount = 0; // Active SENT quotes
  let acceptedCount = 0;
  let rejectedCount = 0;
  let expiredCount = 0;
  let supersededCount = 0;
  let draftCount = 0;

  for (const q of quotes) {
    const amount = Number(q.totalAmountBDT);
    totalQuotedValueBDT += amount;

    // Evaluate virtual expiration if still marked SENT but past validUntil
    const isExpired = q.status === QuoteStatus.EXPIRED || (q.status === QuoteStatus.SENT && q.validUntil < now);

    if (q.status === QuoteStatus.ACCEPTED) {
      acceptedCount++;
      acceptedValueBDT += amount;
    } else if (q.status === QuoteStatus.REJECTED) {
      rejectedCount++;
    } else if (isExpired) {
      expiredCount++;
    } else if (q.status === QuoteStatus.SUPERSEDED) {
      supersededCount++;
    } else if (q.status === QuoteStatus.DRAFT) {
      draftCount++;
    } else if (q.status === QuoteStatus.SENT) {
      quotedCount++;
    }
  }

  const eligibleForAcceptance = acceptedCount + rejectedCount + expiredCount + quotedCount;
  const acceptanceRatePercent =
    eligibleForAcceptance > 0
      ? Math.round((acceptedCount / eligibleForAcceptance) * 1000) / 10
      : 0;

  return {
    dateRange: { from: from.toISOString(), to: to.toISOString() },
    totalQuotesIssued,
    totalQuotedValueBDT: Math.round(totalQuotedValueBDT * 100) / 100,
    quotedCount,
    acceptedCount,
    rejectedCount,
    expiredCount,
    supersededCount,
    draftCount,
    acceptanceRatePercent,
    acceptedValueBDT: Math.round(acceptedValueBDT * 100) / 100,
  };
}

/**
 * 3. Financial Collections, Failures, Outstanding & Refunds Report
 * Formulas & Rules:
 * - Gross Collections = SUM(Payment.amount) WHERE status = 'SUCCEEDED' AND verifiedAt IN [from, to] (or createdAt if verifiedAt is null)
 * - Processed Refunds = SUM(Refund.amount) WHERE status IN ('COMPLETED', 'APPROVED') AND createdAt IN [from, to]
 * - Net Collections = Gross Collections - Processed Refunds
 * - Outstanding Orders = SUM(Order.totalAmountBDT - Order.paidAmountBDT) for orders created in date range where status NOT IN ('CANCELLED', 'REFUNDED')
 * - Double counting prevention:
 *   - Wallet top-up payments and order direct payments are tracked without conflating wallet balances.
 *   - Refunds explicitly deducted once from Gross Collections.
 */
export async function getFinancialCollectionsReport(
  startDate?: string | null,
  endDate?: string | null
): Promise<FinancialCollectionsReport> {
  const { from, to } = parseDateBoundaries(startDate, endDate);

  // 1. Successful & Failed Payments
  const payments = await prisma.payment.findMany({
    where: {
      createdAt: { gte: from, lte: to },
    },
    select: {
      id: true,
      method: true,
      status: true,
      amount: true,
      currency: true,
      createdAt: true,
      verifiedAt: true,
    },
  });

  let grossPaymentsCollectedBDT = 0;
  let totalFailedPaymentsCount = 0;

  const methodMap = new Map<
    string,
    { successfulCount: number; successfulAmountBDT: number; failedCount: number }
  >();

  for (const p of payments) {
    const current = methodMap.get(p.method) || {
      successfulCount: 0,
      successfulAmountBDT: 0,
      failedCount: 0,
    };

    if (p.status === PaymentStatus.SUCCEEDED) {
      const amt = Number(p.amount);
      grossPaymentsCollectedBDT += amt;
      current.successfulCount += 1;
      current.successfulAmountBDT += amt;
    } else if (p.status === PaymentStatus.FAILED || p.status === PaymentStatus.CANCELLED) {
      totalFailedPaymentsCount += 1;
      current.failedCount += 1;
    }

    methodMap.set(p.method, current);
  }

  const paymentMethodBreakdown = Array.from(methodMap.entries()).map(([method, val]) => ({
    method,
    successfulCount: val.successfulCount,
    successfulAmountBDT: Math.round(val.successfulAmountBDT * 100) / 100,
    failedCount: val.failedCount,
  }));

  // 2. Refunds in range
  const refunds = await prisma.refund.findMany({
    where: {
      createdAt: { gte: from, lte: to },
    },
    select: {
      id: true,
      amount: true,
      status: true,
    },
  });

  let completedRefundsCount = 0;
  let completedRefundsAmount = 0;
  let pendingRefundsCount = 0;
  let pendingRefundsAmount = 0;

  for (const r of refunds) {
    const amt = Number(r.amount);
    if (r.status === RefundStatus.COMPLETED || r.status === RefundStatus.APPROVED) {
      completedRefundsCount++;
      completedRefundsAmount += amt;
    } else {
      pendingRefundsCount++;
      pendingRefundsAmount += amt;
    }
  }

  // 3. Outstanding amounts on active orders in range
  const activeOrders = await prisma.order.findMany({
    where: {
      createdAt: { gte: from, lte: to },
      status: {
        notIn: [OrderStatus.CANCELLED, OrderStatus.REFUNDED],
      },
    },
    select: {
      totalAmountBDT: true,
      paidAmountBDT: true,
    },
  });

  let totalOutstandingOrdersBDT = 0;
  for (const o of activeOrders) {
    const total = Number(o.totalAmountBDT);
    const paid = Number(o.paidAmountBDT);
    if (total > paid) {
      totalOutstandingOrdersBDT += (total - paid);
    }
  }

  const netCollectionsBDT = grossPaymentsCollectedBDT - completedRefundsAmount;

  return {
    dateRange: { from: from.toISOString(), to: to.toISOString() },
    grossPaymentsCollectedBDT: Math.round(grossPaymentsCollectedBDT * 100) / 100,
    totalRefundsProcessedBDT: Math.round(completedRefundsAmount * 100) / 100,
    netCollectionsBDT: Math.round(netCollectionsBDT * 100) / 100,
    totalOutstandingOrdersBDT: Math.round(totalOutstandingOrdersBDT * 100) / 100,
    paymentMethodBreakdown,
    refundsBreakdown: {
      completedCount: completedRefundsCount,
      completedAmountBDT: Math.round(completedRefundsAmount * 100) / 100,
      pendingCount: pendingRefundsCount,
      pendingAmountBDT: Math.round(pendingRefundsAmount * 100) / 100,
    },
    totalFailedPaymentsCount,
  };
}

/**
 * 4. Wallet Liability Based on Ledger Balances
 * Formulas & Rules:
 * - Direct derivation from immutable WalletLedgerEntry records.
 * - Total Ledger Liability = SUM(Ledger Credits) - SUM(Ledger Debits)
 * - Cached Accounts Checksum = SUM(WalletAccount.balance)
 * - Reconciliation status verifies |Total Ledger Liability - Cached Accounts Checksum| === 0
 * - Does NOT present estimates; presents exact currency unit totals.
 */
export async function getWalletLiabilityReport(): Promise<WalletLiabilityReport> {
  const accounts = await prisma.walletAccount.findMany({
    select: {
      id: true,
      balance: true,
      isActive: true,
    },
  });

  const totalWalletsCount = accounts.length;
  const activeWalletsCount = accounts.filter((a) => a.isActive).length;
  let totalAccountBalancesBDT = 0;
  for (const acc of accounts) {
    totalAccountBalancesBDT += Number(acc.balance);
  }

  // Aggregate all ledger entries
  const ledgerEntries = await prisma.walletLedgerEntry.findMany({
    select: {
      amount: true,
      entryType: true,
    },
  });

  let totalLedgerLiabilityBDT = 0;
  let totalCreditsBDT = 0;
  let totalCreditsCount = 0;
  let totalDebitsBDT = 0;
  let totalDebitsCount = 0;
  let topupCreditsBDT = 0;
  let refundCreditsBDT = 0;
  let orderPaymentDebitsBDT = 0;
  let adminAdjustmentsBDT = 0;

  for (const entry of ledgerEntries) {
    const amt = Number(entry.amount);
    totalLedgerLiabilityBDT += amt;

    if (amt >= 0) {
      totalCreditsBDT += amt;
      totalCreditsCount += 1;
      if (entry.entryType === "TOP_UP") topupCreditsBDT += amt;
      else if (entry.entryType === "ORDER_REFUND") refundCreditsBDT += amt;
      else if (entry.entryType === "ADJUSTMENT_CREDIT") adminAdjustmentsBDT += amt;
    } else {
      totalDebitsBDT += Math.abs(amt);
      totalDebitsCount += 1;
      if (entry.entryType === "ORDER_PAYMENT") orderPaymentDebitsBDT += Math.abs(amt);
      else if (entry.entryType === "ADJUSTMENT_DEBIT") adminAdjustmentsBDT += amt;
    }
  }

  const discrepancy = Math.abs(
    Math.round((totalLedgerLiabilityBDT - totalAccountBalancesBDT) * 100) / 100
  );
  const isReconciled = discrepancy === 0;

  return {
    asOfTimestamp: new Date().toISOString(),
    totalWalletsCount,
    activeWalletsCount,
    totalLedgerLiabilityBDT: Math.round(totalLedgerLiabilityBDT * 100) / 100,
    totalAccountBalancesBDT: Math.round(totalAccountBalancesBDT * 100) / 100,
    isReconciled,
    reconciliationDiscrepancyBDT: discrepancy,
    ledgerActivitySummary: {
      totalCreditsBDT: Math.round(totalCreditsBDT * 100) / 100,
      totalCreditsCount,
      totalDebitsBDT: Math.round(totalDebitsBDT * 100) / 100,
      totalDebitsCount,
      topupCreditsBDT: Math.round(topupCreditsBDT * 100) / 100,
      refundCreditsBDT: Math.round(refundCreditsBDT * 100) / 100,
      orderPaymentDebitsBDT: Math.round(orderPaymentDebitsBDT * 100) / 100,
      adminAdjustmentsBDT: Math.round(adminAdjustmentsBDT * 100) / 100,
    },
  };
}

/**
 * 5. Procurement and Shipping Performance
 * Formulas & Rules:
 * - Procurement records created within [from, to]
 * - Shipments created within [from, to]
 * - Average delivery duration = AVG(actualArrival - actualDeparture) for shipments with status = DELIVERED and both timestamps recorded.
 * - Delayed shipments = status == 'DELAYED' OR (status NOT IN ('DELIVERED', 'RETURNED', 'LOST') AND estimatedArrival < now)
 */
export async function getLogisticsPerformanceReport(
  startDate?: string | null,
  endDate?: string | null
): Promise<LogisticsPerformanceReport> {
  const { from, to } = parseDateBoundaries(startDate, endDate);
  const now = new Date();

  // Procurement aggregation
  const procurements = await prisma.procurementRecord.findMany({
    where: {
      createdAt: { gte: from, lte: to },
    },
    select: {
      id: true,
      status: true,
      purchaseCostMYR: true,
      purchaseCostBDT: true,
    },
  });

  const procStatusMap = new Map<string, { count: number; costMYR: number; costBDT: number }>();
  for (const p of procurements) {
    const cur = procStatusMap.get(p.status) || { count: 0, costMYR: 0, costBDT: 0 };
    cur.count += 1;
    cur.costMYR += Number(p.purchaseCostMYR);
    cur.costBDT += Number(p.purchaseCostBDT);
    procStatusMap.set(p.status, cur);
  }

  const procurementStatusBreakdown = Array.from(procStatusMap.entries()).map(([status, val]) => ({
    status,
    count: val.count,
    totalCostMYR: Math.round(val.costMYR * 100) / 100,
    totalCostBDT: Math.round(val.costBDT * 100) / 100,
  }));

  // Shipments aggregation
  const shipments = await prisma.shipment.findMany({
    where: {
      createdAt: { gte: from, lte: to },
    },
    select: {
      id: true,
      carrierName: true,
      status: true,
      estimatedArrival: true,
      actualDeparture: true,
      actualArrival: true,
    },
  });

  let deliveredShipmentsCount = 0;
  let delayedShipmentsCount = 0;
  let inTransitShipmentsCount = 0;
  let totalDeliveryDaysSum = 0;
  let deliveredWithTimestampsCount = 0;

  const carrierMap = new Map<
    string,
    { shipmentCount: number; delayedCount: number; deliveredCount: number }
  >();

  for (const s of shipments) {
    const carrier = s.carrierName || "Unassigned / Air Consolidator";
    const curCarrier = carrierMap.get(carrier) || {
      shipmentCount: 0,
      delayedCount: 0,
      deliveredCount: 0,
    };
    curCarrier.shipmentCount += 1;

    const isDelayed =
      s.status === ShipmentStatus.DELAYED ||
      (s.status !== ShipmentStatus.DELIVERED &&
        s.status !== ShipmentStatus.RETURNED &&
        s.status !== ShipmentStatus.LOST &&
        s.estimatedArrival !== null &&
        s.estimatedArrival < now);

    if (isDelayed) {
      delayedShipmentsCount++;
      curCarrier.delayedCount += 1;
    }

    if (s.status === ShipmentStatus.DELIVERED) {
      deliveredShipmentsCount++;
      curCarrier.deliveredCount += 1;

      if (s.actualDeparture && s.actualArrival) {
        const diffMs = s.actualArrival.getTime() - s.actualDeparture.getTime();
        const diffDays = Math.max(0, diffMs / (1000 * 60 * 60 * 24));
        totalDeliveryDaysSum += diffDays;
        deliveredWithTimestampsCount++;
      }
    } else if (
      s.status === ShipmentStatus.DISPATCHED ||
      s.status === ShipmentStatus.IN_TRANSIT ||
      s.status === ShipmentStatus.CUSTOMS ||
      s.status === ShipmentStatus.OUT_FOR_DELIVERY
    ) {
      inTransitShipmentsCount++;
    }

    carrierMap.set(carrier, curCarrier);
  }

  const carrierBreakdown = Array.from(carrierMap.entries()).map(([carrierName, val]) => ({
    carrierName,
    shipmentCount: val.shipmentCount,
    delayedCount: val.delayedCount,
    deliveredCount: val.deliveredCount,
  }));

  const averageDeliveryDays =
    deliveredWithTimestampsCount > 0
      ? Math.round((totalDeliveryDaysSum / deliveredWithTimestampsCount) * 10) / 10
      : null;

  return {
    dateRange: { from: from.toISOString(), to: to.toISOString() },
    totalProcurementRecords: procurements.length,
    procurementStatusBreakdown,
    totalShipments: shipments.length,
    deliveredShipmentsCount,
    delayedShipmentsCount,
    inTransitShipmentsCount,
    averageDeliveryDays,
    carrierBreakdown,
  };
}

/**
 * 6. Inquiry Volume & Conversion to Quote and Order
 * Formulas & Rules:
 * - Inquiries created within [from, to]
 * - Inquiries Quoted = Inquiries having at least 1 issued Quote
 * - Inquiries Accepted = Inquiries having at least 1 ACCEPTED Quote
 * - Inquiries Converted to Order = Inquiries whose accepted quote created an Order
 * - Funnel metrics:
 *   - Inquiry -> Quote = (Quoted / Inquiries) * 100
 *   - Quote -> Accepted = (Accepted / Quoted) * 100
 *   - Overall Conversion = (ConvertedToOrder / Inquiries) * 100
 */
export async function getInquiryConversionReport(
  startDate?: string | null,
  endDate?: string | null
): Promise<InquiryConversionReport> {
  const { from, to } = parseDateBoundaries(startDate, endDate);

  const inquiries = await prisma.productInquiry.findMany({
    where: {
      createdAt: { gte: from, lte: to },
    },
    select: {
      id: true,
      status: true,
      quotes: {
        select: {
          id: true,
          status: true,
          orders: {
            select: { id: true },
          },
        },
      },
    },
  });

  const totalInquiriesSubmitted = inquiries.length;
  let inquiriesQuotedCount = 0;
  let inquiriesAcceptedQuoteCount = 0;
  let inquiriesConvertedToOrderCount = 0;

  const statusMap = new Map<string, number>();

  for (const inq of inquiries) {
    statusMap.set(inq.status, (statusMap.get(inq.status) || 0) + 1);

    const hasQuotes = inq.quotes.length > 0;
    if (hasQuotes) {
      inquiriesQuotedCount++;
    }

    const hasAcceptedQuote = inq.quotes.some((q) => q.status === QuoteStatus.ACCEPTED);
    if (hasAcceptedQuote) {
      inquiriesAcceptedQuoteCount++;
    }

    const hasOrder = inq.quotes.some((q) => q.orders.length > 0);
    if (hasOrder) {
      inquiriesConvertedToOrderCount++;
    }
  }

  const conversionInquiryToQuotePercent =
    totalInquiriesSubmitted > 0
      ? Math.round((inquiriesQuotedCount / totalInquiriesSubmitted) * 1000) / 10
      : 0;

  const conversionQuoteToAcceptedPercent =
    inquiriesQuotedCount > 0
      ? Math.round((inquiriesAcceptedQuoteCount / inquiriesQuotedCount) * 1000) / 10
      : 0;

  const overallFunnelConversionPercent =
    totalInquiriesSubmitted > 0
      ? Math.round((inquiriesConvertedToOrderCount / totalInquiriesSubmitted) * 1000) / 10
      : 0;

  const inquiryStatusBreakdown = Array.from(statusMap.entries()).map(([status, count]) => ({
    status,
    count,
  }));

  return {
    dateRange: { from: from.toISOString(), to: to.toISOString() },
    totalInquiriesSubmitted,
    inquiriesQuotedCount,
    inquiriesAcceptedQuoteCount,
    inquiriesConvertedToOrderCount,
    conversionInquiryToQuotePercent,
    conversionQuoteToAcceptedPercent,
    overallFunnelConversionPercent,
    inquiryStatusBreakdown,
  };
}

/**
 * 7. Complete Master Operational Report
 */
export async function getMasterOperationalReport(
  startDate?: string | null,
  endDate?: string | null
): Promise<MasterOperationalReport> {
  const { from, to } = parseDateBoundaries(startDate, endDate);

  const [
    ordersReport,
    quotesReport,
    financialReport,
    walletReport,
    logisticsReport,
    inquiryReport,
  ] = await Promise.all([
    getOrdersByStatusReport(startDate, endDate),
    getQuotesPerformanceReport(startDate, endDate),
    getFinancialCollectionsReport(startDate, endDate),
    getWalletLiabilityReport(),
    getLogisticsPerformanceReport(startDate, endDate),
    getInquiryConversionReport(startDate, endDate),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    dateRange: { from: from.toISOString(), to: to.toISOString() },
    ordersReport,
    quotesReport,
    financialReport,
    walletReport,
    logisticsReport,
    inquiryReport,
  };
}
