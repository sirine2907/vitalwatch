import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/data/db";
import * as schema from "@/data/schema";
import type { TestJob } from "@/integrations/job-queue";
import type { Email } from "@/integrations/resend";
import { createAlertService } from "@/services/alert.service";
import { createMonitoringService } from "@/services/monitoring.service";
import { createProjectService } from "@/services/project.service";
import { buildPsiResponse } from "./fixtures/psi-response";
import { createTestDb, createUser } from "./helpers/test-db";

let db: Db;
let close: () => Promise<void>;
let owner: string;
let now: Date;

const OWNER_EMAIL = "owner@example.com";

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterAll(() => close());

beforeEach(async () => {
  await db.delete(schema.users);
  owner = await createUser(db, OWNER_EMAIL);
  now = new Date(Date.UTC(2026, 10, 1, 12, 0));
});

/** A PSI response with the given score and field LCP. */
function psi(score: number, fieldLcp = 2100) {
  const response = buildPsiResponse({ categories: { performance: { score: score / 100 } } });
  response.loadingExperience.metrics.LARGEST_CONTENTFUL_PAINT_MS.percentile = fieldLcp;
  return response;
}

function harness(options: { sendEmail?: (email: Email) => Promise<void>; ownerAddress?: string } = {}) {
  const published: { job: TestJob; delay?: number }[] = [];
  const emails: Email[] = [];
  const fetchPsi = vi.fn(async () => psi(80) as unknown);
  const alerts = createAlertService({
    db,
    sendEmail: options.sendEmail ?? (async (email) => void emails.push(email)),
    ownerAddress: options.ownerAddress,
    appUrl: "https://vitalwatch.example",
  });
  const service = createMonitoringService({
    db,
    fetchPsi,
    queue: { publishTest: async (job, delay) => void published.push({ job, delay }) },
    alerts,
    now: () => now,
  });
  return { service, alerts, published, emails, fetchPsi };
}

async function setup(schedule: "off" | "hourly" | "daily" = "hourly") {
  const projects = createProjectService(db, () => now);
  const project = await projects.create(owner, "Shop");
  const url = await projects.addUrl(owner, project.id, "shop.example.com");
  await projects.updateMonitoring(owner, project.id, {
    schedule,
    scoreDropThreshold: "10",
    emailAlerts: true,
  });
  return { project, url, projects };
}

let slotCounter = 0;
function job(urlId: string, overrides: Partial<TestJob> = {}): TestJob {
  slotCounter += 1;
  return {
    urlId,
    strategy: "mobile",
    slot: new Date(Date.UTC(2026, 9, 1) + slotCounter * 3_600_000).toISOString(),
    trigger: "scheduled",
    ...overrides,
  };
}

/** Builds a baseline of `count` healthy scheduled runs. */
async function seedHistory(h: ReturnType<typeof harness>, urlId: string, count = 6) {
  h.fetchPsi.mockImplementation(async () => psi(80));
  for (let i = 0; i < count; i++) await h.service.runJob(job(urlId));
}

const openAlerts = () => db.select().from(schema.alerts).where(eq(schema.alerts.status, "open"));

describe("dispatch", () => {
  it("queues each URL on both devices for a due project, once", async () => {
    const { url } = await setup("hourly");
    const h = harness();

    expect(await h.service.dispatchDue()).toEqual({ projects: 1, jobs: 2 });
    expect(h.published.map((p) => [p.job.urlId, p.job.strategy, p.job.slot])).toEqual([
      [url.id, "mobile", now.toISOString()],
      [url.id, "desktop", now.toISOString()],
    ]);

    // A second tick in the same hour finds nothing due.
    expect(await h.service.dispatchDue()).toEqual({ projects: 0, jobs: 0 });
  });

  it("moves the next run forward by the schedule", async () => {
    const { project, projects } = await setup("daily");
    await harness().service.dispatchDue();
    const updated = await projects.requireProject(owner, project.id);
    expect(updated.nextRunAt).toEqual(new Date(now.getTime() + 24 * 3_600_000));
  });

  it("ignores projects that are off or not yet due", async () => {
    await setup("off");
    const h = harness();
    expect(await h.service.dispatchDue()).toEqual({ projects: 0, jobs: 0 });

    const { project } = await setup("hourly");
    await h.service.dispatchDue();
    now = new Date(now.getTime() + 30 * 60_000);
    expect(await h.service.dispatchDue()).toEqual({ projects: 0, jobs: 0 });
    expect(project).toBeTruthy();
  });

  it("doesn't queue competitors", async () => {
    const { project, projects } = await setup("hourly");
    await projects.addUrl(owner, project.id, "rival.example.com", "", "competitor");
    expect((await harness().service.dispatchDue()).jobs).toBe(2);
  });

  it("lets changing the schedule start at the next tick", async () => {
    const { project, projects } = await setup("off");
    await projects.updateMonitoring(owner, project.id, { schedule: "weekly", scoreDropThreshold: "10", emailAlerts: true });
    expect((await harness().service.dispatchDue()).projects).toBe(1);
  });
});

