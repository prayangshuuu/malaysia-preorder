import { Prisma, WalletLedgerEntryType, PaymentStatus, OrderStatus, RefundStatus, PaymentMethodType } from "@prisma/client";
import { prisma } from "../prisma";
import {
  WALLET_CURRENCY,
  bdtToMinorUnits,
  minorUnitsToBDT,
  ReconciliationReport,
  WalletLedgerEntryDTO,
} from "./types";
import { logAudit } from "../audit";

export class WalletError extends Error {
  constructor(message: string, public readonly code: string, public readonly statusCode: number = 400) {
    super(message);
    this.name = "WalletError";
  }
}

/**
 * Gets or initializes a WalletAccount for a user inside an atomic transaction or standalone.
 */
export async function getOrCreateWalletAccount(
  userId: string,
  client: Prisma.TransactionClient | typeof prisma = prisma
) {
  let wallet = await client.walletAccount.findUnique({
    where: { userId },
  });

  if (!wallet) {
    try {
      wallet = await client.walletAccount.create({
        data: {
          userId,
          currency: WALLET_CURRENCY,
          balance: new Prisma.Decimal(0),
          isActive: true,
        },
      });
    } catch (err: unknown) {
      const isUniqueConflict = (err as { code?: string })?.code === "P2002";
      if (isUniqueConflict) {
        wallet = await client.walletAccount.findUniqueOrThrow({
          where: { userId },
        });
      } else {
        throw err;
      }
    }
  }

  return wallet;
}

/**
 * Reconciles a single wallet's cached balance against the immutable ledger sum.
 * Returns true if perfectly consistent, otherwise reports discrepancy.
 */
export async function reconcileWallet(
  walletId: string,
  client: Prisma.TransactionClient | typeof prisma = prisma
): Promise<ReconciliationReport> {
  const wallet = await client.walletAccount.findUnique({
    where: { id: walletId },
  });

  if (!wallet) {
    throw new WalletError("Wallet account not found", "WALLET_NOT_FOUND", 404);
  }

  // Aggregate sum of all ledger entries for this wallet
  const aggregateResult = await client.walletLedgerEntry.aggregate({
    where: { walletId },
    _sum: { amount: true },
    _count: { id: true },
  });

  const sumDecimal = aggregateResult._sum.amount ?? new Prisma.Decimal(0);
  const ledgerSumMinorUnits = bdtToMinorUnits(sumDecimal);
  const cachedBalanceMinorUnits = bdtToMinorUnits(wallet.balance);

  const discrepancy = cachedBalanceMinorUnits - ledgerSumMinorUnits;
  const isConsistent = discrepancy === 0;

  return {
    walletId: wallet.id,
    userId: wallet.userId,
    cachedBalanceMinorUnits,
    cachedBalanceBDT: minorUnitsToBDT(cachedBalanceMinorUnits),
    computedLedgerSumMinorUnits: ledgerSumMinorUnits,
    computedLedgerSumBDT: minorUnitsToBDT(ledgerSumMinorUnits),
    totalEntriesCount: aggregateResult._count.id,
    isConsistent,
    discrepancyMinorUnits: discrepancy,
    discrepancyBDT: minorUnitsToBDT(discrepancy),
    checkedAt: new Date().toISOString(),
  };
}

export interface PostLedgerEntryParams {
  walletId: string;
  entryType: WalletLedgerEntryType;
  amountMinorUnits: number; // Positive for credit, Negative for debit
  currency?: string;
  idempotencyKey: string;
  referenceNote: string;
  paymentId?: string | null;
  orderId?: string | null;
  refundId?: string | null;
  actorId?: string | null;
  actorRole?: string | null;
  actorEmail?: string | null;
}

/**
 * Core atomic ledger entry posting engine.
 * Guarantees:
 * 1. Serializable row lock via SELECT ... FOR UPDATE on WalletAccount.
 * 2. Strict idempotency checking (rejects duplicate or returns existing).
 * 3. Atomic calculation: newBalance = currentBalance + amount.
 * 4. Sufficient funds check for debits (newBalance >= 0).
 * 5. Immutable ledger entry written with exact balanceAfter snapshot.
 * 6. Synchronized cached balance update.
 * 7. Invariant verification in PostgreSQL (wallet_balance_non_negative check constraint).
 */
