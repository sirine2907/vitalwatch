import { parsePsiResponse } from "@/domain/psi/parse";
import type { AnalysisResult, Strategy } from "@/domain/psi/types";
import { validateUrl } from "@/domain/url/validate";
import type { AnalysisCache } from "@/integrations/analysis-cache";
import type { RateLimiter, RateLimitDecision } from "@/integrations/rate-limit";
import { AppError } from "@/lib/errors";

export interface AnalysisDependencies {
  fetchPsi: (url: string, strategy: Strategy) => Promise<unknown>;
  cache: AnalysisCache;
  rateLimit: RateLimiter;
  now?: () => number;
}

export interface AnalyzeInput {
  url: string;
  strategy: Strategy;
  clientId: string;
}

export interface AnalyzeOutcome {
  result: AnalysisResult;
  cached: boolean;
  rateLimit: RateLimitDecision | null;
}

/** Redis trouble shouldn't take down testing, so these fail open and log. */
async function safely<T>(label: string, action: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await action();
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown error";
    console.error(`[vitalwatch] ${label} failed: ${reason}`);
    return fallback;
  }
}

export function createAnalysisService(deps: AnalysisDependencies) {
  const now = deps.now ?? Date.now;

  return {
    async analyze({ url, strategy, clientId }: AnalyzeInput): Promise<AnalyzeOutcome> {
      const validation = validateUrl(url);
      if (!validation.ok) {
        throw new AppError("invalid_url", validation.error, { status: 400 });
      }

      const decision = await safely("rate limit", () => deps.rateLimit(clientId), null);
      if (decision && !decision.allowed) {
        throw new AppError("rate_limited", "Too many tests. Please wait a moment and try again.", {
          status: 429,
          retryAfterSeconds: Math.max(1, Math.ceil((decision.resetAt - now()) / 1000)),
        });
      }

      const cached = await safely(
        "cache read",
        () => deps.cache.get(validation.url, strategy),
        null,
      );
      if (cached) return { result: cached, cached: true, rateLimit: decision };

      const raw = await deps.fetchPsi(validation.url, strategy);
      const result = parsePsiResponse(raw, strategy, validation.url);

      await safely("cache write", () => deps.cache.set(validation.url, strategy, result), undefined);

      return { result, cached: false, rateLimit: decision };
    },
  };
}
