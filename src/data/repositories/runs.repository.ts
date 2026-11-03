import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import type { LatestScore, RunMetrics, RunRecord, RunTrigger } from "@/domain/projects/types";
import type { FieldScope, Strategy } from "@/domain/psi/types";
import type { Db } from "../db";
import { projects, projectUrls, testRuns } from "../schema";

// Everything except `raw`, which is large and only needed for one run at a time.
const runColumns = {
  id: testRuns.id,
  urlId: testRuns.urlId,
  strategy: testRuns.strategy,
  status: testRuns.status,
  trigger: testRuns.trigger,
  performanceScore: testRuns.performanceScore,
  labLcpMs: testRuns.labLcpMs,
  labFcpMs: testRuns.labFcpMs,
  labTbtMs: testRuns.labTbtMs,
  labSiMs: testRuns.labSiMs,
  labTtfbMs: testRuns.labTtfbMs,
  labCls: testRuns.labCls,
  fieldLcpMs: testRuns.fieldLcpMs,
  fieldInpMs: testRuns.fieldInpMs,
  fieldCls: testRuns.fieldCls,
  fieldScope: testRuns.fieldScope,
  error: testRuns.error,
  createdAt: testRuns.createdAt,
};

const ownedBy = (userId: string) => eq(projects.userId, userId);

function selectOwnedRuns(db: Db) {
  return db
    .select(runColumns)
    .from(testRuns)
    .innerJoin(projectUrls, eq(projectUrls.id, testRuns.urlId))
    .innerJoin(projects, eq(projects.id, projectUrls.projectId));
}

/** Callers must have checked that the user owns the URL. */
export async function createPendingRun(
  db: Db,
  urlId: string,
  strategy: Strategy,
  trigger: RunTrigger,
): Promise<string> {
  const [run] = await db
    .insert(testRuns)
    .values({ urlId, strategy, trigger })
    .returning({ id: testRuns.id });
  return run.id;
}

export interface CompletedRun extends RunMetrics {
  fieldScope: FieldScope;
  lighthouseVersion: string | null;
  finalUrl: string;
  raw: unknown;
}

export async function completeRun(db: Db, runId: string, run: CompletedRun) {
  await db
    .update(testRuns)
    .set({ ...run, status: "success", completedAt: new Date() })
    .where(eq(testRuns.id, runId));
}

export async function failRun(db: Db, runId: string, error: string) {
  await db
    .update(testRuns)
    .set({ status: "failed", error, completedAt: new Date() })
    .where(eq(testRuns.id, runId));
}

export async function listRunsSince(
  db: Db,
  userId: string,
  urlId: string,
  since: Date,
): Promise<RunRecord[]> {
  return selectOwnedRuns(db)
    .where(and(eq(testRuns.urlId, urlId), ownedBy(userId), gte(testRuns.createdAt, since)))
    .orderBy(testRuns.createdAt);
}

export async function listRecentRuns(
  db: Db,
  userId: string,
  urlId: string,
  limit: number,
): Promise<RunRecord[]> {
  return selectOwnedRuns(db)
    .where(and(eq(testRuns.urlId, urlId), ownedBy(userId)))
    .orderBy(desc(testRuns.createdAt))
    .limit(limit);
}

/** The latest successful run's raw JSON for each strategy. */
export async function getLatestRawRuns(db: Db, userId: string, urlId: string) {
  const rows = await db
    .selectDistinctOn([testRuns.strategy], {
      id: testRuns.id,
      strategy: testRuns.strategy,
      raw: testRuns.raw,
      createdAt: testRuns.createdAt,
    })
    .from(testRuns)
    .innerJoin(projectUrls, eq(projectUrls.id, testRuns.urlId))
    .innerJoin(projects, eq(projects.id, projectUrls.projectId))
    .where(and(eq(testRuns.urlId, urlId), ownedBy(userId), eq(testRuns.status, "success")))
    .orderBy(testRuns.strategy, desc(testRuns.createdAt));
  return rows;
}

/** The latest successful score per URL and strategy, for a project's URL list. */
export async function getLatestScores(
  db: Db,
  userId: string,
  urlIds: string[],
): Promise<LatestScore[]> {
  if (urlIds.length === 0) return [];
  const rows = await db
    .selectDistinctOn([testRuns.urlId, testRuns.strategy], {
      urlId: testRuns.urlId,
      strategy: testRuns.strategy,
      score: sql<number>`${testRuns.performanceScore}`,
      createdAt: testRuns.createdAt,
    })
    .from(testRuns)
    .innerJoin(projectUrls, eq(projectUrls.id, testRuns.urlId))
    .innerJoin(projects, eq(projects.id, projectUrls.projectId))
    .where(and(inArray(testRuns.urlId, urlIds), ownedBy(userId), eq(testRuns.status, "success")))
    .orderBy(testRuns.urlId, testRuns.strategy, desc(testRuns.createdAt));
  return rows;
}
