import crypto from "node:crypto";

/**
 * Generates an unguessable, human-readable order number.
 * Format: ORD-YYYYMMDD-XXXX (e.g. ORD-20261022-7F3K)
 * Avoids revealing sequential database auto-increments or predictable counters.
 */
export function generateOrderNumber(date: Date = new Date()): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const randomSuffix = crypto.randomBytes(3).toString("hex").toUpperCase(); // 6 chars, high entropy
  return `ORD-${yyyy}${mm}${dd}-${randomSuffix}`;
}
