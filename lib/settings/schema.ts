import { z } from "zod";

/**
 * Shipping option structure configured in company settings
 */
export const configurableShippingOptionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2).max(100),
  description: z.string().max(255).optional(),
  costBDT: z.number().min(0),
  estDaysMin: z.number().int().min(1),
  estDaysMax: z.number().int().min(1),
  isDefault: z.boolean().default(false),
});

export type ConfigurableShippingOption = z.infer<typeof configurableShippingOptionSchema>;

/**
 * Enabled payment methods configuration structure
 */
export const paymentMethodConfigSchema = z.object({
  id: z.string(), // e.g. "BKASH", "NAGAD", "SSLCOMMERZ", "BANK_TRANSFER", "WALLET", "MANUAL_VERIFICATION"
  name: z.string(),
  enabled: z.boolean(),
  instructions: z.string().optional(),
  requiresManualVerification: z.boolean().default(false),
});

export type PaymentMethodConfig = z.infer<typeof paymentMethodConfigSchema>;

/**
 * Exchange rate handling configuration & documentation
 */
export const exchangeRateConfigSchema = z.object({
  defaultRateMYRtoBDT: z.number().positive(),
  sourceDescription: z.string(), // e.g. "Central Bank / Market Rate with Sourcing Buffer"
  bufferPercent: z.number().min(0).max(50), // Margin/risk buffer percentage
  rulesDocumentation: z.string(), // Human-readable rules for how exchange rates are locked and applied
  lastUpdated: z.string().optional(),
});

export type ExchangeRateConfig = z.infer<typeof exchangeRateConfigSchema>;

/**
 * Full Business Settings Schema with validation
 */
export const businessSettingsSchema = z.object({
  // Company & Contact Details
  companyName: z.string().trim().min(2, "Company name is required").max(100),
  tagline: z.string().trim().max(200).optional(),
  supportEmail: z.string().trim().email("Invalid support email"),
  supportPhone: z.string().trim().min(6, "Valid support phone required").max(30),
  whatsappNumber: z.string().trim().max(30).optional(),
  emergencyContact: z.string().trim().max(100).optional(),
  klOfficeAddress: z.string().trim().max(300).optional(),
  dhakaOfficeAddress: z.string().trim().max(300).optional(),
  businessHours: z.string().trim().max(100).optional(),

  // Policy Contents (Markdown/HTML Text)
  termsAndConditionsPolicy: z.string().min(10, "Terms policy content required"),
  privacyPolicy: z.string().min(10, "Privacy policy content required"),
  refundAndCancellationPolicy: z.string().min(10, "Refund & cancellation policy required"),
  shippingPolicy: z.string().min(10, "Shipping policy required"),
  walletPolicy: z.string().min(10, "Wallet policy required"),

  // Quotation Defaults & Fees
  quoteDefaultValidityDays: z.number().int().min(1).max(60),
  defaultServiceFeeBDT: z.number().min(0),
  defaultCustomsFeeBDT: z.number().min(0),
  minimumOrderBDT: z.number().min(0),
  standardCustomerNotes: z.string().max(500).optional(),

  // Shipping Options
  shippingOptions: z.array(configurableShippingOptionSchema).min(1, "At least one shipping option required"),

  // Payment Methods
  paymentMethods: z.array(paymentMethodConfigSchema).min(1, "At least one payment method configuration required"),

  // Currency & Exchange Rate Handling
  baseDisplayCurrency: z.literal("BDT"),
  sourcingCurrency: z.literal("MYR"),
  exchangeRateHandling: exchangeRateConfigSchema,
});

export type BusinessSettings = z.infer<typeof businessSettingsSchema>;

/**
 * Default fallback values when settings are initialized or missing in DB
 */
