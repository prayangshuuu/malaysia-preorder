import { Prisma, ProcurementStatus, ShipmentStatus, OrderStatus } from "@prisma/client";
import { prisma } from "../prisma";
import { generateProcurementCode, generateShipmentNumber } from "./code-generator";
import {
  validateOrderStatusTransition,
  validateProcurementStatusTransition,
  validateShipmentStatusTransition,
} from "../orders/state-machine";
import { sendCustomerNotification, NotificationTemplates } from "../notifications";
import {
  RecordProcurementInput,
  UpdateProcurementStatusInput,
  CreateShipmentInput,
  UpdateShipmentInput,
  AddShipmentEventInput,
  AddOrderTimelineEventInput,
  CreateSupplierInput,
} from "./validations";

export class ProcurementShipmentError extends Error {
  constructor(message: string, public readonly statusCode: number = 400) {
    super(message);
    this.name = "ProcurementShipmentError";
  }
}

export interface StaffActor {
  id: string;
  email: string;
  role: string;
}

function calculateCostBDT(costMYR: number, exchangeRate: number): Prisma.Decimal {
  const rounded = Math.round(costMYR * exchangeRate * 100) / 100;
  return new Prisma.Decimal(rounded);
}

// ============================================================================
// SUPPLIERS
// ============================================================================

export async function createSupplier(input: CreateSupplierInput, actor: StaffActor) {
  const supplier = await prisma.supplier.create({
    data: {
      name: input.name,
      contactPerson: input.contactPerson || null,
      email: input.email || null,
      phone: input.phone || null,
      address: input.address || null,
      city: input.city,
      country: input.country,
      notes: input.notes || null,
      isActive: input.isActive,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: "SUPPLIER_CREATED",
      entityType: "Supplier",
      entityId: supplier.id,
      metadata: {
        name: supplier.name,
        country: supplier.country,
      },
    },
  });

  return supplier;
}

export async function getSuppliers(activeOnly = true) {
  return await prisma.supplier.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    orderBy: { name: "asc" },
  });
}

// ============================================================================
// PROCUREMENT
// ============================================================================

export async function recordProcurement(input: RecordProcurementInput, actor: StaffActor) {
  return await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: input.orderId },
      include: { lineItems: true },
    });

    if (!order) {
      throw new ProcurementShipmentError("Order not found", 404);
    }

    // Resolve or create supplier if provided
    let supplierId = input.supplierId;
    if (!supplierId && input.supplierName) {
      const newSupplier = await tx.supplier.create({
        data: {
          name: input.supplierName,
          country: "Malaysia",
          notes: "Created via procurement record",
        },
      });
      supplierId = newSupplier.id;
    }

    const purchaseCostBDT = calculateCostBDT(input.purchaseCostMYR, input.exchangeRateUsed);

    // Generate unique procurement code
    let procurementCode = generateProcurementCode();
    let collision = await tx.procurementRecord.findUnique({ where: { procurementCode } });
    while (collision) {
      procurementCode = generateProcurementCode();
      collision = await tx.procurementRecord.findUnique({ where: { procurementCode } });
    }

    // Combine receipt reference into notes/receipt tracking
    let notes = input.notes || "";
    if (input.receiptUrl) {
      notes = notes ? `${notes}\n[Receipt Attachment: ${input.receiptUrl}]` : `[Receipt Attachment: ${input.receiptUrl}]`;
    }

    const procurement = await tx.procurementRecord.create({
      data: {
        procurementCode,
        orderId: order.id,
        orderLineItemId: input.orderLineItemId || null,
        supplierId: supplierId || null,
        status: input.status,
        purchaseCostMYR: new Prisma.Decimal(input.purchaseCostMYR),
        exchangeRateUsed: new Prisma.Decimal(input.exchangeRateUsed),
        purchaseCostBDT,
        supplierInvoiceRef: input.supplierInvoiceRef || null,
        purchasedAt: input.purchasedAt || new Date(),
        purchasedById: actor.id,
        notes: notes || null,
      },
      include: {
        supplier: true,
        orderLineItem: true,
      },
    });

    // Update order's procurementStatus
    if (order.procurementStatus !== input.status) {
      validateProcurementStatusTransition(order.procurementStatus, input.status);
      await tx.order.update({
        where: { id: order.id },
        data: { procurementStatus: input.status },
      });
    }

    // Update order status if requested and transition is valid
    if (input.updateOrderStatusToProcurement && order.status === OrderStatus.PAID) {
      validateOrderStatusTransition(order.status, OrderStatus.PROCUREMENT);
      await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.PROCUREMENT },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: OrderStatus.PAID,
          toStatus: OrderStatus.PROCUREMENT,
          changedById: actor.id,
          reason: `Procurement recorded (${procurementCode})`,
        },
      });
    }

    // Customer-safe event log (NEVER includes supplier cost or internal supplier notes)
    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        eventType: "PROCUREMENT_LOGGED",
        title: "Item Sourcing Recorded in Malaysia",
        description: "Our Kuala Lumpur team has acquired the items for your pre-order and is prepping them for dispatch.",
        isCustomerVisible: true,
        createdById: actor.id,
      },
    });

    // Audit log (Staff action with financial sourcing metadata)
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: "PROCUREMENT_RECORDED",
        entityType: "ProcurementRecord",
        entityId: procurement.id,
        metadata: {
          procurementCode,
          orderId: order.id,
          orderNumber: order.orderNumber,
          costMYR: input.purchaseCostMYR,
          exchangeRate: input.exchangeRateUsed,
          costBDT: purchaseCostBDT.toString(),
          supplierInvoiceRef: input.supplierInvoiceRef,
          supplierId,
        },
      },
    });

    return procurement;
  });
}

