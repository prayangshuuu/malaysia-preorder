"use server";

import { getCurrentSession } from "@/lib/auth/session";
import { isAdminOrStaffRole } from "@/lib/auth/rbac";
import {
  createOrderFromQuoteSchema,
  createOrderFromAcceptedQuote,
  updateOrderStatusSchema,
  updateOrderStateByAdmin,
} from "@/lib/orders";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createOrderAction(formData: FormData): Promise<void> {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login");
  }

  const raw = {
    quoteId: formData.get("quoteId") as string,
    customerNotes: (formData.get("customerNotes") as string) || null,
    shippingAddress: {
      recipientName: formData.get("recipientName") as string,
      phoneNumber: formData.get("phoneNumber") as string,
      streetAddress: formData.get("streetAddress") as string,
      thanaOrUpazila: (formData.get("thanaOrUpazila") as string) || null,
      district: formData.get("district") as string,
      division: formData.get("division") as string,
      postalCode: (formData.get("postalCode") as string) || null,
      country: "Bangladesh",
    },
  };

  const parsed = createOrderFromQuoteSchema.safeParse(raw);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message || "Invalid input";
    throw new Error(firstIssue);
  }

  let orderId: string;
  try {
    const order = await createOrderFromAcceptedQuote(parsed.data, {
      id: session.userId,
      email: session.email,
      role: session.role,
    });
    orderId = order.id;

    revalidatePath("/account/orders");
    revalidatePath("/account");
  } catch (err: unknown) {
    if ((err as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) {
      throw err;
    }
    const message = err instanceof Error ? err.message : "Failed to place order";
    throw new Error(message);
  }

  redirect(`/account/orders/${orderId}`);
}

export async function updateOrderStateAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session || !isAdminOrStaffRole(session.role)) {
    return { success: false, error: "Administrative privileges required." };
  }

  const raw = {
    orderId: formData.get("orderId") as string,
    status: (formData.get("status") as unknown as undefined) || undefined,
    procurementStatus: (formData.get("procurementStatus") as unknown as undefined) || undefined,
    shipmentStatus: (formData.get("shipmentStatus") as unknown as undefined) || undefined,
    adminNotes: (formData.get("adminNotes") as string) || undefined,
    customerSafeNote: (formData.get("customerSafeNote") as string) || undefined,
    reason: (formData.get("reason") as string) || undefined,
  };

  const parsed = updateOrderStatusSchema.safeParse(raw);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message || "Invalid transition parameters";
    return { success: false, error: firstIssue };
  }

  try {
    const updated = await updateOrderStateByAdmin(parsed.data, {
      id: session.userId,
      email: session.email,
      role: session.role,
    });

    revalidatePath(`/admin/orders/${updated.id}`);
    revalidatePath("/admin/orders");
    revalidatePath(`/account/orders/${updated.id}`);
    return { success: true, orderId: updated.id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update order state";
    return { success: false, error: message };
  }
}
