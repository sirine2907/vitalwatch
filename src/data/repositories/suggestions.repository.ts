import { and, count, desc, eq, gte } from "drizzle-orm";
import type { DetectedTech } from "@/domain/stack/detect";
import type { Db } from "../db";
import { aiSuggestions, projects, projectUrls, stackDetections, testRuns } from "../schema";

/** A run the user owns, with what generating suggestions needs. */
export async function getOwnedRun(db: Db, userId: string, runId: string) {
  const [row] = await db
    .select({
      id: testRuns.id,
      status: testRuns.status,
      strategy: testRuns.strategy,
      raw: testRuns.raw,
      urlId: projectUrls.id,
      url: projectUrls.url,
    })
    .from(testRuns)
    .innerJoin(projectUrls, eq(projectUrls.id, testRuns.urlId))
    .innerJoin(projects, eq(projects.id, projectUrls.projectId))
    .where(and(eq(testRuns.id, runId), eq(projects.userId, userId)));
  return row ?? null;
}

export async function getSuggestion(db: Db, userId: string, runId: string, promptVersion: string) {
  const [row] = await db
    .select({
      content: aiSuggestions.content,
      stack: aiSuggestions.stack,
      model: aiSuggestions.model,
      createdAt: aiSuggestions.createdAt,
    })
    .from(aiSuggestions)
    .where(
      and(
        eq(aiSuggestions.runId, runId),
        eq(aiSuggestions.userId, userId),
        eq(aiSuggestions.promptVersion, promptVersion),
      ),
    );
  return row ?? null;
}

export async function insertSuggestion(
  db: Db,
  values: typeof aiSuggestions.$inferInsert,
): Promise<boolean> {
  const rows = await db.insert(aiSuggestions).values(values).onConflictDoNothing().returning({ id: aiSuggestions.id });
  return rows.length > 0;
}

export async function countSuggestionsSince(db: Db, userId: string, since: Date): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(aiSuggestions)
    .where(and(eq(aiSuggestions.userId, userId), gte(aiSuggestions.createdAt, since)));
  return row.value;
}

export async function getRecentStack(db: Db, urlId: string, since: Date): Promise<DetectedTech[] | null> {
  const [row] = await db
    .select({ detected: stackDetections.detected })
    .from(stackDetections)
    .where(and(eq(stackDetections.urlId, urlId), gte(stackDetections.createdAt, since)))
    .orderBy(desc(stackDetections.createdAt))
    .limit(1);
  return row ? (row.detected as DetectedTech[]) : null;
}

export async function saveStack(db: Db, urlId: string, detected: DetectedTech[]) {
  await db.insert(stackDetections).values({ urlId, detected });
}
