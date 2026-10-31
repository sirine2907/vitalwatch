import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/data/schema";
import type { Db } from "@/data/db";
import { MAX_PROJECTS_PER_USER, MAX_URLS_PER_PROJECT } from "@/domain/projects/limits";
import { AppError } from "@/lib/errors";
import { createProjectService } from "@/services/project.service";
import { createRunService } from "@/services/run.service";
import { buildPsiResponse } from "./fixtures/psi-response";
import { createTestDb, createUser } from "./helpers/test-db";

const allowed = async () => ({ allowed: true, limit: 30, remaining: 29, resetAt: 0 });
const MISSING_ID = "00000000-0000-4000-8000-000000000000";

let db: Db;
let close: () => Promise<void>;
let alice: string;
let bob: string;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterAll(() => close());

beforeEach(async () => {
  await db.delete(schema.users);
  alice = await createUser(db, "alice@example.com");
  bob = await createUser(db, "bob@example.com");
});

const projects = () => createProjectService(db);
const runsWith = (fetchPsi = vi.fn(async () => buildPsiResponse() as unknown)) =>
  createRunService({ db, fetchPsi, rateLimit: allowed });

async function setup() {
  const project = await projects().create(alice, "Shop");
  const url = await projects().addUrl(alice, project.id, "shop.example.com/");
  return { project, url };
}