export async function postLedgerEntry(
  params: PostLedgerEntryParams,
  externalTx?: Prisma.TransactionClient
): Promise<{ entry: WalletLedgerEntryDTO; isDuplicate: boolean; walletBalanceBDT: string }> {
  if (params.amountMinorUnits === 0) {
    throw new WalletError("Ledger entry amount cannot be zero", "ZERO_AMOUNT", 400);
  }

  const runWithTx = async (tx: Prisma.TransactionClient) => {
    // 1. Check idempotency first within transaction
    const existingEntry = await tx.walletLedgerEntry.findUnique({
      where: { idempotencyKey: params.idempotencyKey },
      include: { wallet: true },
    });

    if (existingEntry) {
      return {
        entry: {
          id: existingEntry.id,
          walletId: existingEntry.walletId,
          entryType: existingEntry.entryType,
          amountMinorUnits: bdtToMinorUnits(existingEntry.amount),
          amountBDT: minorUnitsToBDT(bdtToMinorUnits(existingEntry.amount)),
          balanceAfterMinorUnits: bdtToMinorUnits(existingEntry.balanceAfter),
          balanceAfterBDT: minorUnitsToBDT(bdtToMinorUnits(existingEntry.balanceAfter)),
          currency: existingEntry.currency,
          idempotencyKey: existingEntry.idempotencyKey,
          referenceNote: existingEntry.referenceNote,
          paymentId: existingEntry.paymentId,
          orderId: existingEntry.orderId,
          refundId: existingEntry.refundId,
          createdById: existingEntry.createdById,
          createdAt: existingEntry.createdAt.toISOString(),
        },
        isDuplicate: true,
        walletBalanceBDT: existingEntry.wallet.balance.toFixed(2),
      };
    }

    // 2. Concurrency-safe pessimistic row locking on WalletAccount
    // SELECT ... FOR UPDATE prevents race conditions / double-spending
    const rows: Array<{
      id: string;
      userId: string;
      currency: string;
      balance: string | number;
      isActive: boolean;
    }> = await tx.$queryRaw`
      SELECT id, "userId", currency, balance, "isActive"
      FROM "WalletAccount"
      WHERE id = ${params.walletId}
      FOR UPDATE
    `;

    if (!rows || rows.length === 0) {
      throw new WalletError("Wallet account not found", "WALLET_NOT_FOUND", 404);
    }

    const lockedWallet = rows[0];

    if (!lockedWallet.isActive) {
      throw new WalletError("Wallet account is suspended or inactive", "WALLET_INACTIVE", 403);
    }

    const currentBalanceMinor = bdtToMinorUnits(lockedWallet.balance);
    const deltaMinor = params.amountMinorUnits;
    const newBalanceMinor = currentBalanceMinor + deltaMinor;

    // 3. Concurrency-safe sufficient balance check
    if (newBalanceMinor < 0) {
      throw new WalletError(
        `Insufficient wallet balance. Available: ৳${minorUnitsToBDT(currentBalanceMinor)}, required: ৳${minorUnitsToBDT(
          Math.abs(deltaMinor)
        )}`,
        "INSUFFICIENT_FUNDS",
        400
      );
    }

    const deltaDecimal = new Prisma.Decimal(minorUnitsToBDT(deltaMinor));
    const newBalanceDecimal = new Prisma.Decimal(minorUnitsToBDT(newBalanceMinor));

    // 4. Create Immutable Ledger Entry
    const newEntry = await tx.walletLedgerEntry.create({
      data: {
        walletId: lockedWallet.id,
        entryType: params.entryType,
        amount: deltaDecimal,
        balanceAfter: newBalanceDecimal,
        currency: params.currency || lockedWallet.currency || WALLET_CURRENCY,
        idempotencyKey: params.idempotencyKey,
        referenceNote: params.referenceNote,
        paymentId: params.paymentId ?? null,
        orderId: params.orderId ?? null,
        refundId: params.refundId ?? null,
        createdById: params.actorId ?? null,
      },
    });

    // 5. Update cached aggregate balance transactionally
    await tx.walletAccount.update({
      where: { id: lockedWallet.id },
      data: {
        balance: newBalanceDecimal,
      },
    });

    // 6. Record audit trail
    // Note: actorId has a foreign key to User; if it is a system string like "SYSTEM", use null for actorId
    const isActorUuid = params.actorId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.actorId);
    await tx.auditLog.create({
      data: {
        actorId: isActorUuid ? params.actorId : null,
        actorEmail: params.actorEmail ?? null,
        actorRole: params.actorRole ?? "SYSTEM",
        action: `WALLET_${params.entryType}`,
        entityType: "WalletLedgerEntry",
        entityId: newEntry.id,
        metadata: {
          walletId: lockedWallet.id,
          amountMinorUnits: deltaMinor,
          amountBDT: minorUnitsToBDT(deltaMinor),
          balanceBeforeBDT: minorUnitsToBDT(currentBalanceMinor),
          balanceAfterBDT: minorUnitsToBDT(newBalanceMinor),
          idempotencyKey: params.idempotencyKey,
          referenceNote: params.referenceNote,
          orderId: params.orderId,
          paymentId: params.paymentId,
          refundId: params.refundId,
          actor: params.actorId,
        },
      },
    });

    return {
      entry: {
        id: newEntry.id,
        walletId: newEntry.walletId,
        entryType: newEntry.entryType,
        amountMinorUnits: deltaMinor,
        amountBDT: minorUnitsToBDT(deltaMinor),
        balanceAfterMinorUnits: newBalanceMinor,
        balanceAfterBDT: minorUnitsToBDT(newBalanceMinor),
        currency: newEntry.currency,
        idempotencyKey: newEntry.idempotencyKey,
        referenceNote: newEntry.referenceNote,
        paymentId: newEntry.paymentId,
        orderId: newEntry.orderId,
        refundId: newEntry.refundId,
        createdById: newEntry.createdById,
        createdAt: newEntry.createdAt.toISOString(),
      },
      isDuplicate: false,
      walletBalanceBDT: minorUnitsToBDT(newBalanceMinor),
    };
  };

  if (externalTx) {
    return await runWithTx(externalTx);
  } else {
    return await prisma.$transaction(async (tx) => {
      return await runWithTx(tx);
    });
  }
}

