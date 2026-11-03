import { afterAll, beforeAll, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { Db } from "@/data/db";
import * as schema from "@/data/schema";
import type { LlmProvider } from "@/integrations/llm/provider";
import type { FetchedPage } from "@/integrations/site-fetcher";
import { createProjectService } from "@/services/project.service";
import { createRunService } from "@/services/run.service";
import { createSuggestionService } from "@/services/suggestion.service";
import { buildPsiResponse, withAudits } from "./fixtures/psi-response";
import { createTestDb, createUser } from "./helpers/test-db";

let db: Db;
let close: () => Promise<void>;
let owner: string;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterAll(() => close());
beforeEach(async () => {
  await db.delete(schema.users);
  owner = await createUser(db, "owner@example.com");
});

const allowed = async () => ({ allowed: true, limit: 30, remaining: 29, resetAt: 0 });

const goodOutput = {
  summary: "Render-blocking CSS delays the first paint.",
  fixes: [
    {
      title: "Inline critical CSS",
      priority: 1,
      impact: "high",
      difficulty: "medium",
      auditIds: ["render-blocking", "made-up"],
      why: "The browser waits for the stylesheet.",
      steps: ["Use next/font", "Split CSS"],
      code: { language: "tsx", snippet: "import { Inter } from 'next/font/google'" },
    },
  ],
};

function fakeProvider(output: unknown = goodOutput): LlmProvider & { calls: string[] } {
  const calls: string[] = [];
  return {
    name: "Fake",
    calls,
    async generateFixes(_system, prompt) {
      calls.push(prompt);
      return { output, model: "fake-model", inputTokens: 100, outputTokens: 50 };
    },
  };
}

async function setup(raw: unknown = withAudits({ "render-blocking": { title: "Eliminate render-blocking", score: 0, metricSavings: { LCP: 900 } } })) {
  const projects = createProjectService(db);
  const project = await projects.create(owner, "Shop");
  const url = await projects.addUrl(owner, project.id, "shop.example.com");
  const runs = createRunService({ db, fetchPsi: async () => raw, rateLimit: allowed });
  await runs.runManualTest(owner, url.id, "mobile");
  const [run] = await db.select().from(schema.testRuns);
  return { url, runId: run.id };
}

type PageFetcher = Mock<(url: string) => Promise<FetchedPage | null>>;

function service(provider: LlmProvider | null, options: { dailyLimit?: number; fetchPage?: PageFetcher } = {}) {
  const fetchPage =
    options.fetchPage ??
    vi.fn<(url: string) => Promise<FetchedPage | null>>(async () => ({ finalUrl: "https://shop.example.com/", headers: { "x-powered-by": "Next.js" }, html: "<div id=__NEXT_DATA__>" }));
  return {
    suggestions: createSuggestionService({ db, provider, fetchPage, dailyLimit: options.dailyLimit }),
    fetchPage,
  };
}

describe("suggestion service", () => {
  it("generates, validates and stores suggestions with the detected stack", async () => {
    const { runId } = await setup();
    const provider = fakeProvider();
    const { suggestions } = service(provider);

    const stored = await suggestions.generate(owner, runId);

    expect(stored.model).toBe("fake-model");
    expect(stored.stack.map((t) => t.name)).toEqual(["Next.js"]);
    expect(stored.suggestions.fixes[0].auditIds).toEqual(["render-blocking"]);
    expect(provider.calls[0]).toContain("render-blocking");
    expect(provider.calls[0]).toContain("Next.js");
  });

  it("returns the cached answer without calling the model again", async () => {
    const { runId } = await setup();
    const provider = fakeProvider();
    const { suggestions } = service(provider);
    await suggestions.generate(owner, runId);
    await suggestions.generate(owner, runId);
    expect(provider.calls).toHaveLength(1);
    expect(await suggestions.getForRun(owner, runId)).not.toBeNull();
  });

  it("reuses a recent stack detection instead of fetching the site again", async () => {
    const { runId, url } = await setup();
    const { suggestions, fetchPage } = service(fakeProvider());
    await suggestions.generate(owner, runId);

    const runs = createRunService({ db, fetchPsi: async () => withAudits({ "render-blocking": { title: "x", score: 0, metricSavings: { LCP: 500 } } }), rateLimit: allowed });
    await runs.runManualTest(owner, url.id, "desktop");
    const rows = await db.select().from(schema.testRuns);
    const second = rows.find((row) => row.id !== runId)!;
    await suggestions.generate(owner, second.id);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it("still works when the site can't be fetched", async () => {
    const { runId } = await setup();
    const { suggestions } = service(fakeProvider(), { fetchPage: vi.fn<(url: string) => Promise<FetchedPage | null>>(async () => null) });
    const stored = await suggestions.generate(owner, runId);
    expect(stored.stack).toEqual([]);
  });

  it("rejects output that doesn't match the schema, and stores nothing", async () => {
    const { runId } = await setup();
    const { suggestions } = service(fakeProvider({ summary: "x", fixes: "not a list" }));
    await expect(suggestions.generate(owner, runId)).rejects.toMatchObject({ code: "ai_unavailable" });
    expect(await suggestions.getForRun(owner, runId)).toBeNull();
  });

  it("enforces the daily limit, without counting cached answers", async () => {
    const { runId } = await setup();
    const { suggestions } = service(fakeProvider(), { dailyLimit: 1 });
    await suggestions.generate(owner, runId);
    await expect(suggestions.generate(owner, runId)).resolves.toBeTruthy();

    const projects = createProjectService(db);
    const [project] = await projects.list(owner);
    const other = await projects.addUrl(owner, project.id, "shop.example.com/other");
    const runs = createRunService({ db, fetchPsi: async () => withAudits({ "render-blocking": { title: "x", score: 0, metricSavings: { LCP: 500 } } }), rateLimit: allowed });
    await runs.runManualTest(owner, other.id, "mobile");
    const second = (await db.select().from(schema.testRuns)).find((row) => row.urlId === other.id)!;
    await expect(suggestions.generate(owner, second.id)).rejects.toMatchObject({ code: "rate_limited" });
  });

  it("says when AI isn't configured", async () => {
    const { runId } = await setup();
    const { suggestions } = service(null);
    expect(suggestions.isAvailable()).toBe(false);
    await expect(suggestions.generate(owner, runId)).rejects.toMatchObject({ code: "ai_not_configured" });
  });

  it("refuses another user's run", async () => {
    const { runId } = await setup();
    const stranger = await createUser(db, "stranger@example.com");
    const provider = fakeProvider();
    const { suggestions } = service(provider);
    await expect(suggestions.generate(stranger, runId)).rejects.toMatchObject({ code: "not_found" });
    await suggestions.generate(owner, runId);
    expect(await suggestions.getForRun(stranger, runId)).toBeNull();
    expect(provider.calls).toHaveLength(1);
  });

  it("refuses failed runs and malformed IDs", async () => {
    const { suggestions } = service(fakeProvider());
    await expect(suggestions.generate(owner, "not-a-uuid")).rejects.toMatchObject({ code: "not_found" });

    const projects = createProjectService(db);
    const project = await projects.create(owner, "Broken");
    const url = await projects.addUrl(owner, project.id, "broken.example.com");
    const runs = createRunService({ db, fetchPsi: async () => { throw new Error("down"); }, rateLimit: allowed });
    await expect(runs.runManualTest(owner, url.id, "mobile")).rejects.toThrow();
    const [failed] = await db.select().from(schema.testRuns);
    await expect(suggestions.generate(owner, failed.id)).rejects.toMatchObject({ status: 400 });
  });

  it("doesn't call the model when there's nothing to fix", async () => {
    const { runId } = await setup(buildPsiResponse());
    const provider = fakeProvider();
    const { suggestions } = service(provider);
    await expect(suggestions.generate(owner, runId)).rejects.toMatchObject({ status: 400 });
    expect(provider.calls).toEqual([]);
  });
});
