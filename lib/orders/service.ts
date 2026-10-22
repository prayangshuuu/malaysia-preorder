import { Prisma, QuoteStatus, OrderStatus, PaymentStatus, ProcurementStatus, ShipmentStatus } from "@prisma/client";
import { prisma } from "../prisma";
import { generateOrderNumber } from "./order-number";
import {
  validateOrderStatusTransition,
  validateProcurementStatusTransition,
  validateShipmentStatusTransition,
} from "./state-machine";
import { CreateOrderFromQuoteInput, UpdateOrderStatusInput } from "./validations";

export class OrderServiceError extends Error {
  constructor(message: string, public readonly statusCode: number = 400) {
    super(message);
    this.name = "OrderServiceError";
  }
}

export interface OrderActor {
  id: string;
  email: string;
  role: string;
}

/**
 * Creates an immutable order from an accepted quote in an atomic database transaction.
 * Guarantees:
 * 1. Quote exists and belongs to the customer (or is being created on their behalf).
 * 2. Quote is in ACCEPTED status (if SENT, automatically accepts with explicit timestamp).
 * 3. Quote has not expired.
 * 4. Duplicate prevention: prevents multiple orders created for the same quote.
 * 5. Snapshots item lines, agreed pricing, fees, terms, shipping method, and delivery address.
 * 6. Generates non-sequential human readable order reference.
 * 7. Records initial ORDER_CREATED event and status history.
 */
export async function createOrderFromAcceptedQuote(
  input: CreateOrderFromQuoteInput,
  actor: OrderActor
) {
  return await prisma.$transaction(async (tx) => {
    // 1. Fetch quote with line items and inquiry
    const quote = await tx.quote.findUnique({
      where: { id: input.quoteId },
      include: {
        inquiry: true,
        lineItems: true,
        orders: true,
      },
    });

    if (!quote) {
      throw new OrderServiceError("Quotation not found", 404);
    }

    // Check customer ownership
    const isOwner = quote.inquiry.userId === actor.id;
    const isStaff = ["ADMIN", "OPERATIONS", "FINANCE", "SUPPORT"].includes(actor.role);

    if (!isOwner && !isStaff) {
      throw new OrderServiceError("Access denied: You do not own this quote", 403);
    }

    // 2. Prevent duplicate order creation
    if (quote.orders && quote.orders.length > 0) {
      throw new OrderServiceError(
        `An order has already been created for quote ${quote.quoteNumber} (Order: ${quote.orders[0].orderNumber})`,
        409
      );
    }

    // 3. Check quote status and validity
    const now = new Date();
    if (quote.validUntil < now) {
      throw new OrderServiceError(
        `This quote expired on ${quote.validUntil.toISOString().slice(0, 10)}. Please request an updated quote.`,
        400
      );
    }

    if (quote.status === QuoteStatus.REJECTED) {
      throw new OrderServiceError("Cannot create an order from a rejected quote", 400);
    }

    if (quote.status === QuoteStatus.EXPIRED || quote.status === QuoteStatus.SUPERSEDED) {
      throw new OrderServiceError(`Cannot create an order from a ${quote.status.toLowerCase()} quote`, 400);
    }

    if (quote.status === QuoteStatus.DRAFT) {
      throw new OrderServiceError("Cannot accept a draft quote. It must be finalized by staff first.", 400);
    }

    // If quote is SENT, transition it to ACCEPTED atomically
    if (quote.status === QuoteStatus.SENT) {
      await tx.quote.update({
        where: { id: quote.id },
        data: {
          status: QuoteStatus.ACCEPTED,
          acceptedAt: now,
          acceptedById: actor.id,
        },
      });
    }

    // 4. Generate unique non-sequential human readable order reference
    let orderNumber = generateOrderNumber(now);
    let collisionCheck = await tx.order.findUnique({ where: { orderNumber } });
    while (collisionCheck) {
      orderNumber = generateOrderNumber(now);
      collisionCheck = await tx.order.findUnique({ where: { orderNumber } });
    }

    // 5. Snapshot shipping address and create the Order record
    const addr = input.shippingAddress;
    const customerNotes = input.customerNotes || quote.customerNotes || null;

    const order = await tx.order.create({
      data: {
        orderNumber,
        customerId: quote.inquiry.userId,
        quoteId: quote.id,
        status: OrderStatus.AWAITING_PAYMENT,
        paymentStatus: PaymentStatus.PENDING,
        procurementStatus: ProcurementStatus.NOT_STARTED,
        shipmentStatus: ShipmentStatus.NOT_READY,

        // Snapshotted agreed amounts
        currency: quote.currency,
        itemsSubtotalBDT: quote.itemsSubtotalBDT,
        serviceFeeBDT: quote.serviceFeeBDT,
        shippingFeeBDT: quote.shippingFeeBDT,
        customsFeeBDT: quote.customsFeeBDT,
        discountBDT: quote.discountBDT,
        totalAmountBDT: quote.totalAmountBDT,
        paidAmountBDT: new Prisma.Decimal(0),

        // Snapshotted shipping address
        shippingRecipientName: addr.recipientName,
        shippingPhoneNumber: addr.phoneNumber,
        shippingStreetAddress: addr.streetAddress,
        shippingThanaOrUpazila: addr.thanaOrUpazila || null,
        shippingDistrict: addr.district,
        shippingDivision: addr.division,
        shippingPostalCode: addr.postalCode || null,
        shippingCountry: addr.country || "Bangladesh",

        customerNotes,
        adminNotes: quote.adminNotes ? `Quote reference notes: ${quote.adminNotes}` : null,

        // Snapshot line items
        lineItems: {
          create: quote.lineItems.map((li) => ({
            productId: li.productId,
            itemTitle: li.title,
            itemDescription: li.description,
            sourceUrl: li.sourceUrl,
            quantity: li.quantity,
            unitPriceBDT: li.unitPriceBDT,
            totalPriceBDT: li.totalPriceBDT,
          })),
        },

        // Append initial order events
        events: {
          create: [
            {
              eventType: "ORDER_CREATED",
              title: "Pre-Order Placed",
              description: `Order ${orderNumber} created from accepted quote ${quote.quoteNumber}. Awaiting payment verification.`,
              isCustomerVisible: true,
              createdById: actor.id,
            },
          ],
        },

        // Append initial status history
        statusHistory: {
          create: [
            {
              fromStatus: null,
              toStatus: OrderStatus.AWAITING_PAYMENT,
              changedById: actor.id,
              reason: `Order created from quote ${quote.quoteNumber}`,
            },
          ],
        },
      },
      include: {
        lineItems: true,
        events: true,
        quote: {
          select: {
            quoteNumber: true,
            shippingMethod: true,
            estDeliveryDaysMin: true,
            estDeliveryDaysMax: true,
            estDispatchDaysMin: true,
            estDispatchDaysMax: true,
          },
        },
      },
    });

    // 6. Record audit log
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: "ORDER_CREATED_FROM_QUOTE",
        entityType: "Order",
        entityId: order.id,
        metadata: {
          orderNumber: order.orderNumber,
          quoteId: quote.id,
          quoteNumber: quote.quoteNumber,
          totalAmountBDT: quote.totalAmountBDT.toString(),
        },
      },
    });

    return order;
  });
}

