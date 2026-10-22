# PostgreSQL Relational Data Model Specification

## Malaysia → Bangladesh Cross-Border Pre-Order Platform

This document describes the schema architecture, relational models, state machines, financial constraints, and operational migration workflows implemented in Prisma 7 (`prisma@7.10.1`, `@prisma/client@7.10.1`, with `@prisma/adapter-pg`).

---

## 1. Architectural Principles

1. **Single-Tenant Company Design**
   - The platform serves **one business entity** sourcing items in Malaysia and delivering them to retail/individual customers across Bangladesh.
   - No `tenant_id`, multi-tenant routing, or organization multiplexing.

2. **Immutable Financial History & Snapshots**
   - Quotes and orders snapshot item titles, descriptions, source URLs, unit prices, service charges, shipping fees, and customs duties at acceptance.
   - When an admin updates a catalog product, historical quotes and orders remain unchanged.

3. **Strict Money Handling**
   - All monetary fields use high-precision PostgreSQL decimals (`DECIMAL(12, 2)` or `DECIMAL(10, 4)` for exchange rates).
   - Zero floating-point arithmetic.
   - Customer-facing financial amounts are explicitly denominated in **BDT** (`currency = "BDT"`), while sourcing supplier costs and exchange rates store currency explicitly.

4. **Decoupled State Machines**
   - No single overloaded "status" column.
   - Independent lifecycle states for **Product Inquiries**, **Quotes**, **Orders**, **Payments**, **Procurements**, and **Shipments**.

5. **Security & Confidentiality**
   - **Zero raw cardholder data**: No raw card numbers, CVVs, or gateway API keys are stored in the database.
   - **Internal Supplier Confidentiality**: Sourcing costs (`estCostMYR`, `purchaseCostMYR`, `exchangeRateUsed`) and supplier identities are accessible only to authorized staff (`ADMIN`, `OPERATIONS`, `FINANCE`).

6. **Append-Only Wallet Ledger**
   - Wallet balances are protected by an immutable ledger (`WalletLedgerEntry`).
   - Every transaction requires a unique `idempotencyKey`, an entry type, and a signed amount (`+` for credits, `-` for debits). Balance updates are derived and audit-logged.

---

## 2. Entity Relational Architecture

### 2.1 Identity & Access Control
- **`User`**: System actors. Roles include `CUSTOMER`, `ADMIN`, `OPERATIONS`, `FINANCE`, `SUPPORT`.
- **`CustomerProfile`**: Preferred city, district, division, and logistics notes.
- **`Address`**: Shipping and billing addresses with Bangladesh divisions and districts.

### 2.2 Catalogue & Products
- **`ProductCategory`**: Hierarchical category tree (self-referencing `parentId`) with slug, image, and display order.
- **`Product`**: Sourced items with customer-facing display prices (`FIXED_PRICE` or `REQUEST_QUOTE_ONLY`), estimated transit duration, and staff-only sourcing estimates (`approxCostMYR`, `defaultSupplierId`).
- **`ProductImage`**: Multi-image gallery with ordering and primary selection.

### 2.3 Inquiries & Sourcing Requests
- **`ProductInquiry`**: Custom product requests submitted by customers (URL, name, model, quantity, target budget).
- **`InquiryAttachment`**: Uploaded photos and reference documents.
- **`InquiryMessage`**: Communication thread between customer and staff (supports staff-internal notes with `isStaffOnly: true`).
- **`InquiryStatusHistory`**: Auditable transition log for every inquiry status change.

### 2.4 Quotations & Agreed Terms
- **`Quote`**: Versioned quotations (`version` autoincrement per inquiry). Contains itemized fees (items subtotal, service fee, shipping fee, customs fee, discounts).
- **`QuoteLineItem`**: Snapshotted itemized rows and private supplier cost estimates.
- **Acceptance Tracking**: `acceptedAt` and `acceptedById` provide immutable proof of customer acceptance before order creation.

### 2.5 Orders & Snapshots
- **`Order`**: Order entity referencing accepted quote and customer. Stores the snapshot of delivery address and finalized financial commitments.
- **`OrderLineItem`**: Snapshotted item details (title, description, source URL, price).
- **`OrderEvent`**: Customer-visible and operational timeline events.
- **`OrderStatusHistory`**: Immutable history of order progression.