export async function updateProcurementStatus(input: UpdateProcurementStatusInput, actor: StaffActor) {
  return await prisma.$transaction(async (tx) => {
    const procurement = await tx.procurementRecord.findUnique({
      where: { id: input.procurementId },
      include: { order: true },
    });

    if (!procurement) {
      throw new ProcurementShipmentError("Procurement record not found", 404);
    }

    validateProcurementStatusTransition(procurement.status, input.status);

    const updated = await tx.procurementRecord.update({
      where: { id: procurement.id },
      data: {
        status: input.status,
        notes: input.notes !== undefined ? input.notes : procurement.notes,
      },
      include: {
        supplier: true,
        orderLineItem: true,
      },
    });

    // Also update order's procurementStatus
    await tx.order.update({
      where: { id: procurement.orderId },
      data: { procurementStatus: input.status },
    });

    // If marked UNAVAILABLE or CANCELLED, create customer-safe event
    let eventTitle = `Procurement Status: ${input.status}`;
    let eventDesc = `Procurement update recorded for order ${procurement.order.orderNumber}.`;
    if (input.status === ProcurementStatus.UNAVAILABLE) {
      eventTitle = "Stock Sourcing Advisory";
      eventDesc = "The initial supplier branch was out of stock; our team is sourcing stock from alternate authorized stores in Malaysia.";
    } else if (input.status === ProcurementStatus.PURCHASED) {
      eventTitle = "Items Purchased in Malaysia";
      eventDesc = "All requested items have been secured and are being transported to our Kuala Lumpur packing warehouse.";
    }

    await tx.orderEvent.create({
      data: {
        orderId: procurement.orderId,
        eventType: "PROCUREMENT_STATUS_UPDATED",
        title: eventTitle,
        description: eventDesc,
        isCustomerVisible: true,
        createdById: actor.id,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: "PROCUREMENT_STATUS_UPDATED",
        entityType: "ProcurementRecord",
        entityId: procurement.id,
        metadata: {
          previousStatus: procurement.status,
          newStatus: input.status,
          orderId: procurement.orderId,
          reason: input.reason,
        },
      },
    });

    return updated;
  });
}

// ============================================================================
// SHIPMENTS & PACKING
// ============================================================================

