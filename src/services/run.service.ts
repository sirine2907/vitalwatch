import type { Db } from "@/data/db";
import { getUrl } from "@/data/repositories/projects.repository";
import * as runs from "@/data/repositories/runs.repository";
import { parsePsiResponse } from "@/domain/psi/parse";
import { trimPsiResponse } from "@/domain/psi/trim";
import type { AnalysisResult, Strategy } from "@/domain/psi/types";
import type { RateLimiter } from "@/integrations/rate-limit";
import { AppError } from "@/lib/errors";
import type { RangeDays } from "@/domain/history/trend";
import { isUuid } from "./project.service";

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_RUNS_LIMIT = 50;

export interface RunDependencies {
  db: Db;
  fetchPsi: (url: string, strategy: Strategy) => Promise<unknown>;
  rateLimit: RateLimiter;
  now?: () => number;
}

export function toCompletedRun(result: AnalysisResult, raw: unknown): runs.CompletedRun {
  return {
    performanceScore: result.score,
    labLcpMs: result.lab.lcp,
    labFcpMs: result.lab.fcp,
    labTbtMs: result.lab.tbt,
    labSiMs: result.lab.si,
    labTtfbMs: result.lab.ttfb,
    labCls: result.lab.cls,
    fieldLcpMs: result.field.vitals.lcp?.value ?? null,
    fieldInpMs: result.field.vitals.inp?.value ?? null,
    fieldCls: result.field.vitals.cls?.value ?? null,
    fieldScope: result.field.scope,
    lighthouseVersion: result.lighthouseVersion,
    finalUrl: result.finalUrl,
    raw: trimPsiResponse(raw),
  };
}

export function createRunService(deps: RunDependencies) {
  const { db } = deps;
  const now = deps.now ?? Date.now;

  return {
    /**
     * Runs a test and stores the outcome, including failures, so history stays
     * honest. Skips the public 5-minute cache: every stored run must be a new
     * measurement, or the history would contain duplicates.
     */
    async runManualTest(userId: string, urlId: string, strategy: Strategy): Promise<AnalysisResult> {
      const url = isUuid(urlId) ? await getUrl(db, userId, urlId) : null;
      if (!url) throw new AppError("not_found", "That URL wasn't found.", { status: 404 });

      const decision = await deps.rateLimit(userId).catch(() => null);
      if (decision && !decision.allowed) {
        throw new AppError("rate_limited", "You've run a lot of tests. Please try again later.", {
          status: 429,
          retryAfterSeconds: Math.max(1, Math.ceil((decision.resetAt - now()) / 1000)),
        });
      }

      const runId = await runs.createPendingRun(db, urlId, strategy, "manual");

      try {
        const raw = await deps.fetchPsi(url.url, strategy);
        const result = parsePsiResponse(raw, strategy, url.url);
        await runs.completeRun(db, runId, toCompletedRun(result, raw));
        return result;
      } catch (error) {
        const message = error instanceof AppError ? error.message : "The test failed unexpectedly.";
        await runs.failRun(db, runId, message);
        throw error;
      }
    },

    listForRange(userId: string, urlId: string, rangeDays: RangeDays) {
      return runs.listRunsSince(db, userId, urlId, new Date(now() - rangeDays * DAY_MS));
    },

    listRecent: (userId: string, urlId: string) =>
      runs.listRecentRuns(db, userId, urlId, RECENT_RUNS_LIMIT),

    /** Re-reads the stored raw JSON, so results match what was measured then. */
    async getLatestResults(userId: string, urlId: string, url: string) {
      const rows = await runs.getLatestRawRuns(db, userId, urlId);
      const results: Partial<Record<Strategy, AnalysisResult & { runId: string }>> = {};
      for (const row of rows) {
        try {
          results[row.strategy] = { ...parsePsiResponse(row.raw, row.strategy, url), runId: row.id };
        } catch {
          // A row saved by an older format shouldn't break the whole page.
          console.error(`[vitalwatch] couldn't re-read a stored ${row.strategy} run`);
        }
      }
      return results;
    },
  };
}
