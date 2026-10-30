import { Redis } from "@upstash/redis";
import type { Env } from "@/lib/env";

let warned = false;

/**
 * Returns the Redis client, or null when Upstash isn't configured. That is only
 * reachable in development, since production refuses to start without it.
 */
export function getRedis(env: Env): Redis | null {
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    return new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  if (!warned) {
    console.warn("[vitalwatch] Upstash isn't configured: caching and rate limiting are OFF.");
    warned = true;
  }
  return null;
}
