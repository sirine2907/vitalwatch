import { createRedisCache, noCache } from "@/integrations/analysis-cache";
import { fetchPsi } from "@/integrations/psi.client";
import { ANALYZE_RATE_LIMIT, createRedisRateLimiter, noRateLimit } from "@/integrations/rate-limit";
import { getRedis } from "@/integrations/redis";
import { readEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { createAnalysisService } from "./analysis.service";

/** Wires the analysis service to its real dependencies. */
export function buildAnalysisService() {
  const env = readEnv();
  const apiKey = env.PAGESPEED_API_KEY;

  if (!apiKey) {
    throw new AppError(
      "not_configured",
      "PAGESPEED_API_KEY is missing. Add it to .env.local (see .env.example) and restart.",
      { status: 503 },
    );
  }

  const redis = getRedis(env);

  return createAnalysisService({
    fetchPsi: (url, strategy) =>
      fetchPsi(url, strategy, { apiKey, endpoint: env.PAGESPEED_API_URL }),
    cache: redis ? createRedisCache(redis) : noCache,
    rateLimit: redis ? createRedisRateLimiter(redis, ANALYZE_RATE_LIMIT) : noRateLimit,
  });
}
