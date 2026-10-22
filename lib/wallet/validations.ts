import { z } from "zod";
import { WalletLedgerEntryType } from "@prisma/client";

export const initiateTopUpSchema = z.object({
  amountBDT: z
    .number()
    .positive("Top-up amount must be greater than 0")
    .max(500000, "Maximum top-up per transaction is ৳500,000")
    .refine((val) => Number.isInteger(Math.round(val * 100)), {
      message: "Amount must have at most 2 decimal places",
    }),
  idempotencyKey: z
    .string()
    .min(10, "Idempotency key must be at least 10 characters")
    .max(128, "Idempotency key must be at most 128 characters"),
  providerName: z.string().optional().default("safe-dev-payment"),
  returnUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

export type InitiateTopUpInput = z.infer<typeof initiateTopUpSchema>;

export const payOrderWithWalletSchema = z.object({
  orderId: z.string().uuid("Invalid order ID"),
  idempotencyKey: z
    .string()
    .min(10, "Idempotency key must be at least 10 characters")
    .max(128, "Idempotency key must be at most 128 characters"),
});

export type PayOrderWithWalletInput = z.infer<typeof payOrderWithWalletSchema>;

export const walletHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  entryType: z.nativeEnum(WalletLedgerEntryType).optional(),
});

export type WalletHistoryQueryInput = z.infer<typeof walletHistoryQuerySchema>;

export const adminReconciliationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  onlyDiscrepancies: z.coerce.boolean().default(false),
  userId: z.string().uuid().optional(),
});

export type AdminReconciliationQueryInput = z.infer<typeof adminReconciliationQuerySchema>;
