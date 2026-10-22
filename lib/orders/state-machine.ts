import {
  OrderStatus,
  PaymentStatus,
  ProcurementStatus,
  ShipmentStatus,
  UserRole,
} from "@prisma/client";

/**
 * Permitted transitions for OrderStatus
 */
export const ALLOWED_ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.AWAITING_PAYMENT]: [
    OrderStatus.PAYMENT_REVIEW,
    OrderStatus.PAID,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.PAYMENT_REVIEW]: [
    OrderStatus.PAID,
    OrderStatus.AWAITING_PAYMENT,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.PAID]: [
    OrderStatus.PROCUREMENT,
    OrderStatus.CANCELLED,
    OrderStatus.REFUND_PENDING,
  ],
  [OrderStatus.PROCUREMENT]: [
    OrderStatus.PACKING,
    OrderStatus.CANCELLED,
    OrderStatus.REFUND_PENDING,
  ],
  [OrderStatus.PACKING]: [
    OrderStatus.DISPATCHED,
    OrderStatus.REFUND_PENDING,
  ],
  [OrderStatus.DISPATCHED]: [
    OrderStatus.IN_TRANSIT,
    OrderStatus.CUSTOMS,
    OrderStatus.REFUND_PENDING,
  ],
  [OrderStatus.IN_TRANSIT]: [
    OrderStatus.CUSTOMS,
    OrderStatus.OUT_FOR_DELIVERY,
    OrderStatus.REFUND_PENDING,
  ],
  [OrderStatus.CUSTOMS]: [
    OrderStatus.OUT_FOR_DELIVERY,
    OrderStatus.REFUND_PENDING,
  ],
  [OrderStatus.OUT_FOR_DELIVERY]: [
    OrderStatus.DELIVERED,
    OrderStatus.REFUND_PENDING,
  ],
  [OrderStatus.DELIVERED]: [
    OrderStatus.REFUND_PENDING,
  ],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.REFUND_PENDING]: [
    OrderStatus.PARTIALLY_REFUNDED,
    OrderStatus.REFUNDED,
    OrderStatus.PAID, // in case refund request was denied/reverted
  ],
  [OrderStatus.PARTIALLY_REFUNDED]: [
    OrderStatus.REFUNDED,
  ],
  [OrderStatus.REFUNDED]: [],
};

/**
 * Permitted transitions for ProcurementStatus
 */
export const ALLOWED_PROCUREMENT_STATUS_TRANSITIONS: Record<ProcurementStatus, ProcurementStatus[]> = {
  [ProcurementStatus.NOT_STARTED]: [
    ProcurementStatus.SOURCING,
    ProcurementStatus.CANCELLED,
  ],
  [ProcurementStatus.SOURCING]: [
    ProcurementStatus.PURCHASED,
    ProcurementStatus.UNAVAILABLE,
    ProcurementStatus.CANCELLED,
  ],
  [ProcurementStatus.PURCHASED]: [
    ProcurementStatus.CANCELLED,
  ],
  [ProcurementStatus.UNAVAILABLE]: [
    ProcurementStatus.SOURCING,
    ProcurementStatus.CANCELLED,
  ],
  [ProcurementStatus.CANCELLED]: [],
};

/**
 * Permitted transitions for ShipmentStatus
 */
export const ALLOWED_SHIPMENT_STATUS_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  [ShipmentStatus.NOT_READY]: [
    ShipmentStatus.READY_TO_DISPATCH,
    ShipmentStatus.LOST,
  ],
  [ShipmentStatus.READY_TO_DISPATCH]: [
    ShipmentStatus.DISPATCHED,
    ShipmentStatus.NOT_READY,
    ShipmentStatus.LOST,
  ],
  [ShipmentStatus.DISPATCHED]: [
    ShipmentStatus.IN_TRANSIT,
    ShipmentStatus.DELAYED,
    ShipmentStatus.CUSTOMS,
    ShipmentStatus.LOST,
  ],
  [ShipmentStatus.IN_TRANSIT]: [
    ShipmentStatus.DELAYED,
    ShipmentStatus.CUSTOMS,
    ShipmentStatus.OUT_FOR_DELIVERY,
    ShipmentStatus.LOST,
  ],
  [ShipmentStatus.DELAYED]: [
    ShipmentStatus.IN_TRANSIT,
    ShipmentStatus.CUSTOMS,
    ShipmentStatus.OUT_FOR_DELIVERY,
    ShipmentStatus.LOST,
  ],
  [ShipmentStatus.CUSTOMS]: [
    ShipmentStatus.OUT_FOR_DELIVERY,
    ShipmentStatus.DELAYED,
    ShipmentStatus.RETURNED,
    ShipmentStatus.LOST,
  ],
  [ShipmentStatus.OUT_FOR_DELIVERY]: [
    ShipmentStatus.DELIVERED,
    ShipmentStatus.RETURNED,
    ShipmentStatus.LOST,
  ],
  [ShipmentStatus.DELIVERED]: [],
  [ShipmentStatus.LOST]: [],
  [ShipmentStatus.RETURNED]: [],
};