### 2.6 Payments & Idempotency
- **`Payment`**: Provider-agnostic payment records (`bKash`, `Nagad`, `SSLCommerz`, `Bank Transfer`, `Wallet`).
- **`PaymentAttempt`**: Audit logs of gateway requests and provider responses.
- **`Refund`**: Refund tracking linked to orders, provider transaction references, and wallet compensations.
- **`WebhookEvent`**: Webhook event log indexed with composite unique `(provider, eventId)` to prevent duplicate processing.

### 2.7 Wallet & Ledger
- **`WalletAccount`**: User balance container (`BDT`).
- **`WalletLedgerEntry`**: Immutable transaction log (`TOP_UP`, `ORDER_PAYMENT`, `ORDER_REFUND`, `ADJUSTMENT_CREDIT`, `ADJUSTMENT_DEBIT`, `REVERSAL`). Every record has an `idempotencyKey` and `balanceAfter` snapshot.

### 2.8 Malaysia Procurement & Private Suppliers
- **`Supplier`**: Confidential registry of Malaysian wholesalers and vendors.
- **`ProcurementRecord`**: Staff purchasing records in Malaysia, capturing invoice reference, `purchaseCostMYR`, `exchangeRateUsed`, and `purchaseCostBDT`.

### 2.9 Logistics, Shipments & Tracking
- **`Shipment`**: Package consignment, carrier details, air waybill/tracking number, weights, and dimensions.
- **`ShipmentEvent`**: Public milestones (`Kuala Lumpur Hub`, `Customs Clearance Dhaka`, `Out for Delivery`).

### 2.10 Operations, Support & Audit
- **`CompanySetting`**: System configuration (fees, conversion rates, contact details).
- **`SupportTicket` & `SupportTicketMessage`**: Customer support inquiry management.
- **`AuditLog`**: Security and financial audit trail recording actor ID, entity, action, IP, and sanitized payload.

---

## 3. State Machines & Status Enums

| State Machine | Enums |
|---|---|
| **Inquiry** | `SUBMITTED` → `UNDER_REVIEW` → `NEEDS_INFORMATION` → `QUOTED` → `ACCEPTED` / `DECLINED` / `CANCELLED` |
| **Quote** | `DRAFT` → `SENT` → `ACCEPTED` / `REJECTED` / `EXPIRED` / `SUPERSEDED` |
| **Order** | `AWAITING_PAYMENT` → `PAYMENT_REVIEW` → `PAID` → `PROCUREMENT` → `PACKING` → `DISPATCHED` → `IN_TRANSIT` → `CUSTOMS` → `OUT_FOR_DELIVERY` → `DELIVERED` (or `CANCELLED`, `REFUND_PENDING`, `PARTIALLY_REFUNDED`, `REFUNDED`) |
| **Payment** | `PENDING` → `REQUIRES_ACTION` → `SUCCEEDED` / `FAILED` / `CANCELLED` / `PARTIALLY_REFUNDED` / `REFUNDED` / `REVERSED` |
| **Procurement** | `NOT_STARTED` → `SOURCING` → `PURCHASED` / `UNAVAILABLE` / `CANCELLED` |
| **Shipment** | `NOT_READY` → `READY_TO_DISPATCH` → `DISPATCHED` → `IN_TRANSIT` → `DELAYED` → `CUSTOMS` → `OUT_FOR_DELIVERY` → `DELIVERED` / `LOST` / `RETURNED` |

---

## 4. Migration & Database Workflow

The project uses Prisma 7 with the direct PostgreSQL driver adapter (`@prisma/adapter-pg`).

### Commands

1. **Apply Migrations in Development:**
   ```bash
   npx prisma migrate dev
   ```
2. **Check Migration Status:**
   ```bash
   npx prisma migrate status
   ```
3. **Generate Prisma Client:**
   ```bash
   npx prisma generate
   ```
4. **Run Seed Script (Development Data):**
   ```bash
   npm run db:seed
   ```
   *(Or `npx tsx prisma/seed.ts`)*

5. **Prisma Studio:**
   ```bash
   npx prisma studio
   ```

### Client Initialization Pattern (Next.js App Router)
Prisma 7 requires passing a database adapter or Accelerate URL to the `PrismaClient` constructor:
```typescript
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
export const prisma = new PrismaClient({ adapter });
```
A singleton instance is exported from [`app/lib/prisma.ts`](file:///Users/prayangshuuu/Desktop/malaysia-preorder/app/lib/prisma.ts).
