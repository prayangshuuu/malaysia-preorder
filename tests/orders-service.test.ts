import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../lib/prisma";
import {
  createOrderFromAcceptedQuote,
  updateOrderStateByAdmin,
  OrderServiceError,
} from "../lib/orders";
import { QuoteStatus, OrderStatus, UserRole } from "@prisma/client";

test("Quote-to-Order Creation, Idempotency, and RBAC Ownership", async (t) => {
  // Setup test customer and admin users
  const testCustomerEmail = `test-cust-${Date.now()}@test.local`;
  const otherCustomerEmail = `other-cust-${Date.now()}@test.local`;
  const testAdminEmail = `test-admin-${Date.now()}@test.local`;

  const customer = await prisma.user.create({
    data: {
      email: testCustomerEmail,
      name: "Test Customer",
      role: UserRole.CUSTOMER,
    },
  });

  const otherCustomer = await prisma.user.create({
    data: {
      email: otherCustomerEmail,
      name: "Other Customer",
      role: UserRole.CUSTOMER,
    },
  });

  const admin = await prisma.user.create({
    data: {
      email: testAdminEmail,
      name: "Test Admin",
      role: UserRole.ADMIN,
    },
  });

  t.after(async () => {
    // Cleanup created test records
    await prisma.orderEvent.deleteMany({
      where: { order: { customerId: customer.id } },
    });
    await prisma.orderStatusHistory.deleteMany({
      where: { order: { customerId: customer.id } },
    });
    await prisma.orderLineItem.deleteMany({
      where: { order: { customerId: customer.id } },
    });
    await prisma.order.deleteMany({
      where: { customerId: customer.id },
    });
    await prisma.quoteLineItem.deleteMany({
      where: { quote: { inquiry: { userId: customer.id } } },
    });
    await prisma.quote.deleteMany({
      where: { inquiry: { userId: customer.id } },
    });
    await prisma.productInquiry.deleteMany({
      where: { userId: customer.id },
    });
    await prisma.auditLog.deleteMany({
      where: { actorId: { in: [customer.id, otherCustomer.id, admin.id] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [customer.id, otherCustomer.id, admin.id] } },
    });
  });

  // 1. Create Inquiry and Quote
  const inquiry = await prisma.productInquiry.create({
    data: {
      inquiryNumber: `INQ-TEST-${Date.now()}`,
      userId: customer.id,
      productName: "Sony WH-1000XM5 Headphone",
      quantityRequested: 1,
    },
  });

  const validUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days in future
  const quote = await prisma.quote.create({
    data: {
      quoteNumber: `QUO-TEST-${Date.now()}`,
      version: 1,
      inquiryId: inquiry.id,
      createdById: admin.id,
      status: QuoteStatus.SENT,
      validUntil,
      currency: "BDT",
      itemsSubtotalBDT: 35000,
      serviceFeeBDT: 2000,
      shippingFeeBDT: 1500,
      customsFeeBDT: 500,
      totalAmountBDT: 39000,
      estCostMYR: 1200,
      estExchangeRate: 27.5,
      shippingMethod: "Air Express Courier",
      lineItems: {
        create: [
          {
            title: "Sony WH-1000XM5 (Black)",
            quantity: 1,
            unitPriceBDT: 35000,
            totalPriceBDT: 35000,
            estUnitCostMYR: 1200,
          },
        ],
      },
    },
  });

  const validShippingInput = {
    quoteId: quote.id,
    shippingAddress: {
      recipientName: "Test Customer",
      phoneNumber: "01700000000",
      streetAddress: "Road 10, Gulshan 1",
      thanaOrUpazila: "Gulshan",
      district: "Dhaka",
      division: "Dhaka",
      postalCode: "1212",
      country: "Bangladesh",
    },
    customerNotes: "Test delivery instructions",
  };

  // 2. Test Cross-Customer IDOR Prevention: Other customer cannot create order from this quote
  await assert.rejects(
    async () => {
      await createOrderFromAcceptedQuote(validShippingInput, {
        id: otherCustomer.id,
        email: otherCustomer.email,
        role: otherCustomer.role,
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof OrderServiceError);
      assert.equal(err.statusCode, 403);
      return true;
    }
  );

  // 3. Test Successful Quote-to-Order Creation by Owner
  const order = await createOrderFromAcceptedQuote(validShippingInput, {
    id: customer.id,
    email: customer.email,
    role: customer.role,
  });

  assert.ok(order.id);
  assert.match(order.orderNumber, /^ORD-\d{8}-[0-9A-F]{6}$/);
  assert.equal(order.customerId, customer.id);
  assert.equal(order.status, OrderStatus.AWAITING_PAYMENT);
  assert.equal(Number(order.totalAmountBDT), 39000);
  assert.equal(order.lineItems.length, 1);
  assert.equal(order.lineItems[0].itemTitle, "Sony WH-1000XM5 (Black)");
  assert.equal(order.events.length, 1);
  assert.equal(order.events[0].eventType, "ORDER_CREATED");

  // Verify quote status became ACCEPTED atomically
  const refreshedQuote = await prisma.quote.findUnique({ where: { id: quote.id } });
  assert.equal(refreshedQuote?.status, QuoteStatus.ACCEPTED);
  assert.ok(refreshedQuote?.acceptedAt);

  // 4. Test Duplicate Submission Prevention (Idempotency)
  await assert.rejects(
    async () => {
      await createOrderFromAcceptedQuote(validShippingInput, {
        id: customer.id,
        email: customer.email,
        role: customer.role,
      });
    },
    (err: unknown) => {
      assert.ok(err instanceof OrderServiceError);
      assert.equal(err.statusCode, 409); // Conflict / duplicate
      return true;
    }
  );

  // 5. Test State Transitions by Staff: AWAITING_PAYMENT -> PAID
  const paidOrder = await updateOrderStateByAdmin(
    {
      orderId: order.id,
      status: OrderStatus.PAID,
      reason: "Verified bKash merchant transaction reference",
    },
    {
      id: admin.id,
      email: admin.email,
      role: admin.role,
    }
  );

  assert.equal(paidOrder.status, OrderStatus.PAID);
  // An append-only event was recorded
  assert.ok(paidOrder.events.some((e) => e.eventType === "ORDER_STATUS_CHANGED"));

  // 6. Test Non-Staff cannot perform order transitions
  await assert.rejects(
    async () => {
      await updateOrderStateByAdmin(
        {
          orderId: order.id,
          status: OrderStatus.PROCUREMENT,
        },
        {
          id: customer.id,
          email: customer.email,
          role: customer.role,
        }
      );
    },
    (err: unknown) => {
      assert.ok(err instanceof OrderServiceError);
      assert.equal(err.statusCode, 403);
      return true;
    }
  );
});
