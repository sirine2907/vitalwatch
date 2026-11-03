import { getDb } from "@/data/db";
import { MANUAL_RUNS_PER_HOUR } from "@/domain/projects/limits";
import { createQStashQueue, type JobQueue } from "@/integrations/job-queue";
import { fetchPsi } from "@/integrations/psi.client";
import { createRedisRateLimiter, noRateLimit } from "@/integrations/rate-limit";
import { getRedis } from "@/integrations/redis";
import { DEFAULT_EMAIL_FROM, sendEmail } from "@/integrations/resend";
import { appUrl, readEnv, type Env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { createAlertService } from "./alert.service";
import { createMonitoringService, type MonitoringService } from "./monitoring.service";
import { createProjectService } from "./project.service";
import { createRunService } from "./run.service";
import { createReportService } from "./report.service";
import { createSuggestionService } from "./suggestion.service";
import { createAnthropicProvider } from "@/integrations/llm/anthropic";
import { createGeminiProvider } from "@/integrations/llm/gemini";
import type { LlmProvider } from "@/integrations/llm/provider";
import { fetchPublicPage } from "@/integrations/site-fetcher";

function psiFetcher(env: Env) {
  return (url: string, strategy: "mobile" | "desktop") => {
    if (!env.PAGESPEED_API_KEY) {
      throw new AppError("not_configured", "PAGESPEED_API_KEY is missing.", { status: 503 });
    }
    return fetchPsi(url, strategy, { apiKey: env.PAGESPEED_API_KEY, endpoint: env.PAGESPEED_API_URL });
  };
}

export function projectService() {
  return createProjectService(getDb());
}

export function runService() {
  const env = readEnv();
  const redis = getRedis(env);

  return createRunService({
    db: getDb(),
    fetchPsi: psiFetcher(env),
    rateLimit: redis
      ? createRedisRateLimiter(redis, {
          prefix: "ratelimit:runs",
          requests: MANUAL_RUNS_PER_HOUR,
          window: "1 h",
        })
      : noRateLimit,
  });
}

export function alertService() {
  const env = readEnv();
  const apiKey = env.RESEND_API_KEY;
  const from = env.EMAIL_FROM ?? DEFAULT_EMAIL_FROM;

  return createAlertService({
    db: getDb(),
    sendEmail: apiKey ? (email) => sendEmail({ apiKey, from }, email) : null,
    ownerAddress: env.EMAIL_OWNER_ADDRESS,
    appUrl: appUrl(env),
  });
}

export function monitoringService(): MonitoringService {
  const env = readEnv();

  let queue: JobQueue;
  if (env.QSTASH_TOKEN) {
    queue = createQStashQueue({ token: env.QSTASH_TOKEN, baseUrl: env.QSTASH_URL, appUrl: appUrl(env) });
  } else if (process.env.NODE_ENV === "development") {
    // QStash can't call localhost, so local development runs jobs straight away.
    queue = { publishTest: (job) => service.runJob(job).then(() => undefined) };
  } else {
    throw new AppError("not_configured", "QSTASH_TOKEN is missing.", { status: 503 });
  }

  const service = createMonitoringService({
    db: getDb(),
    fetchPsi: psiFetcher(env),
    queue,
    alerts: alertService(),
  });
  return service;
}

/** Claude when its key is set, otherwise Gemini's free tier, otherwise none. */
function llmProvider(env: Env): LlmProvider | null {
  if (env.ANTHROPIC_API_KEY) {
    return createAnthropicProvider({ apiKey: env.ANTHROPIC_API_KEY, model: env.ANTHROPIC_MODEL });
  }
  if (env.GEMINI_API_KEY) {
    return createGeminiProvider({ apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL, endpoint: env.GEMINI_API_URL });
  }
  return null;
}

export function suggestionService() {
  const env = readEnv();
  return createSuggestionService({
    db: getDb(),
    provider: llmProvider(env),
    fetchPage: (url) => fetchPublicPage(url),
    dailyLimit: env.AI_DAILY_LIMIT_PER_USER,
  });
}

export function reportService() {
  return createReportService(getDb());
}
