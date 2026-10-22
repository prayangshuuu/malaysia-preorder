import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import { Prisma, PaymentStatus, OrderStatus, WalletLedgerEntryType, RefundStatus } from "@prisma/client";
import { prisma, pool } from "../lib/prisma";
import {
  bdtToMinorUnits,
  minorUnitsToBDT,
  postLedgerEntry,
  getOrCreateWalletAccount,
  reconcileWallet,
  creditWalletFromVerifiedPayment,
  payOrderWithWallet,
  refundOrderToWallet,
  WalletError,
} from "../lib/wallet";

test("Minor units conversion utility enforces integer math precision", () => {
  assert.equal(bdtToMinorUnits(100), 10000);
  assert.equal(bdtToMinorUnits("100.50"), 10050);
  assert.equal(bdtToMinorUnits("0.05"), 5);
  assert.equal(bdtToMinorUnits(new Prisma.Decimal("1234.56")), 123456);

  assert.equal(minorUnitsToBDT(10000), "100.00");
  assert.equal(minorUnitsToBDT(10050), "100.50");
  assert.equal(minorUnitsToBDT(5), "0.05");
  assert.equal(minorUnitsToBDT(123456), "1234.56");

  assert.throws(() => minorUnitsToBDT(12.34));
});

test("Wallet Lifecycle: Account Creation and Zero Balance Invariant", async () => {
  const email = `wallet-user-${Date.now()}@example.com`;
  const user = await prisma.user.create({
    data: {
      name: "Wallet Tester",
      email,
      role: "CUSTOMER",
    },
  });

  const wallet = await getOrCreateWalletAccount(user.id);
  assert.ok(wallet.id);
  assert.equal(Number(wallet.balance), 0);
  assert.equal(wallet.currency, "BDT");

  // Reconcile on empty wallet
  const initialRecon = await reconcileWallet(wallet.id);
  assert.equal(initialRecon.isConsistent, true);
  assert.equal(initialRecon.cachedBalanceMinorUnits, 0);
  assert.equal(initialRecon.computedLedgerSumMinorUnits, 0);
  assert.equal(initialRecon.totalEntriesCount, 0);
});

test("Ledger Idempotency: Duplicate idempotency key does not create duplicate entries", async () => {
  const email = `idempotency-user-${Date.now()}@example.com`;
  const user = await prisma.user.create({
    data: {
      name: "Idempotent User",
      email,
      role: "CUSTOMER",
    },
  });

  const wallet = await getOrCreateWalletAccount(user.id);
  const idempotencyKey = `topup-test-${crypto.randomUUID()}`;

  // First credit: ৳1,000.00 (100,000 minor units)
  const firstResult = await postLedgerEntry({
    walletId: wallet.id,
    entryType: WalletLedgerEntryType.TOP_UP,
    amountMinorUnits: 100000,
    idempotencyKey,
    referenceNote: "First top-up attempt",
  });

  assert.equal(firstResult.isDuplicate, false);
  assert.equal(firstResult.walletBalanceBDT, "1000.00");
  assert.equal(firstResult.entry.balanceAfterBDT, "1000.00");

  // Repeated identical request
  const secondResult = await postLedgerEntry({
    walletId: wallet.id,
    entryType: WalletLedgerEntryType.TOP_UP,
    amountMinorUnits: 100000,
    idempotencyKey,
    referenceNote: "Duplicate request retry",
  });

  assert.equal(secondResult.isDuplicate, true);
  assert.equal(secondResult.entry.id, firstResult.entry.id);
  assert.equal(secondResult.walletBalanceBDT, "1000.00");

  // Verify only 1 entry exists in ledger
  const count = await prisma.walletLedgerEntry.count({
    where: { walletId: wallet.id },
  });
  assert.equal(count, 1);

  // Reconciliation check
  const recon = await reconcileWallet(wallet.id);
  assert.equal(recon.isConsistent, true);
  assert.equal(recon.computedLedgerSumBDT, "1000.00");
  assert.equal(recon.cachedBalanceBDT, "1000.00");
});

test("Insufficient Balance Protection: Rejects debit when balance is insufficient", async () => {
  const email = `low-balance-${Date.now()}@example.com`;
  const user = await prisma.user.create({
    data: {
      name: "Low Balance User",
      email,
      role: "CUSTOMER",
    },
  });

  const wallet = await getOrCreateWalletAccount(user.id);

  // Attempt to debit ৳500 from empty wallet
  await assert.rejects(
    async () => {
      await postLedgerEntry({
        walletId: wallet.id,
        entryType: WalletLedgerEntryType.ORDER_PAYMENT,
        amountMinorUnits: -50000,
        idempotencyKey: `debit-fail-${crypto.randomUUID()}`,
        referenceNote: "Order debit should fail",
      });
    },
    (err: unknown) => {
      return (
        err instanceof WalletError &&
        err.code === "INSUFFICIENT_FUNDS" &&
        err.message.includes("Insufficient wallet balance")
      );
    }
  );

  // Balance remains 0
  const refreshed = await prisma.walletAccount.findUniqueOrThrow({
    where: { id: wallet.id },
  });
  assert.equal(Number(refreshed.balance), 0);
});