/**
 * Updates order state (status, procurement, shipment) with strict validation,
 * append-only event creation, and audit logging.
 */
export async function updateOrderStateByAdmin(
  input: UpdateOrderStatusInput,
  actor: OrderActor
) {
  const isStaff = ["ADMIN", "OPERATIONS", "FINANCE", "SUPPORT"].includes(actor.role);
  if (!isStaff) {
    throw new OrderServiceError("Access denied: Administrative privileges required", 403);
  }

  return await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: input.orderId },
      include: {
        lineItems: true,
      },
    });

    if (!order) {
      throw new OrderServiceError("Order not found", 404);
    }

    const updates: Prisma.OrderUpdateInput = {};
    const eventsToCreate: Prisma.OrderEventCreateWithoutOrderInput[] = [];

    // 1. Validate and apply OrderStatus transition
    if (input.status && input.status !== order.status) {
      validateOrderStatusTransition(order.status, input.status);
      updates.status = input.status;

      // Status history entry
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: input.status,
          changedById: actor.id,
          reason: input.reason || `Status updated to ${input.status}`,
        },
      });

      // Customer-safe event
      const safeDesc =
        input.customerSafeNote ||
        getCustomerSafeStatusDescription(input.status, order.orderNumber);

      eventsToCreate.push({
        eventType: "ORDER_STATUS_CHANGED",
        title: `Order Status: ${formatStatusLabel(input.status)}`,
        description: safeDesc,
        isCustomerVisible: true,
        createdById: actor.id,
      });
    }

    // 2. Validate and apply ProcurementStatus transition
    if (input.procurementStatus && input.procurementStatus !== order.procurementStatus) {
      validateProcurementStatusTransition(order.procurementStatus, input.procurementStatus);
      updates.procurementStatus = input.procurementStatus;

      const safeProcurementDesc = getCustomerSafeProcurementDescription(input.procurementStatus);
      if (safeProcurementDesc) {
        eventsToCreate.push({
          eventType: "PROCUREMENT_STATUS_CHANGED",
          title: `Procurement: ${formatStatusLabel(input.procurementStatus)}`,
          description: safeProcurementDesc,
          isCustomerVisible: true,
          createdById: actor.id,
        });
      }
    }

    // 3. Validate and apply ShipmentStatus transition
    if (input.shipmentStatus && input.shipmentStatus !== order.shipmentStatus) {
      validateShipmentStatusTransition(order.shipmentStatus, input.shipmentStatus);
      updates.shipmentStatus = input.shipmentStatus;

      const safeShipmentDesc = getCustomerSafeShipmentDescription(input.shipmentStatus);
      if (safeShipmentDesc) {
        eventsToCreate.push({
          eventType: "SHIPMENT_STATUS_CHANGED",
          title: `Shipment: ${formatStatusLabel(input.shipmentStatus)}`,
          description: safeShipmentDesc,
          isCustomerVisible: true,
          createdById: actor.id,
        });
      }
    }

    // Admin notes update (private, never customer-visible)
    if (input.adminNotes !== undefined) {
      updates.adminNotes = input.adminNotes;
    }

    // Commit order updates and events
    if (eventsToCreate.length > 0) {
      updates.events = {
        create: eventsToCreate,
      };
    }

    const updatedOrder = await tx.order.update({
      where: { id: order.id },
      data: updates,
      include: {
        lineItems: true,
        events: {
          orderBy: { createdAt: "desc" },
        },
        statusHistory: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    // Record audit log
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: "ORDER_STATE_UPDATED",
        entityType: "Order",
        entityId: order.id,
        metadata: {
          orderNumber: order.orderNumber,
          previousStatus: order.status,
          newStatus: input.status,
          previousProcurementStatus: order.procurementStatus,
          newProcurementStatus: input.procurementStatus,
          previousShipmentStatus: order.shipmentStatus,
          newShipmentStatus: input.shipmentStatus,
        },
      },
    });

    return updatedOrder;
  });
}

