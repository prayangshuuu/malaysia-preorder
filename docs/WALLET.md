# Customer Wallet & Auditable Ledger Documentation

The Customer Wallet subsystem provides an append-only, transactionally consistent, auditable ledger for handling customer balances, verified top-ups, order debits, compensative refunds, and reconciliation.

---

## 1. Architectural Highlights

- **Append-Only Immutable Ledger (`WalletLedgerEntry`):**
  Every balance change is recorded as an immutable row. Rows are never edited or deleted.
- **Strict Monetary Minor Units:**
  All ledger computations and sufficiency checks operate in integer minor units (Poisha, where 1 BDT = 100 Poisha) to avoid floating-point drift.
- **Pessimistic Concurrency Locking (`SELECT ... FOR UPDATE`):**
  Race conditions and double-spending across concurrent requests are blocked at the database level by acquiring a row lock on `WalletAccount` before checking sufficiency and posting ledger entries.
- **Strict Idempotency:**
  `idempotencyKey` is enforced via a unique database index (`@unique`). Repeated requests safely return the existing transaction record without duplicate balance updates.
- **Verified Top-Up Requirement:**
  Top-up credits are only posted after official payment confirmation (`PaymentStatus.SUCCEEDED`) from the payment subsystem. Unverified or pending payments cannot credit spendable funds.
- **Compensating Refunds & Reversals:**
  Refunds create explicit compensating credit entries (`ORDER_REFUND` or `REVERSAL`), preserving historical transaction integrity.
- **No Direct Admin Balance Manipulation:**
  Admin interfaces and API endpoints do not permit arbitrary balance editing. Admins can view audit logs and run automated reconciliation against the ledger sum.
- **Separation of Pending vs. Available Funds:**
  Pending top-ups awaiting gateway confirmation are tracked separately from spendable balance.
- **Compliance Guardrail:**
  Cash-out/withdrawals are intentionally disabled to comply with cross-border sourcing export/import regulations.

---

## 2. Ledger Data Model

### `WalletAccount`
```prisma
model WalletAccount {
  id        String   @id @default(uuid())
  userId    String   @unique
  currency  String   @default("BDT")
  balance   Decimal  @default(0) @db.Decimal(12, 2) // Transactionally consistent cached balance
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### `WalletLedgerEntry`
```prisma
model WalletLedgerEntry {
  id             String                @id @default(uuid())
  walletId       String
  wallet         WalletAccount         @relation(...)
  entryType      WalletLedgerEntryType // TOP_UP, ORDER_PAYMENT, ORDER_REFUND, ADJUSTMENT_CREDIT, ADJUSTMENT_DEBIT, REVERSAL
  amount         Decimal               @db.Decimal(12, 2) // Signed: Positive for credit, Negative for debit
  balanceAfter   Decimal               @db.Decimal(12, 2) // Balance snapshot immediately following the entry
  currency       String                @default("BDT")
  idempotencyKey String                @unique
  referenceNote  String
  paymentId      String?
  orderId        String?
  refundId       String?               @unique
  createdById    String?
  createdAt      DateTime              @default(now())
}
```

---

## 3. Reconciliation Procedure

The reconciliation invariant checks that the cached balance equals the aggregate sum of all historical ledger entries:

$$\text{Cached Balance} = \sum_{e \in \text{LedgerEntries}} e.\text{amount}$$

### Automated Reconcile Flow
1. Fetch `WalletAccount` row.
2. Query `SUM(amount)` and `COUNT(id)` from `WalletLedgerEntry` where `walletId = targetWalletId`.
3. Compare `cachedBalanceMinorUnits` with `computedLedgerSumMinorUnits`.
4. If difference is zero (`discrepancy = 0`), account is marked `isConsistent: true`.
5. If difference is non-zero, discrepancy is flagged for administrative review and audit alerts.

### Endpoints
- `GET /api/wallet/reconcile` (Admin): List all customer wallets with live reconciliation status, or filter by `?onlyDiscrepancies=true`.
- `POST /api/wallet/reconcile` (Admin): Run an on-demand audit check for a specific `walletId`.

---

## 4. API & Integration Endpoints

### 1. `GET /api/wallet`
Returns the authenticated customer's available balance, pending top-up funds, and paginated transaction ledger.

### 2. `POST /api/wallet/topup/initiate`
Initiates a payment gateway session for a wallet top-up order (`ORD-TOPUP-*`).
- **Body:** `{ "amountBDT": 1000.00, "idempotencyKey": "topup-unique-key", "providerName": "safe-dev-payment" }`
- **Result:** Top-up is marked pending until gateway webhook verification confirms payment.

### 3. `POST /api/wallet/pay-order`
Debits customer wallet for an order inside an atomic transaction with row locking.
- **Body:** `{ "orderId": "uuid", "idempotencyKey": "pay-unique-key" }`
- **Result:** Order transitions to `PAID`, payment record created with method `WALLET`.

---

## 5. Verification Test Suite

Run the automated test suite covering all critical ledger invariants and concurrency protections:
```bash
npx tsx tests/wallet.test.ts
```

Tests cover:
1. Integer minor unit conversion invariants (`bdtToMinorUnits`, `minorUnitsToBDT`).
2. Wallet lifecycle: initial balance, multiple credits/debits, and balance reconciliation invariant.
3. Duplicate idempotency key defense (safe idempotent replay without double-crediting).
4. Insufficient balance checks blocking debits from driving balances negative.
5. Verified top-ups rejecting unverified payments and posting credits upon confirmation.
6. Atomic order payment with wallet balance, status transition to `PAID`, and payment records.
7. Compensating refund entries appending without altering historical records.
8. Concurrent debits race condition defense: simultaneous debit attempts cannot double-spend.
