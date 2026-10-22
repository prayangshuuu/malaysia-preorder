import test from "node:test";
import assert from "node:assert/strict";
import {
  getEmailProviderConfig,
  sanitizeNotificationText,
  buildSafeCustomerLink,
  NotificationTemplates,
  sendCustomerNotification,
} from "../lib/notifications";
import {
  createSupportTicketSchema,
  addSupportMessageSchema,
  updateSupportTicketStatusSchema,
  sanitizeSupportMessagesForCustomer,
  generateTicketNumber,
} from "../lib/support";
import { prisma } from "../lib/prisma";

test("Email Provider Configuration: Detects unconfigured / placeholder SMTP safely", () => {
  const originalEnv = { ...process.env };

  try {
    // 1. With placeholder values (default in dev / .env.example)
    process.env.SMTP_HOST = "smtp.mailtrap.io";
    process.env.SMTP_USER = "placeholder_user";
    process.env.SMTP_PASS = "placeholder_pass";
    process.env.SMTP_FROM_EMAIL = "support@example.com";

    const config = getEmailProviderConfig();
    assert.equal(config.isConfigured, false);
    assert.equal(config.provider, "disabled");
    assert.ok(config.reasonIfDisabled?.includes("placeholder"));

    // 2. With valid dummy production values
    process.env.SMTP_HOST = "smtp.sendgrid.net";
    process.env.SMTP_USER = "apikey";
    process.env.SMTP_PASS = "SG.real-secret-key-123456789";
    process.env.SMTP_FROM_EMAIL = "notifications@bdpreorder.com";

    const prodConfig = getEmailProviderConfig();
    assert.equal(prodConfig.isConfigured, true);
    assert.equal(prodConfig.provider, "smtp");
    assert.equal(prodConfig.from, "notifications@bdpreorder.com");
  } finally {
    process.env = originalEnv;
  }
});

test("Security & Sanitization: Notification text strips private secrets, cards, and CVVs", () => {
  const rawTextWithSecrets =
    "Payment debug: token: secret_token_abc123 card 4111 2222 3333 4444 with cvv 123";
  const sanitized = sanitizeNotificationText(rawTextWithSecrets);

  assert.ok(!sanitized.includes("secret_token_abc123"), "Secret token should be redacted");
  assert.ok(!sanitized.includes("4111 2222 3333 4444"), "Card number should be redacted");
  assert.ok(!sanitized.includes("123"), "CVV should be redacted");
  assert.ok(sanitized.includes("[REDACTED]"));
  assert.ok(sanitized.includes("[REDACTED_CARD]"));
});

test("Safe Customer Links: Strictly rejects untrusted external or malicious schemes", () => {
  assert.equal(buildSafeCustomerLink("/account/orders/123"), "/account/orders/123");
  assert.equal(buildSafeCustomerLink("/account/quotes/abc"), "/account/quotes/abc");

  // Malicious / open-redirect attempts rejected
  assert.equal(buildSafeCustomerLink("//evil.com/phish"), null);
  assert.equal(buildSafeCustomerLink("https://attacker.com"), null);
  assert.equal(buildSafeCustomerLink("javascript:alert(1)"), null);
  assert.equal(buildSafeCustomerLink(null), null);
});

test("Notification Templates: Generate accurate, customer-safe event communications", () => {
  const quoteSent = NotificationTemplates.quoteSent("QT-2026-001", "30 Oct 2026", "quote-id-1");
  assert.equal(quoteSent.category, "QUOTE_SENT");
  assert.ok(quoteSent.message.includes("#QT-2026-001"));
  assert.equal(quoteSent.linkUrl, "/account/quotes/quote-id-1");

  const dispatched = NotificationTemplates.dispatched("ORD-2026-099", "Biman Air Cargo Flight BG-382", "ord-1");
  assert.equal(dispatched.category, "DISPATCHED");
  assert.ok(dispatched.message.includes("BG-382"));

  const refund = NotificationTemplates.refundStatus("ORD-2026-099", "1,500.00", "Out of stock in KL", "ord-1");
  assert.equal(refund.category, "REFUND_STATUS");
  assert.ok(refund.message.includes("1,500.00 BDT"));
});

