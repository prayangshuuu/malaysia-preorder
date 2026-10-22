# Order State Transitions & Lifecycle Architecture

## 1. Overview
The **Malaysia → Bangladesh Pre-Order Platform** follows an explicit multi-state-machine architecture to manage pre-orders sourced in Malaysia and shipped internationally to customers in Bangladesh.

In accordance with [MASTER_PROMPT.md](file:///Users/prayangshuuu/Desktop/malaysia-preorder/MASTER_PROMPT.md):
- Separate state machines are maintained for **Order Status**, **Payment Status**, **Procurement Status**, and **Shipment Status** to avoid overloaded states.
- Customer pre-orders are generated via atomic database transactions (`prisma.$transaction`) from explicitly accepted quotes.
- Agreed items, quantities, shipping methods, customer address, and pricing breakdowns are strictly snapshotted at creation time.
- Confidential supplier costs (in MYR), private exchange rates, internal cargo notes, and private staff remarks are strictly sanitized before rendering customer views.
- Payment status cannot be marked as paid merely by returning from a gateway URL; payments require verified webhook reconciliation or staff review.

---

## 2. State Machine Transition Specifications

### A. Order Status (`OrderStatus`)
Controls the overarching fulfillment stage of the order.

| Current Status | Permitted Transitions (`toStatus`) | Notes |
| :--- | :--- | :--- |
| `AWAITING_PAYMENT` | `PAYMENT_REVIEW`, `PAID`, `CANCELLED` | Default state on order creation from quote. |
| `PAYMENT_REVIEW` | `PAID`, `AWAITING_PAYMENT`, `CANCELLED` | Used when manual payment slip / transaction reference is uploaded. |
| `PAID` | `PROCUREMENT`, `CANCELLED`, `REFUND_PENDING` | Payment confirmed via webhook or manual verification. Ready for sourcing. |
| `PROCUREMENT` | `PACKING`, `CANCELLED`, `REFUND_PENDING` | Items being sourced from suppliers in Malaysia. |
| `PACKING` | `DISPATCHED`, `REFUND_PENDING` | Received in Kuala Lumpur warehouse and packaged. |
| `DISPATCHED` | `IN_TRANSIT`, `CUSTOMS`, `REFUND_PENDING` | Manifested on international air freight out of KLIA. |
| `IN_TRANSIT` | `CUSTOMS`, `OUT_FOR_DELIVERY`, `REFUND_PENDING` | Cross-border flight en route to Dhaka. |
| `CUSTOMS` | `OUT_FOR_DELIVERY`, `REFUND_PENDING` | Undergoing import inspection at Hazrat Shahjalal International Airport. |
| `OUT_FOR_DELIVERY` | `DELIVERED`, `REFUND_PENDING` | Handed over to local courier in Bangladesh. |
| `DELIVERED` | `REFUND_PENDING` | Final terminal state for normal flow; eligible for post-delivery dispute. |
| `CANCELLED` | *None* | Terminal state. |
| `REFUND_PENDING` | `PARTIALLY_REFUNDED`, `REFUNDED`, `PAID` | Refund review stage. Can return to `PAID` if claim is rejected. |
| `PARTIALLY_REFUNDED`| `REFUNDED` | Partial compensation recorded in ledger. |
| `REFUNDED` | *None* | Terminal state. |

---

### B. Procurement Status (`ProcurementStatus`)
Tracks private sourcing operations in Malaysia without exposing supplier identities or procurement margins.

| Current Status | Permitted Transitions (`toStatus`) | Customer-Safe Milestone Text |
| :--- | :--- | :--- |
| `NOT_STARTED` | `SOURCING`, `CANCELLED` | Order queued for procurement. |
| `SOURCING` | `PURCHASED`, `UNAVAILABLE`, `CANCELLED` | *"Procurement team is sourcing agreed stock in Malaysia."* |
| `PURCHASED` | `CANCELLED` | *"Item(s) purchased and in transit to our Kuala Lumpur warehouse."* |
| `UNAVAILABLE` | `SOURCING`, `CANCELLED` | *"Supplier temporarily out of stock; sourcing team is checking alternate partner branches."* |
| `CANCELLED` | *None* | Terminal state. |

---

### C. Shipment Status (`ShipmentStatus`)
Tracks logistics consignment movements. Does not claim live GPS carrier tracking unless an active carrier API integration exists.

| Current Status | Permitted Transitions (`toStatus`) | Customer-Safe Milestone Text |
| :--- | :--- | :--- |
| `NOT_READY` | `READY_TO_DISPATCH`, `LOST` | Initial shipment record. |
| `READY_TO_DISPATCH`| `DISPATCHED`, `NOT_READY`, `LOST` | *"Consignment packaged, weighted, and scheduled for flight manifest."* |
| `DISPATCHED` | `IN_TRANSIT`, `DELAYED`, `CUSTOMS`, `LOST` | *"Flight departure recorded from Malaysia."* |
| `IN_TRANSIT` | `DELAYED`, `CUSTOMS`, `OUT_FOR_DELIVERY`, `LOST` | *"En route to Dhaka international freight terminal."* |
| `DELAYED` | `IN_TRANSIT`, `CUSTOMS`, `OUT_FOR_DELIVERY`, `LOST` | *"Minor logistics delay reported. Tracking will update once resumed."* |
| `CUSTOMS` | `OUT_FOR_DELIVERY`, `DELAYED`, `RETURNED`, `LOST` | *"Undergoing customs intake and import assessment."* |
| `OUT_FOR_DELIVERY` | `DELIVERED`, `RETURNED`, `LOST` | *"Dispatched for final-mile domestic delivery."* |
| `DELIVERED` | *None* | *"Shipment received and confirmed delivered."* |
| `LOST` | *None* | Terminal state. |
| `RETURNED` | *None* | Terminal state. |

---

### D. Payment Status (`PaymentStatus`)
Manages the monetary state of the order. Concurrency and webhook idempotency are strictly preserved.

| Current Status | Permitted Transitions (`toStatus`) |
| :--- | :--- |
| `PENDING` | `REQUIRES_ACTION`, `SUCCEEDED`, `FAILED`, `CANCELLED` |
| `REQUIRES_ACTION` | `SUCCEEDED`, `FAILED`, `CANCELLED` |
| `SUCCEEDED` | `PARTIALLY_REFUNDED`, `REFUNDED`, `REVERSED` |
| `FAILED` | `PENDING`, `CANCELLED` |
| `CANCELLED` | *None* |
| `PARTIALLY_REFUNDED`| `REFUNDED` |
| `REFUNDED` | *None* |
| `REVERSED` | *None* |

---

## 3. Order Reference Generation
- Order numbers use the format: `ORD-YYYYMMDD-XXXXXX` (e.g., `ORD-20261022-A9F3D1`).
- Generated using high-entropy crypto random bytes to prevent sequential enumeration attacks and IDOR leaks.
- Collision safety is enforced within the database transaction prior to insertion.

---

## 4. Security & Privacy Guarantees
1. **Confidentiality:** Supplier unit costs (`estUnitCostMYR`), exchange rates (`estExchangeRate`), private supplier invoices, and staff-only notes (`adminNotes`) are never present in the customer API payload or client components.
2. **Access Control (RBAC & IDOR):** Every customer read/write queries with `where: { customerId: session.userId }` or verifies ownership via `assertResourceOwnership`. Administrative routes require staff permissions (`ADMIN`, `OPERATIONS`, `FINANCE`, `SUPPORT`).
3. **Auditability & Append-Only Logs:** State transitions generate immutable `OrderStatusHistory` and `OrderEvent` records with actor attribution, timestamp, and customer-safe descriptions.
