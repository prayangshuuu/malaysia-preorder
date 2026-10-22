# Secure Payment Subsystem Documentation

The payment subsystem provides a secure, provider-neutral architecture for handling payments, webhooks, callbacks, refunds, and reconciliation in the Malaysia → Bangladesh Pre-Order Platform.

---

## 1. Architectural Highlights

- **Provider Neutrality (`IPaymentProvider`):** Standard interface for payment initiation, signature verification, server-to-server inquiry, and refund processing.
- **Safe Development Adapter (`SafeDevPaymentAdapter`):**
  - Activated by default when real gateway credentials are not configured.
  - Generates clear mock indicators (`DEV-MOCK-*`) that cannot be mistaken for actual settled funds.
  - Enforces HMAC-SHA256 signature verification to ensure realistic security testing.
- **Cardholder Security:** No raw credit card, CVV, or cardholder numbers are ever stored or logged. The payload sanitizer (`lib/payments/sanitizer.ts`) redacts sensitive fields automatically.
- **Browser Redirect Policy:** Browser redirects are treated as informational only. Payment state changes occur exclusively through cryptographically verified server-to-server callbacks or direct trusted provider API status queries.
- **Idempotency & Replay Defense:**
  - Database-backed `WebhookEvent` model with composite unique constraint `[provider, eventId]`.
  - Duplicate events are detected, acknowledged, and ignored without reprocessing.
- **Reconciliation Engine:** Reconciles order amount, currency, order reference, and provider references before updating state.
- **Database Transactions:** All state updates across `Payment`, `Order`, `PaymentAttempt`, `OrderStatusHistory`, `OrderEvent`, `WebhookEvent`, and `AuditLog` run in atomic PostgreSQL transactions.
- **State Machine Integrity:** Handles `PENDING`, `REQUIRES_ACTION`, `SUCCEEDED`, `FAILED`, `CANCELLED`, `PARTIALLY_REFUNDED`, `REFUNDED`, and `REVERSED` states.

---

## 2. Environment Variables

Add or configure these environment variables in your `.env` file (refer to `.env.example`):

```bash
# Safe Dev Adapter Secret (For HMAC signature generation in tests and local development)
DEV_MOCK_PAYMENT_SECRET="dev-safe-test-secret-never-use-in-prod"

# bKash Gateway (When credentials and documentation are available)
BKASH_APP_KEY="placeholder_bkash_key"
BKASH_APP_SECRET="placeholder_bkash_secret"
BKASH_USERNAME="placeholder_bkash_user"
BKASH_PASSWORD="placeholder_bkash_pass"
BKASH_BASE_URL="https://tokenized.sandbox.bka.sh/v1.2.0-beta"

# SSLCommerz Gateway (When credentials and documentation are available)
SSLCOMMERZ_STORE_ID="placeholder_store_id"
SSLCOMMERZ_STORE_PASSWD="placeholder_store_password"
SSLCOMMERZ_IS_SANDBOX="true"
```

> **Note:** As specified in `MASTER_PROMPT.md`, real payment providers remain in disabled/unconfigured status until actual official credentials and verified integration docs are provided.

---

## 3. Endpoints

### 1. `GET /api/payments/config`
Retrieves public status of all registered payment providers (e.g., whether configured, sandbox/mock mode, supported payment methods). Never reveals secrets.

### 2. `POST /api/payments/initiate`
Initiates a payment session for an authenticated customer's order.
- **Headers:** `Cookie: mb_auth_session=<token>`
- **Body:**
```json
{
  "orderId": "uuid-here",
  "providerName": "dev-safe-adapter"
}
```

### 3. `POST /api/payments/webhook?provider=dev-safe-adapter`
Receives and processes provider events.
- **Header:** `x-dev-signature: <hmac-sha256-hex>`
- **Body:**
```json
{
  "eventId": "EVT-10001",
  "eventType": "payment.succeeded",
  "orderId": "uuid-here",
  "orderNumber": "ORD-2026-0001",
  "amount": 5000.00,
  "currency": "BDT",
  "providerTrxId": "TRX-777888"
}
```

---

## 4. Sandbox Testing Procedure

### Step 1: Run the automated test suite
```bash
npx tsx --test tests/payment.test.ts
```
This tests:
1. Payload sanitizer strips CVV, card numbers, passwords, and API keys.
2. Unconfigured providers report missing configuration state cleanly without claiming completion.
3. Amount and currency reconciliation checks.
4. Cryptographic HMAC signature verification and rejection of tampered/missing signatures.
5. Safe development mock generation with informational redirect markers.
6. End-to-end database lifecycle: atomic state transition, idempotent duplicate event handling, and audit logging.

### Step 2: Testing via HTTP (Curl)
Generate an HMAC SHA-256 signature for your test payload using Node.js:
```bash
node -e "
const crypto = require('crypto');
const body = JSON.stringify({
  eventId: 'TEST-EVT-01',
  eventType: 'payment.succeeded',
  orderNumber: 'ORD-TEST-0001',
  amount: 2500.00,
  currency: 'BDT',
  providerTrxId: 'DEV-TRX-001'
});
const sig = crypto.createHmac('sha256', 'dev-safe-test-secret-never-use-in-prod').update(body).digest('hex');
console.log('Signature:', sig);
console.log('Payload:', body);
"
```
Send the webhook request:
```bash
curl -X POST "http://localhost:3000/api/payments/webhook?provider=dev-safe-adapter" \
  -H "Content-Type: application/json" \
  -H "x-dev-signature: <SIGNATURE>" \
  -d '<PAYLOAD>'
```
Replay the identical request to verify idempotent handling (`"duplicate": true`).
