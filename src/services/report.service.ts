import { createHash, randomBytes } from "node:crypto";
import type { Db } from "@/data/db";
import * as repo from "@/data/repositories/reports.repository";
import { getLatestRawRuns } from "@/data/repositories/runs.repository";
import { listUrls } from "@/data/repositories/projects.repository";
import type { MonitoredUrl } from "@/domain/projects/types";
import { parsePsiResponse } from "@/domain/psi/parse";
import type { Strategy } from "@/domain/psi/types";
import { buildComparison, type CompareColumn } from "@/domain/reports/compare";
import {
  BRAND_COLOR,
  DEFAULT_BRAND_COLOR,
  readSnapshot,
  summarizeResult,
  type ReportPage,
  type ReportSnapshot,
} from "@/domain/reports/snapshot";
import { AppError } from "@/lib/errors";
import { createProjectService, isUuid } from "./project.service";

export const REPORT_EXPIRY_OPTIONS = ["7", "30", "never"] as const;
const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_TOKEN_LENGTH = 40;

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export function createReportService(db: Db, now: () => Date = () => new Date()) {
  const projects = createProjectService(db, now);

  async function summarizeUrl(userId: string, url: MonitoredUrl): Promise<ReportPage> {
    const rows = await getLatestRawRuns(db, userId, url.id);
    const page: ReportPage = { label: url.label, url: url.url, mobile: null, desktop: null };
    for (const row of rows) {
      try {
        page[row.strategy] = summarizeResult(parsePsiResponse(row.raw, row.strategy, url.url));
      } catch {
        // A run stored in an older format is left out rather than breaking the report.
      }
    }
    return page;
  }

  return {
    /** A fresh snapshot of the project, used for shared links and the owner's PDF. */
    async buildSnapshot(userId: string, projectId: string): Promise<ReportSnapshot> {
      const project = await projects.requireProject(userId, projectId);
      const urls = await listUrls(db, userId, projectId);
      const pages = await Promise.all(urls.map((url) => summarizeUrl(userId, url)));
      return {
        version: 1,
        projectName: project.name,
        brandColor: project.brandColor ?? DEFAULT_BRAND_COLOR,
        generatedAt: now().toISOString(),
        pages: pages.filter((_, index) => urls[index].role === "monitored"),
        competitors: pages.filter((_, index) => urls[index].role === "competitor"),
      };
    },

    /** Returns the raw token once. Only its hash is stored. */
    async createShareLink(userId: string, projectId: string, expiry: string) {
      if (!REPORT_EXPIRY_OPTIONS.includes(expiry as (typeof REPORT_EXPIRY_OPTIONS)[number])) {
        throw new AppError("invalid_request", "Choose when the link expires.", { status: 400 });
      }
      const snapshot = await this.buildSnapshot(userId, projectId);
      if (snapshot.pages.every((page) => !page.mobile && !page.desktop)) {
        throw new AppError("invalid_request", "Test at least one page before sharing a report.", { status: 400 });
      }

      const token = randomBytes(32).toString("base64url");
      await repo.insertReport(db, {
        projectId,
        tokenHash: hashToken(token),
        snapshot,
        expiresAt: expiry === "never" ? null : new Date(now().getTime() + Number(expiry) * DAY_MS),
      });
      return token;
    },

    /** Null for unknown, revoked and expired links alike, so nothing can be probed. */
    async getShared(token: string): Promise<ReportSnapshot | null> {
      if (token.length < MIN_TOKEN_LENGTH) return null;
      const report = await repo.findReportByHash(db, hashToken(token));
      if (!report || report.revokedAt) return null;
      if (report.expiresAt && report.expiresAt.getTime() <= now().getTime()) return null;
      return readSnapshot(report.snapshot);
    },

    async listShareLinks(userId: string, projectId: string) {
      await projects.requireProject(userId, projectId);
      return repo.listReports(db, userId, projectId);
    },

    async revokeShareLink(userId: string, reportId: string) {
      const revoked = isUuid(reportId) && (await repo.revokeReport(db, userId, reportId));
      if (!revoked) throw new AppError("not_found", "That link wasn't found.", { status: 404 });
    },

    async setBrandColor(userId: string, projectId: string, input: string) {
      await projects.requireProject(userId, projectId);
      const color = input.trim();
      if (color && !BRAND_COLOR.test(color)) {
        throw new AppError("invalid_request", "Use a hex color like #141416.", { status: 400 });
      }
      await repo.setBrandColor(db, userId, projectId, color ? color.toLowerCase() : null);
    },

    /** Your page next to its competitors, for one device. */
    async compare(userId: string, projectId: string, yourUrlId: string | undefined, strategy: Strategy) {
      const { project, urls, competitors } = await projects.getOverview(userId, projectId);
      const yours = urls.find((url) => url.id === yourUrlId) ?? urls[0];
      if (!yours) return { project, yours: null, columns: [], rows: [], urls, competitors };

      const selected = [yours, ...competitors];
      const latest = await repo.getLatestMetrics(db, userId, selected.map((url) => url.id), strategy);
      const columns: CompareColumn[] = selected.map((url) => {
        const row = latest.find((entry) => entry.urlId === url.id);
        return {
          label: url.label ?? new URL(url.url).hostname,
          url: url.url,
          isYours: url.id === yours.id,
          metrics: row ?? null,
          testedAt: row?.createdAt ?? null,
        };
      });
      return { project, yours, columns, rows: buildComparison(columns), urls, competitors };
    },
  };
}

