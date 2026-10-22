import { z } from "zod";

// Password policy: At least 8 characters, at least 1 letter, and at least 1 number
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters long")
  .max(100, "Password cannot exceed 100 characters")
  .regex(/[a-zA-Z]/, "Password must contain at least one letter")
  .regex(/[0-9]/, "Password must contain at least one number");

// Customer registration schema
export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(80, "Name cannot exceed 80 characters"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please provide a valid email address")
    .max(100, "Email cannot exceed 100 characters"),
  phone: z
    .string()
    .trim()
    .regex(/^(\+?8801|01)[3-9]\d{8}$/, "Please enter a valid Bangladesh phone number (e.g., 01712345678)")
    .optional()
    .or(z.literal("")),
  password: passwordSchema,
});

// Login schema
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please enter a valid email address"),
  password: z
    .string()
    .min(1, "Password is required")
    .max(100, "Password is too long"),
});

// Profile update schema
export const updateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(80, "Name cannot exceed 80 characters"),
  phone: z
    .string()
    .trim()
    .regex(/^(\+?8801|01)[3-9]\d{8}$/, "Please enter a valid Bangladesh phone number")
    .optional()
    .or(z.literal("")),
  preferredCity: z.string().trim().max(60).optional(),
  district: z.string().trim().max(60).optional(),
  division: z.string().trim().max(60).optional(),
  defaultNotes: z.string().trim().max(500).optional(),
});

// Password change schema
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "New passwords do not match",
    path: ["confirmPassword"],
  });

// Customer Address validation
export const addressSchema = z.object({
  recipientName: z
    .string()
    .trim()
    .min(2, "Recipient name must be at least 2 characters")
    .max(100),
  phoneNumber: z
    .string()
    .trim()
    .regex(/^(\+?8801|01)[3-9]\d{8}$/, "Please enter a valid Bangladesh phone number"),
  streetAddress: z
    .string()
    .trim()
    .min(5, "Street address must be at least 5 characters")
    .max(250),
  thanaOrUpazila: z.string().trim().max(100).optional(),
  district: z.string().trim().min(2, "District is required").max(100),
  division: z.string().trim().min(2, "Division is required").max(100),
  postalCode: z.string().trim().max(20).optional(),
  isDefault: z.boolean().default(false),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type AddressInput = z.infer<typeof addressSchema>;