test("Concurrency Safety: Concurrent debits prevent double-spending race conditions", async () => {
  const email = `concurrent-user-${Date.now()}@example.com`;
  const user = await prisma.user.create({
    data: {
      name: "Concurrent User",
      email,
      role: "CUSTOMER",
    },
  });

  const wallet = await getOrCreateWalletAccount(user.id);

  // Fund wallet with exactly ৳1,000.00 (100,000 minor units)
  await postLedgerEntry({
    walletId: wallet.id,
    entryType: WalletLedgerEntryType.TOP_UP,
    amountMinorUnits: 100000,
    idempotencyKey: `fund-concurrency-${crypto.randomUUID()}`,
    referenceNote: "Initial funding",
  });

  // Launch 5 parallel debits of ৳400.00 each
  // Only 2 should succeed (400 + 400 = 800 <= 1000), the others must fail with INSUFFICIENT_FUNDS
  const debitPromises = Array.from({ length: 5 }, (_, i) =>
    postLedgerEntry({
      walletId: wallet.id,
      entryType: WalletLedgerEntryType.ORDER_PAYMENT,
      amountMinorUnits: -40000,
      idempotencyKey: `concurrency-debit-${i}-${crypto.randomUUID()}`,
      referenceNote: `Concurrent debit attempt #${i}`,
    })
      .then((res) => ({ success: true, res }))
      .catch((err) => ({ success: false, err }))
  );

  const results = await Promise.all(debitPromises);
  const successes = results.filter((r) => r.success);
  const failures = results.filter((r) => !r.success);

  assert.equal(successes.length, 2, "Exactly 2 debits must succeed");
  assert.equal(failures.length, 3, "Exactly 3 debits must be rejected");

  for (const failure of failures) {
    if ("err" in failure) {
      assert.ok(
        (failure.err as WalletError).code === "INSUFFICIENT_FUNDS" ||
          String(failure.err).includes("wallet_balance_non_negative")
      );
    }
  }

  // Final balance must be exactly ৳200.00 (1000 - 400*2 = 200)
  const finalWallet = await prisma.walletAccount.findUniqueOrThrow({
    where: { id: wallet.id },
  });
  assert.equal(Number(finalWallet.balance), 200);

  // Total ledger sum must match cached balance perfectly
  const recon = await reconcileWallet(wallet.id);
  assert.equal(recon.isConsistent, true);
  assert.equal(recon.computedLedgerSumBDT, "200.00");
  assert.equal(recon.cachedBalanceBDT, "200.00");
});

test("Top-Up Security: Unverified payment cannot credit wallet", async () => {
  const email = `unverified-test-${Date.now()}@example.com`;
  const user = await prisma.user.create({
    data: {
      name: "Unverified Tester",
      email,
      role: "CUSTOMER",
    },
  });

  const order = await prisma.order.create({
    data: {
      orderNumber: `ORD-TEST-${Date.now().toString().slice(-6)}`,
      customerId: user.id,
      currency: "BDT",
      itemsSubtotalBDT: new Prisma.Decimal("500.00"),
      totalAmountBDT: new Prisma.Decimal("500.00"),
      shippingRecipientName: user.name,
      shippingPhoneNumber: "01700000000",
      shippingStreetAddress: "123 Dhaka",
      shippingDistrict: "Dhaka",
      shippingDivision: "Dhaka",
      status: "AWAITING_PAYMENT",
      paymentStatus: "PENDING",
    },
  });

  // Create PENDING payment
  const pendingPayment = await prisma.payment.create({
    data: {
      paymentNumber: `PAY-PENDING-${Date.now().toString().slice(-6)}`,
      orderId: order.id,
      method: "BKASH",
      status: PaymentStatus.PENDING,
      amount: new Prisma.Decimal("500.00"),
      currency: "BDT",
    },
  });

  // Attempt to credit wallet from pending payment -> MUST FAIL
  await assert.rejects(
    async () => {
      await creditWalletFromVerifiedPayment({
        paymentId: pendingPayment.id,
      });
    },
    (err: unknown) => {
      return (
        err instanceof WalletError &&
        err.code === "UNVERIFIED_PAYMENT" &&
        err.message.includes("Cannot credit wallet from unverified payment")
      );
    }
  );

  // Mark payment as SUCCEEDED (verified by payment subsystem)
  await prisma.payment.update({
    where: { id: pendingPayment.id },
    data: {
      status: PaymentStatus.SUCCEEDED,
      verifiedAt: new Date(),
    },
  });

  // Now credit wallet -> MUST SUCCEED
  const creditRes = await creditWalletFromVerifiedPayment({
    paymentId: pendingPayment.id,
  });

  assert.equal(creditRes.isDuplicate, false);
  assert.equal(creditRes.walletBalanceBDT, "500.00");

  // Reconcile
  const recon = await reconcileWallet(creditRes.entry.walletId);
  assert.equal(recon.isConsistent, true);
  assert.equal(recon.computedLedgerSumBDT, "500.00");
});

