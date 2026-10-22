# Notifications & Support Foundations Documentation

## Overview
This platform implements an auditable, truthful notification and customer care architecture for the Malaysia → Bangladesh Pre-Order application, adhering strictly to the constraints in `MASTER_PROMPT.md`.

---

## 1. Notification Service Architecture

### Abstraction & Provider Truthfulness
- Located at [lib/notifications.ts](file:///Users/prayangshuuu/Desktop/malaysia-preorder/lib/notifications.ts).
- Integrates both in-app notification persistence (`prisma.notification`) and an external delivery layer.
- **Provider Status Truthfulness**:
  - The system checks environment variables (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_EMAIL`).
  - If any placeholder or missing values are detected, `emailProviderConfig.isConfigured` evaluates to `false`.
  - The service records/displays an explicit disabled state (`DISABLED_PROVIDER`) with a clear reason ("SMTP provider credentials are not configured or contain placeholder values. Live email delivery is safely disabled").
  - The system **never** claims an email was sent when no provider is configured.

### Event Milestones Supported
Safe templates and dispatch hooks are built into the lifecycle for:
1. **Quote Sent & Expiring**: `NotificationTemplates.quoteSent` and `NotificationTemplates.quoteExpiring` notifying customers of issued quotations and expiry countdowns.
2. **Quote Accepted**: `NotificationTemplates.quoteAccepted` notifying customers that their accepted quote has created an order awaiting payment.
3. **Payment Verified / Failed**: `NotificationTemplates.paymentVerified` and `NotificationTemplates.paymentFailed` invoked from webhook/reconciliation events.
4. **Procurement Updates**: `NotificationTemplates.procurementUpdate` when sourcing status progresses in Malaysia.
5. **Shipment Dispatched**: `NotificationTemplates.dispatched` providing flight/carrier identifiers (e.g. Biman Air Cargo) without exposing internal warehouse costs.
6. **Shipment Delay**: `NotificationTemplates.shipmentDelay` communicating cargo handling or flight schedule updates.
7. **Delivery**: `NotificationTemplates.delivered` celebrating doorstep fulfillment.
8. **Refund Status**: `NotificationTemplates.refundStatus` confirming ledger-backed wallet credits.

### Idempotency & Deduplication
- Notifications accept an optional `idempotencyKey` (e.g., `quote-sent:qt_123:v1`, `payment-verified:pay_999`).
- Before creating a record, the notification service checks whether a notification with this unique reference has already been stored for the customer.
- Duplicate events are safely ignored with status `DUPLICATE_IGNORED` and the existing `notificationId` returned.

### Data Sanitization & Safe URLs
- `sanitizeNotificationText`: Redacts tokens, passwords, 13–16 digit payment card numbers, and CVV codes before saving or transmitting.
- `buildSafeCustomerLink`: Validates relative paths starting with `/`, strictly rejecting protocol-relative (`//`), `javascript:`, and external unvetted redirect URLs.

---

## 2. Customer Support & Contact Helpdesk

### Foundations & Data Model
- Located at [lib/support/service.ts](file:///Users/prayangshuuu/Desktop/malaysia-preorder/lib/support/service.ts) and [app/actions/support.ts](file:///Users/prayangshuuu/Desktop/malaysia-preorder/app/actions/support.ts).
- Persisted using `SupportTicket` and `SupportTicketMessage` models with status enum `OPEN | IN_PROGRESS | RESOLVED | CLOSED`.
- Human-friendly ticket numbers generated via `TKT-YYYY-XXXXX`.

### Spam & Rate-Limit Protection
- Contact endpoint is protected by:
  1. **Honeypot field**: `companyWebsite` must remain empty; populated values trigger `SupportServiceError("Spam verification failed")`.
  2. **Rate Limiting**: Bounded to 5 submissions per 10 minutes per IP address using [lib/security/rate-limit.ts](file:///Users/prayangshuuu/Desktop/malaysia-preorder/lib/security/rate-limit.ts).
  3. **Server Validation**: Strict Zod schemas validating lengths, email formats, and message boundaries.

### Staff Confidentiality & Internal Notes Separation
- Staff members can post private notes marked with `isStaffOnlyNote: true` (rendered with `[INTERNAL STAFF NOTE]`).
- Public responses from staff trigger customer notifications and update ticket statuses.
- `sanitizeSupportMessagesForCustomer` strips all internal staff notes, ensuring customers only see public communications.
- Customer replies are strictly restricted from marking messages as staff notes.

---

## 3. UI Interfaces

- **Public Contact Page**: [/contact](file:///Users/prayangshuuu/Desktop/malaysia-preorder/app/contact/page.tsx) with client form [ContactSupportForm.tsx](file:///Users/prayangshuuu/Desktop/malaysia-preorder/components/support/ContactSupportForm.tsx).
- **Admin Support Console**: [/admin/support](file:///Users/prayangshuuu/Desktop/malaysia-preorder/app/admin/support/page.tsx) and [/admin/support/[ticketId]](file:///Users/prayangshuuu/Desktop/malaysia-preorder/app/admin/support/[ticketId]/page.tsx) with status updates, internal notes, and message logs.
- **Customer Account Views**:
  - Notification history at [/account/notifications](file:///Users/prayangshuuu/Desktop/malaysia-preorder/app/account/notifications/page.tsx) displaying in-app notifications and SMTP configuration status.
  - Ticket detail & reply thread at [/account/support/[ticketId]](file:///Users/prayangshuuu/Desktop/malaysia-preorder/app/account/support/[ticketId]/page.tsx) with IDOR protection.

---

## 4. Test Coverage & Verification

Test suite: [tests/notifications-and-support.test.ts](file:///Users/prayangshuuu/Desktop/malaysia-preorder/tests/notifications-and-support.test.ts).
- Validates SMTP unconfigured/disabled provider truthfulness.
- Validates data sanitization against cards, tokens, and CVVs.
- Validates link safety against untrusted hosts.
- Validates template formatting across all core events.
- Validates duplicate event deduplication using idempotency keys.
- Validates honeypot defense against spam submissions.
- Validates customer data isolation and stripping of internal staff notes.
