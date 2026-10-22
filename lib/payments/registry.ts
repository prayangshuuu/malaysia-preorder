import { PaymentMethodType, PaymentStatus, RefundStatus } from "@prisma/client";
import {
  IPaymentProvider,
  InitiatePaymentParams,
  InitiatePaymentResult,
  VerifyWebhookParams,
  ParsedWebhookEvent,
  GetPaymentStatusParams,
  ProviderPaymentStatusResult,
  ProcessRefundParams,
  ProcessRefundResult,
  ProviderConfigState,
} from "./types";
import { SafeDevPaymentAdapter } from "./safe-dev-adapter";

/**
 * BKash Checkout Adapter (Stub / Disabled state)
 *
 * Requirements:
 * Implement a real provider ONLY when official integration documentation and credentials are available.
 * If credentials are missing or placeholder, getConfigState() reports unconfigured,
 * and operations throw/reject safely without faking payment success.
 */
export class BkashPaymentProvider implements IPaymentProvider {
  public readonly providerName = "bkash";
  public readonly methodType = PaymentMethodType.BKASH;

  private appKey?: string;
  private appSecret?: string;
  private username?: string;
  private password?: string;
  private baseUrl?: string;

  constructor() {
    this.appKey = process.env.BKASH_APP_KEY;
    this.appSecret = process.env.BKASH_APP_SECRET;
    this.username = process.env.BKASH_USERNAME;
    this.password = process.env.BKASH_PASSWORD;
    this.baseUrl = process.env.BKASH_BASE_URL;
  }

  public getConfigState(): ProviderConfigState {
    const missingKeys: string[] = [];
    if (!this.appKey || this.appKey.includes("placeholder")) missingKeys.push("BKASH_APP_KEY");
    if (!this.appSecret || this.appSecret.includes("placeholder")) missingKeys.push("BKASH_APP_SECRET");
    if (!this.username || this.username.includes("placeholder")) missingKeys.push("BKASH_USERNAME");
    if (!this.password || this.password.includes("placeholder")) missingKeys.push("BKASH_PASSWORD");

    const isConfigured = missingKeys.length === 0;

    return {
      isConfigured,
      providerName: this.providerName,
      environment: isConfigured ? "sandbox" : "unconfigured",
      supportedMethods: [PaymentMethodType.BKASH],
      missingKeys,
    };
  }

  public async initiatePayment(_params: InitiatePaymentParams): Promise<InitiatePaymentResult> {
    const config = this.getConfigState();
    if (!config.isConfigured) {
      return {
        success: false,
        status: PaymentStatus.FAILED,
        errorMessage: `bKash payment provider is unconfigured. Missing credentials: ${config.missingKeys.join(", ")}`,
      };
    }

    // In a fully credentialed environment, this would call bKash /tokenized/checkout/create
    throw new Error("bKash credentials not verified against real upstream gateway");
  }

  public async verifyWebhook(_params: VerifyWebhookParams): Promise<ParsedWebhookEvent> {
    return {
      isValidSignature: false,
      eventId: "BKASH-UNCONFIGURED",
      eventType: "unknown",
      provider: this.providerName,
      status: PaymentStatus.FAILED,
      sanitizedPayload: {},
      rejectionReason: "bKash webhook processing disabled: official gateway integration unconfigured",
    };
  }

  public async getPaymentStatus(_params: GetPaymentStatusParams): Promise<ProviderPaymentStatusResult> {
    return {
      status: PaymentStatus.FAILED,
      amount: 0,
      currency: "BDT",
      sanitizedPayload: {},
      errorMessage: "bKash query status disabled: credentials unconfigured",
    };
  }

  public async processRefund(_params: ProcessRefundParams): Promise<ProcessRefundResult> {
    return {
      success: false,
      status: RefundStatus.REJECTED,
      refundedAmount: 0,
      sanitizedPayload: {},
      errorMessage: "bKash refunds disabled: gateway unconfigured",
    };
  }
}

/**
 * SSLCommerz Adapter (Stub / Disabled state)
 */
