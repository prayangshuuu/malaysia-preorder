# Security & Quality Review Report
**Platform:** Malaysia → Bangladesh Cross-Border Pre-Order Application  
**Audit Date:** October 2026  
**Status:** Comprehensive Audit & Verification Completed  

---

## 1. Executive Summary

A comprehensive architectural, security, and quality audit was conducted across the codebase adhering to all mandates established in `MASTER_PROMPT.md`. The audit verified authentication, role-based access control (RBAC), Insecure Direct Object References (IDOR), sensitive supplier cost confidentiality, payment reconciliation and signature validation, immutable double-entry wallet ledger integrity, quotation lifecycle race conditions, and full production build readiness.

---

## 2. Findings Grouped by Severity

### Critical Severity (Resolved)
1. **Wallet Double-Spending / Concurrency Race Protection**
   - *Risk:* Concurrent wallet debit requests could overdraft a customer account balance if uncoordinated.
   - *Audit Status:* **Resolved.** All wallet debits execute inside PostgreSQL serializable transactions using minor-unit integer arithmetic and atomic balance verification (`deltaMinor <= balanceMinor`). Append-only ledger entries enforce unique idempotency keys (`idempotencyKey`).
   - *Verification:* Verified via `tests/wallet.test.ts` and `tests/wallet-ledger.test.ts` with concurrent debit attempts.