export async function createShipment(input: CreateShipmentInput, actor: StaffActor) {
  return await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: input.orderId },
    });

    if (!order) {
      throw new ProcurementShipmentError("Order not found", 404);
    }

    let shipmentNumber = generateShipmentNumber();
    let collision = await tx.shipment.findUnique({ where: { shipmentNumber } });
    while (collision) {
      shipmentNumber = generateShipmentNumber();
      collision = await tx.shipment.findUnique({ where: { shipmentNumber } });
    }

    const shipment = await tx.shipment.create({
      data: {
        shipmentNumber,
        orderId: order.id,
        carrierName: input.carrierName || "Consolidated Air Freight",
        trackingNumber: input.trackingNumber || null,
        trackingUrl: input.trackingUrl || null,
        status: input.status,
        dispatchOrigin: input.dispatchOrigin,
        destinationCountry: input.destinationCountry,
        estimatedDeparture: input.estimatedDeparture || null,
        actualDeparture: input.actualDeparture || null,
        estimatedArrival: input.estimatedArrival || null,
        actualArrival: input.actualArrival || null,
        weightKg: input.weightKg ? new Prisma.Decimal(input.weightKg) : null,
        dimensionsCm: input.dimensionsCm || null,
        internalCargoNotes: input.internalCargoNotes || null,
        events: {
          create: [
            {
              status: input.status,
              location: "Kuala Lumpur Warehouse",
              description: input.status === ShipmentStatus.READY_TO_DISPATCH
                ? "Consignment weighed, packaged, and labeled for international air departure."
                : `Shipment created with status ${input.status}.`,
              isPublic: true,
            },
          ],
        },
      },
      include: {
        events: true,
      },
    });

    // Update order shipmentStatus
    if (order.shipmentStatus !== input.status) {
      validateShipmentStatusTransition(order.shipmentStatus, input.status);
      await tx.order.update({
        where: { id: order.id },
        data: { shipmentStatus: input.status },
      });
    }

    // Optionally update overall order status (e.g. PACKING or DISPATCHED)
    if (input.updateOrderStatus) {
      let targetOrderStatus: OrderStatus | null = null;
      if (input.status === ShipmentStatus.READY_TO_DISPATCH && (order.status === OrderStatus.PROCUREMENT || order.status === OrderStatus.PAID)) {
        targetOrderStatus = OrderStatus.PACKING;
      } else if (input.status === ShipmentStatus.DISPATCHED && order.status === OrderStatus.PACKING) {
        targetOrderStatus = OrderStatus.DISPATCHED;
      }

      if (targetOrderStatus && targetOrderStatus !== order.status) {
        validateOrderStatusTransition(order.status, targetOrderStatus);
        await tx.order.update({
          where: { id: order.id },
          data: { status: targetOrderStatus },
        });

        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            fromStatus: order.status,
            toStatus: targetOrderStatus,
            changedById: actor.id,
            reason: `Shipment ${shipmentNumber} created (${input.status})`,
          },
        });
      }
    }

    // Add customer timeline event
    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        eventType: "SHIPMENT_CREATED",
        title: "Package Prepared for Transit",
        description: `Package reference ${shipmentNumber} generated. Dispatch from ${input.dispatchOrigin} to ${input.destinationCountry}.`,
        isCustomerVisible: true,
        createdById: actor.id,
      },
    });

    // Audit log
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: "SHIPMENT_CREATED",
        entityType: "Shipment",
        entityId: shipment.id,
        metadata: {
          shipmentNumber,
          orderId: order.id,
          orderNumber: order.orderNumber,
          carrierName: input.carrierName,
          trackingNumber: input.trackingNumber,
          status: input.status,
        },
      },
    });

    return shipment;
  });
}

