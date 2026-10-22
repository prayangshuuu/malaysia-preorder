import { PaymentMethodType, PaymentStatus, RefundStatus } from "@prisma/client";

/**
 * Standard monetary currencies supported by the payment engine
 */
export type SupportedCurrency = "BDT" | "MYR";

/**
 * Common configuration state for a payment provider
 */
export interface ProviderConfigState {
  isConfigured: boolean;
  providerName: string;
  environment: "sandbox" | "production" | "unconfigured" | "development_mock";
  supportedMethods: PaymentMethodType[];
  missingKeys: string[];
}

/**
 * Parameters to initialize a payment request with a provider
 */
export interface InitiatePaymentParams {
  orderId: string;
  orderNumber: string;
  amountBDT: number; // In BDT units, e.g. 1500.50
  currency: SupportedCurrency;
  customer: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
  };
  returnUrl: string; // Informational redirect URL for customer browser return
  cancelUrl: string; // Informational cancellation URL
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}

/**
 * Standardized outcome from initiating a payment
 */
export interface InitiatePaymentResult {
  success: boolean;
  paymentId?: string; // Internal or provider-level payment identifier
  redirectUrl?: string; // Safe external gateway checkout redirect URL
  gatewayReference?: string; // Provider's checkout/session ID
  status: PaymentStatus;
  errorMessage?: string;
  requiresAction?: boolean;
  actionDetails?: Record<string, unknown>;
}

/**
 * Parameters for verifying and reconciling an incoming event (webhook or server-to-server callback)
 */
export interface VerifyWebhookParams {
  rawBody: string | Buffer;
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
}

/**
 * Canonical parsed event from any provider
 */
export interface ParsedWebhookEvent {
  isValidSignature: boolean;
  eventId: string;
  eventType: string; // e.g. "payment.succeeded", "payment.failed", "refund.completed"
  provider: string; // e.g. "dev-safe-adapter", "bkash", "sslcommerz"
  providerTrxId?: string;
  providerPaymentId?: string;
  orderNumber?: string;
  orderId?: string;
  amount?: number;
  currency?: string;
  status: PaymentStatus;
  sanitizedPayload: Record<string, unknown>;
  rejectionReason?: string;
}

/**
 * Parameters for querying the trusted server-to-server payment status
 */
export interface GetPaymentStatusParams {
  providerTrxId?: string;
  providerPaymentId?: string;
  orderId?: string;
  paymentNumber?: string;
}

/**
 * Standardized status response directly from trusted provider API
 */
export interface ProviderPaymentStatusResult {
  providerTrxId?: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  settledAt?: Date;
  rawStatus?: string;
  sanitizedPayload: Record<string, unknown>;
  errorMessage?: string;
}

/**
 * Parameters for initiating a gateway refund
 */
export interface ProcessRefundParams {
  paymentNumber: string;
  providerTrxId: string;
  amount: number;
  currency: string;
  reason: string;
  idempotencyKey: string;
}

/**
 * Standardized refund outcome
 */
export interface ProcessRefundResult {
  success: boolean;
  providerRefundId?: string;
  status: RefundStatus;
  refundedAmount: number;
  sanitizedPayload: Record<string, unknown>;
  errorMessage?: string;
}

/**
 * Provider-neutral interface for all payment gateways
 */
export interface IPaymentProvider {
  readonly providerName: string;
  readonly methodType: PaymentMethodType;

  /**
   * Check if current provider has verified credentials & active environment
   */
  getConfigState(): ProviderConfigState;

  /**
   * Initiate a payment session or checkout redirect
   */
  initiatePayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult>;

  /**
   * Verify cryptographic signature and parse payload without side-effects
   */
  verifyWebhook(params: VerifyWebhookParams): Promise<ParsedWebhookEvent>;

  /**
   * Inquire payment status directly from provider API for validation/reconciliation
   */
  getPaymentStatus(params: GetPaymentStatusParams): Promise<ProviderPaymentStatusResult>;

  /**
   * Process refund via provider gateway if supported
   */
  processRefund(params: ProcessRefundParams): Promise<ProcessRefundResult>;
}
