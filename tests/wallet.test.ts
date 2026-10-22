import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import { Prisma, WalletLedgerEntryType, OrderStatus, PaymentStatus, RefundStatus } from "@prisma/client";
import { prisma, pool } from "../lib/prisma";
import {
  bdtToMinorUnits,
  minorUnitsToBDT,
  getOrCreateWalletAccount,
  postLedgerEntry,
  reconcileWallet,
  payOrderWithWallet,
  creditWalletFromVerifiedPayment,
  refundOrderToWallet,
  WalletError,
} from "../lib/wallet";

// Helper to generate unique identifiers
const uid = () => `test_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;

test("Monetary Minor Units Invariants: bdtToMinorUnits and minorUnitsToBDT", () => {
  assert.equal(bdtToMinorUnits(100), 10000);
  assert.equal(bdtToMinorUnits(150.5), 15050);
  assert.equal(bdtToMinorUnits("2499.99"), 249999);
  assert.equal(bdtToMinorUnits(0), 0);

  assert.equal(minorUnitsToBDT(10000), "100.00");
  assert.equal(minorUnitsToBDT(15050), "150.50");
  assert.equal(minorUnitsToBDT(249999), "2499.99");
  assert.equal(minorUnitsToBDT(-5000), "-50.00");

  assert.throws(() => bdtToMinorUnits("invalid-num"), /Invalid monetary amount/);
  assert.throws(() => minorUnitsToBDT(12.34), /Minor units must be an integer/);
});

test("Wallet Lifecycle: Account creation and Ledger Balance Invariant Reconciles Perfectly", async () => {
  const suffix = uid();
  const testUser = await prisma.user.create({
    data: {
      email: `${suffix}@example.com`,
      name: "Wallet Invariant User",
    },
  });

  try {
    const wallet = await getOrCreateWalletAccount(testUser.id);
    assert.ok(wallet.id);
    assert.equal(Number(wallet.balance), 0);

    // Initial reconciliation
    const initialReport = await reconcileWallet(wallet.id);
    assert.equal(initialReport.isConsistent, true);
    assert.equal(initialReport.cachedBalanceMinorUnits, 0);
    assert.equal(initialReport.computedLedgerSumMinorUnits, 0);
    assert.equal(initialReport.discrepancyMinorUnits, 0);

    // 1. Credit 500.00 BDT
    const credit1 = await postLedgerEntry({
      walletId: wallet.id,
      entryType: WalletLedgerEntryType.TOP_UP,
      amountMinorUnits: 50000, // +500.00 BDT
      idempotencyKey: `idemp-credit-1-${suffix}`,
      referenceNote: "Test Credit #1",
      actorId: testUser.id,
    });

    assert.equal(credit1.isDuplicate, false);
    assert.equal(credit1.walletBalanceBDT, "500.00");
    assert.equal(credit1.entry.amountMinorUnits, 50000);
    assert.equal(credit1.entry.balanceAfterMinorUnits, 50000);

    // 2. Credit another 250.50 BDT
    const credit2 = await postLedgerEntry({
      walletId: wallet.id,
      entryType: WalletLedgerEntryType.ADJUSTMENT_CREDIT,
      amountMinorUnits: 25050, // +250.50 BDT
      idempotencyKey: `idemp-credit-2-${suffix}`,
      referenceNote: "Test Credit #2",
      actorId: testUser.id,
    });

    assert.equal(credit2.walletBalanceBDT, "750.50");

    // 3. Debit 150.50 BDT
    const debit1 = await postLedgerEntry({
      walletId: wallet.id,
      entryType: WalletLedgerEntryType.ORDER_PAYMENT,
      amountMinorUnits: -15050, // -150.50 BDT
      idempotencyKey: `idemp-debit-1-${suffix}`,
      referenceNote: "Test Debit #1",
      actorId: testUser.id,
    });

    assert.equal(debit1.walletBalanceBDT, "600.00");
    assert.equal(debit1.entry.amountMinorUnits, -15050);
    assert.equal(debit1.entry.balanceAfterMinorUnits, 60000);

    // Verify Invariant: Cached balance matches sum(ledger) perfectly
    const reconciled = await reconcileWallet(wallet.id);
    assert.equal(reconciled.isConsistent, true);
    assert.equal(reconciled.cachedBalanceMinorUnits, 60000);
    assert.equal(reconciled.computedLedgerSumMinorUnits, 60000);
    assert.equal(reconciled.cachedBalanceBDT, "600.00");
    assert.equal(reconciled.totalEntriesCount, 3);
    assert.equal(reconciled.discrepancyMinorUnits, 0);
  } finally {
    await prisma.walletLedgerEntry.deleteMany({ where: { wallet: { userId: testUser.id } } });
    await prisma.walletAccount.deleteMany({ where: { userId: testUser.id } });
    await prisma.user.delete({ where: { id: testUser.id } });
  }
});

test("Duplicate Idempotency Keys are strictly prevented / safely returned without double-crediting", async () => {
  const suffix = uid();
  const testUser = await prisma.user.create({
    data: {
      email: `${suffix}@example.com`,
      name: "Wallet Idempotency User",
    },
  });

  try {
    const wallet = await getOrCreateWalletAccount(testUser.id);
    const key = `idemp-duplicate-${suffix}`;

    // First call
    const call1 = await postLedgerEntry({
      walletId: wallet.id,
      entryType: WalletLedgerEntryType.TOP_UP,
      amountMinorUnits: 30000,
      idempotencyKey: key,
      referenceNote: "Initial top-up call",
      actorId: testUser.id,
    });

    assert.equal(call1.isDuplicate, false);
    assert.equal(call1.walletBalanceBDT, "300.00");

    // Second call with same idempotency key
    const call2 = await postLedgerEntry({
      walletId: wallet.id,
      entryType: WalletLedgerEntryType.TOP_UP,
      amountMinorUnits: 30000,
      idempotencyKey: key,
      referenceNote: "Duplicate top-up call",
      actorId: testUser.id,
    });

    assert.equal(call2.isDuplicate, true);
    assert.equal(call2.walletBalanceBDT, "300.00");
    assert.equal(call2.entry.id, call1.entry.id);

    // Ensure only 1 ledger entry exists in database
    const entriesCount = await prisma.walletLedgerEntry.count({
      where: { walletId: wallet.id },
    });
    assert.equal(entriesCount, 1);

    // Verify balance is still 300.00 and not 600.00
    const checkWallet = await prisma.walletAccount.findUniqueOrThrow({
      where: { id: wallet.id },
    });
    assert.equal(Number(checkWallet.balance), 300.00);
  } finally {
    await prisma.walletLedgerEntry.deleteMany({ where: { wallet: { userId: testUser.id } } });
    await prisma.walletAccount.deleteMany({ where: { userId: testUser.id } });
    await prisma.user.delete({ where: { id: testUser.id } });
  }
});

test("Insufficient Balance check strictly blocks debit and prevents balance from going negative", async () => {
  const suffix = uid();
  const testUser = await prisma.user.create({
    data: {
      email: `${suffix}@example.com`,
      name: "Wallet Insufficient Funds User",
    },
  });

  try {
    const wallet = await getOrCreateWalletAccount(testUser.id);

    // Initial balance is 0. Attempt debit of 100.00 BDT
    await assert.rejects(
      async () => {
        await postLedgerEntry({
          walletId: wallet.id,
          entryType: WalletLedgerEntryType.ORDER_PAYMENT,
          amountMinorUnits: -10000, // -100.00 BDT
          idempotencyKey: `idemp-fail-debit-${suffix}`,
          referenceNote: "Should fail insufficient funds",
          actorId: testUser.id,
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof WalletError);
        assert.equal(err.code, "INSUFFICIENT_FUNDS");
        assert.match(err.message, /Insufficient wallet balance/);
        return true;
      }
    );

    // Ensure balance remains 0
    const checkWallet = await prisma.walletAccount.findUniqueOrThrow({
      where: { id: wallet.id },
    });
    assert.equal(Number(checkWallet.balance), 0);
  } finally {
    await prisma.walletAccount.deleteMany({ where: { userId: testUser.id } });
    await prisma.user.delete({ where: { id: testUser.id } });
  }
});

test("Verified Top-Up Credits: Posted only after verified payment confirmation (rejects unverified)", async () => {
  const suffix = uid();
  const testUser = await prisma.user.create({
    data: {
      email: `${suffix}@example.com`,
      name: "Verified TopUp User",
    },
  });

  const testOrder = await prisma.order.create({
    data: {
      orderNumber: `ORD-TOPUP-${suffix}`,
      customerId: testUser.id,
      currency: "BDT",
      itemsSubtotalBDT: 1500.0,
      totalAmountBDT: 1500.0,
      shippingRecipientName: "Wallet User",
      shippingPhoneNumber: "01700000000",
      shippingStreetAddress: "Wallet Topup",
      shippingDistrict: "Dhaka",
      shippingDivision: "Dhaka",
      status: OrderStatus.AWAITING_PAYMENT,
      paymentStatus: PaymentStatus.PENDING,
    },
  });

  const pendingPayment = await prisma.payment.create({
    data: {
      paymentNumber: `PAY-TOPUP-${suffix}`,
      orderId: testOrder.id,
      method: "MANUAL_VERIFICATION",
      status: PaymentStatus.PENDING, // Unverified
      currency: "BDT",
      amount: new Prisma.Decimal(1500.0),
    },
  });

  try {
    // 1. Unverified payment must be rejected
    await assert.rejects(
      async () => {
        await creditWalletFromVerifiedPayment({
          paymentId: pendingPayment.id,
          actorId: "SYSTEM",
        });
      },
      (err: unknown) => {
        assert.ok(err instanceof WalletError);
        assert.equal(err.code, "UNVERIFIED_PAYMENT");
        return true;
      }
    );

    // 2. Mark payment as SUCCEEDED
    await prisma.payment.update({
      where: { id: pendingPayment.id },
      data: { status: PaymentStatus.SUCCEEDED },
    });

    // 3. Verified top-up succeeds
    const topUpResult = await creditWalletFromVerifiedPayment({
      paymentId: pendingPayment.id,
      actorId: "SYSTEM",
    });

    assert.equal(topUpResult.isDuplicate, false);
    assert.equal(topUpResult.walletBalanceBDT, "1500.00");

    // 4. Calling again is idempotent
    const repeatResult = await creditWalletFromVerifiedPayment({
      paymentId: pendingPayment.id,
      actorId: "SYSTEM",
    });
    assert.equal(repeatResult.isDuplicate, true);
    assert.equal(repeatResult.walletBalanceBDT, "1500.00");
  } finally {
    await prisma.walletLedgerEntry.deleteMany({ where: { wallet: { userId: testUser.id } } });
    await prisma.walletAccount.deleteMany({ where: { userId: testUser.id } });
    await prisma.payment.deleteMany({ where: { orderId: testOrder.id } });
    await prisma.order.delete({ where: { id: testOrder.id } });
    await prisma.user.delete({ where: { id: testUser.id } });
  }
});

test("Order Debit with Wallet: Atomic debit, sufficient balance check, transitions order to PAID", async () => {
  const suffix = uid();
  const testUser = await prisma.user.create({
    data: {
      email: `${suffix}@example.com`,
      name: "Order Pay User",
    },
  });

  const wallet = await getOrCreateWalletAccount(testUser.id);
  // Fund wallet with 2000.00 BDT
  await postLedgerEntry({
    walletId: wallet.id,
    entryType: WalletLedgerEntryType.TOP_UP,
    amountMinorUnits: 200000,
    idempotencyKey: `seed-fund-${suffix}`,
    referenceNote: "Seed funding for order checkout",
    actorId: testUser.id,
  });

  const order = await prisma.order.create({
    data: {
      orderNumber: `ORD-BUY-${suffix}`,
      customerId: testUser.id,
      currency: "BDT",
      itemsSubtotalBDT: 1200.0,
      totalAmountBDT: 1200.0,
      shippingRecipientName: "Order Buyer",
      shippingPhoneNumber: "01711111111",
      shippingStreetAddress: "Banani, Dhaka",
      shippingDistrict: "Dhaka",
      shippingDivision: "Dhaka",
      status: OrderStatus.AWAITING_PAYMENT,
      paymentStatus: PaymentStatus.PENDING,
    },
  });

  try {
    // Pay order using wallet
    const payResult = await payOrderWithWallet({
      orderId: order.id,
      userId: testUser.id,
      idempotencyKey: `pay-order-wlt-${suffix}`,
    });

    assert.equal(payResult.success, true);
    assert.equal(payResult.walletBalanceBDT, "800.00"); // 2000 - 1200 = 800

    // Verify order transitioned to PAID
    const updatedOrder = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { payments: true, events: true, statusHistory: true },
    });

    assert.equal(updatedOrder.status, OrderStatus.PAID);
    assert.equal(updatedOrder.paymentStatus, PaymentStatus.SUCCEEDED);
    assert.equal(Number(updatedOrder.paidAmountBDT), 1200.0);
    assert.equal(updatedOrder.payments.length, 1);
    assert.equal(updatedOrder.payments[0].method, "WALLET");
    assert.equal(updatedOrder.payments[0].status, PaymentStatus.SUCCEEDED);

    // Repeat payment call with same idempotency key is idempotent
    const repeatPay = await payOrderWithWallet({
      orderId: order.id,
      userId: testUser.id,
      idempotencyKey: `pay-order-wlt-${suffix}`,
    });
    assert.equal(repeatPay.isDuplicate, true);
    assert.equal(repeatPay.walletBalanceBDT, "800.00");
  } finally {
    await prisma.walletLedgerEntry.deleteMany({ where: { wallet: { userId: testUser.id } } });
    await prisma.walletAccount.deleteMany({ where: { userId: testUser.id } });
    await prisma.orderStatusHistory.deleteMany({ where: { orderId: order.id } });
    await prisma.orderEvent.deleteMany({ where: { orderId: order.id } });
    await prisma.payment.deleteMany({ where: { orderId: order.id } });
    await prisma.order.delete({ where: { id: order.id } });
    await prisma.user.delete({ where: { id: testUser.id } });
  }
});

test("Refund to Wallet: Compensating entry appended, history never modified, order marked REFUNDED", async () => {
  const suffix = uid();
  const testUser = await prisma.user.create({
    data: {
      email: `${suffix}@example.com`,
      name: "Refund User",
    },
  });

  const wallet = await getOrCreateWalletAccount(testUser.id);

  const order = await prisma.order.create({
    data: {
      orderNumber: `ORD-REF-${suffix}`,
      customerId: testUser.id,
      currency: "BDT",
      itemsSubtotalBDT: 800.0,
      totalAmountBDT: 800.0,
      paidAmountBDT: 800.0,
      shippingRecipientName: "Refund Recipient",
      shippingPhoneNumber: "01722222222",
      shippingStreetAddress: "Dhanmondi, Dhaka",
      shippingDistrict: "Dhaka",
      shippingDivision: "Dhaka",
      status: OrderStatus.PAID,
      paymentStatus: PaymentStatus.SUCCEEDED,
    },
  });

  const refund = await prisma.refund.create({
    data: {
      refundNumber: `REF-${suffix}`,
      orderId: order.id,
      amount: new Prisma.Decimal(800.0),
      currency: "BDT",
      status: RefundStatus.PENDING,
      reason: "Item out of stock in Malaysia supplier",
    },
  });

  try {
    const refundResult = await refundOrderToWallet({
      refundId: refund.id,
      actorId: "admin_test",
      actorRole: "ADMIN",
      actorEmail: "admin@preorder.bd",
    });

    assert.equal(refundResult.success, true);
    assert.equal(refundResult.walletBalanceBDT, "800.00");

    // Verify refund completed
    const updatedRefund = await prisma.refund.findUniqueOrThrow({
      where: { id: refund.id },
      include: { walletLedgerEntry: true },
    });
    assert.equal(updatedRefund.status, RefundStatus.COMPLETED);
    assert.ok(updatedRefund.walletLedgerEntry);
    assert.equal(updatedRefund.walletLedgerEntry.entryType, WalletLedgerEntryType.ORDER_REFUND);
    assert.equal(Number(updatedRefund.walletLedgerEntry.amount), 800.0);

    // Verify order updated
    const updatedOrder = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
    });
    assert.equal(updatedOrder.status, OrderStatus.REFUNDED);
    assert.equal(updatedOrder.paymentStatus, PaymentStatus.REFUNDED);

    // Calling again returns duplicate idempotent response
    const repeatRefund = await refundOrderToWallet({
      refundId: refund.id,
      actorId: "admin_test",
      actorRole: "ADMIN",
    });
    assert.equal(repeatRefund.isDuplicate, true);
  } finally {
    await prisma.walletLedgerEntry.deleteMany({ where: { wallet: { userId: testUser.id } } });
    await prisma.walletAccount.deleteMany({ where: { userId: testUser.id } });
    await prisma.refund.deleteMany({ where: { orderId: order.id } });
    await prisma.orderEvent.deleteMany({ where: { orderId: order.id } });
    await prisma.order.delete({ where: { id: order.id } });
    await prisma.user.delete({ where: { id: testUser.id } });
  }
});

test("Concurrency & Race Defense: Concurrent debits cannot double-spend", async () => {
  const suffix = uid();
  const testUser = await prisma.user.create({
    data: {
      email: `${suffix}@example.com`,
      name: "Race Defense User",
    },
  });

  try {
    const wallet = await getOrCreateWalletAccount(testUser.id);

    // Credit exactly 1000.00 BDT
    await postLedgerEntry({
      walletId: wallet.id,
      entryType: WalletLedgerEntryType.TOP_UP,
      amountMinorUnits: 100000, // 1000.00 BDT
      idempotencyKey: `idemp-race-seed-${suffix}`,
      referenceNote: "Seed 1000 BDT for race test",
      actorId: testUser.id,
    });

    // Fire 2 concurrent debit requests of 700.00 BDT each.
    // Together they require 1400.00 BDT, which exceeds the 1000.00 BDT balance.
    // Exactly ONE MUST SUCCEED, and the other MUST FAIL with INSUFFICIENT_FUNDS.
    const results = await Promise.allSettled([
      postLedgerEntry({
        walletId: wallet.id,
        entryType: WalletLedgerEntryType.ORDER_PAYMENT,
        amountMinorUnits: -70000, // -700.00 BDT
        idempotencyKey: `idemp-race-debit-A-${suffix}`,
        referenceNote: "Debit attempt A",
        actorId: testUser.id,
      }),
      postLedgerEntry({
        walletId: wallet.id,
        entryType: WalletLedgerEntryType.ORDER_PAYMENT,
        amountMinorUnits: -70000, // -700.00 BDT
        idempotencyKey: `idemp-race-debit-B-${suffix}`,
        referenceNote: "Debit attempt B",
        actorId: testUser.id,
      }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    assert.equal(fulfilled.length, 1, "Exactly one debit attempt must succeed");
    assert.equal(rejected.length, 1, "Exactly one debit attempt must be rejected");

    const rejectionReason = (rejected[0] as PromiseRejectedResult).reason;
    assert.ok(rejectionReason instanceof WalletError);
    assert.equal(rejectionReason.code, "INSUFFICIENT_FUNDS");

    // Invariant check: Remaining balance must be exactly 300.00 BDT (1000 - 700)
    const finalReport = await reconcileWallet(wallet.id);
    assert.equal(finalReport.isConsistent, true);
    assert.equal(finalReport.cachedBalanceBDT, "300.00");
    assert.equal(finalReport.computedLedgerSumBDT, "300.00");
    assert.equal(finalReport.discrepancyMinorUnits, 0);
  } finally {
    await prisma.walletLedgerEntry.deleteMany({ where: { wallet: { userId: testUser.id } } });
    await prisma.walletAccount.deleteMany({ where: { userId: testUser.id } });
    await prisma.user.delete({ where: { id: testUser.id } });
    await prisma.$disconnect();
    await pool.end();
  }
});
