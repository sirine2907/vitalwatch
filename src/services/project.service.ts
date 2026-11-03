import type { Db } from "@/data/db";
import * as monitoring from "@/data/repositories/monitoring.repository";
import * as repo from "@/data/repositories/projects.repository";
import { getLatestScores } from "@/data/repositories/runs.repository";
import { checkScheduleQuota } from "@/domain/monitoring/quota";
import { firstRunAt, SCHEDULES, type Schedule } from "@/domain/monitoring/schedule";
import {
  MAX_COMPETITORS_PER_PROJECT,
  MAX_PROJECT_NAME_LENGTH,
  MAX_PROJECTS_PER_USER,
  MAX_SCORE_DROP_THRESHOLD,
  MAX_URL_LABEL_LENGTH,
  MAX_URLS_PER_PROJECT,
} from "@/domain/projects/limits";
import type { UrlRole } from "@/domain/projects/types";
import { validateUrl } from "@/domain/url/validate";
import { AppError } from "@/lib/errors";

const invalid = (message: string) => new AppError("invalid_request", message, { status: 400 });
const notFound = (what: string) => new AppError("not_found", `${what} wasn't found.`, { status: 404 });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A malformed ID in a URL should be a normal 404, not a database error. */
export const isUuid = (value: string) => UUID.test(value);

function cleanName(input: string): string {
  const name = input.trim();
  if (!name) throw invalid("Give the project a name.");
  if (name.length > MAX_PROJECT_NAME_LENGTH) {
    throw invalid(`Project names can be at most ${MAX_PROJECT_NAME_LENGTH} characters.`);
  }
  return name;
}

export interface MonitoringInput {
  schedule: string;
  scoreDropThreshold: string;
  emailAlerts: boolean;
}

export function createProjectService(db: Db, now: () => Date = () => new Date()) {
  async function requireProject(userId: string, projectId: string) {
    const project = isUuid(projectId) ? await repo.getProject(db, userId, projectId) : null;
    if (!project) throw notFound("That project");
    return project;
  }

  /** Rejects a change that would push the user's scheduled tests over their share. */
  async function assertQuota(userId: string, projectId: string, change: { schedule?: Schedule; addUrls?: number }) {
    const loads = await monitoring.listScheduleLoads(db, userId);
    const project = loads.get(projectId);
    if (project) {
      loads.set(projectId, {
        schedule: change.schedule ?? project.schedule,
        urlCount: project.urlCount + (change.addUrls ?? 0),
      });
    }
    const problem = checkScheduleQuota([...loads.values()]);
    if (problem) throw invalid(problem);
  }

  return {
    requireProject,

    list: (userId: string) => repo.listProjects(db, userId),

    async create(userId: string, input: string) {
      const name = cleanName(input);
      if ((await repo.countProjects(db, userId)) >= MAX_PROJECTS_PER_USER) {
        throw invalid(`You can have up to ${MAX_PROJECTS_PER_USER} projects.`);
      }
      return repo.createProject(db, userId, name);
    },

    async rename(userId: string, projectId: string, input: string) {
      const name = cleanName(input);
      await requireProject(userId, projectId);
      await repo.renameProject(db, userId, projectId, name);
    },

    async remove(userId: string, projectId: string) {
      await requireProject(userId, projectId);
      await repo.deleteProject(db, userId, projectId);
    },

    async addUrl(
      userId: string,
      projectId: string,
      input: string,
      labelInput = "",
      role: UrlRole = "monitored",
    ) {
      const project = await requireProject(userId, projectId);

      const validation = validateUrl(input);
      if (!validation.ok) throw invalid(validation.error);

      const label = labelInput.trim();
      if (label.length > MAX_URL_LABEL_LENGTH) {
        throw invalid(`Labels can be at most ${MAX_URL_LABEL_LENGTH} characters.`);
      }

      const limit = role === "monitored" ? MAX_URLS_PER_PROJECT : MAX_COMPETITORS_PER_PROJECT;
      if ((await repo.countUrls(db, projectId, role)) >= limit) {
        throw invalid(
          role === "monitored"
            ? `A project can have up to ${limit} URLs.`
            : `A project can have up to ${limit} competitors.`,
        );
      }
      if (role === "monitored" && project.schedule !== "off") {
        await assertQuota(userId, projectId, { addUrls: 1 });
      }

      const created = await repo.insertUrl(db, projectId, validation.url, label || null, role);
      if (!created) throw invalid("This project already has that URL.");
      return created;
    },

    async removeUrl(userId: string, urlId: string) {
      const removed = isUuid(urlId) && (await repo.deleteUrl(db, userId, urlId));
      if (!removed) throw notFound("That URL");
    },

    async requireUrl(userId: string, urlId: string) {
      const url = isUuid(urlId) ? await repo.getUrl(db, userId, urlId) : null;
      if (!url) throw notFound("That URL");
      return url;
    },

    async updateMonitoring(userId: string, projectId: string, input: MonitoringInput) {
      const project = await requireProject(userId, projectId);

      const schedule = SCHEDULES.find((option) => option === input.schedule);
      if (!schedule) throw invalid("Choose a schedule.");

      const threshold = Number(input.scoreDropThreshold);
      if (!Number.isInteger(threshold) || threshold < 1 || threshold > MAX_SCORE_DROP_THRESHOLD) {
        throw invalid(`The score drop must be a whole number from 1 to ${MAX_SCORE_DROP_THRESHOLD}.`);
      }
      if (schedule !== "off") await assertQuota(userId, projectId, { schedule });

      await monitoring.updateMonitoringSettings(db, userId, projectId, {
        schedule,
        // Keep the current slot unless the schedule itself changed.
        nextRunAt: schedule === project.schedule ? project.nextRunAt : firstRunAt(schedule, now()),
        scoreDropThreshold: threshold,
        emailAlerts: input.emailAlerts,
      });
    },

    /** A project's URLs, each with its latest mobile and desktop score. */
    async getOverview(userId: string, projectId: string) {
      const project = await requireProject(userId, projectId);
      const urls = await repo.listUrls(db, userId, projectId);
      const scores = await getLatestScores(db, userId, urls.map((url) => url.id));
      const withScores = urls.map((url) => ({
        ...url,
        mobile: scores.find((s) => s.urlId === url.id && s.strategy === "mobile")?.score ?? null,
        desktop: scores.find((s) => s.urlId === url.id && s.strategy === "desktop")?.score ?? null,
      }));
      return {
        project,
        urls: withScores.filter((url) => url.role === "monitored"),
        competitors: withScores.filter((url) => url.role === "competitor"),
      };
    },
  };
}
