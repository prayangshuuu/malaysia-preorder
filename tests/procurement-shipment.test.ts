import test from "node:test";
import assert from "node:assert/strict";
import { OrderStatus, ProcurementStatus, ShipmentStatus, PaymentStatus } from "@prisma/client";
import {
  generateProcurementCode,
  generateShipmentNumber,
  recordProcurementSchema,
  createShipmentSchema,
  updateShipmentSchema,
  addShipmentEventSchema,
  addOrderTimelineEventSchema,
  createSupplierSchema,
} from "../lib/procurement-shipment";
import {
  validateOrderStatusTransition,
  validateProcurementStatusTransition,
  validateShipmentStatusTransition,
  InvalidStatusTransitionError,
} from "../lib/orders/state-machine";
import { sanitizeCustomerOrder } from "../lib/orders/sanitizer";

test("Code Generator: procurement and shipment reference numbers", () => {
  const date = new Date("2026-10-22T12:00:00Z");
  const procCode1 = generateProcurementCode(date);
  const procCode2 = generateProcurementCode(date);
  const shpNum1 = generateShipmentNumber(date);
  const shpNum2 = generateShipmentNumber(date);

  assert.match(procCode1, /^PROC-20261022-[0-9A-F]{6}$/);
  assert.match(procCode2, /^PROC-20261022-[0-9A-F]{6}$/);
  assert.notEqual(procCode1, procCode2);

  assert.match(shpNum1, /^SHP-20261022-[0-9A-F]{6}$/);
  assert.match(shpNum2, /^SHP-20261022-[0-9A-F]{6}$/);
  assert.notEqual(shpNum1, shpNum2);
});

test("Validation Schemas: Procurement, Shipment, and Supplier inputs", () => {
  const sampleUuid = "123e4567-e89b-12d3-a456-426614174000";

  // Valid procurement input
  const validProc = recordProcurementSchema.safeParse({
    orderId: sampleUuid,
    status: ProcurementStatus.PURCHASED,
    purchaseCostMYR: "150.50",
    exchangeRateUsed: "28.50",
    supplierInvoiceRef: "INV-8419",
    notes: "Purchased at official store",
    updateOrderStatusToProcurement: true,
  });
  assert.equal(validProc.success, true);
  if (validProc.success) {
    assert.equal(validProc.data.purchaseCostMYR, 150.5);
    assert.equal(validProc.data.exchangeRateUsed, 28.5);
  }

  // Reject negative purchase cost
  const invalidProc = recordProcurementSchema.safeParse({
    orderId: sampleUuid,
    purchaseCostMYR: -50,
    exchangeRateUsed: 28,
  });
  assert.equal(invalidProc.success, false);

  // Valid shipment input
  const validShipment = createShipmentSchema.safeParse({
    orderId: sampleUuid,
    carrierName: "Malaysia Airlines Cargo",
    trackingNumber: "MH-998822",
    status: ShipmentStatus.READY_TO_DISPATCH,
    dispatchOrigin: "Malaysia",
    destinationCountry: "Bangladesh",
    weightKg: "2.45",
  });
  assert.equal(validShipment.success, true);

  // Valid supplier input
  const validSupplier = createSupplierSchema.safeParse({
    name: "Petaling Jaya Gadgets Sdn Bhd",
    email: "sales@pjgadgets.my",
    phone: "+60 12-345 6789",
    city: "Petaling Jaya",
  });
  assert.equal(validSupplier.success, true);

  // Valid timeline event input
  const validTimeline = addOrderTimelineEventSchema.safeParse({
    orderId: sampleUuid,
    eventType: "CUSTOMS_ASSESSMENT",
    title: "Dhaka Airport Customs Clearance",
    description: "Assessment completed, import duty cleared.",
    location: "Hazrat Shahjalal Airport",
    isCustomerVisible: true,
  });
  assert.equal(validTimeline.success, true);
});

test("State Transition Rules: Independent state machines for order, procurement, and shipment", () => {
  // Procurement state transitions
  assert.doesNotThrow(() => {
    validateProcurementStatusTransition(ProcurementStatus.NOT_STARTED, ProcurementStatus.SOURCING);
    validateProcurementStatusTransition(ProcurementStatus.SOURCING, ProcurementStatus.PURCHASED);
    validateProcurementStatusTransition(ProcurementStatus.SOURCING, ProcurementStatus.UNAVAILABLE);
  });

  // Cannot jump from NOT_STARTED straight to PURCHASED without sourcing
  assert.throws(() => {
    validateProcurementStatusTransition(ProcurementStatus.NOT_STARTED, ProcurementStatus.PURCHASED);
  }, InvalidStatusTransitionError);

  // Shipment state transitions (including delay, customs, delivery, return, loss)
  assert.doesNotThrow(() => {
    validateShipmentStatusTransition(ShipmentStatus.NOT_READY, ShipmentStatus.READY_TO_DISPATCH);
    validateShipmentStatusTransition(ShipmentStatus.READY_TO_DISPATCH, ShipmentStatus.DISPATCHED);
    validateShipmentStatusTransition(ShipmentStatus.DISPATCHED, ShipmentStatus.IN_TRANSIT);
    validateShipmentStatusTransition(ShipmentStatus.IN_TRANSIT, ShipmentStatus.DELAYED);
    validateShipmentStatusTransition(ShipmentStatus.DELAYED, ShipmentStatus.CUSTOMS);
    validateShipmentStatusTransition(ShipmentStatus.CUSTOMS, ShipmentStatus.OUT_FOR_DELIVERY);
    validateShipmentStatusTransition(ShipmentStatus.OUT_FOR_DELIVERY, ShipmentStatus.DELIVERED);
  });

  // Shipment exception flows: CUSTOMS -> RETURNED, IN_TRANSIT -> LOST
  assert.doesNotThrow(() => {
    validateShipmentStatusTransition(ShipmentStatus.CUSTOMS, ShipmentStatus.RETURNED);
    validateShipmentStatusTransition(ShipmentStatus.IN_TRANSIT, ShipmentStatus.LOST);
  });

  // DELIVERED, RETURNED, and LOST are terminal states
  assert.throws(() => {
    validateShipmentStatusTransition(ShipmentStatus.DELIVERED, ShipmentStatus.IN_TRANSIT);
  }, InvalidStatusTransitionError);
  assert.throws(() => {
    validateShipmentStatusTransition(ShipmentStatus.LOST, ShipmentStatus.READY_TO_DISPATCH);
  }, InvalidStatusTransitionError);
});