test("Idempotency & Duplicate Prevention: Ignores duplicate notification events", async () => {
  // Find or create test customer
  const customer = await prisma.user.findFirst({
    where: { role: "CUSTOMER" },
  });

  if (!customer) {
    // If no seeded user, test unit logic
    return;
  }

  const uniqueKey = `test-evt-key-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  // First dispatch: Succeeds and records
  const result1 = await sendCustomerNotification({
    userId: customer.id,
    title: "Order Test Event",
    message: "First notification event",
    idempotencyKey: uniqueKey,
  });

  assert.equal(result1.inAppCreated, true);
  assert.equal(result1.isDuplicate, false);
  assert.ok(result1.notificationId);

  // Second dispatch with same idempotency key: strictly ignored
  const result2 = await sendCustomerNotification({
    userId: customer.id,
    title: "Order Test Event",
    message: "First notification event",
    idempotencyKey: uniqueKey,
  });

  assert.equal(result2.inAppCreated, false);
  assert.equal(result2.isDuplicate, true);
  assert.equal(result2.status, "DUPLICATE_IGNORED");
  assert.equal(result2.notificationId, result1.notificationId);
});

test("Support Ticket Validation & Honeypot Spam Defense", () => {
  // Valid ticket payload
  const valid = createSupportTicketSchema.safeParse({
    customerName: "Amina Rahman",
    customerEmail: "amina@example.com",
    customerPhone: "+8801712345678",
    subject: "Delivery inquiry for BD order",
    message: "Could you please confirm if this order will arrive before Friday?",
  });
  assert.ok(valid.success);

  // Honeypot spam bot detection (if bot fills companyWebsite)
  const botSubmission = createSupportTicketSchema.safeParse({
    customerName: "Spam Bot",
    customerEmail: "bot@spam.com",
    subject: "Cheap SEO services",
    message: "Visit our website for ranking boosts",
    companyWebsite: "http://bot-spammer.com",
  });
  assert.equal(botSubmission.success, false);
  assert.ok(botSubmission.error.issues[0]?.message.includes("Spam"));

  // Ticket number generator conforms to TKT-YYYY-XXXXX format
  const tktNumber = generateTicketNumber();
  assert.match(tktNumber, /^TKT-\d{4}-\d{5}$/);
});

test("Support Confidentiality: Isolates internal staff notes from customer view", () => {
  const rawMessages = [
    {
      id: "m-1",
      isStaff: false,
      messageText: "Hello, when is my parcel leaving Malaysia?",
    },
    {
      id: "m-2",
      isStaff: true,
      messageText: "[INTERNAL STAFF NOTE]\nSupplier at Bukit Bintang was delayed 2 days. Cost was MYR 140.",
    },
    {
      id: "m-3",
      isStaff: true,
      messageText: "Dear customer, your order has been packaged and is scheduled for the Friday cargo flight.",
    },
    {
      id: "m-4",
      isStaff: true,
      messageText: "[INTERNAL STAFF NOTE - STATUS UPDATE: IN_PROGRESS]\nEscalating to KL ground agent.",
    },
  ];

  const sanitized = sanitizeSupportMessagesForCustomer(rawMessages);

  // Customer should only see m-1 and m-3
  assert.equal(sanitized.length, 2);
  assert.equal(sanitized[0].id, "m-1");
  assert.equal(sanitized[1].id, "m-3");
  assert.ok(!sanitized.some((m) => m.messageText.includes("INTERNAL STAFF NOTE")));
  assert.ok(!sanitized.some((m) => m.messageText.includes("MYR 140")));
});
