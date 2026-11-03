import { and, asc, count, desc, eq } from "drizzle-orm";
import type { MonitoredUrl, ProjectSummary, UrlRole } from "@/domain/projects/types";
import type { Db } from "../db";
import { projects, projectUrls } from "../schema";

const urlColumns = {
  id: projectUrls.id,
  projectId: projectUrls.projectId,
  url: projectUrls.url,
  label: projectUrls.label,
  role: projectUrls.role,
};

export async function createProject(db: Db, userId: string, name: string) {
  const [project] = await db.insert(projects).values({ userId, name }).returning();
  return project;
}

export async function countProjects(db: Db, userId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(projects)
    .where(eq(projects.userId, userId));
  return row.value;
}

export async function listProjects(db: Db, userId: string): Promise<ProjectSummary[]> {
  return db
    .select({
      id: projects.id,
      name: projects.name,
      createdAt: projects.createdAt,
      urlCount: count(projectUrls.id),
    })
    .from(projects)
    .leftJoin(
      projectUrls,
      and(eq(projectUrls.projectId, projects.id), eq(projectUrls.role, "monitored")),
    )
    .where(eq(projects.userId, userId))
    .groupBy(projects.id)
    .orderBy(desc(projects.createdAt));
}

export async function getProject(db: Db, userId: string, projectId: string) {
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
  return project ?? null;
}

export async function renameProject(db: Db, userId: string, projectId: string, name: string) {
  const updated = await db
    .update(projects)
    .set({ name })
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .returning({ id: projects.id });
  return updated.length > 0;
}

export async function deleteProject(db: Db, userId: string, projectId: string) {
  const deleted = await db
    .delete(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .returning({ id: projects.id });
  return deleted.length > 0;
}

export async function countUrls(db: Db, projectId: string, role: UrlRole): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(projectUrls)
    .where(and(eq(projectUrls.projectId, projectId), eq(projectUrls.role, role)));
  return row.value;
}

/** Returns null if the project already has this URL. Callers must own the project. */
export async function insertUrl(
  db: Db,
  projectId: string,
  url: string,
  label: string | null,
  role: UrlRole,
): Promise<MonitoredUrl | null> {
  const [created] = await db
    .insert(projectUrls)
    .values({ projectId, url, label, role })
    .onConflictDoNothing()
    .returning(urlColumns);
  return created ?? null;
}

export async function listUrls(db: Db, userId: string, projectId: string): Promise<MonitoredUrl[]> {
  return db
    .select(urlColumns)
    .from(projectUrls)
    .innerJoin(projects, eq(projects.id, projectUrls.projectId))
    .where(and(eq(projectUrls.projectId, projectId), eq(projects.userId, userId)))
    .orderBy(asc(projectUrls.createdAt));
}

export async function getUrl(db: Db, userId: string, urlId: string) {
  const [row] = await db
    .select({ ...urlColumns, projectName: projects.name })
    .from(projectUrls)
    .innerJoin(projects, eq(projects.id, projectUrls.projectId))
    .where(and(eq(projectUrls.id, urlId), eq(projects.userId, userId)));
  return row ?? null;
}

export async function deleteUrl(db: Db, userId: string, urlId: string) {
  const owned = await getUrl(db, userId, urlId);
  if (!owned) return false;
  await db.delete(projectUrls).where(eq(projectUrls.id, urlId));
  return true;
}
