import test from "node:test";
import assert from "node:assert/strict";
import { OrderStatus, ProcurementStatus, ShipmentStatus, PaymentStatus } from "@prisma/client";
import {
  validateOrderStatusTransition,
  validateProcurementStatusTransition,
  validateShipmentStatusTransition,
  validatePaymentStatusTransition,
  InvalidStatusTransitionError,
  generateOrderNumber,
  sanitizeCustomerOrder,
} from "../lib/orders";

test("Order Number Generation: format and entropy", () => {
  const date = new Date("2026-10-22T12:00:00Z");
  const orderNum1 = generateOrderNumber(date);
  const orderNum2 = generateOrderNumber(date);

  assert.match(orderNum1, /^ORD-20261022-[0-9A-F]{6}$/);
  assert.match(orderNum2, /^ORD-20261022-[0-9A-F]{6}$/);
  // Non-sequential and collision resistant
  assert.notEqual(orderNum1, orderNum2);
});

test("Order Status State Machine: valid transitions", () => {
  // AWAITING_PAYMENT -> PAID
  assert.doesNotThrow(() => {
    validateOrderStatusTransition(OrderStatus.AWAITING_PAYMENT, OrderStatus.PAID);
  });

  // AWAITING_PAYMENT -> PAYMENT_REVIEW
  assert.doesNotThrow(() => {
    validateOrderStatusTransition(OrderStatus.AWAITING_PAYMENT, OrderStatus.PAYMENT_REVIEW);
  });

  // PAID -> PROCUREMENT
  assert.doesNotThrow(() => {
    validateOrderStatusTransition(OrderStatus.PAID, OrderStatus.PROCUREMENT);
  });

  // PROCUREMENT -> PACKING
  assert.doesNotThrow(() => {
    validateOrderStatusTransition(OrderStatus.PROCUREMENT, OrderStatus.PACKING);
  });

  // PACKING -> DISPATCHED
  assert.doesNotThrow(() => {
    validateOrderStatusTransition(OrderStatus.PACKING, OrderStatus.DISPATCHED);
  });

  // DISPATCHED -> IN_TRANSIT -> CUSTOMS -> OUT_FOR_DELIVERY -> DELIVERED
  assert.doesNotThrow(() => {
    validateOrderStatusTransition(OrderStatus.DISPATCHED, OrderStatus.IN_TRANSIT);
    validateOrderStatusTransition(OrderStatus.IN_TRANSIT, OrderStatus.CUSTOMS);
    validateOrderStatusTransition(OrderStatus.CUSTOMS, OrderStatus.OUT_FOR_DELIVERY);
    validateOrderStatusTransition(OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED);
  });

  // Same status is a no-op
  assert.doesNotThrow(() => {
    validateOrderStatusTransition(OrderStatus.PAID, OrderStatus.PAID);
  });
});

test("Order Status State Machine: rejects illegal jumps and backwards steps", () => {
  // Cannot jump directly from AWAITING_PAYMENT to DELIVERED
  assert.throws(
    () => {
      validateOrderStatusTransition(OrderStatus.AWAITING_PAYMENT, OrderStatus.DELIVERED);
    },
    (err: unknown) => err instanceof InvalidStatusTransitionError
  );

  // Cannot jump backwards from DELIVERED to AWAITING_PAYMENT
  assert.throws(
    () => {
      validateOrderStatusTransition(OrderStatus.DELIVERED, OrderStatus.AWAITING_PAYMENT);
    },
    (err: unknown) => err instanceof InvalidStatusTransitionError
  );

  // CANCELLED is terminal
  assert.throws(
    () => {
      validateOrderStatusTransition(OrderStatus.CANCELLED, OrderStatus.PAID);
    },
    (err: unknown) => err instanceof InvalidStatusTransitionError
  );
});

test("Procurement Status State Machine: valid and invalid transitions", () => {
  assert.doesNotThrow(() => {
    validateProcurementStatusTransition(ProcurementStatus.NOT_STARTED, ProcurementStatus.SOURCING);
    validateProcurementStatusTransition(ProcurementStatus.SOURCING, ProcurementStatus.PURCHASED);
  });

  // Cannot transition directly from NOT_STARTED to PURCHASED
  assert.throws(
    () => {
      validateProcurementStatusTransition(ProcurementStatus.NOT_STARTED, ProcurementStatus.PURCHASED);
    },
    (err: unknown) => err instanceof InvalidStatusTransitionError
  );
});