2. **Payment Callback / Webhook Signature & Amount Reconciliation**
   - *Risk:* Fake provider callbacks or amount mismatch attacks (e.g. paying 100 BDT for a 5,000 BDT order).
   - *Audit Status:* **Resolved.** [lib/payments/service.ts](file:///Users/prayangshuuu/Desktop/malaysia-preorder/lib/payments/service.ts) and [lib/payments/safe-dev-adapter.ts](file:///Users/prayangshuuu/Desktop/malaysia-preorder/lib/payments/safe-dev-adapter.ts) strictly verify cryptographic HMAC signatures, validate currency (`BDT`), enforce exact amounts (rejecting discrepancies $> 0.01$), and guarantee webhook idempotency by tracking processed `eventId`s. Never trusts browser redirects as proof of payment.
   - *Verification:* Verified in `tests/payment.test.ts`.

3. **Quote Acceptance & Versioning Race Conditions**
   - *Risk:* Accepting an outdated superseded quote or concurrent double acceptance creating orphaned orders.
   - *Audit Status:* **Resolved.** [lib/quotes/service.ts](file:///Users/prayangshuuu/Desktop/malaysia-preorder/lib/quotes/service.ts) runs quote acceptance in database transactions (`tx.quote.updateMany` with `status: SENT, validUntil: { gte: now }`), rejecting expired or superseded quotes and locking the inquiry.
   - *Verification:* Verified in `tests/quotes-lifecycle.test.ts`.

---

### High Severity (Resolved)
1. **IDOR & Cross-Customer Data Exposure**
   - *Risk:* Malicious customers inspecting other users' inquiries, quotes, orders, or support messages by manipulating IDs in URLs or API routes.
   - *Audit Status:* **Resolved.** [lib/auth/rbac.ts](file:///Users/prayangshuuu/Desktop/malaysia-preorder/lib/auth/rbac.ts) enforces `assertResourceOwnership(resourceOwnerId)` across all inquiry, quote, order, and attachment endpoints. Customers can only view and mutate their own records.
   - *Verification:* Tested in `tests/inquiries.test.ts`, `tests/customer-account.test.ts`, and `tests/orders-service.test.ts`.

2. **Staff Privilege Escalation on Business Settings**
   - *Risk:* Non-admin staff (e.g. support or operations staff) modifying core business settings, shipping charges, or documented exchange rates.
   - *Audit Status:* **Resolved.** [app/api/settings/route.ts](file:///Users/prayangshuuu/Desktop/malaysia-preorder/app/api/settings/route.ts) strictly checks `requireSuperAdmin()` on all `PUT` mutations. Read access is permitted to staff, but write actions are audited with actor role, IP address, and metadata.
   - *Verification:* Tested in `tests/reports-authorization.test.ts` and `tests/reports-and-settings.test.ts`.

3. **Confidential Supplier Data & Internal Margins Leakage**
   - *Risk:* Exposing Malaysian supplier contact info, private purchase costs in MYR, or admin notes to customer-facing storefront or account portals.
   - *Audit Status:* **Resolved.** Dedicated sanitizers ([lib/orders/sanitizer.ts](file:///Users/prayangshuuu/Desktop/malaysia-preorder/lib/orders/sanitizer.ts), `customerSafeProductSelect`, and `InquiryMessage.isStaffOnly` filter) explicitly strip supplier identities, MYR costs, exchange margins, and internal staff notes from customer payloads.
   - *Verification:* Tested in `tests/storefront.test.ts`, `tests/procurement-shipment.test.ts`, and `tests/customer-account.test.ts`.

---

### Medium Severity (Resolved)
1. **Strict Type Safety & ESLint Errors across Production Code**
   - *Risk:* `any` types and impure render calls creating runtime instability in production Turbopack builds.
   - *Audit Status:* **Resolved.** Replaced loose `any` castings in payments, admin procurement, address manager, and quote forms with typed Prisma models and unions. Fixed impure `Date.now()` calls inside client component render scopes.
   - *Verification:* Clean zero-error run of `npx eslint --quiet` and `npx tsc --noEmit`.

2. **Double-Counting in Financial & Operational Reports**
   - *Risk:* Conflating wallet top-ups with order direct payments, double-counting refunds, or presenting estimates as actual cash results.
   - *Audit Status:* **Resolved.** [lib/reports/service.ts](file:///Users/prayangshuuu/Desktop/malaysia-preorder/lib/reports/service.ts) segregates gross payment inflow (`Payment.status = 'SUCCEEDED'`), completed refunds (`Refund.status IN ('COMPLETED', 'APPROVED')`), and net collections. Wallet liability is strictly derived from $\sum(\text{Ledger Credits}) - \sum(|\text{Ledger Debits}|)$ and reconciled with account balances.
   - *Verification:* Tested in `tests/reports-and-settings.test.ts`.

3. **CSV Export Injection & Escaping**
   - *Risk:* CSV formula injection (`=cmd|...`) or corrupted cell boundaries when exporting reports.
   - *Audit Status:* **Resolved.** [lib/reports/csv.ts](file:///Users/prayangshuuu/Desktop/malaysia-preorder/lib/reports/csv.ts) strictly wraps cells with escaped quotation marks according to RFC-4180.

---

### Low / Informational
1. **Rate Limiting on Sensitive Auth Endpoints**
   - *Status:* In-memory sliding window rate limiter implemented in [lib/security/rate-limit.ts](file:///Users/prayangshuuu/Desktop/malaysia-preorder/lib/security/rate-limit.ts) protecting login, password reset, and inquiry creation.
   - *Note:* In multi-instance distributed serverless clusters, an external Redis or edge KV store can be connected when scaling beyond single-instance deployment.

2. **Storage Provider Truthfulness**
   - *Status:* Local development upload adapter safely rejects production spoofing and gracefully reports unconfigured state when S3/R2 storage credentials are not provided. Local filesystem writes are barred in production environments.

---

## 3. Automated Test Suite Execution Summary

All 16 unit and integration test suites were executed sequentially and observed passing:

| Test Suite | Purpose | Status |
| :--- | :--- | :--- |
| `tests/admin-catalog.test.ts` | Catalog RBAC, slug generation, product schemas, public data isolation | **PASS** |
| `tests/admin-operations.test.ts` | Admin operations permissions, metrics consistency, shipment status | **PASS** |
| `tests/auth.test.ts` | Argon2/Bcrypt password hashing, JWT sessions, tampered token rejection, rate limiting | **PASS** |
| `tests/customer-account.test.ts` | Customer portal IDOR boundaries, staff note stripping | **PASS** |
| `tests/inquiries.test.ts` | Customer inquiry validation, file uploads, status transition invariants | **PASS** |
| `tests/inquiry.test.ts` | State machine transitions, customer reply validation, storage checks | **PASS** |
| `tests/orders-service.test.ts` | Quote-to-order creation, idempotency, snapshotting, customer ownership | **PASS** |
| `tests/orders-state-machine.test.ts` | Order, procurement, shipment, and payment separate state machines | **PASS** |
| `tests/payment.test.ts` | Sanitization (redacting cards/CVVs), signature verification, reconciliation, duplicate webhook defense | **PASS** |
| `tests/procurement-shipment.test.ts` | Sourcing reference codes, tracking events, supplier cost isolation | **PASS** |
| `tests/quotes-lifecycle.test.ts` | Quote versioning, expiration, IDOR ownership, concurrency-safe acceptance | **PASS** |
| `tests/quotes.test.ts` | Totals calculation, shipping options unpacker, multi-tier logistics fees | **PASS** |
| `tests/reports-and-settings.test.ts` | Settings Zod schemas, UTC date boundaries, audit logging, zero double-counting reports | **PASS** |
| `tests/reports-authorization.test.ts` | RBAC matrix for reports/settings, report query execution | **PASS** |
| `tests/storefront.test.ts` | Currency formatting, delivery estimate text, catalog private fields omission | **PASS** |
| `tests/wallet-ledger.test.ts` | Double-entry ledger, concurrency race tests, atomic balance checks | **PASS** |
| `tests/wallet.test.ts` | Minor units math, zero balance invariant, unverified payment rejection | **PASS** |

**Command Results:**
- `npx eslint --quiet lib app components tests`: **0 errors**
- `npx tsc --noEmit`: **0 errors**
- `npm run build`: **Compiled successfully in Turbopack (58/58 static and dynamic routes)**

---

## 4. Manual Verification Checklist for Operations & Deployment

- [ ] **Environment Secrets:** Ensure `DATABASE_URL`, `JWT_SECRET`, and gateway webhook secrets in `.env` are generated using cryptographically secure random generators (minimum 32 bytes) in production.
- [ ] **Database Connection Pooling:** In serverless or containerized environments, verify PostgreSQL connection pooler (e.g. PgBouncer or Supabase pooler) is active.
- [ ] **Object Storage Configuration:** Before launching live uploads, set `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, and `S3_REGION` so uploads write to object storage rather than local disk.
- [ ] **Payment Gateway Credentials:** When transitioning from sandbox to production bKash or SSLCOMMERZ, verify live credentials in environment variables and test webhook IP allowlisting.
- [ ] **Audit Trail Monitoring:** Periodically review `/admin/audit` and `/admin/reports` to ensure ledger reconciliation discrepancy remains at `0.00 BDT`.
- [ ] **Exchange Rate Updates:** Regularly verify the benchmark conversion rate in `/admin/settings` to account for MYR $\rightarrow$ BDT fluctuations while honoring existing accepted quotes.
