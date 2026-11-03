import { and, desc, eq, inArray } from "drizzle-orm";
import type { RunMetrics } from "@/domain/projects/types";
import type { Strategy } from "@/domain/psi/types";
import type { Db } from "../db";
import { projects, projectUrls, sharedReports, testRuns } from "../schema";

/** The latest successful run per URL for one device, with metrics only. */
export async function getLatestMetrics(db: Db, userId: string, urlIds: string[], strategy: Strategy) {
  if (urlIds.length === 0) return [];
  return db
    .selectDistinctOn([testRuns.urlId], {
      urlId: testRuns.urlId,
      createdAt: testRuns.createdAt,
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
    })
    .from(testRuns)
    .innerJoin(projectUrls, eq(projectUrls.id, testRuns.urlId))
    .innerJoin(projects, eq(projects.id, projectUrls.projectId))
    .where(
      and(
        inArray(testRuns.urlId, urlIds),
        eq(testRuns.strategy, strategy),
        eq(testRuns.status, "success"),
        eq(projects.userId, userId),
      ),
    )
    .orderBy(testRuns.urlId, desc(testRuns.createdAt));
}

export type LatestMetrics = RunMetrics & { urlId: string; createdAt: Date };

export async function insertReport(
  db: Db,
  values: { projectId: string; tokenHash: string; snapshot: unknown; expiresAt: Date | null },
) {
  const [row] = await db.insert(sharedReports).values(values).returning({ id: sharedReports.id });
  return row.id;
}

export async function findReportByHash(db: Db, tokenHash: string) {
  const [row] = await db.select().from(sharedReports).where(eq(sharedReports.tokenHash, tokenHash));
  return row ?? null;
}

export async function listReports(db: Db, userId: string, projectId: string) {
  return db
    .select({
      id: sharedReports.id,
      createdAt: sharedReports.createdAt,
      expiresAt: sharedReports.expiresAt,
      revokedAt: sharedReports.revokedAt,
    })
    .from(sharedReports)
    .innerJoin(projects, eq(projects.id, sharedReports.projectId))
    .where(and(eq(sharedReports.projectId, projectId), eq(projects.userId, userId)))
    .orderBy(desc(sharedReports.createdAt));
}

export async function revokeReport(db: Db, userId: string, reportId: string) {
  const owned = db.select({ id: projects.id }).from(projects).where(eq(projects.userId, userId));
  const rows = await db
    .update(sharedReports)
    .set({ revokedAt: new Date() })
    .where(and(eq(sharedReports.id, reportId), inArray(sharedReports.projectId, owned)))
    .returning({ id: sharedReports.id });
  return rows.length > 0;
}

export async function setBrandColor(db: Db, userId: string, projectId: string, brandColor: string | null) {
  await db
    .update(projects)
    .set({ brandColor })
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
}
