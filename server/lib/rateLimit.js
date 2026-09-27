/**
 * Minimal in-memory sliding-window rate limiter. This is a single-user
 * local app, so this exists mainly to prevent a runaway loop (e.g. a bug,
 * or a "Try Again" spam-click) from burning through API credits — see
 * brief section 25 (cost control).
 */
export function createRateLimiter({ perMinute = 20 } = {}) {
  const hits = [];

  return {
    check() {
      const now = Date.now();
      const windowStart = now - 60_000;
      while (hits.length && hits[0] < windowStart) hits.shift();
      if (hits.length >= perMinute) {
        const retryAfterMs = hits[0] + 60_000 - now;
        return { allowed: false, retryAfterMs: Math.max(retryAfterMs, 0) };
      }
      hits.push(now);
      return { allowed: true };
    },
  };
}
