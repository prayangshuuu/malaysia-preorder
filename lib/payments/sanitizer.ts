/**
 * Sensitive fields that must NEVER be logged or persisted in raw payloads
 */
const SENSITIVE_KEYS = new Set([
  "card_number",
  "cardNumber",
  "card",
  "pan",
  "cvv",
  "cvc",
  "security_code",
  "securityCode",
  "password",
  "secret",
  "app_secret",
  "store_passwd",
  "apiKey",
  "api_key",
  "token",
  "authorization",
  "auth_token",
  "access_token",
  "refresh_token",
  "pin",
  "otp",
]);

/**
 * Deeply sanitizes any payload, redacting credit card numbers, secrets,
 * passwords, API keys, CVVs, and sensitive auth data.
 */
export function sanitizePayload<T>(input: T): T {
  if (input === null || input === undefined) {
    return input;
  }

  if (typeof input === "string") {
    // Redact 13-19 digit credit card numbers if present in strings
    return input.replace(/\b(?:\d[ -]*?){13,19}\b/g, "[REDACTED_CARD]") as unknown as T;
  }

  if (Array.isArray(input)) {
    return input.map((item) => sanitizePayload(item)) as unknown as T;
  }

  if (typeof input === "object") {
    const sanitizedObj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();
      if (
        SENSITIVE_KEYS.has(key) ||
        SENSITIVE_KEYS.has(lowerKey) ||
        lowerKey.includes("password") ||
        lowerKey.includes("secret") ||
        lowerKey.includes("cvv") ||
        lowerKey.includes("cvc") ||
        lowerKey.includes("card_num") ||
        lowerKey.includes("cardnumber")
      ) {
        sanitizedObj[key] = "[REDACTED]";
      } else {
        sanitizedObj[key] = sanitizePayload(value);
      }
    }
    return sanitizedObj as T;
  }

  return input;
}

/**
 * Helper to safely log info without exposing secrets
 */
export function safePaymentLog(action: string, data: Record<string, unknown>): void {
  const sanitized = sanitizePayload(data);
  // Log safely in server output
  if (process.env.NODE_ENV !== "test") {
    console.info(`[PaymentAudit][${action}]`, JSON.stringify(sanitized));
  }
}
