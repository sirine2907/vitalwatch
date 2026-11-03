import type { Db } from "@/data/db";
import * as repo from "@/data/repositories/monitoring.repository";
import { completeRun, failRun } from "@/data/repositories/runs.repository";
import { confirmedByRetest, evaluateRun } from "@/domain/monitoring/regression";
import { nextRunAfter } from "@/domain/monitoring/schedule";
import { parsePsiResponse } from "@/domain/psi/parse";
import { STRATEGIES, type Strategy } from "@/domain/psi/types";
import type { JobQueue, TestJob } from "@/integrations/job-queue";
import { AppError } from "@/lib/errors";
import type { AlertService } from "./alert.service";
import { toCompletedRun } from "./run.service";

const RETEST_DELAY_SECONDS = 5 * 60;

export interface MonitoringDependencies {
  db: Db;
  fetchPsi: (url: string, strategy: Strategy) => Promise<unknown>;
  queue: JobQueue;
  alerts: AlertService;
  now?: () => Date;
}

export type JobOutcome =
  | { status: "skipped"; reason: "missing" | "competitor" | "duplicate" | "bad-retest" }
  | { status: "failed" }
  | { status: "building" }
  | { status: "evaluated"; raised: number; retestQueued: boolean };

export function createMonitoringService(deps: MonitoringDependencies) {
  const { db } = deps;
  const now = deps.now ?? (() => new Date());

  /** Runs one test and stores it. Returns the run, or null if it failed. */
  async function measure(runId: string, url: string, strategy: Strategy) {
    try {
      const raw = await deps.fetchPsi(url, strategy);
      const result = parsePsiResponse(raw, strategy, url);
      const completed = toCompletedRun(result, raw);
      await completeRun(db, runId, completed);
      return completed;
    } catch (error) {
      const message = error instanceof AppError ? error.message : "The test failed unexpectedly.";
      await failRun(db, runId, message);
      return null;
    }
  }

  return {
    /** Called every 15 minutes: queues one job per URL and device for each due project. */
    async dispatchDue() {
      const claimed = await repo.claimDueProjects(db, now(), (schedule, due) =>
        nextRunAfter(schedule, due, now()),
      );

      let jobs = 0;
      for (const project of claimed) {
        for (const urlId of project.urlIds) {
          for (const strategy of STRATEGIES) {
            await deps.queue.publishTest({
              urlId,
              strategy,
              slot: project.due.toISOString(),
              trigger: "scheduled",
            });
            jobs += 1;
          }
        }
      }
      return { projects: claimed.length, jobs };
    },

    async runJob(job: TestJob): Promise<JobOutcome> {
      const context = await repo.getJobContext(db, job.urlId);
      if (!context) return { status: "skipped", reason: "missing" };
      if (context.role !== "monitored") return { status: "skipped", reason: "competitor" };

      const original =
        job.trigger === "retest" && job.confirmsRunId
          ? await repo.getRunMetrics(db, job.confirmsRunId)
          : null;
      if (job.trigger === "retest" && original?.status !== "success") {
        return { status: "skipped", reason: "bad-retest" };
      }

      const runId = await repo.insertJobRun(db, job.urlId, job.strategy, new Date(job.slot), job.trigger);
      if (!runId) return { status: "skipped", reason: "duplicate" };

      const current = await measure(runId, context.url, job.strategy);
      if (!current) return { status: "failed" };

      const settings = {
        scoreDropThreshold: context.scoreDropThreshold,
        baselineSize: context.baselineSize,
      };
      const excluded = original ? [runId, original.id] : [runId];
      const history = await repo.listBaselineRuns(db, job.urlId, job.strategy, excluded, settings.baselineSize);

      if (original) {
        const confirmed = confirmedByRetest(
          evaluateRun(original, history, settings),
          evaluateRun(current, history, settings),
        );
        let raised = 0;
        for (const check of confirmed) {
          if (await deps.alerts.raise(context, job.strategy, check, original.id)) raised += 1;
        }
        return { status: "evaluated", raised, retestQueued: false };
      }

      const evaluation = evaluateRun(current, history, settings);
      if (evaluation.status === "building") return { status: "building" };

      let raised = 0;
      let needsRetest = false;
      for (const check of evaluation.checks) {
        if (!check.breached) {
          await deps.alerts.resolve(job.urlId, job.strategy, check);
        } else if (check.needsConfirmation) {
          needsRetest = true;
        } else if (await deps.alerts.raise(context, job.strategy, check, runId)) {
          raised += 1;
        }
      }

      if (needsRetest) {
        await deps.queue.publishTest(
          { ...job, trigger: "retest", confirmsRunId: runId },
          RETEST_DELAY_SECONDS,
        );
      }
      return { status: "evaluated", raised, retestQueued: needsRetest };
    },
  };
}

export type MonitoringService = ReturnType<typeof createMonitoringService>;
