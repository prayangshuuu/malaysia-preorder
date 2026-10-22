"use server";

import { getCurrentSession } from "@/lib/auth/session";
import { isAdminOrStaffRole } from "@/lib/auth/rbac";
import {
  recordProcurementSchema,
  updateProcurementStatusSchema,
  createShipmentSchema,
  updateShipmentSchema,
  addShipmentEventSchema,
  addOrderTimelineEventSchema,
  createSupplierSchema,
  recordProcurement,
  updateProcurementStatus,
  createShipment,
  updateShipment,
  addShipmentEvent,
  addOrderTimelineEvent,
  createSupplier,
} from "@/lib/procurement-shipment";
import { revalidatePath } from "next/cache";

export async function createSupplierAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session || !isAdminOrStaffRole(session.role)) {
    return { success: false, error: "Administrative privileges required." };
  }

  const raw = {
    name: formData.get("name") as string,
    contactPerson: (formData.get("contactPerson") as string) || null,
    email: (formData.get("email") as string) || null,
    phone: (formData.get("phone") as string) || null,
    address: (formData.get("address") as string) || null,
    city: (formData.get("city") as string) || "Kuala Lumpur",
    country: (formData.get("country") as string) || "Malaysia",
    notes: (formData.get("notes") as string) || null,
    isActive: formData.get("isActive") !== "false",
  };

  const parsed = createSupplierSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Invalid supplier data" };
  }

  try {
    const supplier = await createSupplier(parsed.data, {
      id: session.userId,
      email: session.email,
      role: session.role,
    });
    return { success: true, supplier };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to create supplier" };
  }
}

export async function recordProcurementAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session || !isAdminOrStaffRole(session.role)) {
    return { success: false, error: "Administrative privileges required." };
  }

  const orderId = formData.get("orderId") as string;
  const raw = {
    orderId,
    orderLineItemId: (formData.get("orderLineItemId") as string) || null,
    supplierId: (formData.get("supplierId") as string) || null,
    supplierName: (formData.get("supplierName") as string) || null,
    status: (formData.get("status") as string) || "SOURCING",
    purchaseCostMYR: formData.get("purchaseCostMYR"),
    exchangeRateUsed: formData.get("exchangeRateUsed"),
    supplierInvoiceRef: (formData.get("supplierInvoiceRef") as string) || null,
    purchasedAt: (formData.get("purchasedAt") as string) || null,
    notes: (formData.get("notes") as string) || null,
    receiptUrl: (formData.get("receiptUrl") as string) || null,
    updateOrderStatusToProcurement: formData.get("updateOrderStatusToProcurement") === "true",
  };

  const parsed = recordProcurementSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Invalid procurement data" };
  }

  try {
    const procurement = await recordProcurement(parsed.data, {
      id: session.userId,
      email: session.email,
      role: session.role,
    });

    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath("/admin/orders");
    revalidatePath(`/account/orders/${orderId}`);
    return { success: true, procurementId: procurement.id };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to record procurement" };
  }
}

export async function updateProcurementStatusAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session || !isAdminOrStaffRole(session.role)) {
    return { success: false, error: "Administrative privileges required." };
  }

  const orderId = formData.get("orderId") as string;
  const raw = {
    procurementId: formData.get("procurementId") as string,
    status: formData.get("status") as string,
    notes: (formData.get("notes") as string) || null,
    reason: (formData.get("reason") as string) || null,
  };

  const parsed = updateProcurementStatusSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Invalid status transition" };
  }

  try {
    const updated = await updateProcurementStatus(parsed.data, {
      id: session.userId,
      email: session.email,
      role: session.role,
    });

    if (orderId) {
      revalidatePath(`/admin/orders/${orderId}`);
      revalidatePath(`/account/orders/${orderId}`);
    }
    return { success: true, procurement: updated };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update procurement status" };
  }
}

