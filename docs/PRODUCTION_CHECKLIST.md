# Production Deployment Readiness Checklist
**Platform:** Malaysia → Bangladesh Cross-Border Pre-Order Application  
**Target:** Live Production Readiness Verification  

---

## 1. External Integrations Status Matrix

Before promoting to live traffic, verify the operational status of external providers:

| Integration | Provider / Protocol | Status in Repository | Live Action Required |
| :--- | :--- | :--- | :--- |
| **Relational Database** | PostgreSQL via Prisma Adapter | **Active & Verified** | Provision managed PostgreSQL and run `npm run db:migrate:deploy`. |
| **Authentication** | Jose JWT + Bcrypt + HttpOnly Cookies | **Active & Verified** | Set 32+ character `AUTH_SECRET` in environment variables. |
| **bKash Payment** | Tokenized Checkout Gateway | **Stub / Disabled State** | Add verified merchant credentials (`BKASH_APP_KEY`, `APP_SECRET`, `USERNAME`, `PASSWORD`). |
| **SSLCOMMERZ Payment** | Hosted Checkout & IPN | **Stub / Disabled State** | Add verified credentials (`SSLCOMMERZ_STORE_ID`, `SSLCOMMERZ_STORE_PASSWD`). |
| **Dev-Safe Mock Adapter**| HMAC-signed Sandbox Simulator | **Active for Dev/Staging** | Disable in production by omitting `DEV_PAYMENT_SECRET`. |
| **Customer Wallet** | Immutable Double-Entry Ledger | **Active & Verified** | Spendable top-ups only occur after verified payments. Reconciled at `0.00 BDT` discrepancy. |
| **Air Cargo Tracking** | Kuala Lumpur $\rightarrow$ Dhaka Consolidator | **Internal Milestones Active** | Staff records flight manifest events manually; live carrier webhook can be added when carrier API is provisioned. |
| **Object Storage** | S3-Compatible Storage | **Fallback Active** | Set `STORAGE_ENDPOINT`, `STORAGE_BUCKET_NAME`, and S3 access keys in production. |
| **Email Notifications** | Nodemailer / SMTP | **Fallback Active** | Configure `SMTP_HOST`, `SMTP_PORT`, and transactional email credentials. |

> [!IMPORTANT]
> In accordance with `MASTER_PROMPT.md`, live payments and carrier tracking are **not faked**. When credentials are not supplied, the platform safely indicates disabled/unconfigured status and provides manual bank transfer verification workflows.

---

## 2. Staging Smoke-Test Checklist

Perform these sequential end-to-end smoke tests on your staging environment prior to cutting over DNS:

### A. Customer Onboarding & Sourcing
- [ ] **Customer Registration:** Register a new user at `/register` with phone and email. Verify session cookie is set.
- [ ] **Address Management:** Add a delivery address in Dhaka via `/account` (recipient name, phone, district, division).
- [ ] **Product Catalog:** Browse `/products`, verify prices render in BDT, and ensure private Malaysian supplier costs and admin notes are completely absent.
- [ ] **Inquiry Submission:** Submit a custom product inquiry at `/inquire` with reference URL, desired brand/model, quantity, and notes.

### B. Admin Quoting & Customer Acceptance
- [ ] **Admin Review:** Log in as staff at `/admin/login`, navigate to `/admin/inquiries`, and open the customer inquiry.
- [ ] **Quote Generation:** Click "Create Quotation", select shipping tier (e.g. Standard Air vs DHL Priority), verify service fee and customs fee defaults populate from business settings, enter estimated MYR cost, and issue Quote Version 1.
- [ ] **Customer Quote Acceptance:** Log in as customer, open `/account/quotes/[id]`, review transparent BDT pricing, select preferred shipping option, and accept the quote.
- [ ] **Order Creation:** Confirm an order is generated with status `AWAITING_PAYMENT` and agreed financial snapshots are locked.

### C. Payment, Wallet & Procurement
- [ ] **Payment Simulation:** In staging, test checkout payment using the safe development adapter or sandbox gateway. Verify payment transitions order to `PAID` and logs an audit record.
- [ ] **Wallet Payment:** Top up test wallet balance and pay for an order using store credit. Confirm double-entry ledger entry is created with unique idempotency key.
- [ ] **Procurement Record:** Admin opens `/admin/orders/[id]`, records purchasing cost in MYR with exchange rate, and marks procurement status `PURCHASED`.
- [ ] **Shipment Tracking:** Admin creates a shipment dispatch manifest, assigns air cargo carrier, adds flight milestone event (e.g., "Departed KUL Airport"). Verify customer sees customer-safe tracking and cannot view internal cargo notes.

### D. Refunds & Reversals
- [ ] **Refund Accounting:** Admin initiates partial or full refund for damaged or cancelled item. Confirm refund writes a compensating credit to customer wallet ledger or logs gateway refund reference without deleting history.
- [ ] **Audit Trail & Reports:** Navigate to `/admin/reports` and `/admin/audit`. Verify financial gross, net, refund, and wallet reconciliation discrepancies equal `0.00 BDT`.

---

## 3. Production Readiness Sign-Off

Before going live:
- [x] All 17 automated unit and integration test suites pass (`npm test`).
- [x] Zero TypeScript compilation errors (`npx tsc --noEmit`).
- [x] Zero ESLint linting errors (`npx eslint --quiet`).
- [x] Production build compiles successfully with Turbopack (`npm run build`).
- [x] First Super Administrator provisioning script is prepared (`npm run provision:admin`).
- [x] Health check endpoint is active at `/api/health`.
- [x] `.env.example` verified with placeholders only (zero secrets committed).
