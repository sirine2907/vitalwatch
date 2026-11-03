import type { Db } from "@/data/db";
import * as repo from "@/data/repositories/suggestions.repository";
import { buildFixRequest, FIX_SYSTEM_PROMPT, fixUserPrompt } from "@/domain/ai/fix-request";
import {
  cleanSuggestions,
  fixSuggestionsSchema,
  PROMPT_VERSION,
  type FixSuggestions,
} from "@/domain/ai/fix-schema";
import { parsePsiResponse } from "@/domain/psi/parse";
import { detectStack, stackPacksFromRaw, type DetectedTech } from "@/domain/stack/detect";
import type { LlmProvider } from "@/integrations/llm/provider";
import type { FetchedPage } from "@/integrations/site-fetcher";
import { AppError } from "@/lib/errors";
import { isUuid } from "./project.service";

const DAY_MS = 24 * 60 * 60 * 1000;
const STACK_REUSE_MS = 7 * DAY_MS;
export const DEFAULT_AI_DAILY_LIMIT = 10;

export interface StoredSuggestions {
  suggestions: FixSuggestions;
  stack: DetectedTech[];
  model: string;
  createdAt: Date;
}

export interface SuggestionDependencies {
  db: Db;
  /** Null when no AI key is configured. */
  provider: LlmProvider | null;
  fetchPage: (url: string) => Promise<FetchedPage | null>;
  dailyLimit?: number;
  now?: () => Date;
}

export function createSuggestionService(deps: SuggestionDependencies) {
  const { db } = deps;
  const now = deps.now ?? (() => new Date());
  const dailyLimit = deps.dailyLimit ?? DEFAULT_AI_DAILY_LIMIT;

  async function requireRun(userId: string, runId: string) {
    const run = isUuid(runId) ? await repo.getOwnedRun(db, userId, runId) : null;
    if (!run) throw new AppError("not_found", "That test wasn't found.", { status: 404 });
    if (run.status !== "success") {
      throw new AppError("invalid_request", "Suggestions need a successful test.", { status: 400 });
    }
    return run;
  }

  /** Detects the stack, reusing a detection from the last week when there is one. */
  async function stackFor(urlId: string, url: string, raw: unknown): Promise<DetectedTech[]> {
    const recent = await repo.getRecentStack(db, urlId, new Date(now().getTime() - STACK_REUSE_MS));
    if (recent) return recent;

    // A site that blocks us still gets Lighthouse's own detection.
    const page = await deps.fetchPage(url);
    const detected = detectStack({
      headers: page?.headers ?? {},
      html: page?.html ?? null,
      stackPacks: stackPacksFromRaw(raw),
    });
    await repo.saveStack(db, urlId, detected);
    return detected;
  }

  return {
    isAvailable: () => deps.provider !== null,
    providerName: () => deps.provider?.name ?? null,

    async getForRun(userId: string, runId: string): Promise<StoredSuggestions | null> {
      if (!isUuid(runId)) return null;
      const row = await repo.getSuggestion(db, userId, runId, PROMPT_VERSION);
      if (!row) return null;
      return {
        suggestions: row.content as FixSuggestions,
        stack: row.stack as DetectedTech[],
        model: row.model,
        createdAt: row.createdAt,
      };
    },

    async generate(userId: string, runId: string): Promise<StoredSuggestions> {
      const run = await requireRun(userId, runId);

      // Results are cached per run, so asking twice is free.
      const cached = await this.getForRun(userId, runId);
      if (cached) return cached;

      if (!deps.provider) {
        throw new AppError("ai_not_configured", "AI suggestions aren't set up on this server.", { status: 503 });
      }
      const usedToday = await repo.countSuggestionsSince(db, userId, new Date(now().getTime() - DAY_MS));
      if (usedToday >= dailyLimit) {
        throw new AppError(
          "rate_limited",
          `You've used your ${dailyLimit} AI suggestions for today. Please try again tomorrow.`,
          { status: 429 },
        );
      }

      const result = parsePsiResponse(run.raw, run.strategy, run.url);
      if (result.opportunities.length === 0) {
        throw new AppError("invalid_request", "This test found nothing to fix, so there's nothing to suggest.", {
          status: 400,
        });
      }

      const stack = await stackFor(run.urlId, run.url, run.raw);
      const request = buildFixRequest(result, run.raw, stack);
      const generated = await deps.provider.generateFixes(FIX_SYSTEM_PROMPT, fixUserPrompt(request));

      const parsed = fixSuggestionsSchema.safeParse(generated.output);
      if (!parsed.success) {
        throw new AppError("ai_unavailable", "The AI answer wasn't in the expected format. Please try again.", {
          status: 502,
        });
      }
      const suggestions = cleanSuggestions(parsed.data, request.audits.map((audit) => audit.id));

      await repo.insertSuggestion(db, {
        runId,
        userId,
        promptVersion: PROMPT_VERSION,
        model: generated.model,
        content: suggestions,
        stack,
        inputTokens: generated.inputTokens,
        outputTokens: generated.outputTokens,
      });
      // If two requests raced, the first stored answer wins for both.
      return (await this.getForRun(userId, runId))!;
    },
  };
}

export type SuggestionService = ReturnType<typeof createSuggestionService>;
