"use server";

import { getCurrentSession } from "@/lib/auth/session";
import { isAdminOrStaffRole, requireAdminOrStaff } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const reconcilePaymentSchema = z.object({
  paymentId: z.string().uuid("Invalid payment ID"),
  action: z.enum(["APPROVE", "FAIL", "REFUND"]),
  providerTrxId: z.string().trim().max(100).optional().nullable(),
  reason: z.string().trim().max(255).optional().nullable(),
});

export async function reconcilePaymentAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session || !isAdminOrStaffRole(session.role)) {
    return { success: false, error: "Administrative privileges required." };
  }

  const raw = {
    paymentId: formData.get("paymentId") as string,
    action: formData.get("action") as string,
    providerTrxId: (formData.get("providerTrxId") as string) || null,
    reason: (formData.get("reason") as string) || null,
  };

  const parsed = reconcilePaymentSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Invalid input" };
  }

  try {
    const payment = await prisma.payment.findUnique({
      where: { id: parsed.data.paymentId },
      include: { order: true },
    });

    if (!payment) {
      return { success: false, error: "Payment not found" };
    }

    if (parsed.data.action === "APPROVE") {
      await prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: "SUCCEEDED",
            providerTrxId: parsed.data.providerTrxId || payment.providerTrxId,
            verifiedAt: new Date(),
            verifiedById: session.userId,
          },
        });

        // Advance order if awaiting payment
        if (payment.order.status === "AWAITING_PAYMENT" || payment.order.status === "PAYMENT_REVIEW") {
          await tx.order.update({
            where: { id: payment.orderId },
            data: {
              status: "PAID",
              paymentStatus: "SUCCEEDED",
              paidAmountBDT: payment.amount,
            },
          });

          await tx.orderStatusHistory.create({
            data: {
              orderId: payment.orderId,
              fromStatus: payment.order.status,
              toStatus: "PAID",
              changedById: session.userId,
              reason: `Payment ${payment.paymentNumber} verified and reconciled`,
            },
          });

          await tx.orderEvent.create({
            data: {
              orderId: payment.orderId,
              eventType: "PAYMENT_VERIFIED",
              title: "Payment Confirmed",
              description: `Payment of ৳ ${Number(payment.amount).toFixed(2)} confirmed. Sourcing queued.`,
              isCustomerVisible: true,
              createdById: session.userId,
            },
          });
        }

        await tx.auditLog.create({
          data: {
            actorId: session.userId,
            actorEmail: session.email,
            actorRole: session.role,
            action: "PAYMENT_RECONCILED_SUCCESS",
            entityType: "Payment",
            entityId: payment.id,
            metadata: {
              paymentNumber: payment.paymentNumber,
              orderId: payment.orderId,
              amount: payment.amount.toString(),
            },
          },
        });
      });
    } else if (parsed.data.action === "FAIL") {
      await prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: "FAILED",
            failureReason: parsed.data.reason || "Staff verification rejected transaction proof",
          },
        });

        await tx.auditLog.create({
          data: {
            actorId: session.userId,
            actorEmail: session.email,
            actorRole: session.role,
            action: "PAYMENT_RECONCILED_FAILED",
            entityType: "Payment",
            entityId: payment.id,
            metadata: {
              paymentNumber: payment.paymentNumber,
              reason: parsed.data.reason,
            },
          },
        });
      });
    }

    revalidatePath("/admin/payments");
    revalidatePath(`/admin/orders/${payment.orderId}`);
    revalidatePath("/admin");
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Reconciliation failed" };
  }
}

export async function updateSettingAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session || !isAdminOrStaffRole(session.role)) {
    return { success: false, error: "Administrative privileges required." };
  }

  const key = formData.get("key") as string;
  const value = formData.get("value") as string;
  const description = (formData.get("description") as string) || null;
  const isPublic = formData.get("isPublic") === "true";

  if (!key || value === undefined) {
    return { success: false, error: "Key and value are required." };
  }

  try {
    await prisma.companySetting.upsert({
      where: { key },
      update: { value, description, isPublic },
      create: { key, value, description, isPublic },
    });

    await prisma.auditLog.create({
      data: {
        actorId: session.userId,
        actorEmail: session.email,
        actorRole: session.role,
        action: "COMPANY_SETTING_UPDATED",
        entityType: "CompanySetting",
        metadata: { key, value, isPublic },
      },
    });

    revalidatePath("/admin/settings");
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update setting" };
  }
}