describe("running jobs", () => {
  it("stores a scheduled run with its slot", async () => {
    const { url } = await setup();
    const h = harness();
    const outcome = await h.service.runJob(job(url.id));
    expect(outcome).toEqual({ status: "building" });
    const [run] = await db.select().from(schema.testRuns);
    expect(run).toMatchObject({ trigger: "scheduled", status: "success", performanceScore: 80 });
    expect(run.slot).not.toBeNull();
  });

  it("does nothing for a redelivered job", async () => {
    const { url } = await setup();
    const h = harness();
    const repeated = job(url.id);
    await h.service.runJob(repeated);
    expect(await h.service.runJob(repeated)).toEqual({ status: "skipped", reason: "duplicate" });
    expect(h.fetchPsi).toHaveBeenCalledTimes(1);
  });

  it("skips URLs that were deleted after the job was queued", async () => {
    const h = harness();
    expect(await h.service.runJob(job("00000000-0000-4000-8000-000000000000"))).toEqual({
      status: "skipped",
      reason: "missing",
    });
  });

  it("records failures without alerting", async () => {
    const { url } = await setup();
    const h = harness();
    await seedHistory(h, url.id);
    h.fetchPsi.mockRejectedValue(new Error("down"));
    expect(await h.service.runJob(job(url.id))).toEqual({ status: "failed" });
    expect(await openAlerts()).toEqual([]);
    expect(h.published).toEqual([]);
  });
});

describe("regression alerts", () => {
  it("queues a delayed retest for a score drop instead of alerting", async () => {
    const { url } = await setup();
    const h = harness();
    await seedHistory(h, url.id);

    h.fetchPsi.mockResolvedValue(psi(60));
    const drop = job(url.id);
    expect(await h.service.runJob(drop)).toMatchObject({ raised: 0, retestQueued: true });
    expect(h.published).toEqual([
      expect.objectContaining({ delay: 300, job: expect.objectContaining({ trigger: "retest", slot: drop.slot }) }),
    ]);
    expect(await openAlerts()).toEqual([]);
  });

  it("alerts and emails once when the retest confirms the drop", async () => {
    const { url, project } = await setup();
    const h = harness();
    await seedHistory(h, url.id);

    h.fetchPsi.mockResolvedValue(psi(60));
    await h.service.runJob(job(url.id));
    const retest = h.published[0].job;
    expect(await h.service.runJob(retest)).toMatchObject({ status: "evaluated", raised: 1 });

    const [alert] = await openAlerts();
    expect(alert).toMatchObject({ type: "score_drop", metric: "score", baselineValue: 80, currentValue: 60 });
    expect(alert.emailedAt).not.toBeNull();
    expect(h.emails).toHaveLength(1);
    expect(h.emails[0]).toMatchObject({ to: OWNER_EMAIL, subject: expect.stringContaining("score dropped from 80 to 60") });
    expect(h.emails[0].text).toContain(`https://vitalwatch.example/projects/${project.id}/urls/${url.id}`);
  });

  it("doesn't alert when the retest recovers", async () => {
    const { url } = await setup();
    const h = harness();
    await seedHistory(h, url.id);

    h.fetchPsi.mockResolvedValueOnce(psi(60)).mockResolvedValueOnce(psi(79));
    await h.service.runJob(job(url.id));
    expect(await h.service.runJob(h.published[0].job)).toMatchObject({ raised: 0 });
    expect(await openAlerts()).toEqual([]);
  });

  it("runs a retest only once per slot", async () => {
    const { url } = await setup();
    const h = harness();
    await seedHistory(h, url.id);
    h.fetchPsi.mockResolvedValue(psi(60));
    await h.service.runJob(job(url.id));
    await h.service.runJob(h.published[0].job);
    expect(await h.service.runJob(h.published[0].job)).toEqual({ status: "skipped", reason: "duplicate" });
  });

  it("alerts on a field vital at once, and doesn't repeat while it stays open", async () => {
    const { url } = await setup();
    const h = harness();
    await seedHistory(h, url.id);

    h.fetchPsi.mockResolvedValue(psi(80, 4500));
    expect(await h.service.runJob(job(url.id))).toMatchObject({ raised: 1, retestQueued: false });
    expect(await h.service.runJob(job(url.id))).toMatchObject({ raised: 0 });
    expect(await openAlerts()).toHaveLength(1);
    expect(h.emails).toHaveLength(1);
  });

  it("resolves the alert when the page recovers, and can alert again later", async () => {
    const { url } = await setup();
    const h = harness();
    await seedHistory(h, url.id);

    h.fetchPsi.mockResolvedValue(psi(80, 4500));
    await h.service.runJob(job(url.id));
    h.fetchPsi.mockResolvedValue(psi(80, 2000));
    await h.service.runJob(job(url.id));
    expect(await openAlerts()).toEqual([]);
    const [resolved] = await db.select().from(schema.alerts);
    expect(resolved.status).toBe("resolved");
    expect(resolved.resolvedAt).not.toBeNull();

    h.fetchPsi.mockResolvedValue(psi(80, 4500));
    expect(await h.service.runJob(job(url.id))).toMatchObject({ raised: 1 });
  });

  it("keeps mobile and desktop alerts apart", async () => {
    const { url } = await setup();
    const h = harness();
    await seedHistory(h, url.id);
    h.fetchPsi.mockImplementation(async () => psi(80));
    for (let i = 0; i < 6; i++) await h.service.runJob(job(url.id, { strategy: "desktop" }));

    h.fetchPsi.mockResolvedValue(psi(80, 4500));
    await h.service.runJob(job(url.id, { strategy: "mobile" }));
    await h.service.runJob(job(url.id, { strategy: "desktop" }));
    expect((await openAlerts()).map((a) => a.strategy).sort()).toEqual(["desktop", "mobile"]);
  });

  it("doesn't email when the project turned email off", async () => {
    const { url, project, projects } = await setup();
    await projects.updateMonitoring(owner, project.id, { schedule: "hourly", scoreDropThreshold: "10", emailAlerts: false });
    const h = harness();
    await seedHistory(h, url.id);
    h.fetchPsi.mockResolvedValue(psi(80, 4500));
    await h.service.runJob(job(url.id));
    expect(await openAlerts()).toHaveLength(1);
    expect(h.emails).toEqual([]);
  });

  it("doesn't email anyone but the owner address on a domain-less setup", async () => {
    const { url } = await setup();
    const h = harness({ ownerAddress: "someone-else@example.com" });
    await seedHistory(h, url.id);
    h.fetchPsi.mockResolvedValue(psi(80, 4500));
    await h.service.runJob(job(url.id));
    expect(await openAlerts()).toHaveLength(1);
    expect(h.emails).toEqual([]);
  });

  it("keeps the alert when the email fails", async () => {
    const { url } = await setup();
    const h = harness({ sendEmail: async () => { throw new Error("resend down"); } });
    await seedHistory(h, url.id);
    h.fetchPsi.mockResolvedValue(psi(80, 4500));
    expect(await h.service.runJob(job(url.id))).toMatchObject({ raised: 1 });
    const [alert] = await openAlerts();
    expect(alert.emailedAt).toBeNull();
  });

  it("doesn't count retests in later baselines", async () => {
    const { url } = await setup();
    const h = harness();
    await seedHistory(h, url.id, 5);
    h.fetchPsi.mockResolvedValue(psi(60));
    await h.service.runJob(job(url.id));
    await h.service.runJob(h.published[0].job);
    const rows = await db.select().from(schema.testRuns);
    expect(rows.filter((r) => r.trigger === "retest")).toHaveLength(1);
  });
});

