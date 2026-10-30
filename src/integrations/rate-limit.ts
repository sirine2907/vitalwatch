import { Ratelimit } from "@upstash/ratelimit";
import type { Redis } from "@upstash/redis";

const REQUESTS_PER_MINUTE = 10;

export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

export type RateLimiter = (identifier: string) => Promise<RateLimitDecision>;

export function createRedisRateLimiter(redis: Redis): RateLimiter {
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(REQUESTS_PER_MINUTE, "1 m"),
    prefix: "ratelimit:analyze",
  });

  return async (identifier) => {
    const { success, limit, remaining, reset } = await limiter.limit(identifier);
    return { allowed: success, limit, remaining, resetAt: reset };
  };
}

export const noRateLimit: RateLimiter = async () => ({
  allowed: true,
  limit: REQUESTS_PER_MINUTE,
  remaining: REQUESTS_PER_MINUTE,
  resetAt: 0,
});
