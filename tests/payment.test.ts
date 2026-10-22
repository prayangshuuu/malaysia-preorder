import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import { PaymentStatus, OrderStatus } from "@prisma/client";
import {
  SafeDevPaymentAdapter,
  BkashPaymentProvider,
  SSLCommerzPaymentProvider,
  sanitizePayload,
  reconcileAmounts,
  processVerifiedWebhookEvent,
} from "../lib/payments";
import { prisma, pool } from "../lib/prisma";

// Test mock secret
const TEST_DEV_SECRET = "dev-safe-test-secret-never-use-in-prod";

test("Payload Sanitizer strips CVV, card numbers, passwords and API keys", () => {
  const sensitiveInput = {
    cardNumber: "4111 2222 3333 4444",
    cvv: "123",
    app_secret: "super-secret-key-999",
    password: "UserPlainPassword!",
    nested: {
      card_number: "5500000000000004",
      security_code: "999",
      safeField: "Customer note about product",
    },
    remarks: "Paid using card 4242424242424242 securely",
  };

  const sanitized = sanitizePayload(sensitiveInput) as typeof sensitiveInput;

  assert.equal(sanitized.cardNumber, "[REDACTED]");
  assert.equal(sanitized.cvv, "[REDACTED]");
  assert.equal(sanitized.app_secret, "[REDACTED]");
  assert.equal(sanitized.password, "[REDACTED]");
  assert.equal(sanitized.nested.card_number, "[REDACTED]");
  assert.equal(sanitized.nested.security_code, "[REDACTED]");
  assert.equal(sanitized.nested.safeField, "Customer note about product");
  // Embedded card in freeform text string is redacted
  assert.ok(sanitized.remarks.includes("[REDACTED_CARD]"));
});

test("Provider Configuration State detects missing credentials cleanly", () => {
  const bkash = new BkashPaymentProvider();
  const bkashConfig = bkash.getConfigState();
  assert.equal(bkashConfig.providerName, "bkash");
  assert.equal(bkashConfig.isConfigured, false);
  assert.ok(bkashConfig.missingKeys.length > 0);

  const ssl = new SSLCommerzPaymentProvider();
  const sslConfig = ssl.getConfigState();
  assert.equal(sslConfig.providerName, "sslcommerz");
  assert.equal(sslConfig.isConfigured, false);
  assert.ok(sslConfig.missingKeys.length > 0);

  const devSafe = new SafeDevPaymentAdapter(TEST_DEV_SECRET);
  const devConfig = devSafe.getConfigState();
  assert.equal(devConfig.providerName, "dev-safe-adapter");
  assert.equal(devConfig.isConfigured, true);
  assert.equal(devConfig.environment, "development_mock");
});

test("Reconcile Amounts detects currency and amount discrepancies accurately", () => {
  // 1. Exact match
  const match = reconcileAmounts({
    expectedAmount: 1500.50,
    actualAmount: 1500.50,
    expectedCurrency: "BDT",
    actualCurrency: "BDT",
  });
  assert.equal(match.isMatch, true);

  // 2. Minor rounding match within 0.009
  const minorRounding = reconcileAmounts({
    expectedAmount: 1500.50,
    actualAmount: 1500.504,
    expectedCurrency: "BDT",
    actualCurrency: "BDT",
  });
  assert.equal(minorRounding.isMatch, true);

  // 3. Amount mismatch
  const mismatchAmount = reconcileAmounts({
    expectedAmount: 1500.00,
    actualAmount: 1200.00,
    expectedCurrency: "BDT",
    actualCurrency: "BDT",
  });
  assert.equal(mismatchAmount.isMatch, false);
  assert.ok(mismatchAmount.reason?.includes("Amount mismatch"));

  // 4. Currency mismatch
  const mismatchCurrency = reconcileAmounts({
    expectedAmount: 1500.00,
    actualAmount: 1500.00,
    expectedCurrency: "BDT",
    actualCurrency: "MYR",
  });
  assert.equal(mismatchCurrency.isMatch, false);
  assert.ok(mismatchCurrency.reason?.includes("Currency mismatch"));
});

