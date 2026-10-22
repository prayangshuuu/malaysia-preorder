import { MasterOperationalReport } from "./types";

/**
 * Escapes CSV cell value to prevent injection and quoting issues
 */
function escapeCsvValue(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Generates safely formatted, strictly typed CSV export of operational reports.
 */
export function generateOperationalReportCSV(report: MasterOperationalReport): string {
  const lines: string[] = [];

  // Metadata Header
  lines.push(`"Report Name","Malaysia Pre-Order Operations & Financial Summary"`);
  lines.push(`"Generated At",${escapeCsvValue(report.generatedAt)}`);
  lines.push(`"Date Range From",${escapeCsvValue(report.dateRange.from)}`);
  lines.push(`"Date Range To",${escapeCsvValue(report.dateRange.to)}`);
  lines.push("");

  // SECTION 1: FINANCIAL & COLLECTIONS SUMMARY
  lines.push(`"--- FINANCIAL COLLECTIONS & LIABILITIES ---"`);
  lines.push(`"Metric","Amount (BDT)","Details"`);
  lines.push(
    `"Gross Collections",${report.financialReport.grossPaymentsCollectedBDT},"Verified customer payments received"`
  );
  lines.push(
    `"Refunds Processed",${report.financialReport.totalRefundsProcessedBDT},"Completed/approved return payouts"`
  );
  lines.push(
    `"Net Collections",${report.financialReport.netCollectionsBDT},"Gross Collections minus Processed Refunds"`
  );
  lines.push(
    `"Active Orders Outstanding",${report.financialReport.totalOutstandingOrdersBDT},"Uncollected balance on active orders"`
  );
  lines.push(
    `"Total Wallet Liability",${report.walletReport.totalLedgerLiabilityBDT},"Sum of immutable ledger credits minus debits"`
  );
  lines.push(
    `"Wallet Reconciled Status",${escapeCsvValue(
      report.walletReport.isReconciled ? "RECONCILED" : "DISCREPANCY"
    )},${escapeCsvValue("Discrepancy: " + report.walletReport.reconciliationDiscrepancyBDT + " BDT")}`
  );
  lines.push("");

  // SECTION 2: ORDERS BY STATUS
  lines.push(`"--- ORDERS SUMMARY BY STATUS ---"`);
  lines.push(`"Status","Order Count","Total Value (BDT)","Percentage"`);
  for (const item of report.ordersReport.statusBreakdown) {
    lines.push(
      `${escapeCsvValue(item.status)},${item.count},${item.totalAmountBDT},${escapeCsvValue(
        item.percentageOfTotal + "%"
      )}`
    );
  }
  lines.push(
    `"TOTAL ORDERS",${report.ordersReport.totalOrdersCount},${report.ordersReport.totalAgreedValueBDT},"100%"`
  );
  lines.push("");

  // SECTION 3: QUOTES LIFECYCLE
  lines.push(`"--- QUOTES LIFECYCLE & ACCEPTANCE ---"`);
  lines.push(`"Metric","Count","Value (BDT)"`);
  lines.push(`"Total Issued",${report.quotesReport.totalQuotesIssued},${report.quotesReport.totalQuotedValueBDT}`);
  lines.push(`"Accepted Quotes",${report.quotesReport.acceptedCount},${report.quotesReport.acceptedValueBDT}`);
  lines.push(`"Quoted (Active)",${report.quotesReport.quotedCount},"N/A"`);
  lines.push(`"Expired Quotes",${report.quotesReport.expiredCount},"N/A"`);
  lines.push(`"Rejected Quotes",${report.quotesReport.rejectedCount},"N/A"`);
  lines.push(`"Superseded Quotes",${report.quotesReport.supersededCount},"N/A"`);
  lines.push(
    `"Acceptance Rate",${escapeCsvValue(report.quotesReport.acceptanceRatePercent + "%")},"Based on decided quotes"`
  );
  lines.push("");

  // SECTION 4: INQUIRIES & CONVERSION FUNNEL
  lines.push(`"--- INQUIRIES & CONVERSION FUNNEL ---"`);
  lines.push(`"Funnel Stage","Volume","Conversion Rate"`);
  lines.push(`"Total Inquiries Submitted",${report.inquiryReport.totalInquiriesSubmitted},"100%"`);
  lines.push(
    `"Inquiries Quoted",${report.inquiryReport.inquiriesQuotedCount},${escapeCsvValue(
      report.inquiryReport.conversionInquiryToQuotePercent + "%"
    )}`
  );
  lines.push(
    `"Inquiries with Accepted Quote",${report.inquiryReport.inquiriesAcceptedQuoteCount},${escapeCsvValue(
      report.inquiryReport.conversionQuoteToAcceptedPercent + "% (of quoted)"
    )}`
  );
  lines.push(
    `"Inquiries Converted to Order",${report.inquiryReport.inquiriesConvertedToOrderCount},${escapeCsvValue(
      report.inquiryReport.overallFunnelConversionPercent + "% (overall)"
    )}`
  );
  lines.push("");

  // SECTION 5: LOGISTICS & SHIPMENTS
  lines.push(`"--- LOGISTICS & SHIPPING PERFORMANCE ---"`);
  lines.push(`"Metric","Value"`);
  lines.push(`"Total Shipments",${report.logisticsReport.totalShipments}`);
  lines.push(`"Delivered Shipments",${report.logisticsReport.deliveredShipmentsCount}`);
  lines.push(`"Delayed Shipments",${report.logisticsReport.delayedShipmentsCount}`);
  lines.push(`"In Transit Shipments",${report.logisticsReport.inTransitShipmentsCount}`);
  lines.push(
    `"Average Delivery Days",${escapeCsvValue(
      report.logisticsReport.averageDeliveryDays !== null
        ? `${report.logisticsReport.averageDeliveryDays} days`
        : "Pending delivery data"
    )}`
  );
  lines.push("");

  return lines.join("\n");
}
