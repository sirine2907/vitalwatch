import { and, asc, desc, eq, inArray, lte, ne } from "drizzle-orm";
import type { RunMetrics, RunTrigger } from "@/domain/projects/types";
import type { Schedule } from "@/domain/monitoring/schedule";
import type { Strategy } from "@/domain/psi/types";
import type { Db } from "../db";
import { projects, projectUrls, testRuns, users } from "../schema";

const metricColumns = {
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
};

export interface DueProject {
  projectId: string;
  due: Date;
  urlIds: string[];
}

/**
 * Takes projects whose next run is due and moves their next run forward, in
 * one transaction. SKIP LOCKED lets two overlapping dispatchers split the work
 * instead of both running it.
 */
export async function claimDueProjects(
  db: Db,
  now: Date,
  nextRun: (schedule: Schedule, due: Date) => Date | null,
  limit = 50,
): Promise<DueProject[]> {
  return db.transaction(async (tx) => {
    const due = await tx
      .select({ id: projects.id, schedule: projects.schedule, nextRunAt: projects.nextRunAt })
      .from(projects)
      .where(and(ne(projects.schedule, "off"), lte(projects.nextRunAt, now)))
      .orderBy(asc(projects.nextRunAt))
      .limit(limit)
      .for("update", { skipLocked: true });

    const claimed: DueProject[] = [];
    for (const project of due) {
      const dueAt = project.nextRunAt!;
      await tx
        .update(projects)
        .set({ nextRunAt: nextRun(project.schedule, dueAt) })
        .where(eq(projects.id, project.id));
      const urls = await tx
        .select({ id: projectUrls.id })
        .from(projectUrls)
        .where(and(eq(projectUrls.projectId, project.id), eq(projectUrls.role, "monitored")));
      claimed.push({ projectId: project.id, due: dueAt, urlIds: urls.map((url) => url.id) });
    }
    return claimed;
  });
}

/** Everything a background job needs about a URL. Jobs run without a signed-in user. */
export async function getJobContext(db: Db, urlId: string) {
  const [row] = await db
    .select({
      urlId: projectUrls.id,
      url: projectUrls.url,
      label: projectUrls.label,
      role: projectUrls.role,
      projectId: projects.id,
      projectName: projects.name,
      scoreDropThreshold: projects.scoreDropThreshold,
      baselineSize: projects.baselineSize,
      emailAlerts: projects.emailAlerts,
      userId: users.id,
      userEmail: users.email,
    })
    .from(projectUrls)
    .innerJoin(projects, eq(projects.id, projectUrls.projectId))
    .innerJoin(users, eq(users.id, projects.userId))
    .where(eq(projectUrls.id, urlId));
  return row ?? null;
}

export type JobContext = NonNullable<Awaited<ReturnType<typeof getJobContext>>>;

/** Returns null when this slot already has a run, so redelivered jobs do nothing. */
export async function insertJobRun(
  db: Db,
  urlId: string,
  strategy: Strategy,
  slot: Date,
  trigger: RunTrigger,
): Promise<string | null> {
  const [run] = await db
    .insert(testRuns)
    .values({ urlId, strategy, slot, trigger })
    .onConflictDoNothing()
    .returning({ id: testRuns.id });
  return run?.id ?? null;
}

/** Earlier successful runs, newest first. Retests are left out so one slot counts once. */
export async function listBaselineRuns(
  db: Db,
  urlId: string,
  strategy: Strategy,
  excludeIds: string[],
  limit: number,
): Promise<RunMetrics[]> {
  const rows = await db
    .select({ id: testRuns.id, ...metricColumns })
    .from(testRuns)
    .where(
      and(
        eq(testRuns.urlId, urlId),
        eq(testRuns.strategy, strategy),
        eq(testRuns.status, "success"),
        inArray(testRuns.trigger, ["manual", "scheduled"]),
      ),
    )
    .orderBy(desc(testRuns.createdAt))
    .limit(limit + excludeIds.length);
  return rows.filter((row) => !excludeIds.includes(row.id)).slice(0, limit);
}

export async function getRunMetrics(db: Db, runId: string) {
  const [row] = await db
    .select({ id: testRuns.id, status: testRuns.status, slot: testRuns.slot, ...metricColumns })
    .from(testRuns)
    .where(eq(testRuns.id, runId));
  return row ?? null;
}

export async function updateMonitoringSettings(
  db: Db,
  userId: string,
  projectId: string,
  settings: {
    schedule: Schedule;
    nextRunAt: Date | null;
    scoreDropThreshold: number;
    emailAlerts: boolean;
  },
) {
  await db
    .update(projects)
    .set(settings)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
}

/** Schedules and URL counts across a user's projects, for the quota check. */
export async function listScheduleLoads(db: Db, userId: string) {
  const rows = await db
    .select({ id: projects.id, schedule: projects.schedule, role: projectUrls.role })
    .from(projects)
    .leftJoin(projectUrls, eq(projectUrls.projectId, projects.id))
    .where(eq(projects.userId, userId));

  const byProject = new Map<string, { schedule: Schedule; urlCount: number }>();
  for (const row of rows) {
    const entry = byProject.get(row.id) ?? { schedule: row.schedule, urlCount: 0 };
    if (row.role === "monitored") entry.urlCount += 1;
    byProject.set(row.id, entry);
  }
  return byProject;
}
