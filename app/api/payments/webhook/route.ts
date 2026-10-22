import { NextRequest, NextResponse } from "next/server";
import { paymentRegistry, processVerifiedWebhookEvent, safePaymentLog } from "@/lib/payments";

/**
 * POST /api/payments/webhook
 * Dynamic webhook & callback endpoint supporting multiple providers.
 * Example: /api/payments/webhook?provider=dev-safe-adapter
 *
 * Security & Reliability:
 * 1. Verifies raw signature headers on the server.
 * 2. Deduplicates event IDs via WebhookEvent uniqueness.
 * 3. Sanitizes all inputs (never stores card numbers or sensitive tokens).
 * 4. Executes order and payment updates within a database transaction.
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const providerParam = searchParams.get("provider") || "dev-safe-adapter";

    // 1. Read raw body as text for HMAC verification
    const rawBody = await request.text();

    // 2. Extract headers into a plain record
    const headers: Record<string, string | undefined> = {};
    request.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    // 3. Resolve the provider adapter
    let provider;
    try {
      provider = paymentRegistry.getProvider(providerParam);
    } catch {
      safePaymentLog("WEBHOOK_UNKNOWN_PROVIDER", { provider: providerParam });
      return NextResponse.json(
        { error: "Bad Request", message: `Unsupported provider: ${providerParam}` },
        { status: 400 }
      );
    }

    // 4. Provider-neutral signature verification and event parsing
    const parsedEvent = await provider.verifyWebhook({
      rawBody,
      headers,
      query: Object.fromEntries(searchParams.entries()),
    });

    if (!parsedEvent.isValidSignature) {
      safePaymentLog("WEBHOOK_VERIFICATION_REJECTED", {
        provider: providerParam,
        reason: parsedEvent.rejectionReason,
      });
      return NextResponse.json(
        {
          error: "Unauthorized",
          message: parsedEvent.rejectionReason || "Invalid webhook signature",
        },
        { status: 401 }
      );
    }

    // 5. Process event idempotently with database transaction & reconciliation
    const result = await processVerifiedWebhookEvent(parsedEvent, headers);

    if (!result.success && !result.duplicate) {
      const statusCode = result.reconciliationError ? 422 : 400;
      return NextResponse.json(
        {
          error: "Webhook Processing Failed",
          message: result.message,
          reconciliationError: result.reconciliationError,
        },
        { status: statusCode }
      );
    }

    return NextResponse.json({
      received: true,
      duplicate: result.duplicate,
      status: result.status,
      message: result.message,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal Server Error";
    safePaymentLog("WEBHOOK_UNHANDLED_EXCEPTION", { error: errorMsg });
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to process payment event" },
      { status: 500 }
    );
  }
}