export async function updateShipment(input: UpdateShipmentInput, actor: StaffActor) {
  return await prisma.$transaction(async (tx) => {
    const shipment = await tx.shipment.findUnique({
      where: { id: input.shipmentId },
      include: { order: true },
    });

    if (!shipment) {
      throw new ProcurementShipmentError("Shipment not found", 404);
    }

    const updates: Prisma.ShipmentUpdateInput = {};

    if (input.carrierName !== undefined) updates.carrierName = input.carrierName;
    if (input.trackingNumber !== undefined) updates.trackingNumber = input.trackingNumber;
    if (input.trackingUrl !== undefined) updates.trackingUrl = input.trackingUrl;
    if (input.estimatedDeparture !== undefined) updates.estimatedDeparture = input.estimatedDeparture;
    if (input.actualDeparture !== undefined) updates.actualDeparture = input.actualDeparture;
    if (input.estimatedArrival !== undefined) updates.estimatedArrival = input.estimatedArrival;
    if (input.actualArrival !== undefined) updates.actualArrival = input.actualArrival;
    if (input.dimensionsCm !== undefined) updates.dimensionsCm = input.dimensionsCm;
    if (input.internalCargoNotes !== undefined) updates.internalCargoNotes = input.internalCargoNotes;
    if (input.weightKg !== undefined) {
      updates.weightKg = input.weightKg !== null ? new Prisma.Decimal(input.weightKg) : null;
    }

    if (input.status && input.status !== shipment.status) {
      validateShipmentStatusTransition(shipment.status, input.status);
      updates.status = input.status;

      // Also sync order shipmentStatus
      await tx.order.update({
        where: { id: shipment.orderId },
        data: { shipmentStatus: input.status },
      });
    }

    const updatedShipment = await tx.shipment.update({
      where: { id: shipment.id },
      data: updates,
      include: {
        events: { orderBy: { timestamp: "desc" } },
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: "SHIPMENT_UPDATED",
        entityType: "Shipment",
        entityId: shipment.id,
        metadata: {
          shipmentNumber: shipment.shipmentNumber,
          previousStatus: shipment.status,
          newStatus: input.status,
          carrierName: input.carrierName,
          trackingNumber: input.trackingNumber,
        },
      },
    });

    return updatedShipment;
  });
}

