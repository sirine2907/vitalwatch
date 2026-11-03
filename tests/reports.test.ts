import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { renderReportPdf } from "@/components/reports/report-pdf";
import type { Db } from "@/data/db";
import * as schema from "@/data/schema";
import type { RunMetrics } from "@/domain/projects/types";
import { buildComparison, type CompareColumn } from "@/domain/reports/compare";
import { readSnapshot, reportFileName } from "@/domain/reports/snapshot";
import { createProjectService } from "@/services/project.service";
import { createReportService, hashToken } from "@/services/report.service";
import { createRunService } from "@/services/run.service";
import { buildPsiResponse, withAudits } from "./fixtures/psi-response";
import { createTestDb, createUser } from "./helpers/test-db";

const metrics = (overrides: Partial<RunMetrics>): RunMetrics => ({
  performanceScore: null,
  labLcpMs: null,
  labFcpMs: null,
  labTbtMs: null,
  labSiMs: null,
  labTtfbMs: null,
  labCls: null,
  fieldLcpMs: null,
  fieldInpMs: null,
  fieldCls: null,
  ...overrides,
});

const column = (label: string, m: Partial<RunMetrics> | null): CompareColumn => ({
  label,
  url: `https://${label}.example/`,
  isYours: label === "you",
  metrics: m ? metrics(m) : null,
  testedAt: m ? new Date() : null,
});

describe("buildComparison", () => {
  const rows = buildComparison([
    column("you", { performanceScore: 70, fieldLcpMs: 2000, labCls: 0.1, labTbtMs: 300 }),
    column("rival", { performanceScore: 90, fieldLcpMs: 3000, labCls: 0.1, labTbtMs: 300 }),
    column("other", { performanceScore: 50, labCls: 0.2, labTbtMs: 300 }),
    column("untested", null),
  ]);
  const row = (label: string) => rows.find((r) => r.label === label)!;

  it("marks the highest score as best", () => {
    expect(row("Performance score")).toMatchObject({ cells: ["70", "90", "50", null], best: [1] });
  });

  it("marks the lowest time as best", () => {
    expect(row("LCP (real users)").best).toEqual([0]);
  });

  it("marks a shared best for all who share it", () => {
    expect(row("CLS (lab)").best).toEqual([0, 1]);
  });

  it("marks nothing when everyone is equal", () => {
    expect(row("Total Blocking Time").best).toEqual([]);
  });

  it("marks nothing when fewer than two have data", () => {
    expect(row("INP (real users)")).toMatchObject({ cells: [null, null, null, null], best: [] });
    const single = buildComparison([column("you", { performanceScore: 50 }), column("rival", null)]);
    expect(single[0].best).toEqual([]);
  });

  it("formats values for each metric", () => {
    expect(row("LCP (real users)").cells).toEqual(["2.0 s", "3.0 s", null, null]);
  });
});

describe("snapshot helpers", () => {
  it("makes safe file names", () => {
    expect(reportFileName("Acme / Shop!!", "2026-11-03T10:00:00Z")).toBe("acme-shop-2026-11-03.pdf");
    expect(reportFileName("???", "2026-11-03T10:00:00Z")).toBe("report-2026-11-03.pdf");
  });

  it("rejects snapshots that don't match the format", () => {
    expect(readSnapshot({ version: 2 })).toBeNull();
    expect(readSnapshot(null)).toBeNull();
  });
});

let db: Db;
let close: () => Promise<void>;
let owner: string;
let now: Date;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterAll(() => close());
beforeEach(async () => {
  await db.delete(schema.users);
  owner = await createUser(db, "owner@example.com");
  now = new Date(Date.UTC(2026, 10, 3, 9, 0));
});

const allowed = async () => ({ allowed: true, limit: 30, remaining: 29, resetAt: 0 });

async function setup(score = 0.73) {
  const projects = createProjectService(db);
  const project = await projects.create(owner, "Acme Shop");
  const url = await projects.addUrl(owner, project.id, "shop.example.com", "Home");
  const rival = await projects.addUrl(owner, project.id, "rival.example.com", "Rival", "competitor");
  const raw = withAudits({ "render-blocking": { title: "Eliminate render-blocking", score: 0, metricSavings: { LCP: 900 } } });
  raw.lighthouseResult.categories.performance.score = score;
  const runs = createRunService({ db, fetchPsi: async () => raw, rateLimit: allowed });
  await runs.runManualTest(owner, url.id, "mobile");
  await runs.runManualTest(owner, rival.id, "mobile");
  return { project, url, rival, runs, reports: createReportService(db, () => now) };
}

