import { Ratelimit, type Duration } from "@upstash/ratelimit";
import type { Redis } from "@upstash/redis";

export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

export type RateLimiter = (identifier: string) => Promise<RateLimitDecision>;

export interface RateLimitRule {
  prefix: string;
  requests: number;
  window: Duration;
}

export const ANALYZE_RATE_LIMIT: RateLimitRule = {
  prefix: "ratelimit:analyze",
  requests: 10,
  window: "1 m",
};

export function createRedisRateLimiter(redis: Redis, rule: RateLimitRule): RateLimiter {
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(rule.requests, rule.window),
    prefix: rule.prefix,
  });

  return async (identifier) => {
    const { success, limit, remaining, reset } = await limiter.limit(identifier);
    return { allowed: success, limit, remaining, resetAt: reset };
  };
}

export const noRateLimit: RateLimiter = async () => ({
  allowed: true,
  limit: 0,
  remaining: 0,
  resetAt: 0,
});
