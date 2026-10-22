import * as crypto from "crypto";
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
import { sanitizePayload } from "./sanitizer";

/**
 * Safe Development Adapter
 *
 * Used when no official payment provider credentials exist or when running in local development.
 * CRITICAL SAFETY RULES:
 * 1. MUST NEVER be mistaken for a real successful payment.
 * 2. Explicitly exposes its simulated state (e.g. prefix `DEV-MOCK-*`).
 * 3. Does not approve real funds or trigger automated fulfillment as real money.
 * 4. Requires explicit cryptographic signature matching for webhooks even in development tests.
 */
export class SafeDevPaymentAdapter implements IPaymentProvider {
  public readonly providerName = "dev-safe-adapter";
  public readonly methodType = PaymentMethodType.MANUAL_VERIFICATION;
  private readonly mockSecret: string;

  constructor(mockSecret = "dev-safe-test-secret-never-use-in-prod") {
    this.mockSecret = process.env.DEV_MOCK_PAYMENT_SECRET || mockSecret;
  }

  public getConfigState(): ProviderConfigState {
    return {
      isConfigured: true,
      providerName: this.providerName,
      environment: "development_mock",
      supportedMethods: [PaymentMethodType.MANUAL_VERIFICATION],
      missingKeys: [],
    };
  }

  public async initiatePayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult> {
    // Generate an unmistakable mock session identifier
    const mockRef = `DEV-MOCK-${params.orderNumber}-${crypto.randomBytes(4).toString("hex")}`;

    // Browser redirects are strictly informational
    const redirectUrl = `${params.returnUrl}${params.returnUrl.includes("?") ? "&" : "?"}provider=dev-safe-adapter&mock_ref=${mockRef}&informational_only=true`;

    return {
      success: true,
      paymentId: mockRef,
      gatewayReference: mockRef,
      redirectUrl,
      status: PaymentStatus.REQUIRES_ACTION,
      requiresAction: true,
      actionDetails: {
        note: "THIS IS A SAFE DEVELOPMENT ADAPTER. IT CANNOT PROCESS REAL FUNDS.",
        orderNumber: params.orderNumber,
        amountBDT: params.amountBDT,
        currency: params.currency,
        mockReference: mockRef,
      },
    };
  }

  public async verifyWebhook(params: VerifyWebhookParams): Promise<ParsedWebhookEvent> {
    const rawBodyString =
      typeof params.rawBody === "string"
        ? params.rawBody
        : params.rawBody.toString("utf-8");

    // Extract signature from headers
    const rawSignature =
      params.headers["x-dev-signature"] ||
      params.headers["X-Dev-Signature"] ||
      params.headers["x-signature"];

    const signature = Array.isArray(rawSignature) ? rawSignature[0] : rawSignature;

    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(rawBodyString);
    } catch {
      return {
        isValidSignature: false,
        eventId: "INVALID-JSON",
        eventType: "unknown",
        provider: this.providerName,
        status: PaymentStatus.FAILED,
        sanitizedPayload: {},
        rejectionReason: "Invalid JSON webhook payload",
      };
    }

    const sanitized = sanitizePayload(payload);

    // Verify HMAC SHA256 signature against mock secret
    if (!signature) {
      return {
        isValidSignature: false,
        eventId: String(payload.eventId || "MISSING-EVENT-ID"),
        eventType: String(payload.eventType || "unknown"),
        provider: this.providerName,
        status: PaymentStatus.FAILED,
        sanitizedPayload: sanitized,
        rejectionReason: "Missing signature header 'x-dev-signature'",
      };
    }

    const expectedSignature = crypto
      .createHmac("sha256", this.mockSecret)
      .update(rawBodyString)
      .digest("hex");

    // Timing-safe comparison to prevent timing attacks
    const isValidSignature =
      signature.length === expectedSignature.length &&
      crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));

    if (!isValidSignature) {
      return {
        isValidSignature: false,
        eventId: String(payload.eventId || "UNAUTHENTICATED-EVENT"),
        eventType: String(payload.eventType || "unknown"),
        provider: this.providerName,
        status: PaymentStatus.FAILED,
        sanitizedPayload: sanitized,
        rejectionReason: "HMAC signature verification failed",
      };
    }

    // Determine status based on event payload
    let status: PaymentStatus = PaymentStatus.PENDING;
    const eventType = String(payload.eventType || "payment.pending");

    if (eventType === "payment.succeeded") {
      status = PaymentStatus.SUCCEEDED;
    } else if (eventType === "payment.failed") {
      status = PaymentStatus.FAILED;
    } else if (eventType === "payment.cancelled") {
      status = PaymentStatus.CANCELLED;
    } else if (eventType === "refund.completed") {
      status = PaymentStatus.REFUNDED;
    }

    return {
      isValidSignature: true,
      eventId: String(payload.eventId || `DEV-EVT-${Date.now()}`),
      eventType,
      provider: this.providerName,
      providerTrxId: payload.providerTrxId ? String(payload.providerTrxId) : undefined,
      providerPaymentId: payload.providerPaymentId ? String(payload.providerPaymentId) : undefined,
      orderNumber: payload.orderNumber ? String(payload.orderNumber) : undefined,
      orderId: payload.orderId ? String(payload.orderId) : undefined,
      amount: typeof payload.amount === "number" ? payload.amount : Number(payload.amount || 0),
      currency: payload.currency ? String(payload.currency) : "BDT",
      status,
      sanitizedPayload: sanitized,
    };
  }

  public async getPaymentStatus(params: GetPaymentStatusParams): Promise<ProviderPaymentStatusResult> {
    if (!params.providerTrxId && !params.providerPaymentId) {
      return {
        status: PaymentStatus.FAILED,
        amount: 0,
        currency: "BDT",
        sanitizedPayload: {},
        errorMessage: "Missing providerTrxId or providerPaymentId",
      };
    }

    // Dev adapter always marks test references as requires-action unless explicitly instructed
    return {
      providerTrxId: params.providerTrxId || "DEV-MOCK-TRX-PENDING",
      status: PaymentStatus.REQUIRES_ACTION,
      amount: 0,
      currency: "BDT",
      rawStatus: "DEV_ADAPTER_PENDING_MANUAL_OR_MOCK",
      sanitizedPayload: {
        note: "Safe mock provider response - not a real transaction",
        query: params,
      },
    };
  }

  public async processRefund(params: ProcessRefundParams): Promise<ProcessRefundResult> {
    const mockRefundId = `DEV-REF-${params.providerTrxId}-${crypto.randomBytes(3).toString("hex")}`;
    return {
      success: true,
      providerRefundId: mockRefundId,
      status: RefundStatus.COMPLETED,
      refundedAmount: params.amount,
      sanitizedPayload: {
        note: "Safe development mock refund",
        idempotencyKey: params.idempotencyKey,
        providerRefundId: mockRefundId,
      },
    };
  }
}