describe("report service", () => {
  it("builds a snapshot of pages and competitors without internal IDs", async () => {
    const { project, url, reports } = await setup();
    const snapshot = await reports.buildSnapshot(owner, project.id);

    expect(snapshot).toMatchObject({ version: 1, projectName: "Acme Shop", brandColor: "#0f766e" });
    expect(snapshot.pages).toHaveLength(1);
    expect(snapshot.pages[0]).toMatchObject({ label: "Home", desktop: null });
    expect(snapshot.pages[0].mobile).toMatchObject({ score: 73, topFixes: [{ title: "Eliminate render-blocking", savingsMs: 900 }] });
    expect(snapshot.competitors[0].label).toBe("Rival");

    const text = JSON.stringify(snapshot);
    expect(text).not.toContain(url.id);
    expect(text).not.toContain(project.id);
    expect(text).not.toContain(owner);
  });

  it("opens a share link by token, and stores only its hash", async () => {
    const { project, reports } = await setup();
    const token = await reports.createShareLink(owner, project.id, "30");

    expect(token.length).toBeGreaterThanOrEqual(43);
    const [row] = await db.select().from(schema.sharedReports);
    expect(row.tokenHash).toBe(hashToken(token));
    expect(JSON.stringify(row)).not.toContain(token);
    expect((await reports.getShared(token))?.projectName).toBe("Acme Shop");
  });

  it("freezes the snapshot when the link is made", async () => {
    const { project, url, reports } = await setup();
    const token = await reports.createShareLink(owner, project.id, "never");

    const better = createRunService({ db, fetchPsi: async () => buildPsiResponse({ categories: { performance: { score: 0.99 } } }), rateLimit: allowed });
    await better.runManualTest(owner, url.id, "mobile");

    expect((await reports.getShared(token))?.pages[0].mobile?.score).toBe(73);
    expect((await reports.buildSnapshot(owner, project.id)).pages[0].mobile?.score).toBe(99);
  });

  it("rejects unknown, short and tampered tokens", async () => {
    const { project, reports } = await setup();
    const token = await reports.createShareLink(owner, project.id, "7");
    expect(await reports.getShared("nope")).toBeNull();
    expect(await reports.getShared(`${token.slice(0, -1)}x`)).toBeNull();
    expect(await reports.getShared(hashToken(token))).toBeNull();
  });

  it("stops working after it expires", async () => {
    const { project, reports } = await setup();
    const token = await reports.createShareLink(owner, project.id, "7");
    now = new Date(now.getTime() + 6 * 24 * 3_600_000);
    expect(await reports.getShared(token)).not.toBeNull();
    now = new Date(now.getTime() + 2 * 24 * 3_600_000);
    expect(await reports.getShared(token)).toBeNull();
  });

  it("can be revoked by its owner only", async () => {
    const { project, reports } = await setup();
    const token = await reports.createShareLink(owner, project.id, "never");
    const [link] = await reports.listShareLinks(owner, project.id);
    const stranger = await createUser(db, "stranger@example.com");

    await expect(reports.revokeShareLink(stranger, link.id)).rejects.toMatchObject({ code: "not_found" });
    expect(await reports.getShared(token)).not.toBeNull();
    await expect(reports.listShareLinks(stranger, project.id)).rejects.toMatchObject({ code: "not_found" });

    await reports.revokeShareLink(owner, link.id);
    expect(await reports.getShared(token)).toBeNull();
  });

  it("won't share a project with no results, or for another user", async () => {
    const projects = createProjectService(db);
    const empty = await projects.create(owner, "Empty");
    await projects.addUrl(owner, empty.id, "empty.example.com");
    const reports = createReportService(db, () => now);
    await expect(reports.createShareLink(owner, empty.id, "7")).rejects.toThrow(/Test at least one page/);

    const { project } = await setup();
    const stranger = await createUser(db, "stranger@example.com");
    await expect(reports.createShareLink(stranger, project.id, "7")).rejects.toMatchObject({ code: "not_found" });
    await expect(reports.buildSnapshot(stranger, project.id)).rejects.toMatchObject({ code: "not_found" });
  });

  it("validates the expiry and brand color", async () => {
    const { project, reports } = await setup();
    await expect(reports.createShareLink(owner, project.id, "365")).rejects.toMatchObject({ status: 400 });
    await expect(reports.setBrandColor(owner, project.id, "red")).rejects.toMatchObject({ status: 400 });
    await expect(reports.setBrandColor(owner, project.id, "#12345")).rejects.toMatchObject({ status: 400 });
    await reports.setBrandColor(owner, project.id, "#AA3366");
    expect((await reports.buildSnapshot(owner, project.id)).brandColor).toBe("#aa3366");
    await reports.setBrandColor(owner, project.id, "");
    expect((await reports.buildSnapshot(owner, project.id)).brandColor).toBe("#0f766e");
  });

  it("compares your page with competitors on one device", async () => {
    const { project, url, reports } = await setup();
    const result = await reports.compare(owner, project.id, url.id, "mobile");
    expect(result.columns.map((c) => [c.label, c.isYours])).toEqual([["Home", true], ["Rival", false]]);
    expect(result.rows[0]).toMatchObject({ label: "Performance score", cells: ["73", "73"], best: [] });

    const desktop = await reports.compare(owner, project.id, url.id, "desktop");
    expect(desktop.columns.every((c) => c.metrics === null)).toBe(true);
  });

  it("caps competitors at three", async () => {
    const { project } = await setup();
    const projects = createProjectService(db);
    await projects.addUrl(owner, project.id, "b.example.com", "", "competitor");
    await projects.addUrl(owner, project.id, "c.example.com", "", "competitor");
    await expect(projects.addUrl(owner, project.id, "d.example.com", "", "competitor")).rejects.toThrow(/3 competitors/);
  });

  it("renders a real PDF", async () => {
    const { project, reports } = await setup();
    const pdf = await renderReportPdf(await reports.buildSnapshot(owner, project.id));
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(1000);
  });
});