export async function createShipmentAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session || !isAdminOrStaffRole(session.role)) {
    return { success: false, error: "Administrative privileges required." };
  }

  const orderId = formData.get("orderId") as string;
  const raw = {
    orderId,
    carrierName: (formData.get("carrierName") as string) || null,
    trackingNumber: (formData.get("trackingNumber") as string) || null,
    trackingUrl: (formData.get("trackingUrl") as string) || null,
    status: (formData.get("status") as string) || "READY_TO_DISPATCH",
    dispatchOrigin: (formData.get("dispatchOrigin") as string) || "Malaysia",
    destinationCountry: (formData.get("destinationCountry") as string) || "Bangladesh",
    estimatedDeparture: (formData.get("estimatedDeparture") as string) || null,
    actualDeparture: (formData.get("actualDeparture") as string) || null,
    estimatedArrival: (formData.get("estimatedArrival") as string) || null,
    actualArrival: (formData.get("actualArrival") as string) || null,
    weightKg: formData.get("weightKg") || null,
    dimensionsCm: (formData.get("dimensionsCm") as string) || null,
    internalCargoNotes: (formData.get("internalCargoNotes") as string) || null,
    updateOrderStatus: formData.get("updateOrderStatus") !== "false",
  };

  const parsed = createShipmentSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Invalid shipment parameters" };
  }

  try {
    const shipment = await createShipment(parsed.data, {
      id: session.userId,
      email: session.email,
      role: session.role,
    });

    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath("/admin/orders");
    revalidatePath(`/account/orders/${orderId}`);
    return { success: true, shipmentId: shipment.id };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to create shipment" };
  }
}

export async function updateShipmentAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session || !isAdminOrStaffRole(session.role)) {
    return { success: false, error: "Administrative privileges required." };
  }

  const orderId = formData.get("orderId") as string;
  const raw = {
    shipmentId: formData.get("shipmentId") as string,
    carrierName: (formData.get("carrierName") as string) || null,
    trackingNumber: (formData.get("trackingNumber") as string) || null,
    trackingUrl: (formData.get("trackingUrl") as string) || null,
    status: (formData.get("status") as string) || undefined,
    estimatedDeparture: (formData.get("estimatedDeparture") as string) || null,
    actualDeparture: (formData.get("actualDeparture") as string) || null,
    estimatedArrival: (formData.get("estimatedArrival") as string) || null,
    actualArrival: (formData.get("actualArrival") as string) || null,
    weightKg: formData.get("weightKg") || null,
    dimensionsCm: (formData.get("dimensionsCm") as string) || null,
    internalCargoNotes: (formData.get("internalCargoNotes") as string) || null,
  };

  const parsed = updateShipmentSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Invalid shipment updates" };
  }

  try {
    const shipment = await updateShipment(parsed.data, {
      id: session.userId,
      email: session.email,
      role: session.role,
    });

    if (orderId) {
      revalidatePath(`/admin/orders/${orderId}`);
      revalidatePath(`/account/orders/${orderId}`);
    }
    return { success: true, shipmentId: shipment.id };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update shipment" };
  }
}

export async function addShipmentEventAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session || !isAdminOrStaffRole(session.role)) {
    return { success: false, error: "Administrative privileges required." };
  }

  const orderId = formData.get("orderId") as string;
  const raw = {
    shipmentId: formData.get("shipmentId") as string,
    status: formData.get("status") as string,
    location: (formData.get("location") as string) || null,
    description: formData.get("description") as string,
    isPublic: formData.get("isPublic") !== "false",
    timestamp: (formData.get("timestamp") as string) || new Date().toISOString(),
    syncOrderStatus: formData.get("syncOrderStatus") !== "false",
  };

  const parsed = addShipmentEventSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Invalid shipment event" };
  }

  try {
    const event = await addShipmentEvent(parsed.data, {
      id: session.userId,
      email: session.email,
      role: session.role,
    });

    if (orderId) {
      revalidatePath(`/admin/orders/${orderId}`);
      revalidatePath(`/account/orders/${orderId}`);
    }
    return { success: true, eventId: event.id };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to add shipment event" };
  }
}

export async function addOrderTimelineEventAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session || !isAdminOrStaffRole(session.role)) {
    return { success: false, error: "Administrative privileges required." };
  }

  const orderId = formData.get("orderId") as string;
  const raw = {
    orderId,
    eventType: (formData.get("eventType") as string) || "MANUAL_UPDATE",
    title: formData.get("title") as string,
    description: formData.get("description") as string,
    location: (formData.get("location") as string) || null,
    isCustomerVisible: formData.get("isCustomerVisible") !== "false",
    timestamp: (formData.get("timestamp") as string) || new Date().toISOString(),
  };

  const parsed = addOrderTimelineEventSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Invalid timeline event" };
  }

  try {
    const event = await addOrderTimelineEvent(parsed.data, {
      id: session.userId,
      email: session.email,
      role: session.role,
    });

    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath(`/account/orders/${orderId}`);
    return { success: true, eventId: event.id };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to add timeline event" };
  }
}
