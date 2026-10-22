import { Prisma, OrderStatus, PaymentStatus, ProcurementStatus, ShipmentStatus } from "@prisma/client";

/**
 * Strips all confidential supplier costs, internal admin notes,
 * and unverified private metadata from an order before returning to customer.
 */
export function sanitizeCustomerOrder<
  T extends {
    id: string;
    orderNumber: string;
    customerId: string;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    procurementStatus: ProcurementStatus;
    shipmentStatus: ShipmentStatus;
    currency: string;
    itemsSubtotalBDT: Prisma.Decimal | number | string;
    serviceFeeBDT: Prisma.Decimal | number | string;
    shippingFeeBDT: Prisma.Decimal | number | string;
    customsFeeBDT: Prisma.Decimal | number | string;
    discountBDT: Prisma.Decimal | number | string;
    totalAmountBDT: Prisma.Decimal | number | string;
    paidAmountBDT: Prisma.Decimal | number | string;
    shippingRecipientName: string;
    shippingPhoneNumber: string;
    shippingStreetAddress: string;
    shippingThanaOrUpazila: string | null;
    shippingDistrict: string;
    shippingDivision: string;
    shippingPostalCode: string | null;
    shippingCountry: string;
    customerNotes: string | null;
    createdAt: Date;
    updatedAt: Date;
    lineItems?: Array<{
      id: string;
      itemTitle: string;
      itemDescription: string | null;
      sourceUrl: string | null;
      quantity: number;
      unitPriceBDT: Prisma.Decimal | number | string;
      totalPriceBDT: Prisma.Decimal | number | string;
    }>;
    events?: Array<{
      id: string;
      eventType: string;
      title: string;
      description: string | null;
      isCustomerVisible: boolean;
      createdAt: Date;
    }>;
    quote?: {
      quoteNumber: string;
      shippingMethod: string | null;
      estDeliveryDaysMin: number | null;
      estDeliveryDaysMax: number | null;
      estDispatchDaysMin: number | null;
      estDispatchDaysMax: number | null;
      validUntil?: Date;
    } | null;
    payments?: Array<{
      id: string;
      paymentNumber: string;
      amount: Prisma.Decimal | number | string;
      method: string;
      status: PaymentStatus;
      providerTrxId: string | null;
      createdAt: Date;
    }>;
    shipments?: Array<{
      id: string;
      shipmentNumber: string;
      carrierName: string | null;
      trackingNumber: string | null;
      trackingUrl: string | null;
      status: ShipmentStatus;
      dispatchOrigin: string;
      destinationCountry: string;
      estimatedDeparture: Date | null;
      actualDeparture: Date | null;
      estimatedArrival: Date | null;
      actualArrival: Date | null;
      weightKg: Prisma.Decimal | number | string | null;
      events?: Array<{
        id: string;
        status: ShipmentStatus;
        location: string | null;
        description: string;
        isPublic: boolean;
        timestamp: Date;
      }>;
    }>;
  }
>(order: T) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    customerId: order.customerId,
    status: order.status,
    paymentStatus: order.paymentStatus,
    procurementStatus: order.procurementStatus,
    shipmentStatus: order.shipmentStatus,
    currency: order.currency,
    itemsSubtotalBDT: Number(order.itemsSubtotalBDT),
    serviceFeeBDT: Number(order.serviceFeeBDT),
    shippingFeeBDT: Number(order.shippingFeeBDT),
    customsFeeBDT: Number(order.customsFeeBDT),
    discountBDT: Number(order.discountBDT),
    totalAmountBDT: Number(order.totalAmountBDT),
    paidAmountBDT: Number(order.paidAmountBDT),
    shippingAddress: {
      recipientName: order.shippingRecipientName,
      phoneNumber: order.shippingPhoneNumber,
      streetAddress: order.shippingStreetAddress,
      thanaOrUpazila: order.shippingThanaOrUpazila,
      district: order.shippingDistrict,
      division: order.shippingDivision,
      postalCode: order.shippingPostalCode,
      country: order.shippingCountry,
    },
    customerNotes: order.customerNotes,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    lineItems: (order.lineItems || []).map((item) => ({
      id: item.id,
      itemTitle: item.itemTitle,
      itemDescription: item.itemDescription,
      sourceUrl: item.sourceUrl,
      quantity: item.quantity,
      unitPriceBDT: Number(item.unitPriceBDT),
      totalPriceBDT: Number(item.totalPriceBDT),
    })),
    events: (order.events || [])
      .filter((evt) => evt.isCustomerVisible)
      .map((evt) => ({
        id: evt.id,
        eventType: evt.eventType,
        title: evt.title,
        description: evt.description,
        createdAt: evt.createdAt,
      })),
    quote: order.quote
      ? {
          quoteNumber: order.quote.quoteNumber,
          shippingMethod: order.quote.shippingMethod,
          estDeliveryDaysMin: order.quote.estDeliveryDaysMin,
          estDeliveryDaysMax: order.quote.estDeliveryDaysMax,
          estDispatchDaysMin: order.quote.estDispatchDaysMin,
          estDispatchDaysMax: order.quote.estDispatchDaysMax,
        }
      : null,
    payments: (order.payments || []).map((p) => ({
      id: p.id,
      paymentNumber: p.paymentNumber,
      amount: Number(p.amount),
      method: p.method,
      status: p.status,
      providerTrxId: p.providerTrxId,
      createdAt: p.createdAt,
    })),
    shipments: (order.shipments || []).map((s) => ({
      id: s.id,
      shipmentNumber: s.shipmentNumber,
      carrierName: s.carrierName,
      trackingNumber: s.trackingNumber,
      trackingUrl: s.trackingUrl,
      status: s.status,
      dispatchOrigin: s.dispatchOrigin,
      destinationCountry: s.destinationCountry,
      estimatedDeparture: s.estimatedDeparture,
      actualDeparture: s.actualDeparture,
      estimatedArrival: s.estimatedArrival,
      actualArrival: s.actualArrival,
      weightKg: s.weightKg ? Number(s.weightKg) : null,
      events: (s.events || [])
        .filter((e) => e.isPublic)
        .map((e) => ({
          id: e.id,
          status: e.status,
          location: e.location,
          description: e.description,
          timestamp: e.timestamp,
        })),
    })),
  };
}