describe("alerts feed", () => {
  it("lists, counts and marks alerts read, scoped to their owner", async () => {
    const { url } = await setup();
    const h = harness();
    await seedHistory(h, url.id);
    h.fetchPsi.mockResolvedValue(psi(80, 4500));
    await h.service.runJob(job(url.id));

    const stranger = await createUser(db, "stranger@example.com");
    expect(await h.alerts.list(stranger)).toEqual([]);
    expect(await h.alerts.countUnread(stranger)).toBe(0);
    await h.alerts.markAllRead(stranger);

    expect(await h.alerts.countUnread(owner)).toBe(1);
    expect((await h.alerts.list(owner))[0]).toMatchObject({ url: "https://shop.example.com/", projectName: "Shop" });
    await h.alerts.markAllRead(owner);
    expect(await h.alerts.countUnread(owner)).toBe(0);
  });
});

describe("monitoring settings", () => {
  it("validates the threshold and schedule", async () => {
    const { project, projects } = await setup("off");
    for (const scoreDropThreshold of ["0", "51", "2.5", "abc"]) {
      await expect(
        projects.updateMonitoring(owner, project.id, { schedule: "daily", scoreDropThreshold, emailAlerts: true }),
      ).rejects.toMatchObject({ status: 400 });
    }
    await expect(
      projects.updateMonitoring(owner, project.id, { schedule: "every-minute", scoreDropThreshold: "10", emailAlerts: true }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("refuses schedules over the daily test budget", async () => {
    const { project, projects } = await setup("off");
    await projects.addUrl(owner, project.id, "shop.example.com/a");
    await projects.addUrl(owner, project.id, "shop.example.com/b");
    await expect(
      projects.updateMonitoring(owner, project.id, { schedule: "hourly", scoreDropThreshold: "10", emailAlerts: true }),
    ).rejects.toThrow(/144 scheduled tests/);
  });

  it("refuses a new URL that would break the budget, but allows competitors", async () => {
    const { project, projects } = await setup("hourly");
    await projects.addUrl(owner, project.id, "shop.example.com/a");
    await expect(projects.addUrl(owner, project.id, "shop.example.com/b")).rejects.toThrow(/limit/);
    await expect(projects.addUrl(owner, project.id, "rival.example.com", "", "competitor")).resolves.toBeTruthy();
  });

  it("can't be changed by another user", async () => {
    const { project, projects } = await setup("off");
    const stranger = await createUser(db, "stranger@example.com");
    await expect(
      projects.updateMonitoring(stranger, project.id, { schedule: "daily", scoreDropThreshold: "10", emailAlerts: true }),
    ).rejects.toMatchObject({ code: "not_found" });
  });
});