test("DevSafeAdapter Webhook Signature Verification and Rejection", async () => {
  const devSafe = new SafeDevPaymentAdapter(TEST_DEV_SECRET);
  const validPayload = JSON.stringify({
    eventId: "EVT-TEST-001",
    eventType: "payment.succeeded",
    orderNumber: "ORD-TEST-999",
    amount: 2500.00,
    currency: "BDT",
    providerTrxId: "DEV-TRX-12345",
  });

  const validHmac = crypto
    .createHmac("sha256", TEST_DEV_SECRET)
    .update(validPayload)
    .digest("hex");

  // A. Valid signature
  const validResult = await devSafe.verifyWebhook({
    rawBody: validPayload,
    headers: { "x-dev-signature": validHmac },
  });
  assert.equal(validResult.isValidSignature, true);
  assert.equal(validResult.eventId, "EVT-TEST-001");
  assert.equal(validResult.status, PaymentStatus.SUCCEEDED);

  // B. Invalid signature (tampered signature)
  const invalidResult = await devSafe.verifyWebhook({
    rawBody: validPayload,
    headers: { "x-dev-signature": "badc0ffee" + validHmac.slice(9) },
  });
  assert.equal(invalidResult.isValidSignature, false);
  assert.ok(invalidResult.rejectionReason?.includes("signature verification failed"));

  // C. Missing signature header
  const missingHeaderResult = await devSafe.verifyWebhook({
    rawBody: validPayload,
    headers: {},
  });
  assert.equal(missingHeaderResult.isValidSignature, false);
  assert.ok(missingHeaderResult.rejectionReason?.includes("Missing signature header"));
});

test("Payment Initiation produces safe development mock with required informational warnings", async () => {
  const devSafe = new SafeDevPaymentAdapter(TEST_DEV_SECRET);
  const initiation = await devSafe.initiatePayment({
    orderId: "ord_dummy_123",
    orderNumber: "ORD-9999",
    amountBDT: 3400.00,
    currency: "BDT",
    customer: {
      id: "usr_123",
      name: "Tariqul Islam",
      email: "tariq@example.com",
    },
    returnUrl: "http://localhost:3000/orders/ord_dummy_123",
    cancelUrl: "http://localhost:3000/orders/ord_dummy_123?cancelled=true",
    idempotencyKey: "test-idempotency-key-01",
  });

  assert.equal(initiation.success, true);
  assert.equal(initiation.status, PaymentStatus.REQUIRES_ACTION);
  assert.ok(initiation.paymentId?.startsWith("DEV-MOCK-ORD-9999-"));
  assert.ok(initiation.redirectUrl?.includes("informational_only=true"));
  assert.ok(
    String(initiation.actionDetails?.note).includes("CANNOT PROCESS REAL FUNDS")
  );
});