export const DEFAULT_BUSINESS_SETTINGS: BusinessSettings = {
  companyName: "Malaysia Direct BD",
  tagline: "Authentic Malaysian products sourced directly and delivered to your doorstep in Bangladesh.",
  supportEmail: "support@malaysiapreorder.com",
  supportPhone: "+880 1800-000001",
  whatsappNumber: "+60 11-2345 6789",
  emergencyContact: "+880 1700-000002",
  klOfficeAddress: "Level 12, Menara KL Sourcing, Jalan Bukit Bintang, 55100 Kuala Lumpur, Malaysia",
  dhakaOfficeAddress: "House 24, Road 11, Banani, Dhaka-1213, Bangladesh",
  businessHours: "Saturday - Thursday: 10:00 AM - 8:00 PM (BST)",

  termsAndConditionsPolicy: `# Terms & Conditions of Pre-Order Service

1. **Nature of Sourcing Agreement**
   Malaysia Direct BD acts as an authorized purchasing and logistics agent on behalf of the customer. When you accept an issued quotation, you authorize our Kuala Lumpur operations team to purchase the specified items from authorized Malaysian retailers.

2. **Pricing and Quotations**
   All accepted quotations are fixed in Bangladeshi Taka (BDT) and cover international air shipping, customs clearance, fuel surcharges, and local delivery within Bangladesh. Any exchange rate fluctuation post-quote acceptance is borne by the company.

3. **Order Confirmation & Payments**
   Procurement in Malaysia starts exclusively after the agreed initial advance payment or total payment is verified through an approved gateway or available wallet funds.

4. **Authenticity Guarantee**
   We only purchase 100% genuine retail and department store merchandise from certified Malaysian vendors. Store purchase receipts and serial numbers are maintained for verification.`,

  privacyPolicy: `# Privacy Policy

1. **Information We Collect**
   We collect customer details necessary to fulfill cross-border logistics: recipient full name, delivery address, phone number, and sourcing inquiry specifications.

2. **Payment Data Security**
   We do not store credit card numbers, CVVs, or bank secrets on our servers. All online transactions are processed through encrypted, PCI-compliant payment gateways or registered mobile financial services.

3. **Data Sharing**
   Customer shipping information is shared strictly with our bonded air cargo logistics partners and domestic delivery couriers in Bangladesh solely for order dispatch. We never sell customer personal information.`,

  refundAndCancellationPolicy: `# Refund & Cancellation Policy

1. **Cancellation Prior to Malaysia Procurement**
   Orders may be cancelled with a 100% full refund before our procurement team purchases the item in Malaysia.

2. **Post-Procurement Restrictions**
   Once an item is purchased from a Malaysian retailer, the order cannot be cancelled unless the merchant accepts returns or the wrong item was procured.

3. **Damaged or Missing Items**
   If an item arrives damaged or differs from the accepted quote specifications, the customer must report within 48 hours of delivery. A full refund or replacement will be arranged.

4. **Refund Processing**
   Refunds may be credited directly to the customer's secure platform Wallet (immediately available for future purchases) or refunded back to the original funding account within 5-7 banking days.`,

  shippingPolicy: `# Shipping & Delivery Policy

1. **Weekly Flight Schedules**
   We consolidate procurement shipments into scheduled weekly air cargo flights from Kuala Lumpur International Airport (KUL) to Hazrat Shahjalal International Airport (DAC).

2. **Delivery Windows**
   - Dhaka City: 7 to 10 working days from weekly flight dispatch.
   - Major Divisional Cities (Chattogram, Sylhet, Rajshahi): 8 to 12 working days.
   - District & Upazila levels: 10 to 14 working days via licensed domestic couriers.

3. **Customs Clearance**
   All goods undergo formal commercial air cargo customs clearance. Quoted prices in BDT include all customs tariffs, duties, and handling charges with zero doorstep surprises.`,

  walletPolicy: `# Customer Wallet Policy

1. **Immutable Double-Entry Ledger**
   The platform wallet is managed via an auditable, append-only ledger. Every credit and debit creates an immutable record tied to an authorized transaction or verified order refund.

2. **Top-Up Validity**
   Funds become spendable immediately upon verified payment callback confirmation from the gateway.

3. **Wallet Usage**
   Wallet funds can be applied instantly at checkout to pay for accepted pre-order quotations without gateway transaction surcharges.

4. **Non-Withdrawable Promotional Credits**
   Promotional or courtesy credits (if issued) cannot be cashed out and may only be redeemed for product sourcing.`,

  quoteDefaultValidityDays: 7,
  defaultServiceFeeBDT: 500,
  defaultCustomsFeeBDT: 0,
  minimumOrderBDT: 1000,
  standardCustomerNotes: "100% original authentic product sourced directly from verified authorized retailers in Kuala Lumpur, Malaysia.",

  shippingOptions: [
    {
      id: "opt-air-std",
      name: "Standard Air Courier (KL → Dhaka)",
      description: "Direct flight cargo, door delivery across Bangladesh",
      costBDT: 850,
      estDaysMin: 7,
      estDaysMax: 10,
      isDefault: true,
    },
    {
      id: "opt-air-exp",
      name: "Express Air Priority (DHL / Cargo Priority)",
      description: "Priority processing and fast courier transit",
      costBDT: 1850,
      estDaysMin: 3,
      estDaysMax: 5,
      isDefault: false,
    },
  ],

  paymentMethods: [
    {
      id: "BKASH",
      name: "bKash Online / QR",
      enabled: true,
      instructions: "Direct bKash gateway and merchant checkout",
      requiresManualVerification: false,
    },
    {
      id: "NAGAD",
      name: "Nagad",
      enabled: true,
      instructions: "Nagad digital payment gateway",
      requiresManualVerification: false,
    },
    {
      id: "SSLCOMMERZ",
      name: "Debit / Credit Card (SSLCOMMERZ)",
      enabled: true,
      instructions: "Visa, Mastercard, AMEX, and Bangladeshi Internet Banking",
      requiresManualVerification: false,
    },
    {
      id: "WALLET",
      name: "Platform Wallet Balance",
      enabled: true,
      instructions: "Instant deduction from your verified store credit balance",
      requiresManualVerification: false,
    },
    {
      id: "BANK_TRANSFER",
      name: "Direct Bank Transfer",
      enabled: true,
      instructions: "Send payment to our BRAC Bank corporate account and upload deposit slip",
      requiresManualVerification: true,
    },
    {
      id: "MANUAL_VERIFICATION",
      name: "Manual Payment Verification",
      enabled: true,
      instructions: "Staff manually verifies transaction ID and reconciles bank statement",
      requiresManualVerification: true,
    },
  ],

  baseDisplayCurrency: "BDT",
  sourcingCurrency: "MYR",
  exchangeRateHandling: {
    defaultRateMYRtoBDT: 28.5,
    sourceDescription: "Bank Negara Malaysia / Bangladesh Bank Commercial Market Reference with FX volatility buffer",
    bufferPercent: 3.5,
    rulesDocumentation: `Exchange Rate & Currency Rules:
1. Customer quotes are strictly displayed and settled in Bangladeshi Taka (BDT).
2. Sourcing costs from Malaysian suppliers are recorded in Malaysian Ringgit (MYR).
3. The exchange rate is snapshot on the Quote upon quote issuance and becomes immutable once accepted by the customer.
4. Fluctuations after quote acceptance are absorbed by company operations; customers are never asked to pay currency adjustment fees after acceptance.
5. Sourcing cost conversions (MYR -> BDT) use: SourcingMYR * ExchangeRate = EstimatedBDT. Internal gross margins are calculated as (QuotedItemsSubtotalBDT - EstimatedSourcingBDT).`,
    lastUpdated: new Date().toISOString(),
  },
};