test("Order Payment with Wallet & Compensating Order Refund Invariant", async () => {
  const email = `order-pay-${Date.now()}@example.com`;
  const user = await prisma.user.create({
    data: {
      name: "Buyer",
      email,
      role: "CUSTOMER",
    },
  });

  const wallet = await getOrCreateWalletAccount(user.id);

  // 1. Initial Verified Top-Up of ৳3,000.00
  await postLedgerEntry({
    walletId: wallet.id,
    entryType: WalletLedgerEntryType.TOP_UP,
    amountMinorUnits: 300000,
    idempotencyKey: `topup-buyer-${crypto.randomUUID()}`,
    referenceNote: "Initial wallet top up",
  });

  // 2. Create Order for ৳1,200.00
  const order = await prisma.order.create({
    data: {
      orderNumber: `ORD-BUY-${Date.now().toString().slice(-6)}`,
      customerId: user.id,
      currency: "BDT",
      itemsSubtotalBDT: new Prisma.Decimal("1200.00"),
      totalAmountBDT: new Prisma.Decimal("1200.00"),
      shippingRecipientName: user.name,
      shippingPhoneNumber: "01711111111",
      shippingStreetAddress: "456 Banani, Dhaka",
      shippingDistrict: "Dhaka",
      shippingDivision: "Dhaka",
      status: OrderStatus.AWAITING_PAYMENT,
      paymentStatus: PaymentStatus.PENDING,
    },
  });

  // 3. Pay for order using customer wallet
  const payResult = await payOrderWithWallet({
    orderId: order.id,
    userId: user.id,
    idempotencyKey: `pay-order-${order.id}`,
  });

  assert.equal(payResult.success, true);
  assert.equal(payResult.walletBalanceBDT, "1800.00"); // 3000 - 1200 = 1800

  // Verify order transitioned to PAID
  const paidOrder = await prisma.order.findUniqueOrThrow({
    where: { id: order.id },
  });
  assert.equal(paidOrder.status, OrderStatus.PAID);
  assert.equal(paidOrder.paymentStatus, PaymentStatus.SUCCEEDED);

  // 4. Duplicate payment attempt with same idempotency key
  const duplicatePayResult = await payOrderWithWallet({
    orderId: order.id,
    userId: user.id,
    idempotencyKey: `pay-order-${order.id}`,
  });
  assert.equal(duplicatePayResult.isDuplicate, true);
  assert.equal(duplicatePayResult.walletBalanceBDT, "1800.00");

  // 5. Customer initiates cancellation and refund of ৳1,200.00 back to wallet
  const refund = await prisma.refund.create({
    data: {
      refundNumber: `REF-${Date.now().toString().slice(-6)}`,
      orderId: order.id,
      amount: new Prisma.Decimal("1200.00"),
      currency: "BDT",
      status: RefundStatus.PENDING,
      reason: "Item out of stock in Malaysia, full refund granted",
    },
  });

  const refundResult = await refundOrderToWallet({
    refundId: refund.id,
    actorId: "admin-staff-1",
    actorRole: "FINANCE",
    actorEmail: "finance@preorder.bd",
  });

  assert.equal(refundResult.success, true);
  assert.equal(refundResult.walletBalanceBDT, "3000.00"); // 1800 + 1200 = 3000 restored!

  // Check that historical ledger entries were NEVER mutated or deleted
  const allEntries = await prisma.walletLedgerEntry.findMany({
    where: { walletId: wallet.id },
    orderBy: { createdAt: "asc" },
  });

  assert.equal(allEntries.length, 3, "Exactly 3 append-only entries exist");
  assert.equal(allEntries[0].entryType, WalletLedgerEntryType.TOP_UP);
  assert.equal(allEntries[0].amount.toFixed(2), "3000.00");

  assert.equal(allEntries[1].entryType, WalletLedgerEntryType.ORDER_PAYMENT);
  assert.equal(allEntries[1].amount.toFixed(2), "-1200.00");

  assert.equal(allEntries[2].entryType, WalletLedgerEntryType.ORDER_REFUND);
  assert.equal(allEntries[2].amount.toFixed(2), "1200.00");

  // Reconcile complete audit trail
  const recon = await reconcileWallet(wallet.id);
  assert.equal(recon.isConsistent, true);
  assert.equal(recon.cachedBalanceBDT, "3000.00");
  assert.equal(recon.computedLedgerSumBDT, "3000.00");
  assert.equal(recon.discrepancyMinorUnits, 0);
});