describe("project ownership", () => {
  it("never lists another user's projects", async () => {
    await projects().create(alice, "Alice's");
    expect(await projects().list(bob)).toEqual([]);
  });

  it("hides another user's project as not found", async () => {
    const { project } = await setup();
    await expect(projects().requireProject(bob, project.id)).rejects.toMatchObject({
      code: "not_found",
    });
    await expect(projects().getOverview(bob, project.id)).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("stops other users renaming or deleting a project", async () => {
    const { project } = await setup();
    await expect(projects().rename(bob, project.id, "Hacked")).rejects.toBeInstanceOf(AppError);
    await expect(projects().remove(bob, project.id)).rejects.toBeInstanceOf(AppError);
    expect((await projects().requireProject(alice, project.id)).name).toBe("Shop");
  });

  it("stops other users adding or removing URLs", async () => {
    const { project, url } = await setup();
    await expect(projects().addUrl(bob, project.id, "evil.example.com")).rejects.toMatchObject({
      code: "not_found",
    });
    await expect(projects().removeUrl(bob, url.id)).rejects.toMatchObject({ code: "not_found" });
    await expect(projects().requireUrl(alice, url.id)).resolves.toMatchObject({ id: url.id });
  });

  it("stops other users running tests or reading results", async () => {
    const { url } = await setup();
    const fetchPsi = vi.fn(async () => buildPsiResponse() as unknown);
    const runs = runsWith(fetchPsi);

    await runs.runManualTest(alice, url.id, "mobile");
    fetchPsi.mockClear();

    await expect(runs.runManualTest(bob, url.id, "mobile")).rejects.toMatchObject({
      code: "not_found",
    });
    expect(fetchPsi).not.toHaveBeenCalled();
    expect(await runs.listForRange(bob, url.id, 30)).toEqual([]);
    expect(await runs.listRecent(bob, url.id)).toEqual([]);
    expect(await runs.getLatestResults(bob, url.id, url.url)).toEqual({});
  });

  it("treats malformed IDs as not found rather than a database error", async () => {
    await expect(projects().requireProject(alice, "not-a-uuid")).rejects.toMatchObject({
      code: "not_found",
    });
    await expect(projects().requireUrl(alice, "' OR 1=1")).rejects.toMatchObject({
      code: "not_found",
    });
    await expect(runsWith().runManualTest(alice, "nope", "mobile")).rejects.toMatchObject({
      code: "not_found",
    });
  });
});

describe("project rules", () => {
  it("rejects blank and overlong names", async () => {
    await expect(projects().create(alice, "   ")).rejects.toMatchObject({ status: 400 });
    await expect(projects().create(alice, "x".repeat(81))).rejects.toMatchObject({ status: 400 });
  });

  it("caps projects per user, without affecting others", async () => {
    for (let i = 0; i < MAX_PROJECTS_PER_USER; i++) await projects().create(alice, `P${i}`);
    await expect(projects().create(alice, "One more")).rejects.toMatchObject({ status: 400 });
    await expect(projects().create(bob, "Bob's first")).resolves.toBeTruthy();
  });

  it("stores normalized URLs and rejects equivalent duplicates", async () => {
    const { project, url } = await setup();
    expect(url.url).toBe("https://shop.example.com/");
    await expect(
      projects().addUrl(alice, project.id, "https://shop.example.com/?utm_source=x#top"),
    ).rejects.toThrow("already has");
  });

  it("allows the same URL in two projects", async () => {
    await setup();
    const other = await projects().create(alice, "Other");
    await expect(projects().addUrl(alice, other.id, "shop.example.com")).resolves.toBeTruthy();
  });

  it("rejects private URLs", async () => {
    const { project } = await setup();
    await expect(projects().addUrl(alice, project.id, "http://10.0.0.1")).rejects.toMatchObject({
      status: 400,
    });
  });

  it("caps URLs per project", async () => {
    const project = await projects().create(alice, "Big");
    for (let i = 0; i < MAX_URLS_PER_PROJECT; i++) {
      await projects().addUrl(alice, project.id, `example.com/${i}`);
    }
    await expect(projects().addUrl(alice, project.id, "example.com/x")).rejects.toThrow("up to");
  });

  it("counts URLs in the project list", async () => {
    await setup();
    const [summary] = await projects().list(alice);
    expect(summary.urlCount).toBe(1);
  });

  it("deleting a project removes its URLs and runs", async () => {
    const { project, url } = await setup();
    await runsWith().runManualTest(alice, url.id, "mobile");
    await projects().remove(alice, project.id);
    expect(await db.select().from(schema.testRuns)).toEqual([]);
    expect(await db.select().from(schema.projectUrls)).toEqual([]);
  });
});

describe("run storage", () => {
  it("stores scores, metrics and trimmed JSON for a successful run", async () => {
    const { url } = await setup();
    const raw = buildPsiResponse({ i18n: { huge: true }, fullPageScreenshot: { data: "x" } });
    await runsWith(vi.fn(async () => raw as unknown)).runManualTest(alice, url.id, "mobile");

    const [run] = await db.select().from(schema.testRuns);
    expect(run).toMatchObject({
      status: "success",
      trigger: "manual",
      strategy: "mobile",
      performanceScore: 73,
      fieldLcpMs: 2100,
      fieldCls: 0.05,
      fieldScope: "url",
      labTbtMs: 310,
    });
    expect(JSON.stringify(run.raw)).not.toContain("huge");
    expect(run.completedAt).not.toBeNull();
  });

  it("records failed runs with no metrics", async () => {
    const { url } = await setup();
    const fetchPsi = vi.fn(async () => {
      throw new AppError("site_unreachable", "Google couldn't load this page.", { status: 422 });
    });

    await expect(runsWith(fetchPsi).runManualTest(alice, url.id, "desktop")).rejects.toThrow();

    const [run] = await db.select().from(schema.testRuns);
    expect(run).toMatchObject({
      status: "failed",
      error: "Google couldn't load this page.",
      performanceScore: null,
    });
  });

  it("records unusable Lighthouse runs as failures, not a zero", async () => {
    const { url } = await setup();
    const fetchPsi = vi.fn(async () => buildPsiResponse({ runtimeError: { code: "NO_FCP" } }) as unknown);
    await expect(runsWith(fetchPsi).runManualTest(alice, url.id, "mobile")).rejects.toThrow();
    const [run] = await db.select().from(schema.testRuns);
    expect(run.status).toBe("failed");
    expect(run.performanceScore).toBeNull();
  });

  it("doesn't store internal error details", async () => {
    const { url } = await setup();
    const fetchPsi = vi.fn(async () => {
      throw new Error("secret connection string");
    });
    await expect(runsWith(fetchPsi).runManualTest(alice, url.id, "mobile")).rejects.toThrow();
    const [run] = await db.select().from(schema.testRuns);
    expect(run.error).toBe("The test failed unexpectedly.");
  });

  it("creates no run when the user is over their limit", async () => {
    const { url } = await setup();
    const runs = createRunService({
      db,
      fetchPsi: vi.fn(),
      rateLimit: async () => ({ allowed: false, limit: 30, remaining: 0, resetAt: 61_000 }),
      now: () => 1_000,
    });
    await expect(runs.runManualTest(alice, url.id, "mobile")).rejects.toMatchObject({
      code: "rate_limited",
      retryAfterSeconds: 60,
    });
    expect(await db.select().from(schema.testRuns)).toEqual([]);
  });

  it("keeps testing if the rate limiter is down", async () => {
    const { url } = await setup();
    const runs = createRunService({
      db,
      fetchPsi: async () => buildPsiResponse(),
      rateLimit: async () => {
        throw new Error("redis down");
      },
    });
    await expect(runs.runManualTest(alice, url.id, "mobile")).resolves.toMatchObject({ score: 73 });
  });

  it("returns the latest result per strategy, rebuilt from stored JSON", async () => {
    const { url } = await setup();
    const fetchPsi = vi
      .fn<() => Promise<unknown>>()
      .mockResolvedValueOnce(buildPsiResponse({ categories: { performance: { score: 0.5 } } }))
      .mockResolvedValueOnce(buildPsiResponse({ categories: { performance: { score: 0.8 } } }))
      .mockResolvedValueOnce(buildPsiResponse({ categories: { performance: { score: 0.95 } } }));
    const runs = runsWith(fetchPsi);

    await runs.runManualTest(alice, url.id, "mobile");
    await runs.runManualTest(alice, url.id, "mobile");
    await runs.runManualTest(alice, url.id, "desktop");

    const latest = await runs.getLatestResults(alice, url.id, url.url);
    expect(latest.mobile?.score).toBe(80);
    expect(latest.desktop?.score).toBe(95);
  });

  it("ignores failed runs when finding the latest score", async () => {
    const { project, url } = await setup();
    const fetchPsi = vi
      .fn<() => Promise<unknown>>()
      .mockResolvedValueOnce(buildPsiResponse())
      .mockRejectedValueOnce(new Error("down"));
    const runs = runsWith(fetchPsi);

    await runs.runManualTest(alice, url.id, "mobile");
    await expect(runs.runManualTest(alice, url.id, "mobile")).rejects.toThrow();

    const overview = await projects().getOverview(alice, project.id);
    expect(overview.urls[0]).toMatchObject({ mobile: 73, desktop: null });
  });

  it("only returns runs inside the range", async () => {
    const { url } = await setup();
    await runsWith().runManualTest(alice, url.id, "mobile");
    const old = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    await db.insert(schema.testRuns).values({
      urlId: url.id,
      strategy: "mobile",
      status: "success",
      performanceScore: 10,
      createdAt: old,
    });

    expect(await runsWith().listForRange(alice, url.id, 30)).toHaveLength(1);
    expect(await runsWith().listForRange(alice, url.id, 90)).toHaveLength(2);
  });

  it("handles a URL with no runs", async () => {
    const { url } = await setup();
    expect(await runsWith().listForRange(alice, url.id, 7)).toEqual([]);
    expect(await runsWith().getLatestResults(alice, url.id, url.url)).toEqual({});
    await expect(createProjectService(db).requireUrl(alice, MISSING_ID)).rejects.toMatchObject({
      code: "not_found",
    });
  });
});