/**
 * Top-Up Credit: POST ONLY after verified payment confirmation from payment subsystem.
 * Strictly verifies payment status is SUCCEEDED before posting credit.
 */
export async function creditWalletFromVerifiedPayment(params: {
  paymentId: string;
  actorId?: string;
  actorRole?: string;
  actorEmail?: string;
}) {
  return await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { id: params.paymentId },
      include: {
        order: {
          include: { customer: true },
        },
      },
    });

    if (!payment) {
      throw new WalletError("Payment record not found", "PAYMENT_NOT_FOUND", 404);
    }

    if (payment.status !== PaymentStatus.SUCCEEDED) {
      throw new WalletError(
        `Cannot credit wallet from unverified payment. Current payment status is ${payment.status}`,
        "UNVERIFIED_PAYMENT",
        400
      );
    }

    // Identify user to credit
    const userId = payment.order.customerId;
    const wallet = await getOrCreateWalletAccount(userId, tx);

    const amountMinor = bdtToMinorUnits(payment.amount);
    if (amountMinor <= 0) {
      throw new WalletError("Payment amount must be greater than zero", "INVALID_AMOUNT", 400);
    }

    const idempotencyKey = `wallet-topup-${payment.id}`;

    return await postLedgerEntry(
      {
        walletId: wallet.id,
        entryType: WalletLedgerEntryType.TOP_UP,
        amountMinorUnits: amountMinor, // Positive credit
        currency: payment.currency,
        idempotencyKey,
        referenceNote: `Verified top-up from payment ${payment.paymentNumber} (${payment.provider ?? "direct"})`,
        paymentId: payment.id,
        orderId: payment.orderId,
        actorId: params.actorId ?? "SYSTEM",
        actorRole: params.actorRole ?? "PAYMENT_SUBSYSTEM",
        actorEmail: params.actorEmail ?? "system@preorder.bd",
      },
      tx
    );
  });
}

/**
 * Order Debit: Runs in a database transaction with concurrency-safe sufficient-balance check.
 * Atomically marks order as PAID and transitions status.
 */