test("Shipment Status State Machine: transitions and validations", () => {
  assert.doesNotThrow(() => {
    validateShipmentStatusTransition(ShipmentStatus.NOT_READY, ShipmentStatus.READY_TO_DISPATCH);
    validateShipmentStatusTransition(ShipmentStatus.READY_TO_DISPATCH, ShipmentStatus.DISPATCHED);
    validateShipmentStatusTransition(ShipmentStatus.DISPATCHED, ShipmentStatus.IN_TRANSIT);
  });

  // Cannot jump from NOT_READY to DELIVERED
  assert.throws(
    () => {
      validateShipmentStatusTransition(ShipmentStatus.NOT_READY, ShipmentStatus.DELIVERED);
    },
    (err: unknown) => err instanceof InvalidStatusTransitionError
  );
});

test("Payment Status State Machine: transitions", () => {
  assert.doesNotThrow(() => {
    validatePaymentStatusTransition(PaymentStatus.PENDING, PaymentStatus.SUCCEEDED);
    validatePaymentStatusTransition(PaymentStatus.SUCCEEDED, PaymentStatus.REFUNDED);
  });

  // Cannot revert from SUCCEEDED to PENDING
  assert.throws(
    () => {
      validatePaymentStatusTransition(PaymentStatus.SUCCEEDED, PaymentStatus.PENDING);
    },
    (err: unknown) => err instanceof InvalidStatusTransitionError
  );
});

test("Customer Sanitization: strips private supplier costs, admin notes, and private events", () => {
  const mockOrderWithSecrets = {
    id: "ord-test-1",
    orderNumber: "ORD-20261022-ABCD12",
    customerId: "cust-1",
    status: OrderStatus.PAID,
    paymentStatus: PaymentStatus.SUCCEEDED,
    procurementStatus: ProcurementStatus.PURCHASED,
    shipmentStatus: ShipmentStatus.READY_TO_DISPATCH,
    currency: "BDT",
    itemsSubtotalBDT: 15000,
    serviceFeeBDT: 1000,
    shippingFeeBDT: 1200,
    customsFeeBDT: 300,
    discountBDT: 0,
    totalAmountBDT: 17500,
    paidAmountBDT: 17500,
    shippingRecipientName: "Rahim Chowdhury",
    shippingPhoneNumber: "01812345678",
    shippingStreetAddress: "123 Green Road",
    shippingThanaOrUpazila: "Tejgaon",
    shippingDistrict: "Dhaka",
    shippingDivision: "Dhaka",
    shippingPostalCode: "1215",
    shippingCountry: "Bangladesh",
    customerNotes: "Please handle carefully",
    adminNotes: "CONFIDENTIAL: Sourced at Petaling Street supplier for RM 420; internal margin 38%",
    createdAt: new Date(),
    updatedAt: new Date(),
    lineItems: [
      {
        id: "item-1",
        itemTitle: "Mechanical Keyboard",
        itemDescription: "Brown switches",
        sourceUrl: "https://example.com/item",
        quantity: 1,
        unitPriceBDT: 15000,
        totalPriceBDT: 15000,
      },
    ],
    events: [
      {
        id: "evt-1",
        eventType: "ORDER_CREATED",
        title: "Order Placed",
        description: "Public event description",
        isCustomerVisible: true,
        createdAt: new Date(),
      },
      {
        id: "evt-2",
        eventType: "INTERNAL_NOTE",
        title: "Supplier Paid",
        description: "Paid RM 420 via CIMB Bank",
        isCustomerVisible: false,
        createdAt: new Date(),
      },
    ],
    quote: {
      quoteNumber: "QUO-001",
      shippingMethod: "Air Cargo",
      estDeliveryDaysMin: 5,
      estDeliveryDaysMax: 8,
      estDispatchDaysMin: 2,
      estDispatchDaysMax: 4,
    },
    payments: [],
    shipments: [],
  };

  const sanitized = sanitizeCustomerOrder(mockOrderWithSecrets);

  // Invariant 1: adminNotes is NOT present
  assert.equal((sanitized as { adminNotes?: string }).adminNotes, undefined);
  // Invariant 2: private events (isCustomerVisible = false) are stripped
  assert.equal(sanitized.events.length, 1);
  assert.equal(sanitized.events[0].title, "Order Placed");
  // Invariant 3: Customer-safe address and financial amounts are properly preserved
  assert.equal(sanitized.totalAmountBDT, 17500);
  assert.equal(sanitized.shippingAddress.recipientName, "Rahim Chowdhury");
});
