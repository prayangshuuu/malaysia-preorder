"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
  addressSchema,
} from "./validation";
import {
  hashPassword,
  verifyPassword,
  createSessionToken,
  setSessionCookie,
  clearSessionCookie,
  getCurrentSession,
} from "./session";
import { rateLimit, getClientIp } from "./rate-limit";
import { requireAuth, requireAdminOrStaff, assertResourceOwnership } from "./rbac";

export type AuthActionResult<T = unknown> = {
  success: boolean;
  message?: string;
  errors?: Record<string, string[]>;
  data?: T;
};

/**
 * Public Customer Registration
 * Enforces role: CUSTOMER. Never allows role escalation from public registration.
 */
export async function registerCustomerAction(
  formData: unknown
): Promise<AuthActionResult<{ userId: string }>> {
  const headersList = await headers();
  const ip = getClientIp(headersList);

  // Rate limiting for registrations (10 requests per 10 mins per IP)
  const rl = await rateLimit(`register:${ip}`, { limit: 10, windowSeconds: 600 });
  if (!rl.success) {
    return {
      success: false,
      message: `Too many registration attempts. Please try again in ${rl.retryAfterSeconds} seconds.`,
    };
  }

  const parsed = registerSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      message: "Please correct the errors in the registration form.",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const { name, email, phone, password } = parsed.data;

  // Check existing user
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email },
        ...(phone ? [{ phone }] : []),
      ],
    },
  });

  if (existingUser) {
    return {
      success: false,
      message: "An account with this email address or phone number already exists.",
    };
  }

  const passwordHash = await hashPassword(password);

  // Create user & initial empty wallet with role explicitly forced to CUSTOMER
  const user = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        name,
        email,
        phone: phone || null,
        passwordHash,
        role: UserRole.CUSTOMER, // Strict customer enforcement
        profile: {
          create: {},
        },
      },
    });

    // Create companion wallet account
    await tx.walletAccount.create({
      data: {
        userId: newUser.id,
      },
    });

    return newUser;
  });

  // Log customer in immediately
  const sessionToken = await createSessionToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    isActive: user.isActive,
  });

  await setSessionCookie(sessionToken);

  return {
    success: true,
    message: "Registration successful! Welcome to the platform.",
    data: { userId: user.id },
  };
}

export const registerAction = registerCustomerAction;
export type ActionState<T = unknown> = AuthActionResult<T>;

/**
 * Customer / Public Login Action
 */
export async function loginAction(
  formData: unknown
): Promise<AuthActionResult<{ redirectUrl: string }>> {
  const headersList = await headers();
  const ip = getClientIp(headersList);

  const rl = await rateLimit(`login:${ip}`);
  if (!rl.success) {
    return {
      success: false,
      message: `Too many login attempts. Please wait ${rl.retryAfterSeconds} seconds before trying again.`,
    };
  }

  const parsed = loginSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      message: "Please check your login credentials.",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user || !user.passwordHash) {
    return {
      success: false,
      message: "Invalid email or password.",
    };
  }

  if (!user.isActive) {
    return {
      success: false,
      message: "Your account has been deactivated. Please contact customer support.",
    };
  }

  const isValidPassword = await verifyPassword(password, user.passwordHash);
  if (!isValidPassword) {
    return {
      success: false,
      message: "Invalid email or password.",
    };
  }

  const token = await createSessionToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    isActive: user.isActive,
  });

  await setSessionCookie(token);

  // Redirect admin/staff to admin dashboard, customers to account
  const redirectUrl =
    user.role === UserRole.ADMIN ||
    user.role === UserRole.OPERATIONS ||
    user.role === UserRole.FINANCE ||
    user.role === UserRole.SUPPORT
      ? "/admin"
      : "/account";

  return {
    success: true,
    message: "Login successful.",
    data: { redirectUrl },
  };
}

/**
 * Admin / Staff Login Action (Enforces Admin/Staff Role)
 * Regular customers trying to log in via /admin/login are rejected with a clear message.
 */
