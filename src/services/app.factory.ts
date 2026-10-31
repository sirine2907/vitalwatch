import { getDb } from "@/data/db";
import { fetchPsi } from "@/integrations/psi.client";
import { createRedisRateLimiter, noRateLimit } from "@/integrations/rate-limit";
import { getRedis } from "@/integrations/redis";
import { MANUAL_RUNS_PER_HOUR } from "@/domain/projects/limits";
import { readEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { createProjectService } from "./project.service";
import { createRunService } from "./run.service";

export function projectService() {
  return createProjectService(getDb());
}

export function runService() {
  const env = readEnv();
  const redis = getRedis(env);

  return createRunService({
    db: getDb(),
    fetchPsi: (url, strategy) => {
      if (!env.PAGESPEED_API_KEY) {
        throw new AppError("not_configured", "PAGESPEED_API_KEY is missing.", { status: 503 });
      }
      return fetchPsi(url, strategy, {
        apiKey: env.PAGESPEED_API_KEY,
        endpoint: env.PAGESPEED_API_URL,
      });
    },
    rateLimit: redis
      ? createRedisRateLimiter(redis, {
          prefix: "ratelimit:runs",
          requests: MANUAL_RUNS_PER_HOUR,
          window: "1 h",
        })
      : noRateLimit,
  });
}
