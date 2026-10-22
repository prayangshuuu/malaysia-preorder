"use server";

import { getCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const addressSchema = z.object({
  recipientName: z.string().trim().min(2, "Recipient name is required").max(100),
  phoneNumber: z.string().trim().min(8, "Valid phone number required").max(20),
  streetAddress: z.string().trim().min(5, "Street address is required").max(255),
  thanaOrUpazila: z.string().trim().max(100).optional().nullable(),
  district: z.string().trim().min(2, "District is required").max(100),
  division: z.string().trim().min(2, "Division is required").max(100),
  postalCode: z.string().trim().max(20).optional().nullable(),
  country: z.string().trim().default("Bangladesh"),
  isDefault: z.boolean().default(false),
});

export async function createAddressAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, error: "Authentication required" };
  }

  const raw = {
    recipientName: formData.get("recipientName") as string,
    phoneNumber: formData.get("phoneNumber") as string,
    streetAddress: formData.get("streetAddress") as string,
    thanaOrUpazila: (formData.get("thanaOrUpazila") as string) || null,
    district: formData.get("district") as string,
    division: formData.get("division") as string,
    postalCode: (formData.get("postalCode") as string) || null,
    country: (formData.get("country") as string) || "Bangladesh",
    isDefault: formData.get("isDefault") === "true",
  };

  const parsed = addressSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Invalid address data" };
  }

  try {
    if (parsed.data.isDefault) {
      // Unset previous defaults
      await prisma.address.updateMany({
        where: { userId: session.userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const address = await prisma.address.create({
      data: {
        userId: session.userId,
        recipientName: parsed.data.recipientName,
        phoneNumber: parsed.data.phoneNumber,
        streetAddress: parsed.data.streetAddress,
        thanaOrUpazila: parsed.data.thanaOrUpazila || null,
        district: parsed.data.district,
        division: parsed.data.division,
        postalCode: parsed.data.postalCode || null,
        country: parsed.data.country,
        isDefault: parsed.data.isDefault,
      },
    });

    revalidatePath("/account");
    revalidatePath("/account/addresses");
    return { success: true, address };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to save address" };
  }
}

export async function deleteAddressAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, error: "Authentication required" };
  }

  const addressId = formData.get("addressId") as string;
  if (!addressId) {
    return { success: false, error: "Address ID required" };
  }

  try {
    // Assert ownership
    const addr = await prisma.address.findUnique({
      where: { id: addressId },
    });

    if (!addr || addr.userId !== session.userId) {
      return { success: false, error: "Address not found or access denied" };
    }

    await prisma.address.delete({
      where: { id: addressId },
    });

    revalidatePath("/account");
    revalidatePath("/account/addresses");
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to delete address" };
  }
}

export async function setDefaultAddressAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, error: "Authentication required" };
  }

  const addressId = formData.get("addressId") as string;
  if (!addressId) {
    return { success: false, error: "Address ID required" };
  }

  try {
    const addr = await prisma.address.findUnique({
      where: { id: addressId },
    });

    if (!addr || addr.userId !== session.userId) {
      return { success: false, error: "Address not found or access denied" };
    }

    await prisma.$transaction([
      prisma.address.updateMany({
        where: { userId: session.userId, isDefault: true },
        data: { isDefault: false },
      }),
      prisma.address.update({
        where: { id: addressId },
        data: { isDefault: true },
      }),
    ]);

    revalidatePath("/account");
    revalidatePath("/account/addresses");
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to set default address" };
  }
}

export async function markNotificationReadAction(formData: FormData) {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, error: "Authentication required" };
  }

  const notificationId = formData.get("notificationId") as string;
  if (!notificationId) {
    return { success: false, error: "Notification ID required" };
  }

  try {
    const notif = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notif || notif.userId !== session.userId) {
      return { success: false, error: "Notification not found or access denied" };
    }

    await prisma.notification.update({
      where: { id: notificationId },
      data: { status: "READ" },
    });

    revalidatePath("/account/notifications");
    revalidatePath("/account");
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update notification" };
  }
}

export async function markAllNotificationsReadAction() {
  const session = await getCurrentSession();
  if (!session) {
    return { success: false, error: "Authentication required" };
  }

  try {
    await prisma.notification.updateMany({
      where: { userId: session.userId, status: "UNREAD" },
      data: { status: "READ" },
    });

    revalidatePath("/account/notifications");
    revalidatePath("/account");
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to mark all as read" };
  }
}
