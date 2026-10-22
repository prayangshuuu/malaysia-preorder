/**
 * Customer-safe formatters for Malaysia -> Bangladesh storefront.
 * 
 * Strict rule from MASTER_PROMPT:
 * - Display BDT prices or "Request a quote" based on product settings.
 * - Never expose MYR sourcing costs, supplier details, internal margin, or private notes.
 */

export function formatBDT(amount: number | string | { toString(): string } | null | undefined): string {
  if (amount === null || amount === undefined) {
    return "";
  }
  const numeric = typeof amount === "object" ? parseFloat(amount.toString()) : typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(numeric)) {
    return "";
  }
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(numeric);
}

export function formatDeliveryEstimate(minDays: number | null | undefined, maxDays: number | null | undefined): string {
  if (minDays && maxDays) {
    if (minDays === maxDays) {
      return `${minDays} working days`;
    }
    return `${minDays}–${maxDays} working days`;
  }
  if (minDays) return `Approx. ${minDays} working days`;
  if (maxDays) return `Up to ${maxDays} working days`;
  return "7–14 working days";
}
