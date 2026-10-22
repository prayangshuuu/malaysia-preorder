import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../lib/prisma";
import { UserRole, QuoteStatus, OrderStatus } from "@prisma/client";
import {
  createOrVersionQuote,
  acceptQuote,
  rejectQuote,
  QuoteServiceError,
} from "../lib/quotes/service";

test("Quote Lifecycle: Versioning, Expiry, IDOR Ownership, and Concurrency Safe Acceptance", async () => {
  // 1. Setup isolated test actors
  const timestamp = Date.now();
  const adminUser = await prisma.user.create({
    data: {
      email: `admin_${timestamp}@example.com`,
      name: "Admin Staff",
      role: UserRole.ADMIN,
    },
  });

  const customerUser = await prisma.user.create({
    data: {
      email: `customer_${timestamp}@example.com`,
      name: "Customer Rahim",
      role: UserRole.CUSTOMER,
    },
  });

  const otherCustomer = await prisma.user.create({
    data: {
      email: `other_${timestamp}@example.com`,
      name: "Other User",
      role: UserRole.CUSTOMER,
    },
  });

  try {
    // 2. Create Inquiry for customerUser
    const inquiry = await prisma.productInquiry.create({
      data: {
        inquiryNumber: `INQ-TEST-${timestamp}`,
        userId: customerUser.id,
        productName: "Sony WH-1000XM5 Headphones",
        quantityRequested: 1,
      },
    });

    // 3. Admin creates Quote Version 1 (SENT)
    const quoteV1 = await createOrVersionQuote(
      {
        inquiryId: inquiry.id,
        status: QuoteStatus.SENT,
        validUntil: new Date(Date.now() + 86400000).toISOString(), // +1 day
        lineItems: [
          {
            title: "Sony WH-1000XM5 (Silver)",
            quantity: 1,
            unitPriceBDT: 38000,
            estUnitCostMYR: 1200,
          },
        ],
        serviceFeeBDT: 1500,
        customsFeeBDT: 500,
        discountBDT: 0,
        estCostMYR: 1200,
        estExchangeRate: 28.5,
        adminNotes: "Internal note: Supplier discount 5% applies",
        shippingOptions: [
          {
            id: "std-air",
            name: "Standard Air Courier",
            costBDT: 1000,
            estDaysMin: 7,
            estDaysMax: 10,
            isDefault: true,
          },
          {
            id: "exp-air",
            name: "DHL Express",
            costBDT: 2500,
            estDaysMin: 3,
            estDaysMax: 5,
            isDefault: false,
          },
        ],
        customerNotes: "Brand new original factory sealed unit.",
        termsAndConditions: "Pre-order non-refundable once procurement begins.",
      },
      { id: adminUser.id, email: adminUser.email, role: adminUser.role }
    );

    assert.equal(quoteV1.version, 1);
    assert.equal(quoteV1.status, QuoteStatus.SENT);
    // 38000 + 1500 + 1000 (std air) + 500 = 41000
    assert.equal(Number(quoteV1.totalAmountBDT), 41000);

    // 4. Test IDOR: otherCustomer tries to accept customerUser's quote -> MUST FAIL with 403
    await assert.rejects(
      async () => {
        await acceptQuote(
          {
            quoteId: quoteV1.id,
            selectedShippingOptionId: "std-air",
            shippingRecipientName: "Other Guy",
            shippingPhoneNumber: "01700000000",
            shippingStreetAddress: "Banani Rd 11",
            shippingDistrict: "Dhaka",
            shippingDivision: "Dhaka",
          },
          { id: otherCustomer.id, email: otherCustomer.email, name: otherCustomer.name }
        );
      },
      (err: any) => {
        assert.ok(err instanceof QuoteServiceError);
        assert.equal(err.code, "FORBIDDEN_OWNERSHIP");
        return true;
      }
    );

    // 5. Admin updates quote (creating Version 2, which supersedes Version 1)
    const quoteV2 = await createOrVersionQuote(
      {
        inquiryId: inquiry.id,
        status: QuoteStatus.SENT,
        validUntil: new Date(Date.now() + 86400000).toISOString(),
        lineItems: [
          {
            title: "Sony WH-1000XM5 (Silver) + Free Travel Case",
            quantity: 1,
            unitPriceBDT: 39000,
          },
        ],
        serviceFeeBDT: 1500,
        customsFeeBDT: 500,
        discountBDT: 1000, // special discount
        shippingOptions: [
          {
            id: "std-air",
            name: "Standard Air Courier",
            costBDT: 1000,
            estDaysMin: 7,
            estDaysMax: 10,
            isDefault: true,
          },
          {
            id: "exp-air",
            name: "DHL Express",
            costBDT: 2500,
            estDaysMin: 3,
            estDaysMax: 5,
            isDefault: false,
          },
        ],
      },
      { id: adminUser.id, email: adminUser.email, role: adminUser.role }
    );

    assert.equal(quoteV2.version, 2);

    // Verify quoteV1 is now SUPERSEDED
    const checkV1 = await prisma.quote.findUnique({ where: { id: quoteV1.id } });
    assert.equal(checkV1?.status, QuoteStatus.SUPERSEDED);

    // 6. Customer tries to accept old superseded quoteV1 -> MUST FAIL
    await assert.rejects(
      async () => {
        await acceptQuote(
          {
            quoteId: quoteV1.id,
            selectedShippingOptionId: "std-air",
            shippingRecipientName: "Rahim Chowdhury",
            shippingPhoneNumber: "01811111111",
            shippingStreetAddress: "House 12, Road 4, Dhanmondi",
            shippingDistrict: "Dhaka",
            shippingDivision: "Dhaka",
          },
          { id: customerUser.id, email: customerUser.email, name: customerUser.name }
        );
      },
      (err: any) => {
        assert.ok(err instanceof QuoteServiceError);
        assert.equal(err.code, "QUOTE_SUPERSEDED");
        return true;
      }
    );

    // 7. Test Expiry: Create an expired quote and verify rejection upon acceptance attempt
    const expiredQuote = await prisma.quote.create({
      data: {
        quoteNumber: `QUO-EXP-${timestamp}`,
        version: 3,
        inquiryId: inquiry.id,
        createdById: adminUser.id,
        status: QuoteStatus.SENT,
        validUntil: new Date(Date.now() - 3600000), // 1 hour ago in past
        itemsSubtotalBDT: 1000,
        totalAmountBDT: 1000,
      },
    });

    await assert.rejects(
      async () => {
        await acceptQuote(
          {
            quoteId: expiredQuote.id,
            selectedShippingOptionId: "default-option",
            shippingRecipientName: "Rahim Chowdhury",
            shippingPhoneNumber: "01811111111",
            shippingStreetAddress: "Dhanmondi",
            shippingDistrict: "Dhaka",
            shippingDivision: "Dhaka",
          },
          { id: customerUser.id, email: customerUser.email, name: customerUser.name }
        );
      },
      (err: any) => {
        assert.ok(err instanceof QuoteServiceError);
        assert.equal(err.code, "QUOTE_EXPIRED");
        return true;
      }
    );

    // 8. Customer accepts Version 2 selecting DHL Express option (exp-air: 2500 BDT)
    // Totals: subtotal 39000 + service 1500 + shipping 2500 + customs 500 - discount 1000 = 42500 BDT
    const acceptanceResult = await acceptQuote(
      {
        quoteId: quoteV2.id,
        selectedShippingOptionId: "exp-air",
        shippingRecipientName: "Rahim Chowdhury",
        shippingPhoneNumber: "01811111111",
        shippingStreetAddress: "House 12, Road 4, Dhanmondi",
        shippingDistrict: "Dhaka",
        shippingDivision: "Dhaka",
        shippingPostalCode: "1205",
        customerNotes: "Please deliver between 2pm - 6pm.",
      },
      { id: customerUser.id, email: customerUser.email, name: customerUser.name }
    );

    assert.ok(acceptanceResult.quote);
    assert.equal(acceptanceResult.quote.status, QuoteStatus.ACCEPTED);
    assert.equal(Number(acceptanceResult.quote.shippingFeeBDT), 2500);
    assert.equal(Number(acceptanceResult.quote.totalAmountBDT), 42500);
    assert.ok(acceptanceResult.quote.acceptedAt);

    // Order created verification
    assert.ok(acceptanceResult.order);
    assert.equal(acceptanceResult.order.status, OrderStatus.AWAITING_PAYMENT);
    assert.equal(Number(acceptanceResult.order.totalAmountBDT), 42500);
    assert.equal(acceptanceResult.order.shippingRecipientName, "Rahim Chowdhury");
    assert.equal(acceptanceResult.order.shippingDistrict, "Dhaka");

    // Snapshot verification
    assert.ok(acceptanceResult.snapshot);
    assert.equal(acceptanceResult.snapshot.selectedShippingOption.name, "DHL Express");
    assert.equal(acceptanceResult.snapshot.selectedShippingOption.costBDT, 2500);

    // 9. Concurrency test: Customer attempts to accept again -> MUST FAIL
    await assert.rejects(
      async () => {
        await acceptQuote(
          {
            quoteId: quoteV2.id,
            selectedShippingOptionId: "exp-air",
            shippingRecipientName: "Rahim Chowdhury",
            shippingPhoneNumber: "01811111111",
            shippingStreetAddress: "House 12, Road 4, Dhanmondi",
            shippingDistrict: "Dhaka",
            shippingDivision: "Dhaka",
          },
          { id: customerUser.id, email: customerUser.email, name: customerUser.name }
        );
      },
      (err: any) => {
        assert.ok(err instanceof QuoteServiceError);
        assert.equal(err.code, "ALREADY_ACCEPTED");
        return true;
      }
    );

    // 10. Attempting to create a new quote on an already-accepted inquiry -> MUST FAIL
    await assert.rejects(
      async () => {
        await createOrVersionQuote(
          {
            inquiryId: inquiry.id,
            status: QuoteStatus.SENT,
            validUntil: new Date(Date.now() + 86400000).toISOString(),
            lineItems: [{ title: "Extra item", quantity: 1, unitPriceBDT: 100 }],
            shippingOptions: [{ id: "opt", name: "Opt", costBDT: 100, estDaysMin: 1, estDaysMax: 2, isDefault: true }],
            serviceFeeBDT: 0,
            customsFeeBDT: 0,
            discountBDT: 0,
          },
          { id: adminUser.id, email: adminUser.email, role: adminUser.role }
        );
      },
      (err: any) => {
        assert.ok(err instanceof QuoteServiceError);
        assert.equal(err.code, "QUOTE_ALREADY_ACCEPTED");
        return true;
      }
    );
  } finally {
    // Cleanup test data safely
    await prisma.orderLineItem.deleteMany({
      where: { order: { customerId: { in: [customerUser.id, otherCustomer.id] } } },
    });
    await prisma.orderEvent.deleteMany({
      where: { order: { customerId: { in: [customerUser.id, otherCustomer.id] } } },
    });
    await prisma.orderStatusHistory.deleteMany({
      where: { order: { customerId: { in: [customerUser.id, otherCustomer.id] } } },
    });
    await prisma.order.deleteMany({
      where: { customerId: { in: [customerUser.id, otherCustomer.id] } },
    });
    await prisma.quoteLineItem.deleteMany({
      where: { quote: { inquiry: { userId: { in: [customerUser.id, otherCustomer.id] } } } },
    });
    await prisma.quote.deleteMany({
      where: { inquiry: { userId: { in: [customerUser.id, otherCustomer.id] } } },
    });
    await prisma.inquiryStatusHistory.deleteMany({
      where: { inquiry: { userId: { in: [customerUser.id, otherCustomer.id] } } },
    });
    await prisma.productInquiry.deleteMany({
      where: { userId: { in: [customerUser.id, otherCustomer.id] } },
    });
    await prisma.auditLog.deleteMany({
      where: { actorId: { in: [adminUser.id, customerUser.id, otherCustomer.id] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [adminUser.id, customerUser.id, otherCustomer.id] } },
    });
  }
});
