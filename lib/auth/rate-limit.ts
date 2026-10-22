interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, RateLimitEntry>();

// Periodic cleanup of expired rate limit buckets every 5 minutes
if (typeof setInterval !== "undefined") {
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memoryStore.entries()) {
      if (entry.resetAt <= now) {
        memoryStore.delete(key);
      }
    }
  }, 5 * 60 * 1000);

  // Allow node to exit cleanly if this timer is active
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

/**
 * Checks and increments rate limit for an identifier (e.g., client IP or action key).
 * Single-tenant scalable integration point. If Redis is configured in production,
 * this function can be swapped or wired to Upstash / Redis without breaking callers.
 */
export async function rateLimit(
  identifier: string,
  options: {
    limit?: number;
    windowSeconds?: number;
  } = {}
): Promise<RateLimitResult> {
  const limit = options.limit ?? Number(process.env.RATE_LIMIT_LOGIN_MAX || 5);
  const windowSeconds =
    options.windowSeconds ?? Number(process.env.RATE_LIMIT_LOGIN_WINDOW_SECONDS || 300);
  const windowMs = windowSeconds * 1000;
  const now = Date.now();

  const entry = memoryStore.get(identifier);

  if (!entry || entry.resetAt <= now) {
    // New window
    memoryStore.set(identifier, {
      count: 1,
      resetAt: now + windowMs,
    });
    return {
      success: true,
      limit,
      remaining: limit - 1,
      resetAt: now + windowMs,
      retryAfterSeconds: 0,
    };
  }

  if (entry.count >= limit) {
    const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
    return {
      success: false,
      limit,
      remaining: 0,
      resetAt: entry.resetAt,
      retryAfterSeconds,
    };
  }

  entry.count += 1;
  return {
    success: true,
    limit,
    remaining: limit - entry.count,
    resetAt: entry.resetAt,
    retryAfterSeconds: 0,
  };
}

/**
 * Helper to extract client IP from Next.js request headers
 */
export function getClientIp(headersList: { get(name: string): string | null }): string {
  const forwardedFor = headersList.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  const realIp = headersList.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  return "127.0.0.1";
}
