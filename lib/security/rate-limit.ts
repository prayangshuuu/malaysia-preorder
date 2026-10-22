/**
 * In-memory sliding-window rate limiter for sensitive endpoints.
 * Integrates cleanly with Edge/Node environments and provides headers/retry information.
 * In a multi-instance production cluster, this can be backed by Redis or an external KV store.
 */

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Clean up stale entries every 5 minutes
if (typeof setInterval !== "undefined") {
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitStore.entries()) {
      if (now > record.resetAt) {
        rateLimitStore.delete(key);
      }
    }
  }, 5 * 60 * 1000);
  if (cleanupTimer.unref) {
    cleanupTimer.unref();
  }
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Check if an action by an identifier (e.g. IP + endpoint) is rate limited.
 * @param identifier Unique key (e.g. `login:192.168.1.1` or `admin_login:user@example.com`)
 * @param limit Maximum number of requests allowed in the window
 * @param windowSeconds Window length in seconds
 */
export function checkRateLimit(
  identifier: string,
  limit: number = 5,
  windowSeconds: number = 60
): RateLimitResult {
  const now = Date.now();
  const existing = rateLimitStore.get(identifier);

  if (!existing || now > existing.resetAt) {
    rateLimitStore.set(identifier, {
      count: 1,
      resetAt: now + windowSeconds * 1000,
    });
    return {
      success: true,
      limit,
      remaining: limit - 1,
      retryAfterSeconds: 0,
    };
  }

  if (existing.count >= limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    return {
      success: false,
      limit,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  existing.count += 1;
  return {
    success: true,
    limit,
    remaining: limit - existing.count,
    retryAfterSeconds: 0,
  };
}

/**
 * Reset rate limit counter for a specific key (e.g., upon successful login).
 */
export function resetRateLimit(identifier: string): void {
  rateLimitStore.delete(identifier);
}