test("Customer Data Isolation: strictly isolates private supplier costs, receipts, and internal notes", () => {
  const mockOrder = {
    id: "ord-test-iso-1",
    orderNumber: "ORD-20261022-XYZ999",
    customerId: "cust-iso-1",
    status: OrderStatus.PROCUREMENT,
    paymentStatus: PaymentStatus.SUCCEEDED,
    procurementStatus: ProcurementStatus.PURCHASED,
    shipmentStatus: ShipmentStatus.READY_TO_DISPATCH,
    currency: "BDT",
    itemsSubtotalBDT: 25000,
    serviceFeeBDT: 2000,
    shippingFeeBDT: 1500,
    customsFeeBDT: 500,
    discountBDT: 0,
    totalAmountBDT: 29000,
    paidAmountBDT: 29000,
    shippingRecipientName: "Tanzim Hasan",
    shippingPhoneNumber: "01711223344",
    shippingStreetAddress: "Banani 11",
    shippingThanaOrUpazila: "Banani",
    shippingDistrict: "Dhaka",
    shippingDivision: "Dhaka",
    shippingPostalCode: "1213",
    shippingCountry: "Bangladesh",
    customerNotes: "Deliver after 4 PM",
    adminNotes: "TOP SECRET: Supplier CIMB Bank Account 882190124. Wholesale cost RM 650.",
    createdAt: new Date(),
    updatedAt: new Date(),
    lineItems: [
      {
        id: "item-1",
        itemTitle: "Sony WH-1000XM5 Headphones",
        itemDescription: "Silver color",
        sourceUrl: "https://sony.com.my",
        quantity: 1,
        unitPriceBDT: 25000,
        totalPriceBDT: 25000,
      },
    ],
    events: [
      {
        id: "evt-1",
        eventType: "PROCUREMENT_LOGGED",
        title: "Item Sourcing Recorded in Malaysia",
        description: "Our Kuala Lumpur team has acquired the items for your pre-order.",
        isCustomerVisible: true,
        createdAt: new Date(),
      },
      {
        id: "evt-2",
        eventType: "INTERNAL_PROMPT",
        title: "Supplier Receipt Verified",
        description: "Paid RM 650 via internal CIMB transfer. Supplier Invoice #9981.",
        isCustomerVisible: false, // Internal staff only
        createdAt: new Date(),
      },
    ],
    shipments: [
      {
        id: "shp-1",
        shipmentNumber: "SHP-20261022-778899",
        carrierName: "Consolidated Air Freight",
        trackingNumber: "AWB-89124",
        trackingUrl: "https://carrier.example/track?id=AWB-89124",
        status: ShipmentStatus.READY_TO_DISPATCH,
        dispatchOrigin: "Malaysia",
        destinationCountry: "Bangladesh",
        estimatedDeparture: new Date("2026-10-25"),
        actualDeparture: null,
        estimatedArrival: new Date("2026-10-28"),
        actualArrival: null,
        weightKg: 1.5,
        internalCargoNotes: "CONFIDENTIAL: Air cargo consolidated pallet #49B",
        events: [
          {
            id: "sevt-1",
            status: ShipmentStatus.READY_TO_DISPATCH,
            location: "Kuala Lumpur Warehouse",
            description: "Consignment weighed, packaged, and labeled for international air departure.",
            isPublic: true,
            timestamp: new Date(),
          },
          {
            id: "sevt-2",
            status: ShipmentStatus.READY_TO_DISPATCH,
            location: "Kuala Lumpur Warehouse",
            description: "Flight Cargo manifest slot confirmed with freight broker. Pallet cost $120.",
            isPublic: false, // Private event
            timestamp: new Date(),
          },
        ],
      },
    ],
  };

  const sanitized = sanitizeCustomerOrder(mockOrder);

  // 1. Admin notes are completely absent
  assert.equal((sanitized as { adminNotes?: string }).adminNotes, undefined);

  // 2. Events: Only the public event is returned (1 of 2)
  assert.equal(sanitized.events.length, 1);
  assert.equal(sanitized.events[0].title, "Item Sourcing Recorded in Malaysia");

  // 3. Shipment: internalCargoNotes is completely stripped
  assert.equal((sanitized.shipments[0] as { internalCargoNotes?: string }).internalCargoNotes, undefined);

  // 4. Shipment events: Only isPublic = true is returned (1 of 2)
  assert.equal(sanitized.shipments[0].events.length, 1);
  assert.equal(sanitized.shipments[0].events[0].location, "Kuala Lumpur Warehouse");

  // 5. Customer-safe fields are retained
  assert.equal(sanitized.shipments[0].carrierName, "Consolidated Air Freight");
  assert.equal(sanitized.shipments[0].trackingNumber, "AWB-89124");
  assert.equal(sanitized.shipments[0].dispatchOrigin, "Malaysia");
  assert.equal(sanitized.shipments[0].destinationCountry, "Bangladesh");
});
