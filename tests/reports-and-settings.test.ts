import test from "node:test";
import assert from "node:assert/strict";
import {
  businessSettingsSchema,
  DEFAULT_BUSINESS_SETTINGS,
  getBusinessSettings,
  updateBusinessSettings,
  SettingsServiceError,
} from "../lib/settings";
import {
  parseDateBoundaries,
  getOrdersByStatusReport,
  getQuotesPerformanceReport,
  getFinancialCollectionsReport,
  getWalletLiabilityReport,
  getLogisticsPerformanceReport,
  getInquiryConversionReport,
  getMasterOperationalReport,
  generateOperationalReportCSV,
} from "../lib/reports";
import { prisma, pool } from "../lib/prisma";
import {
  OrderStatus,
  QuoteStatus,
  PaymentStatus,
  PaymentMethodType,
  ShipmentStatus,
  WalletLedgerEntryType,
} from "@prisma/client";

test("Business Settings Schema validates valid settings and rejects invalid structures", () => {
  // 1. Default settings pass validation
  const valid = businessSettingsSchema.safeParse(DEFAULT_BUSINESS_SETTINGS);
  assert.equal(valid.success, true);

  // 2. Invalid email rejected
  const invalidEmail = businessSettingsSchema.safeParse({
    ...DEFAULT_BUSINESS_SETTINGS,
    supportEmail: "not-an-email",
  });
  assert.equal(invalidEmail.success, false);

  // 3. Negative validity days rejected
  const invalidValidity = businessSettingsSchema.safeParse({
    ...DEFAULT_BUSINESS_SETTINGS,
    quoteDefaultValidityDays: -5,
  });
  assert.equal(invalidValidity.success, false);

  // 4. Empty shipping options rejected
  const emptyShipping = businessSettingsSchema.safeParse({
    ...DEFAULT_BUSINESS_SETTINGS,
    shippingOptions: [],
  });
  assert.equal(emptyShipping.success, false);
});

test("Date boundary parser assigns start-of-day and end-of-day correctly", () => {
  const boundaries = parseDateBoundaries("2026-05-10", "2026-05-20");
  assert.equal(boundaries.from.toISOString().slice(0, 10), "2026-05-10");
  assert.equal(boundaries.from.getUTCHours(), 0);
  assert.equal(boundaries.from.getUTCMinutes(), 0);

  assert.equal(boundaries.to.toISOString().slice(0, 10), "2026-05-20");
  assert.equal(boundaries.to.getUTCHours(), 23);
  assert.equal(boundaries.to.getUTCMinutes(), 59);

  // Defaults when dates omitted
  const defaultBoundaries = parseDateBoundaries(null, null);
  assert.ok(defaultBoundaries.from < defaultBoundaries.to);
});

test("Settings Service updates database and generates audit log", async () => {
  const uniqueId = Date.now().toString().slice(-6);
  // Create test admin user in DB so foreign key constraint succeeds
  const adminUser = await prisma.user.create({
    data: {
      email: `admin-actor-${uniqueId}@test.local`,
      name: "Admin Tester",
      role: "ADMIN",
    },
  });

  const actor = {
    id: adminUser.id,
    email: adminUser.email,
    role: "ADMIN",
  };

  const updatedSettings = {
    ...DEFAULT_BUSINESS_SETTINGS,
    companyName: "Malaysia Direct BD - Tested Trade Name",
    quoteDefaultValidityDays: 10,
  };

  try {
    const result = await updateBusinessSettings(updatedSettings, actor, {
      ipAddress: "127.0.0.1",
      userAgent: "UnitTestRunner/1.0",
    });

    assert.equal(result.companyName, "Malaysia Direct BD - Tested Trade Name");
    assert.equal(result.quoteDefaultValidityDays, 10);

    // Verify DB read
    const fetched = await getBusinessSettings();
    assert.equal(fetched.companyName, "Malaysia Direct BD - Tested Trade Name");

    // Verify Audit Log entry created
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        action: "SETTINGS_UPDATED",
        actorId: adminUser.id,
      },
      orderBy: { createdAt: "desc" },
      take: 1,
    });
    assert.ok(auditLogs.length > 0);
    assert.equal(auditLogs[0].actorRole, "ADMIN");
    assert.equal(auditLogs[0].entityType, "CompanySetting");
  } finally {
    await prisma.auditLog.deleteMany({ where: { actorId: adminUser.id } });
    await prisma.user.delete({ where: { id: adminUser.id } });
  }
});

