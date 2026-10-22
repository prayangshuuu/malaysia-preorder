import test from "node:test";
import assert from "node:assert/strict";
import { calculateQuoteTotals } from "../lib/quotes/types";
import {
  extractShippingOptionsFromQuote,
  extractTermsText,
} from "../lib/quotes/service";

test("calculateQuoteTotals: accurately calculates line items, fees, discount and final total", () => {
  const result = calculateQuoteTotals({
    lineItems: [
      { quantity: 2, unitPriceBDT: 1500 }, // 3000
      { quantity: 1, unitPriceBDT: 450.5 }, // 450.5
    ],
    serviceFeeBDT: 500,
    shippingFeeBDT: 800,
    customsFeeBDT: 200,
    discountBDT: 150.5,
  });

  // itemsSubtotal = 3000 + 450.50 = 3450.50
  assert.equal(result.itemsSubtotalBDT, 3450.5);
  assert.equal(result.serviceFeeBDT, 500);
  assert.equal(result.shippingFeeBDT, 800);
  assert.equal(result.customsFeeBDT, 200);
  assert.equal(result.discountBDT, 150.5);

  // gross = 3450.5 + 500 + 800 + 200 = 4950.5
  // total = 4950.5 - 150.5 = 4800
  assert.equal(result.totalAmountBDT, 4800);
});

test("calculateQuoteTotals: handles zero fees and discount bounded at 0", () => {
  const result = calculateQuoteTotals({
    lineItems: [{ quantity: 1, unitPriceBDT: 100 }],
    discountBDT: 500, // discount larger than subtotal
  });

  assert.equal(result.itemsSubtotalBDT, 100);
  assert.equal(result.totalAmountBDT, 0); // never negative
});

test("extractShippingOptionsFromQuote: falls back to legacy columns if no JSON array present", () => {
  const options = extractShippingOptionsFromQuote({
    shippingMethod: "Air Express Direct",
    shippingFeeBDT: 1200,
    estDeliveryDaysMin: 5,
    estDeliveryDaysMax: 8,
    termsAndConditions: "Standard policy terms",
  });

  assert.equal(options.length, 1);
  assert.equal(options[0].name, "Air Express Direct");
  assert.equal(options[0].costBDT, 1200);
  assert.equal(options[0].estDaysMin, 5);
  assert.equal(options[0].estDaysMax, 8);
});

test("extractShippingOptionsFromQuote & extractTermsText: correctly unpacks multi-shipping metadata", () => {
  const rawTermsJson = JSON.stringify({
    termsText: "50% advance required upon confirmation.",
    shippingOptions: [
      {
        id: "air-std",
        name: "Standard Air Cargo",
        description: "Takes 7-10 days",
        costBDT: 650,
        estDaysMin: 7,
        estDaysMax: 10,
        isDefault: true,
      },
      {
        id: "air-exp",
        name: "DHL Air Express",
        description: "Takes 3-5 days",
        costBDT: 1400,
        estDaysMin: 3,
        estDaysMax: 5,
        isDefault: false,
      },
    ],
  });

  const options = extractShippingOptionsFromQuote({
    shippingMethod: "Standard Air Cargo",
    shippingFeeBDT: 650,
    estDeliveryDaysMin: 7,
    estDeliveryDaysMax: 10,
    termsAndConditions: rawTermsJson,
  });

  assert.equal(options.length, 2);
  assert.equal(options[0].id, "air-std");
  assert.equal(options[0].costBDT, 650);
  assert.equal(options[1].id, "air-exp");
  assert.equal(options[1].costBDT, 1400);

  const cleanTerms = extractTermsText(rawTermsJson);
  assert.equal(cleanTerms, "50% advance required upon confirmation.");
});