test("Database Lifecycle: State Transitions, Idempotency, and Audit Log Trail", async () => {
  // Create test customer & order
  const uniqueSuffix = Date.now().toString().slice(-6);
  const testUser = await prisma.user.create({
    data: {
      email: `payment-tester-${uniqueSuffix}@example.com`,
      name: "Payment Tester",
    },
  });

  const testOrder = await prisma.order.create({
    data: {
      orderNumber: `ORD-TEST-${uniqueSuffix}`,
      customerId: testUser.id,
      currency: "BDT",
      itemsSubtotalBDT: 5000.00,
      totalAmountBDT: 5000.00,
      shippingRecipientName: "Payment Tester",
      shippingPhoneNumber: "01700000000",
      shippingStreetAddress: "Gulshan 2, Dhaka",
      shippingDistrict: "Dhaka",
      shippingDivision: "Dhaka",
      status: OrderStatus.AWAITING_PAYMENT,
      paymentStatus: PaymentStatus.PENDING,
    },
  });

  try {
    const eventId = `EVT-TEST-${uniqueSuffix}`;
    const devSafe = new SafeDevPaymentAdapter(TEST_DEV_SECRET);

    // 1. Process Succeeded Payment Webhook
    const payload = JSON.stringify({
      eventId,
      eventType: "payment.succeeded",
      orderId: testOrder.id,
      orderNumber: testOrder.orderNumber,
      amount: 5000.00,
      currency: "BDT",
      providerTrxId: `TRX-TEST-${uniqueSuffix}`,
    });

    const parsedEvent = await devSafe.verifyWebhook({
      rawBody: payload,
      headers: {
        "x-dev-signature": crypto
          .createHmac("sha256", TEST_DEV_SECRET)
          .update(payload)
          .digest("hex"),
      },
    });

    const processResult = await processVerifiedWebhookEvent(parsedEvent);
    assert.equal(processResult.success, true);
    assert.equal(processResult.duplicate, false);
    assert.equal(processResult.status, PaymentStatus.SUCCEEDED);

    // Verify order and payment updated in DB
    const updatedOrder = await prisma.order.findUnique({
      where: { id: testOrder.id },
      include: { payments: true, statusHistory: true, events: true },
    });
    assert.ok(updatedOrder);
    assert.equal(updatedOrder.status, OrderStatus.PAID);
    assert.equal(updatedOrder.paymentStatus, PaymentStatus.SUCCEEDED);
    assert.equal(Number(updatedOrder.paidAmountBDT), 5000.00);

    // Verify payment record
    assert.equal(updatedOrder.payments.length, 1);
    assert.equal(updatedOrder.payments[0].status, PaymentStatus.SUCCEEDED);
    assert.equal(updatedOrder.payments[0].providerTrxId, `TRX-TEST-${uniqueSuffix}`);

    // Verify audit log created
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        entityId: updatedOrder.payments[0].id,
      },
    });
    assert.ok(auditLogs.length > 0);
    assert.equal(auditLogs[0].action, "PAYMENT_SUCCEEDED");

    // 2. Duplicate / Replay webhook attempt should be detected and idempotently ignored
    const duplicateResult = await processVerifiedWebhookEvent(parsedEvent);
    assert.equal(duplicateResult.success, true);
    assert.equal(duplicateResult.duplicate, true);
    assert.ok(duplicateResult.message.includes("Duplicate webhook event already processed"));

    // 3. Reconcile mismatch attempt on another event (Wrong Amount)
    const mismatchEventId = `EVT-MISMATCH-${uniqueSuffix}`;
    const mismatchPayload = JSON.stringify({
      eventId: mismatchEventId,
      eventType: "payment.succeeded",
      orderId: testOrder.id,
      orderNumber: testOrder.orderNumber,
      amount: 1000.00, // Should be 5000.00
      currency: "BDT",
      providerTrxId: `TRX-WRONG-${uniqueSuffix}`,
    });

    const mismatchParsed = await devSafe.verifyWebhook({
      rawBody: mismatchPayload,
      headers: {
        "x-dev-signature": crypto
          .createHmac("sha256", TEST_DEV_SECRET)
          .update(mismatchPayload)
          .digest("hex"),
      },
    });

    const mismatchResult = await processVerifiedWebhookEvent(mismatchParsed);
    assert.equal(mismatchResult.success, false);
    assert.equal(mismatchResult.status, PaymentStatus.FAILED);
    assert.ok(mismatchResult.reconciliationError?.includes("Amount mismatch"));
  } finally {
    // Cleanup test data safely
    await prisma.paymentAttempt.deleteMany({
      where: { payment: { orderId: testOrder.id } },
    });
    await prisma.payment.deleteMany({ where: { orderId: testOrder.id } });
    await prisma.orderEvent.deleteMany({ where: { orderId: testOrder.id } });
    await prisma.orderStatusHistory.deleteMany({ where: { orderId: testOrder.id } });
    await prisma.auditLog.deleteMany({
      where: {
        entityType: { in: ["Order", "Payment"] },
        entityId: testOrder.id,
      },
    });
    await prisma.webhookEvent.deleteMany({
      where: { eventId: { contains: uniqueSuffix } },
    });
    await prisma.order.delete({ where: { id: testOrder.id } });
    await prisma.user.delete({ where: { id: testUser.id } });
    await prisma.$disconnect();
    await pool.end();
  }
});
