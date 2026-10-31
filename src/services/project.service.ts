import * as repo from "@/data/repositories/projects.repository";
import { getLatestScores } from "@/data/repositories/runs.repository";
import type { Db } from "@/data/db";
import {
  MAX_PROJECT_NAME_LENGTH,
  MAX_PROJECTS_PER_USER,
  MAX_URL_LABEL_LENGTH,
  MAX_URLS_PER_PROJECT,
} from "@/domain/projects/limits";
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

export function createProjectService(db: Db) {
  async function requireProject(userId: string, projectId: string) {
    const project = isUuid(projectId) ? await repo.getProject(db, userId, projectId) : null;
    if (!project) throw notFound("That project");
    return project;
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

    async addUrl(userId: string, projectId: string, input: string, labelInput = "") {
      await requireProject(userId, projectId);

      const validation = validateUrl(input);
      if (!validation.ok) throw invalid(validation.error);

      const label = labelInput.trim();
      if (label.length > MAX_URL_LABEL_LENGTH) {
        throw invalid(`Labels can be at most ${MAX_URL_LABEL_LENGTH} characters.`);
      }
      if ((await repo.countUrls(db, projectId)) >= MAX_URLS_PER_PROJECT) {
        throw invalid(`A project can have up to ${MAX_URLS_PER_PROJECT} URLs.`);
      }

      const created = await repo.insertUrl(db, projectId, validation.url, label || null);
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

    /** A project's URLs, each with its latest mobile and desktop score. */
    async getOverview(userId: string, projectId: string) {
      const project = await requireProject(userId, projectId);
      const urls = await repo.listUrls(db, userId, projectId);
      const scores = await getLatestScores(db, userId, urls.map((url) => url.id));
      return {
        project,
        urls: urls.map((url) => ({
          ...url,
          mobile: scores.find((s) => s.urlId === url.id && s.strategy === "mobile")?.score ?? null,
          desktop: scores.find((s) => s.urlId === url.id && s.strategy === "desktop")?.score ?? null,
        })),
      };
    },
  };
}
