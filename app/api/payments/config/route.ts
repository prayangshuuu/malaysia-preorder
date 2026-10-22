import { NextResponse } from "next/server";
import { paymentRegistry } from "@/lib/payments";

/**
 * GET /api/payments/config
 * Returns public/safe configuration status of registered payment providers.
 * Reveals whether providers are in development mock mode, active sandbox, or unconfigured.
 * NEVER exposes secrets or API keys.
 */
export async function GET() {
  const providerStates = paymentRegistry.getAllProviderStates();
  return NextResponse.json({
    providers: providerStates,
  });
}