export class SSLCommerzPaymentProvider implements IPaymentProvider {
  public readonly providerName = "sslcommerz";
  public readonly methodType = PaymentMethodType.SSLCOMMERZ;

  private storeId?: string;
  private storePasswd?: string;

  constructor() {
    this.storeId = process.env.SSLCOMMERZ_STORE_ID;
    this.storePasswd = process.env.SSLCOMMERZ_STORE_PASSWD;
  }

  public getConfigState(): ProviderConfigState {
    const missingKeys: string[] = [];
    if (!this.storeId || this.storeId.includes("placeholder")) missingKeys.push("SSLCOMMERZ_STORE_ID");
    if (!this.storePasswd || this.storePasswd.includes("placeholder")) missingKeys.push("SSLCOMMERZ_STORE_PASSWD");

    const isConfigured = missingKeys.length === 0;

    return {
      isConfigured,
      providerName: this.providerName,
      environment: isConfigured ? "sandbox" : "unconfigured",
      supportedMethods: [PaymentMethodType.SSLCOMMERZ],
      missingKeys,
    };
  }

  public async initiatePayment(_params: InitiatePaymentParams): Promise<InitiatePaymentResult> {
    const config = this.getConfigState();
    if (!config.isConfigured) {
      return {
        success: false,
        status: PaymentStatus.FAILED,
        errorMessage: `SSLCommerz payment provider is unconfigured. Missing credentials: ${config.missingKeys.join(", ")}`,
      };
    }

    throw new Error("SSLCommerz credentials not verified against real upstream gateway");
  }

  public async verifyWebhook(_params: VerifyWebhookParams): Promise<ParsedWebhookEvent> {
    return {
      isValidSignature: false,
      eventId: "SSLCOMMERZ-UNCONFIGURED",
      eventType: "unknown",
      provider: this.providerName,
      status: PaymentStatus.FAILED,
      sanitizedPayload: {},
      rejectionReason: "SSLCommerz IPN verification disabled: official gateway unconfigured",
    };
  }

  public async getPaymentStatus(_params: GetPaymentStatusParams): Promise<ProviderPaymentStatusResult> {
    return {
      status: PaymentStatus.FAILED,
      amount: 0,
      currency: "BDT",
      sanitizedPayload: {},
      errorMessage: "SSLCommerz query status disabled: credentials unconfigured",
    };
  }

  public async processRefund(_params: ProcessRefundParams): Promise<ProcessRefundResult> {
    return {
      success: false,
      status: RefundStatus.REJECTED,
      refundedAmount: 0,
      sanitizedPayload: {},
      errorMessage: "SSLCommerz refunds disabled: gateway unconfigured",
    };
  }
}

/**
 * Payment Provider Registry / Factory
 */
class PaymentProviderRegistry {
  private providers: Map<string, IPaymentProvider> = new Map();

  constructor() {
    // Register default providers
    const safeDev = new SafeDevPaymentAdapter();
    const bkash = new BkashPaymentProvider();
    const sslcommerz = new SSLCommerzPaymentProvider();

    this.registerProvider(safeDev);
    this.registerProvider(bkash);
    this.registerProvider(sslcommerz);
  }

  public registerProvider(provider: IPaymentProvider): void {
    this.providers.set(provider.providerName.toLowerCase(), provider);
  }

  /**
   * Get provider by name (e.g. "bkash", "sslcommerz", "dev-safe-adapter")
   */
  public getProvider(providerName?: string): IPaymentProvider {
    if (!providerName) {
      return this.providers.get("dev-safe-adapter")!;
    }
    const target = this.providers.get(providerName.toLowerCase());
    if (!target) {
      throw new Error(`Unsupported payment provider: ${providerName}`);
    }
    return target;
  }

  /**
   * Return configuration status of all registered providers
   */
  public getAllProviderStates(): ProviderConfigState[] {
    return Array.from(this.providers.values()).map((p) => p.getConfigState());
  }
}

export const paymentRegistry = new PaymentProviderRegistry();
