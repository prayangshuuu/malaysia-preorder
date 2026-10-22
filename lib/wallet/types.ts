import { WalletLedgerEntryType } from "@prisma/client";

/**
 * Currency minor units definition:
 * For BDT (Bangladeshi Taka), 1 BDT = 100 Poisha (2 decimal places).
 * Minor unit = Integer cents/poisha.
 */
export const WALLET_CURRENCY = "BDT";
export const MINOR_UNITS_FACTOR = 100;

export interface MinorUnits {
  minorUnits: number; // Integer, e.g. 50000 = 500.00 BDT
}

export interface WalletLedgerEntryDTO {
  id: string;
  walletId: string;
  entryType: WalletLedgerEntryType;
  amountMinorUnits: number; // Signed: positive for credit, negative for debit
  amountBDT: string; // e.g. "+500.00" or "-250.00"
  balanceAfterMinorUnits: number;
  balanceAfterBDT: string;
  currency: string;
  idempotencyKey: string;
  referenceNote: string;
  paymentId: string | null;
  orderId: string | null;
  refundId: string | null;
  createdById: string | null;
  createdAt: string;
}

export interface WalletAccountDTO {
  id: string;
  userId: string;
  currency: string;
  balanceMinorUnits: number;
  balanceBDT: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReconciliationReport {
  walletId: string;
  userId: string;
  cachedBalanceMinorUnits: number;
  cachedBalanceBDT: string;
  computedLedgerSumMinorUnits: number;
  computedLedgerSumBDT: string;
  totalEntriesCount: number;
  isConsistent: boolean;
  discrepancyMinorUnits: number;
  discrepancyBDT: string;
  checkedAt: string;
}

/**
 * Convert BDT decimal string or number to integer minor units (poisha).
 * E.g., "150.50" -> 15050, 100 -> 10000
 */
export function bdtToMinorUnits(amount: number | string | { toString(): string }): number {
  const str = typeof amount === "object" ? amount.toString() : String(amount);
  const num = parseFloat(str);
  if (isNaN(num)) {
    throw new Error(`Invalid monetary amount: ${str}`);
  }
  return Math.round(num * MINOR_UNITS_FACTOR);
}

/**
 * Convert integer minor units to 2-decimal string representation.
 * E.g., 15050 -> "150.50", -2500 -> "-25.00"
 */
export function minorUnitsToBDT(minorUnits: number): string {
  if (!Number.isInteger(minorUnits)) {
    throw new Error(`Minor units must be an integer, received: ${minorUnits}`);
  }
  return (minorUnits / MINOR_UNITS_FACTOR).toFixed(2);
}
