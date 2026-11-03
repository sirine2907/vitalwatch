import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";
import type { AlertMetric, AlertSource, AlertType } from "@/domain/monitoring/regression";
import type { Strategy } from "@/domain/psi/types";
import type { Db } from "../db";
import { alerts, projects, projectUrls } from "../schema";

export interface NewAlert {
  projectId: string;
  urlId: string;
  triggerRunId: string;
  type: AlertType;
  metric: AlertMetric;
  source: AlertSource;
  strategy: Strategy;
  baselineValue: number;
  currentValue: number;
  threshold: number;
}

/** Returns null when the same problem already has an open alert. */
export async function insertAlert(db: Db, alert: NewAlert): Promise<string | null> {
  const [row] = await db.insert(alerts).values(alert).onConflictDoNothing().returning({ id: alerts.id });
  return row?.id ?? null;
}

export async function markEmailed(db: Db, alertId: string) {
  await db.update(alerts).set({ emailedAt: new Date() }).where(eq(alerts.id, alertId));
}

export async function resolveAlert(
  db: Db,
  rule: { urlId: string; strategy: Strategy; type: AlertType; metric: AlertMetric },
) {
  await db
    .update(alerts)
    .set({ status: "resolved", resolvedAt: new Date() })
    .where(
      and(
        eq(alerts.urlId, rule.urlId),
        eq(alerts.strategy, rule.strategy),
        eq(alerts.type, rule.type),
        eq(alerts.metric, rule.metric),
        eq(alerts.status, "open"),
      ),
    );
}

const listColumns = {
  id: alerts.id,
  projectId: alerts.projectId,
  projectName: projects.name,
  urlId: alerts.urlId,
  url: projectUrls.url,
  urlLabel: projectUrls.label,
  type: alerts.type,
  metric: alerts.metric,
  source: alerts.source,
  strategy: alerts.strategy,
  baselineValue: alerts.baselineValue,
  currentValue: alerts.currentValue,
  threshold: alerts.threshold,
  status: alerts.status,
  readAt: alerts.readAt,
  createdAt: alerts.createdAt,
  resolvedAt: alerts.resolvedAt,
};

export async function listAlerts(db: Db, userId: string, options: { projectId?: string; limit: number }) {
  return db
    .select(listColumns)
    .from(alerts)
    .innerJoin(projects, eq(projects.id, alerts.projectId))
    .innerJoin(projectUrls, eq(projectUrls.id, alerts.urlId))
    .where(
      and(
        eq(projects.userId, userId),
        options.projectId ? eq(alerts.projectId, options.projectId) : undefined,
      ),
    )
    .orderBy(desc(alerts.createdAt))
    .limit(options.limit);
}

export type AlertRow = Awaited<ReturnType<typeof listAlerts>>[number];

export async function countUnread(db: Db, userId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(alerts)
    .innerJoin(projects, eq(projects.id, alerts.projectId))
    .where(and(eq(projects.userId, userId), isNull(alerts.readAt)));
  return row.value;
}

export async function markAllRead(db: Db, userId: string) {
  const owned = db.select({ id: projects.id }).from(projects).where(eq(projects.userId, userId));
  await db
    .update(alerts)
    .set({ readAt: new Date() })
    .where(and(isNull(alerts.readAt), inArray(alerts.projectId, owned)));
}