test("Operational Reports: Accurate Database Aggregations without Double-Counting", async () => {
  const uniqueId = Date.now().toString().slice(-6);

  // Create isolated test fixtures: Customer, Inquiry, Quote, Order, Payment, Refund, Wallet
  const customer = await prisma.user.create({
    data: {
      email: `report-test-${uniqueId}@example.com`,
      name: "Report Test Customer",
    },
  });

  const inquiry = await prisma.productInquiry.create({
    data: {
      inquiryNumber: `INQ-REP-${uniqueId}`,
      userId: customer.id,
      productName: "Test Report Item",
      quantityRequested: 2,
    },
  });

  const quote = await prisma.quote.create({
    data: {
      quoteNumber: `QUO-REP-${uniqueId}`,
      version: 1,
      inquiryId: inquiry.id,
      createdById: customer.id,
      status: QuoteStatus.ACCEPTED,
      validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      currency: "BDT",
      itemsSubtotalBDT: 3000,
      totalAmountBDT: 3500,
      serviceFeeBDT: 500,
    },
  });

  const order = await prisma.order.create({
    data: {
      orderNumber: `ORD-REP-${uniqueId}`,
      customerId: customer.id,
      quoteId: quote.id,
      status: OrderStatus.PAID,
      paymentStatus: PaymentStatus.SUCCEEDED,
      currency: "BDT",
      itemsSubtotalBDT: 3000,
      totalAmountBDT: 3500,
      paidAmountBDT: 3500,
      shippingRecipientName: "Report Customer",
      shippingPhoneNumber: "01700000000",
      shippingStreetAddress: "Dhanmondi, Dhaka",
      shippingDistrict: "Dhaka",
      shippingDivision: "Dhaka",
    },
  });

  const payment = await prisma.payment.create({
    data: {
      paymentNumber: `PAY-REP-${uniqueId}`,
      orderId: order.id,
      method: PaymentMethodType.BKASH,
      status: PaymentStatus.SUCCEEDED,
      currency: "BDT",
      amount: 3500,
      providerTrxId: `TRX-REP-${uniqueId}`,
    },
  });

  const refund = await prisma.refund.create({
    data: {
      refundNumber: `REF-REP-${uniqueId}`,
      orderId: order.id,
      paymentId: payment.id,
      amount: 500,
      currency: "BDT",
      status: "COMPLETED",
      reason: "Partial adjustment for slight box dent",
    },
  });

  // Wallet and double-entry ledger entries
  const wallet = await prisma.walletAccount.create({
    data: {
      userId: customer.id,
      currency: "BDT",
      balance: 1000,
      isActive: true,
    },
  });

  const topupLedger = await prisma.walletLedgerEntry.create({
    data: {
      walletId: wallet.id,
      entryType: WalletLedgerEntryType.TOP_UP,
      amount: 1500,
      balanceAfter: 1500,
      currency: "BDT",
      idempotencyKey: `LEDGER-TOPUP-${uniqueId}`,
      referenceNote: "Direct topup via bank",
    },
  });

  const spendLedger = await prisma.walletLedgerEntry.create({
    data: {
      walletId: wallet.id,
      entryType: WalletLedgerEntryType.ORDER_PAYMENT,
      amount: -500,
      balanceAfter: 1000,
      currency: "BDT",
      idempotencyKey: `LEDGER-SPEND-${uniqueId}`,
      referenceNote: "Order spend test",
    },
  });

  try {
    const todayStr = new Date().toISOString().slice(0, 10);

    // 1. Orders Report
    const ordersReport = await getOrdersByStatusReport(todayStr, todayStr);
    assert.ok(ordersReport.totalOrdersCount >= 1);
    assert.ok(ordersReport.totalAgreedValueBDT >= 3500);

    // 2. Quotes Report
    const quotesReport = await getQuotesPerformanceReport(todayStr, todayStr);
    assert.ok(quotesReport.totalQuotesIssued >= 1);
    assert.ok(quotesReport.acceptedCount >= 1);
    assert.ok(quotesReport.acceptanceRatePercent > 0);

    // 3. Financial Collections Report
    const financialReport = await getFinancialCollectionsReport(todayStr, todayStr);
    assert.ok(financialReport.grossPaymentsCollectedBDT >= 3500);
    assert.ok(financialReport.totalRefundsProcessedBDT >= 500);
    // Verified Net collections formula: Gross - Refunds
    assert.equal(
      financialReport.netCollectionsBDT,
      financialReport.grossPaymentsCollectedBDT - financialReport.totalRefundsProcessedBDT
    );

    // 4. Wallet Liability Report
    const walletReport = await getWalletLiabilityReport();
    assert.ok(walletReport.totalWalletsCount >= 1);
    // Derives from SUM(ledger credits - debits)
    assert.ok(walletReport.totalLedgerLiabilityBDT >= 1000);
    assert.equal(walletReport.isReconciled, true);
    assert.equal(walletReport.reconciliationDiscrepancyBDT, 0);

    // 5. Inquiries & Funnel Report
    const inqReport = await getInquiryConversionReport(todayStr, todayStr);
    assert.ok(inqReport.totalInquiriesSubmitted >= 1);
    assert.ok(inqReport.inquiriesQuotedCount >= 1);
    assert.ok(inqReport.inquiriesAcceptedQuoteCount >= 1);

    // 6. Master Report & CSV Export
    const masterReport = await getMasterOperationalReport(todayStr, todayStr);
    assert.ok(masterReport.ordersReport);
    assert.ok(masterReport.financialReport);
    assert.ok(masterReport.walletReport);

    const csv = generateOperationalReportCSV(masterReport);
    assert.ok(csv.includes("Report Name"));
    assert.ok(csv.includes("Gross Collections"));
    assert.ok(csv.includes("Total Wallet Liability"));
    assert.ok(csv.includes("ORDERS SUMMARY BY STATUS"));
  } finally {
    // Teardown test fixtures
    await prisma.walletLedgerEntry.deleteMany({ where: { walletId: wallet.id } });
    await prisma.walletAccount.delete({ where: { id: wallet.id } });
    await prisma.refund.delete({ where: { id: refund.id } });
    await prisma.payment.delete({ where: { id: payment.id } });
    await prisma.order.delete({ where: { id: order.id } });
    await prisma.quote.delete({ where: { id: quote.id } });
    await prisma.productInquiry.delete({ where: { id: inquiry.id } });
    await prisma.user.delete({ where: { id: customer.id } });
    await prisma.$disconnect();
    await pool.end();
  }
});