export async function adminLoginAction(
  formData: unknown
): Promise<AuthActionResult<{ redirectUrl: string }>> {
  const headersList = await headers();
  const ip = getClientIp(headersList);

  const rl = await rateLimit(`admin-login:${ip}`, { limit: 5, windowSeconds: 300 });
  if (!rl.success) {
    return {
      success: false,
      message: `Too many attempts on staff portal. Retry in ${rl.retryAfterSeconds} seconds.`,
    };
  }

  const parsed = loginSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      message: "Please enter a valid staff email and password.",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user || !user.passwordHash) {
    return {
      success: false,
      message: "Invalid staff credentials.",
    };
  }

  if (user.role === UserRole.CUSTOMER) {
    return {
      success: false,
      message: "Access denied. Customer accounts cannot access the administration area.",
    };
  }

  if (!user.isActive) {
    return {
      success: false,
      message: "This staff account has been deactivated.",
    };
  }

  const isValidPassword = await verifyPassword(password, user.passwordHash);
  if (!isValidPassword) {
    return {
      success: false,
      message: "Invalid staff credentials.",
    };
  }

  const token = await createSessionToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    isActive: user.isActive,
  });

  await setSessionCookie(token);

  return {
    success: true,
    message: "Admin authentication confirmed.",
    data: { redirectUrl: "/admin" },
  };
}

/**
 * User Logout Action
 */
export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}

/**
 * Update Customer Profile
 */
export async function updateProfileAction(
  formData: unknown
): Promise<AuthActionResult> {
  const session = await requireAuth();

  const parsed = updateProfileSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      message: "Profile validation failed.",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const { name, phone, preferredCity, district, division, defaultNotes } = parsed.data;

  // Check phone uniqueness if changed
  if (phone) {
    const existingPhone = await prisma.user.findFirst({
      where: {
        phone,
        NOT: { id: session.userId },
      },
    });

    if (existingPhone) {
      return {
        success: false,
        message: "This phone number is already registered with another account.",
      };
    }
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: session.userId },
      data: {
        name,
        phone: phone || null,
      },
    }),
    prisma.customerProfile.upsert({
      where: { userId: session.userId },
      create: {
        userId: session.userId,
        preferredCity,
        district,
        division,
        defaultNotes,
      },
      update: {
        preferredCity,
        district,
        division,
        defaultNotes,
      },
    }),
  ]);

  return {
    success: true,
    message: "Your profile has been updated successfully.",
  };
}

/**
 * Change Customer Password
 */
export async function changePasswordAction(
  formData: unknown
): Promise<AuthActionResult> {
  const session = await requireAuth();

  const parsed = changePasswordSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      message: "Password change validation failed.",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const { currentPassword, newPassword } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
  });

  if (!user || !user.passwordHash) {
    return {
      success: false,
      message: "User account not found or has no active password set.",
    };
  }

  const isCurrentValid = await verifyPassword(currentPassword, user.passwordHash);
  if (!isCurrentValid) {
    return {
      success: false,
      message: "Your current password is incorrect.",
    };
  }

  const newHash = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id: session.userId },
    data: { passwordHash: newHash },
  });

  return {
    success: true,
    message: "Password updated successfully.",
  };
}

/**
 * Customer Address Management: Create or Update (with IDOR prevention)
 */
export async function saveAddressAction(
  formData: unknown,
  addressId?: string
): Promise<AuthActionResult<{ addressId: string }>> {
  const session = await requireAuth();

  const parsed = addressSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      success: false,
      message: "Please check your address details.",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const addressData = parsed.data;

  if (addressId) {
    // IDOR Check: Ensure address belongs to authenticated user
    const existingAddress = await prisma.address.findUnique({
      where: { id: addressId },
    });

    if (!existingAddress) {
      return { success: false, message: "Address not found." };
    }

    await assertResourceOwnership(existingAddress.userId);

    if (addressData.isDefault) {
      await prisma.address.updateMany({
        where: { userId: session.userId },
        data: { isDefault: false },
      });
    }

    const updated = await prisma.address.update({
      where: { id: addressId },
      data: { ...addressData },
    });

    return {
      success: true,
      message: "Address updated successfully.",
      data: { addressId: updated.id },
    };
  } else {
    // If setting as default or if first address, set default
    if (addressData.isDefault) {
      await prisma.address.updateMany({
        where: { userId: session.userId },
        data: { isDefault: false },
      });
    }

    const created = await prisma.address.create({
      data: {
        ...addressData,
        userId: session.userId,
      },
    });

    return {
      success: true,
      message: "Address added successfully.",
      data: { addressId: created.id },
    };
  }
}

/**
 * Delete Customer Address (with IDOR prevention)
 */
export async function deleteAddressAction(
  addressId: string
): Promise<AuthActionResult> {
  const session = await requireAuth();

  const existingAddress = await prisma.address.findUnique({
    where: { id: addressId },
  });

  if (!existingAddress) {
    return { success: false, message: "Address not found." };
  }

  // IDOR Protection
  await assertResourceOwnership(existingAddress.userId);

  await prisma.address.delete({
    where: { id: addressId },
  });

  return {
    success: true,
    message: "Address removed.",
  };
}
