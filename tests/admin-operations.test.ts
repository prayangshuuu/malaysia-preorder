import test from "node:test";
import assert from "node:assert/strict";
import { UserRole, OrderStatus, PaymentStatus, ProcurementStatus, ShipmentStatus } from "@prisma/client";
import { isAdminOrStaffRole, AuthorizationError } from "../lib/auth/rbac";

test("Admin Operations RBAC: Staff role checks enforce server authorization", () => {
  // Staff roles permitted
  assert.equal(isAdminOrStaffRole(UserRole.ADMIN), true);
  assert.equal(isAdminOrStaffRole(UserRole.OPERATIONS), true);
  assert.equal(isAdminOrStaffRole(UserRole.FINANCE), true);
  assert.equal(isAdminOrStaffRole(UserRole.SUPPORT), true);

  // Customer role strictly blocked from admin operations
  assert.equal(isAdminOrStaffRole(UserRole.CUSTOMER), false);
});

test("Operational Metrics Invariants: Derives metrics from persisted statuses without double counting", () => {
  // Sample set of orders
  const sampleOrders = [
    { id: "o1", status: OrderStatus.AWAITING_PAYMENT, procurementStatus: ProcurementStatus.NOT_STARTED },
    { id: "o2", status: OrderStatus.PAID, procurementStatus: ProcurementStatus.NOT_STARTED },
    { id: "o3", status: OrderStatus.PROCUREMENT, procurementStatus: ProcurementStatus.SOURCING },
    { id: "o4", status: OrderStatus.PACKING, procurementStatus: ProcurementStatus.PURCHASED },
    { id: "o5", status: OrderStatus.DISPATCHED, procurementStatus: ProcurementStatus.PURCHASED },
    { id: "o6", status: OrderStatus.DELIVERED, procurementStatus: ProcurementStatus.PURCHASED },
    { id: "o7", status: OrderStatus.CANCELLED, procurementStatus: ProcurementStatus.CANCELLED },
  ];

  // 1. Unpaid orders metric
  const unpaid = sampleOrders.filter((o) =>
    ([OrderStatus.AWAITING_PAYMENT, OrderStatus.PAYMENT_REVIEW] as OrderStatus[]).includes(o.status)
  );
  assert.equal(unpaid.length, 1);
  assert.equal(unpaid[0].id, "o1");

  // 2. Procurement backlog metric: PAID or PROCUREMENT but NOT_STARTED or SOURCING
  const procurementBacklog = sampleOrders.filter(
    (o) =>
      ([OrderStatus.PAID, OrderStatus.PROCUREMENT] as OrderStatus[]).includes(o.status) &&
      ([ProcurementStatus.NOT_STARTED, ProcurementStatus.SOURCING] as ProcurementStatus[]).includes(o.procurementStatus)
  );
  assert.equal(procurementBacklog.length, 2);
  assert.deepEqual(procurementBacklog.map((o) => o.id), ["o2", "o3"]);

  // Invariant: Completed, delivered, or cancelled orders are never counted in backlog
  assert.equal(
    procurementBacklog.some((o) => ([OrderStatus.DELIVERED, OrderStatus.CANCELLED] as OrderStatus[]).includes(o.status)),
    false
  );
});

test("Shipment Metrics Invariants: In-transit vs delayed distinction", () => {
  const sampleShipments = [
    { id: "s1", status: ShipmentStatus.READY_TO_DISPATCH },
    { id: "s2", status: ShipmentStatus.DISPATCHED },
    { id: "s3", status: ShipmentStatus.IN_TRANSIT },
    { id: "s4", status: ShipmentStatus.DELAYED },
    { id: "s5", status: ShipmentStatus.CUSTOMS },
    { id: "s6", status: ShipmentStatus.DELIVERED },
  ];

  const inTransit = sampleShipments.filter((s) =>
    ([ShipmentStatus.DISPATCHED, ShipmentStatus.IN_TRANSIT] as ShipmentStatus[]).includes(s.status)
  );
  const delayed = sampleShipments.filter((s) => s.status === ShipmentStatus.DELAYED);

  assert.equal(inTransit.length, 2);
  assert.equal(delayed.length, 1);
  assert.equal(delayed[0].id, "s4");
  // No overlap / double counting between inTransit and delayed
  assert.equal(inTransit.some((s) => s.status === ShipmentStatus.DELAYED), false);
});