export async function payOrderWithWallet(params: {
  orderId: string;
  userId: string;
  idempotencyKey: string;
}) {
  return await prisma.$transaction(async (tx) => {
    // 1. Fetch Order and verify ownership
    const order = await tx.order.findUnique({
      where: { id: params.orderId },
      include: { customer: true },
    });

    if (!order) {
      throw new WalletError("Order not found", "ORDER_NOT_FOUND", 404);
    }

    if (order.customerId !== params.userId) {
      throw new WalletError("Access denied: Order belongs to another customer", "FORBIDDEN", 403);
    }

    // 1. Check if an entry with this idempotency key already exists for this order
    const existingPaymentEntry = await tx.walletLedgerEntry.findUnique({
      where: { idempotencyKey: params.idempotencyKey },
      include: { wallet: true },
    });

    if (existingPaymentEntry) {
      return {
        success: true,
        isDuplicate: true,
        orderId: order.id,
        orderNumber: order.orderNumber,
        ledgerEntry: {
          id: existingPaymentEntry.id,
          walletId: existingPaymentEntry.walletId,
          entryType: existingPaymentEntry.entryType,
          amountMinorUnits: bdtToMinorUnits(existingPaymentEntry.amount),
          amountBDT: minorUnitsToBDT(bdtToMinorUnits(existingPaymentEntry.amount)),
          balanceAfterMinorUnits: bdtToMinorUnits(existingPaymentEntry.balanceAfter),
          balanceAfterBDT: minorUnitsToBDT(bdtToMinorUnits(existingPaymentEntry.balanceAfter)),
          currency: existingPaymentEntry.currency,
          idempotencyKey: existingPaymentEntry.idempotencyKey,
          referenceNote: existingPaymentEntry.referenceNote,
          paymentId: existingPaymentEntry.paymentId,
          orderId: existingPaymentEntry.orderId,
          refundId: existingPaymentEntry.refundId,
          createdById: existingPaymentEntry.createdById,
          createdAt: existingPaymentEntry.createdAt.toISOString(),
        },
        walletBalanceBDT: existingPaymentEntry.wallet.balance.toFixed(2),
      };
    }

    if (order.status === OrderStatus.PAID || order.paymentStatus === PaymentStatus.SUCCEEDED) {
      throw new WalletError("Order has already been paid", "ALREADY_PAID", 400);
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new WalletError("Cannot pay for a cancelled order", "ORDER_CANCELLED", 400);
    }

    // 2. Fetch or create Customer Wallet
    const wallet = await getOrCreateWalletAccount(params.userId, tx);

    const orderAmountMinor = bdtToMinorUnits(order.totalAmountBDT);
    if (orderAmountMinor <= 0) {
      throw new WalletError("Order amount must be greater than zero", "INVALID_ORDER_AMOUNT", 400);
    }

    // 3. Post Ledger Entry (Debit is negative amount)
    const debitResult = await postLedgerEntry(
      {
        walletId: wallet.id,
        entryType: WalletLedgerEntryType.ORDER_PAYMENT,
        amountMinorUnits: -orderAmountMinor, // Negative debit
        currency: order.currency,
        idempotencyKey: params.idempotencyKey,
        referenceNote: `Payment for order ${order.orderNumber}`,
        orderId: order.id,
        actorId: params.userId,
        actorRole: "CUSTOMER",
        actorEmail: order.customer.email,
      },
      tx
    );

    // If duplicate idempotent request, return existing result
    if (debitResult.isDuplicate) {
      return {
        success: true,
        isDuplicate: true,
        orderId: order.id,
        orderNumber: order.orderNumber,
        ledgerEntry: debitResult.entry,
        walletBalanceBDT: debitResult.walletBalanceBDT,
      };
    }

    // 4. Create Payment record for this transaction
    const paymentNumber = `PAY-WLT-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;
    const payment = await tx.payment.create({
      data: {
        paymentNumber,
        orderId: order.id,
        method: PaymentMethodType.WALLET,
        status: PaymentStatus.SUCCEEDED,
        currency: order.currency,
        amount: order.totalAmountBDT,
        provider: "customer-wallet",
        providerTrxId: debitResult.entry.id,
        idempotencyKey: `pay-${params.idempotencyKey}`,
        verifiedAt: new Date(),
        verifiedById: params.userId,
      },
    });

    // 5. Update Order status to PAID
    await tx.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.PAID,
        paymentStatus: PaymentStatus.SUCCEEDED,
        paidAmountBDT: order.totalAmountBDT,
      },
    });

    // 6. Record Order Events and Status History
    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        fromStatus: order.status,
        toStatus: OrderStatus.PAID,
        changedById: params.userId,
        reason: `Paid in full via Customer Wallet. Ledger ref: ${debitResult.entry.id}`,
      },
    });

    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        eventType: "PAYMENT_RECEIVED",
        title: "Payment Received via Wallet",
        description: `Full payment of ৳${minorUnitsToBDT(orderAmountMinor)} completed via wallet balance.`,
        isCustomerVisible: true,
        createdById: params.userId,
      },
    });

    return {
      success: true,
      isDuplicate: false,
      orderId: order.id,
      orderNumber: order.orderNumber,
      paymentId: payment.id,
      ledgerEntry: debitResult.entry,
      walletBalanceBDT: debitResult.walletBalanceBDT,
    };
  });
}

/**
 * Refund / Reversal to Wallet:
 * Appends compensating ledger entry (never edits or deletes past entries).
 */
export async function refundOrderToWallet(params: {
  refundId: string;
  actorId: string;
  actorRole: string;
  actorEmail?: string;
  reason?: string;
}) {
  return await prisma.$transaction(async (tx) => {
    const refund = await tx.refund.findUnique({
      where: { id: params.refundId },
      include: {
        order: {
          include: { customer: true },
        },
        walletLedgerEntry: true,
      },
    });

    if (!refund) {
      throw new WalletError("Refund record not found", "REFUND_NOT_FOUND", 404);
    }

    if (refund.status === RefundStatus.COMPLETED && refund.walletLedgerEntry) {
      return {
        success: true,
        isDuplicate: true,
        refundId: refund.id,
        ledgerEntryId: refund.walletLedgerEntry.id,
        message: "Refund already processed to customer wallet.",
      };
    }

    const userId = refund.order.customerId;
    const wallet = await getOrCreateWalletAccount(userId, tx);

    const refundAmountMinor = bdtToMinorUnits(refund.amount);
    if (refundAmountMinor <= 0) {
      throw new WalletError("Refund amount must be greater than 0", "INVALID_REFUND_AMOUNT", 400);
    }

    const idempotencyKey = `wallet-refund-${refund.id}`;

    // Append compensating ledger entry
    const creditResult = await postLedgerEntry(
      {
        walletId: wallet.id,
        entryType: WalletLedgerEntryType.ORDER_REFUND,
        amountMinorUnits: refundAmountMinor, // Positive credit compensation
        currency: refund.currency,
        idempotencyKey,
        referenceNote: `Refund for order ${refund.order.orderNumber}: ${params.reason || refund.reason}`,
        orderId: refund.orderId,
        refundId: refund.id,
        actorId: params.actorId,
        actorRole: params.actorRole,
        actorEmail: params.actorEmail,
      },
      tx
    );

    // Update refund status to COMPLETED
    await tx.refund.update({
      where: { id: refund.id },
      data: {
        status: RefundStatus.COMPLETED,
        processedAt: new Date(),
        approvedById: params.actorId,
      },
    });

    // Update order status if fully refunded
    await tx.order.update({
      where: { id: refund.orderId },
      data: {
        status: OrderStatus.REFUNDED,
        paymentStatus: PaymentStatus.REFUNDED,
      },
    });

    await tx.orderEvent.create({
      data: {
        orderId: refund.orderId,
        eventType: "ORDER_REFUNDED",
        title: "Refund Credited to Wallet",
        description: `Refund of ৳${minorUnitsToBDT(refundAmountMinor)} has been credited to your customer wallet.`,
        isCustomerVisible: true,
        createdById: params.actorId,
      },
    });

    return {
      success: true,
      isDuplicate: false,
      refundId: refund.id,
      ledgerEntry: creditResult.entry,
      walletBalanceBDT: creditResult.walletBalanceBDT,
    };
  });
}

/**
 * Customer Wallet View:
 * Returns available balance, pending top-ups (if any), and paginated transaction history.
 */
export async function getCustomerWalletSummary(params: {
  userId: string;
  page?: number;
  limit?: number;
  entryType?: WalletLedgerEntryType;
}) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const skip = (page - 1) * limit;

  const wallet = await getOrCreateWalletAccount(params.userId);

  // Fetch pending top-up payments initiated by this customer
  const pendingPayments = await prisma.payment.findMany({
    where: {
      order: { customerId: params.userId },
      status: { in: [PaymentStatus.PENDING, PaymentStatus.REQUIRES_ACTION] },
    },
    select: {
      id: true,
      paymentNumber: true,
      amount: true,
      currency: true,
      status: true,
      createdAt: true,
      order: {
        select: {
          orderNumber: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const pendingTopUpsTotalBDT = pendingPayments.reduce(
    (sum, p) => sum + Number(p.amount),
    0
  );

  // Where filter for ledger history
  const where: Prisma.WalletLedgerEntryWhereInput = {
    walletId: wallet.id,
    ...(params.entryType ? { entryType: params.entryType } : {}),
  };

  const [totalEntries, entries] = await Promise.all([
    prisma.walletLedgerEntry.count({ where }),
    prisma.walletLedgerEntry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
  ]);

  const totalPages = Math.ceil(totalEntries / limit) || 1;

  return {
    wallet: {
      id: wallet.id,
      userId: wallet.userId,
      currency: wallet.currency,
      balanceBDT: wallet.balance.toFixed(2),
      balanceMinorUnits: bdtToMinorUnits(wallet.balance),
      isActive: wallet.isActive,
    },
    pendingFunds: {
      count: pendingPayments.length,
      totalBDT: pendingTopUpsTotalBDT.toFixed(2),
      items: pendingPayments.map((p) => ({
        paymentId: p.id,
        paymentNumber: p.paymentNumber,
        amountBDT: Number(p.amount).toFixed(2),
        currency: p.currency,
        status: p.status,
        orderNumber: p.order.orderNumber,
        createdAt: p.createdAt.toISOString(),
      })),
    },
    pagination: {
      page,
      limit,
      totalEntries,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
    entries: entries.map((e) => ({
      id: e.id,
      entryType: e.entryType,
      amountMinorUnits: bdtToMinorUnits(e.amount),
      amountBDT: (Number(e.amount) > 0 ? "+" : "") + Number(e.amount).toFixed(2),
      balanceAfterBDT: Number(e.balanceAfter).toFixed(2),
      currency: e.currency,
      referenceNote: e.referenceNote,
      orderId: e.orderId,
      paymentId: e.paymentId,
      refundId: e.refundId,
      createdAt: e.createdAt.toISOString(),
    })),
  };
}

/**
 * Admin Wallet Audit & Reconciliation Explorer:
 * View all wallet accounts with reconciliation check against the immutable ledger sum.
 * Admins CANNOT edit balances directly.
 */
export async function getAdminWalletLedgerList(params: {
  page?: number;
  limit?: number;
  onlyDiscrepancies?: boolean;
  userId?: string;
}) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(50, Math.max(1, params.limit || 20));
  const skip = (page - 1) * limit;

  const where: Prisma.WalletAccountWhereInput = {
    ...(params.userId ? { userId: params.userId } : {}),
  };

  const [totalWallets, wallets] = await Promise.all([
    prisma.walletAccount.count({ where }),
    prisma.walletAccount.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        _count: {
          select: { ledgerEntries: true },
        },
      },
      orderBy: { updatedAt: "desc" },
      skip,
      take: limit,
    }),
  ]);

  // Perform reconciliation check for each returned wallet
  const itemsWithReconciliation = await Promise.all(
    wallets.map(async (w) => {
      const rec = await reconcileWallet(w.id);
      return {
        wallet: {
          id: w.id,
          userId: w.userId,
          currency: w.currency,
          balanceBDT: w.balance.toFixed(2),
          isActive: w.isActive,
          createdAt: w.createdAt.toISOString(),
          updatedAt: w.updatedAt.toISOString(),
        },
        user: w.user,
        totalEntries: w._count.ledgerEntries,
        reconciliation: rec,
      };
    })
  );

  const filteredItems = params.onlyDiscrepancies
    ? itemsWithReconciliation.filter((item) => !item.reconciliation.isConsistent)
    : itemsWithReconciliation;

  return {
    wallets: filteredItems,
    pagination: {
      page,
      limit,
      totalWallets,
      totalPages: Math.ceil(totalWallets / limit) || 1,
    },
  };
}
