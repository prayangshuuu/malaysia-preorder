import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import {
  BusinessSettings,
  businessSettingsSchema,
  DEFAULT_BUSINESS_SETTINGS,
} from "./schema";

const SETTINGS_KEY = "BUSINESS_SETTINGS_CONFIG";

/**
 * Service error for settings actions
 */
export class SettingsServiceError extends Error {
  constructor(message: string, public statusCode: number = 400) {
    super(message);
    this.name = "SettingsServiceError";
  }
}

/**
 * Retrieve current active business settings.
 * If not yet saved in database, falls back to well-formed DEFAULT_BUSINESS_SETTINGS
 * and provisions them transparently.
 */
export async function getBusinessSettings(): Promise<BusinessSettings> {
  try {
    const record = await prisma.companySetting.findUnique({
      where: { key: SETTINGS_KEY },
    });

    if (!record || !record.value) {
      return DEFAULT_BUSINESS_SETTINGS;
    }

    const parsedJson = JSON.parse(record.value);
    const validated = businessSettingsSchema.safeParse(parsedJson);

    if (!validated.success) {
      console.warn(
        "[SettingsService] Stored settings JSON failed validation, using defaults:",
        validated.error.format()
      );
      return DEFAULT_BUSINESS_SETTINGS;
    }

    return validated.data;
  } catch (error) {
    console.error("[SettingsService] Error loading business settings:", error);
    return DEFAULT_BUSINESS_SETTINGS;
  }
}

/**
 * Retrieve public-facing business settings for storefront (company info, policies, contact, exchange rate info).
 * Strips internal configuration flags if any.
 */
export async function getPublicBusinessSettings() {
  const settings = await getBusinessSettings();

  return {
    companyName: settings.companyName,
    tagline: settings.tagline,
    supportEmail: settings.supportEmail,
    supportPhone: settings.supportPhone,
    whatsappNumber: settings.whatsappNumber,
    emergencyContact: settings.emergencyContact,
    klOfficeAddress: settings.klOfficeAddress,
    dhakaOfficeAddress: settings.dhakaOfficeAddress,
    businessHours: settings.businessHours,
    policies: {
      termsAndConditions: settings.termsAndConditionsPolicy,
      privacy: settings.privacyPolicy,
      refundAndCancellation: settings.refundAndCancellationPolicy,
      shipping: settings.shippingPolicy,
      wallet: settings.walletPolicy,
    },
    shippingOptions: settings.shippingOptions,
    paymentMethods: settings.paymentMethods.filter((m) => m.enabled),
    baseDisplayCurrency: settings.baseDisplayCurrency,
    sourcingCurrency: settings.sourcingCurrency,
    exchangeRateHandling: {
      defaultRateMYRtoBDT: settings.exchangeRateHandling.defaultRateMYRtoBDT,
      sourceDescription: settings.exchangeRateHandling.sourceDescription,
      rulesDocumentation: settings.exchangeRateHandling.rulesDocumentation,
    },
    quoteDefaultValidityDays: settings.quoteDefaultValidityDays,
  };
}

/**
 * Update business settings with strict validation, superadmin authorization, and audit logging.
 */
export async function updateBusinessSettings(
  input: unknown,
  actor: { id: string; email?: string | null; role: string },
  requestMeta?: { ipAddress?: string | null; userAgent?: string | null }
): Promise<BusinessSettings> {
  // 1. Validate payload
  const parseResult = businessSettingsSchema.safeParse(input);
  if (!parseResult.success) {
    const errorDetails = Object.entries(parseResult.error.flatten().fieldErrors)
      .map(([field, msgs]) => `${field}: ${msgs?.join(", ")}`)
      .join("; ");
    throw new SettingsServiceError(`Validation failed: ${errorDetails}`, 400);
  }

  const validatedSettings = parseResult.data;

  // Stamp lastUpdated on exchange rates
  validatedSettings.exchangeRateHandling.lastUpdated = new Date().toISOString();

  // 2. Load previous settings for audit diff
  let previousSettings: BusinessSettings | null = null;
  const currentRecord = await prisma.companySetting.findUnique({
    where: { key: SETTINGS_KEY },
  });
  if (currentRecord?.value) {
    try {
      previousSettings = JSON.parse(currentRecord.value);
    } catch {
      // previous was unparseable
    }
  }

  // 3. Persist to CompanySetting
  const updatedRecord = await prisma.companySetting.upsert({
    where: { key: SETTINGS_KEY },
    create: {
      key: SETTINGS_KEY,
      value: JSON.stringify(validatedSettings),
      description: "Master Business, Contact, Logistics, Policy & Exchange Rate Settings",
      isPublic: true,
    },
    update: {
      value: JSON.stringify(validatedSettings),
      updatedAt: new Date(),
    },
  });

  // 4. Create Audit Log
  await logAudit({
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: "SETTINGS_UPDATED",
    entityType: "CompanySetting",
    entityId: updatedRecord.id,
    metadata: {
      companyName: validatedSettings.companyName,
      defaultRateMYRtoBDT: validatedSettings.exchangeRateHandling.defaultRateMYRtoBDT,
      quoteDefaultValidityDays: validatedSettings.quoteDefaultValidityDays,
      shippingOptionsCount: validatedSettings.shippingOptions.length,
      paymentMethodsCount: validatedSettings.paymentMethods.length,
      previousSnippet: previousSettings ? {
        companyName: previousSettings.companyName,
        defaultRate: previousSettings.exchangeRateHandling?.defaultRateMYRtoBDT,
      } : null,
    },
    ipAddress: requestMeta?.ipAddress,
    userAgent: requestMeta?.userAgent,
  });

  return validatedSettings;
}