/**
 * Permitted transitions for PaymentStatus
 */
export const ALLOWED_PAYMENT_STATUS_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  [PaymentStatus.PENDING]: [
    PaymentStatus.REQUIRES_ACTION,
    PaymentStatus.SUCCEEDED,
    PaymentStatus.FAILED,
    PaymentStatus.CANCELLED,
  ],
  [PaymentStatus.REQUIRES_ACTION]: [
    PaymentStatus.SUCCEEDED,
    PaymentStatus.FAILED,
    PaymentStatus.CANCELLED,
  ],
  [PaymentStatus.SUCCEEDED]: [
    PaymentStatus.PARTIALLY_REFUNDED,
    PaymentStatus.REFUNDED,
    PaymentStatus.REVERSED,
  ],
  [PaymentStatus.FAILED]: [
    PaymentStatus.PENDING,
    PaymentStatus.CANCELLED,
  ],
  [PaymentStatus.CANCELLED]: [],
  [PaymentStatus.PARTIALLY_REFUNDED]: [
    PaymentStatus.REFUNDED,
  ],
  [PaymentStatus.REFUNDED]: [],
  [PaymentStatus.REVERSED]: [],
};

export class InvalidStatusTransitionError extends Error {
  constructor(
    public readonly entityName: string,
    public readonly currentStatus: string,
    public readonly requestedStatus: string
  ) {
    super(`Cannot transition ${entityName} from '${currentStatus}' to '${requestedStatus}'.`);
    this.name = "InvalidStatusTransitionError";
  }
}

/**
 * Validates whether an OrderStatus transition is permitted
 */
export function validateOrderStatusTransition(
  current: OrderStatus,
  target: OrderStatus
): void {
  if (current === target) return;
  const allowed = ALLOWED_ORDER_STATUS_TRANSITIONS[current] || [];
  if (!allowed.includes(target)) {
    throw new InvalidStatusTransitionError("Order status", current, target);
  }
}

/**
 * Validates whether a ProcurementStatus transition is permitted
 */
export function validateProcurementStatusTransition(
  current: ProcurementStatus,
  target: ProcurementStatus
): void {
  if (current === target) return;
  const allowed = ALLOWED_PROCUREMENT_STATUS_TRANSITIONS[current] || [];
  if (!allowed.includes(target)) {
    throw new InvalidStatusTransitionError("Procurement status", current, target);
  }
}

/**
 * Validates whether a ShipmentStatus transition is permitted
 */
export function validateShipmentStatusTransition(
  current: ShipmentStatus,
  target: ShipmentStatus
): void {
  if (current === target) return;
  const allowed = ALLOWED_SHIPMENT_STATUS_TRANSITIONS[current] || [];
  if (!allowed.includes(target)) {
    throw new InvalidStatusTransitionError("Shipment status", current, target);
  }
}

/**
 * Validates whether a PaymentStatus transition is permitted
 */
export function validatePaymentStatusTransition(
  current: PaymentStatus,
  target: PaymentStatus
): void {
  if (current === target) return;
  const allowed = ALLOWED_PAYMENT_STATUS_TRANSITIONS[current] || [];
  if (!allowed.includes(target)) {
    throw new InvalidStatusTransitionError("Payment status", current, target);
  }
}

/**
 * Roles allowed to perform admin/operations updates on orders
 */
export function canActorUpdateOrderStatus(role?: UserRole): boolean {
  if (!role) return false;
  return ([
    UserRole.ADMIN,
    UserRole.OPERATIONS,
    UserRole.FINANCE,
    UserRole.SUPPORT,
  ] as UserRole[]).includes(role);
}
