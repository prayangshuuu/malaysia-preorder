import test from "node:test";
import assert from "node:assert/strict";
import { formatBDT, formatDeliveryEstimate } from "@/lib/formatters";
import { customerSafeProductSelect } from "@/lib/products";

test("formatBDT formats various currency inputs accurately", () => {
  assert.equal(formatBDT(null), "");
  assert.equal(formatBDT(undefined), "");
  assert.equal(formatBDT(NaN), "");
  
  // Format 850 BDT
  const formatted850 = formatBDT(850);
  assert.match(formatted850, /850/);
  
  // Format Decimal-like objects { toString(): "2450.00" }
  const formattedDecimal = formatBDT({ toString: () => "2450.00" });
  assert.match(formattedDecimal, /2,450|2450/);
});

test("formatDeliveryEstimate provides truthful business estimates", () => {
  assert.equal(formatDeliveryEstimate(7, 12), "7–12 working days");
  assert.equal(formatDeliveryEstimate(10, 10), "10 working days");
  assert.equal(formatDeliveryEstimate(5, null), "Approx. 5 working days");
  assert.equal(formatDeliveryEstimate(null, 14), "Up to 14 working days");
  assert.equal(formatDeliveryEstimate(null, null), "7–14 working days");
});

test("Security invariant: customerSafeProductSelect strictly omits private admin fields", () => {
  const selectedFields = Object.keys(customerSafeProductSelect);
  
  // Forbidden fields from MASTER_PROMPT.md
  assert.equal(selectedFields.includes("approxCostMYR"), false);
  assert.equal(selectedFields.includes("sourceUrl"), false);
  assert.equal(selectedFields.includes("defaultSupplier"), false);
  assert.equal(selectedFields.includes("defaultSupplierId"), false);
  assert.equal(selectedFields.includes("adminNotes"), false);
  assert.equal(selectedFields.includes("sourcingCostMYR"), false);
  
  // Required customer fields present
  assert.equal(selectedFields.includes("id"), true);
  assert.equal(selectedFields.includes("title"), true);
  assert.equal(selectedFields.includes("slug"), true);
  assert.equal(selectedFields.includes("displayPriceBDT"), true);
  assert.equal(selectedFields.includes("pricingType"), true);
  assert.equal(selectedFields.includes("originCountry"), true);
});