export async function addShipmentEvent(input: AddShipmentEventInput, actor: StaffActor) {
  return await prisma.$transaction(async (tx) => {
    const shipment = await tx.shipment.findUnique({
      where: { id: input.shipmentId },
      include: { order: true },
    });

    if (!shipment) {
      throw new ProcurementShipmentError("Shipment not found", 404);
    }

    // Validate shipment transition if changing
    if (input.status !== shipment.status) {
      validateShipmentStatusTransition(shipment.status, input.status);
      await tx.shipment.update({
        where: { id: shipment.id },
        data: { status: input.status },
      });
      await tx.order.update({
        where: { id: shipment.orderId },
        data: { shipmentStatus: input.status },
      });
    }

    const event = await tx.shipmentEvent.create({
      data: {
        shipmentId: shipment.id,
        status: input.status,
        location: input.location || null,
        description: input.description,
        isPublic: input.isPublic,
        timestamp: input.timestamp,
      },
    });

    // If sync requested and public, also mirror to OrderEvent
    if (input.isPublic) {
      await tx.orderEvent.create({
        data: {
          orderId: shipment.orderId,
          eventType: "SHIPMENT_WAYPOINT",
          title: `Shipment Milestone: ${input.status}${input.location ? ` (${input.location})` : ""}`,
          description: input.description,
          isCustomerVisible: true,
          createdById: actor.id,
        },
      });
    }

    // Optionally sync high-level OrderStatus
    if (input.syncOrderStatus) {
      let nextOrderStatus: OrderStatus | null = null;
      if (input.status === ShipmentStatus.DISPATCHED && shipment.order.status === OrderStatus.PACKING) {
        nextOrderStatus = OrderStatus.DISPATCHED;
      } else if (input.status === ShipmentStatus.IN_TRANSIT && shipment.order.status === OrderStatus.DISPATCHED) {
        nextOrderStatus = OrderStatus.IN_TRANSIT;
      } else if (input.status === ShipmentStatus.CUSTOMS && (shipment.order.status === OrderStatus.IN_TRANSIT || shipment.order.status === OrderStatus.DISPATCHED)) {
        nextOrderStatus = OrderStatus.CUSTOMS;
      } else if (input.status === ShipmentStatus.OUT_FOR_DELIVERY && shipment.order.status === OrderStatus.CUSTOMS) {
        nextOrderStatus = OrderStatus.OUT_FOR_DELIVERY;
      } else if (input.status === ShipmentStatus.DELIVERED && shipment.order.status === OrderStatus.OUT_FOR_DELIVERY) {
        nextOrderStatus = OrderStatus.DELIVERED;
      }

      if (nextOrderStatus && nextOrderStatus !== shipment.order.status) {
        validateOrderStatusTransition(shipment.order.status, nextOrderStatus);
        await tx.order.update({
          where: { id: shipment.orderId },
          data: { status: nextOrderStatus },
        });

        await tx.orderStatusHistory.create({
          data: {
            orderId: shipment.orderId,
            fromStatus: shipment.order.status,
            toStatus: nextOrderStatus,
            changedById: actor.id,
            reason: `Shipment event: ${input.status} (${input.description})`,
          },
        });
      }
    }

    // Audit log
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: "SHIPMENT_EVENT_ADDED",
        entityType: "ShipmentEvent",
        entityId: event.id,
        metadata: {
          shipmentId: shipment.id,
          shipmentNumber: shipment.shipmentNumber,
          status: input.status,
          location: input.location,
          isPublic: input.isPublic,
        },
      },
    });

    // Notify customer on key transit milestones (Dispatched, Delayed, Delivered)
    if (input.isPublic && shipment.order.customerId) {
      if (input.status === ShipmentStatus.DISPATCHED) {
        const notif = NotificationTemplates.dispatched(
          shipment.order.orderNumber,
          shipment.carrierName || "Direct Air Cargo",
          shipment.orderId
        );
        await sendCustomerNotification({
          userId: shipment.order.customerId,
          title: notif.title,
          message: notif.message,
          linkUrl: notif.linkUrl,
          emailSubject: notif.emailSubject,
          category: notif.category,
          idempotencyKey: `shipment-dispatched:${shipment.id}:${event.id}`,
        });
      } else if (input.status === ShipmentStatus.DELAYED) {
        const notif = NotificationTemplates.shipmentDelay(
          shipment.order.orderNumber,
          input.description || "Flight schedule or cargo handling adjustment",
          shipment.orderId
        );
        await sendCustomerNotification({
          userId: shipment.order.customerId,
          title: notif.title,
          message: notif.message,
          linkUrl: notif.linkUrl,
          emailSubject: notif.emailSubject,
          category: notif.category,
          idempotencyKey: `shipment-delay:${shipment.id}:${event.id}`,
        });
      } else if (input.status === ShipmentStatus.DELIVERED) {
        const notif = NotificationTemplates.delivered(
          shipment.order.orderNumber,
          shipment.orderId
        );
        await sendCustomerNotification({
          userId: shipment.order.customerId,
          title: notif.title,
          message: notif.message,
          linkUrl: notif.linkUrl,
          emailSubject: notif.emailSubject,
          category: notif.category,
          idempotencyKey: `shipment-delivered:${shipment.id}:${event.id}`,
        });
      }
    }

    return event;
  });
}

// ============================================================================
// TIMELINE EVENTS (ADMIN CUSTOMER-SAFE / INTERNAL EVENTS)
// ============================================================================

export async function addOrderTimelineEvent(input: AddOrderTimelineEventInput, actor: StaffActor) {
  return await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: input.orderId },
    });

    if (!order) {
      throw new ProcurementShipmentError("Order not found", 404);
    }

    const description = input.location
      ? `[${input.location}] ${input.description}`
      : input.description;

    const event = await tx.orderEvent.create({
      data: {
        orderId: order.id,
        eventType: input.eventType,
        title: input.title,
        description,
        isCustomerVisible: input.isCustomerVisible,
        createdById: actor.id,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: "ORDER_TIMELINE_EVENT_ADDED",
        entityType: "OrderEvent",
        entityId: event.id,
        metadata: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          title: input.title,
          isCustomerVisible: input.isCustomerVisible,
          location: input.location,
        },
      },
    });

    return event;
  });
}