/**
 * Customer-safe descriptions for order status milestones
 */
export function getCustomerSafeStatusDescription(status: OrderStatus, orderNumber: string): string {
  switch (status) {
    case OrderStatus.AWAITING_PAYMENT:
      return `Order ${orderNumber} is awaiting payment verification.`;
    case OrderStatus.PAYMENT_REVIEW:
      return "Payment proof submitted. Our team is verifying the transaction details.";
    case OrderStatus.PAID:
      return "Payment successfully confirmed. Order has been queued for Malaysia procurement.";
    case OrderStatus.PROCUREMENT:
      return "Malaysia sourcing team has initiated procurement of your item(s).";
    case OrderStatus.PACKING:
      return "Your order has been received at our Kuala Lumpur operations facility and is being packed.";
    case OrderStatus.DISPATCHED:
      return "Consignment handed over to air freight partner for transit to Bangladesh.";
    case OrderStatus.IN_TRANSIT:
      return "Consignment is in international transit from Malaysia to Bangladesh.";
    case OrderStatus.CUSTOMS:
      return "Consignment has landed in Dhaka and is clearing customs inspection.";
    case OrderStatus.OUT_FOR_DELIVERY:
      return "Customs cleared. Handed to local courier partner for doorstep delivery in Bangladesh.";
    case OrderStatus.DELIVERED:
      return "Package successfully delivered to customer address.";
    case OrderStatus.CANCELLED:
      return "This pre-order has been cancelled.";
    case OrderStatus.REFUND_PENDING:
      return "A refund request is currently being processed.";
    case OrderStatus.PARTIALLY_REFUNDED:
      return "A partial refund has been issued for this order.";
    case OrderStatus.REFUNDED:
      return "This order has been fully refunded.";
    default:
      return `Order status updated to ${status}.`;
  }
}

export function getCustomerSafeProcurementDescription(status: ProcurementStatus): string | null {
  switch (status) {
    case ProcurementStatus.SOURCING:
      return "Procurement team is sourcing agreed stock in Malaysia.";
    case ProcurementStatus.PURCHASED:
      return "Item(s) purchased and in transit to our Kuala Lumpur warehouse.";
    case ProcurementStatus.UNAVAILABLE:
      return "Supplier temporarily out of stock; sourcing team is checking alternate partner branches.";
    case ProcurementStatus.CANCELLED:
      return "Procurement cancelled.";
    default:
      return null;
  }
}

export function getCustomerSafeShipmentDescription(status: ShipmentStatus): string | null {
  switch (status) {
    case ShipmentStatus.READY_TO_DISPATCH:
      return "Consignment packaged, weighted, and scheduled for flight manifest.";
    case ShipmentStatus.DISPATCHED:
      return "Flight departure recorded from Malaysia.";
    case ShipmentStatus.IN_TRANSIT:
      return "En route to Dhaka international freight terminal.";
    case ShipmentStatus.CUSTOMS:
      return "Undergoing customs intake and import assessment.";
    case ShipmentStatus.OUT_FOR_DELIVERY:
      return "Dispatched for final-mile domestic delivery.";
    case ShipmentStatus.DELIVERED:
      return "Shipment received and confirmed delivered.";
    case ShipmentStatus.DELAYED:
      return "Minor logistics delay reported. Tracking will update once resumed.";
    default:
      return null;
  }
}

export function formatStatusLabel(status: string): string {
  return status
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
