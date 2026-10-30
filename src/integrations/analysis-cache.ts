import { createHash } from "node:crypto";
import type { Redis } from "@upstash/redis";
import type { AnalysisResult, Strategy } from "@/domain/psi/types";

const TTL_SECONDS = 300;
// Bump when AnalysisResult changes shape so old entries aren't read back.
const KEY_VERSION = "v1";

export interface AnalysisCache {
  get(url: string, strategy: Strategy): Promise<AnalysisResult | null>;
  set(url: string, strategy: Strategy, result: AnalysisResult): Promise<void>;
}

function cacheKey(url: string, strategy: Strategy): string {
  const hash = createHash("sha256").update(url).digest("hex");
  return `psi:${KEY_VERSION}:${strategy}:${hash}`;
}

export function createRedisCache(redis: Redis): AnalysisCache {
  return {
    get: (url, strategy) => redis.get<AnalysisResult>(cacheKey(url, strategy)),
    set: async (url, strategy, result) => {
      await redis.set(cacheKey(url, strategy), result, { ex: TTL_SECONDS });
    },
  };
}

export const noCache: AnalysisCache = {
  get: async () => null,
  set: async () => {},
};
