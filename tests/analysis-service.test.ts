import { beforeEach, describe, expect, it, vi } from "vitest";
import { parsePsiResponse } from "@/domain/psi/parse";
import type { AnalysisResult, Strategy } from "@/domain/psi/types";
import type { AnalysisCache } from "@/integrations/analysis-cache";
import { AppError } from "@/lib/errors";
import { createAnalysisService } from "@/services/analysis.service";
import { buildPsiResponse } from "./fixtures/psi-response";

const NORMALIZED = "https://example.com/page";
const input = { url: "example.com/page/#top", strategy: "mobile" as Strategy, clientId: "1.1.1.1" };

function memoryCache() {
  const store = new Map<string, AnalysisResult>();
  const key = (url: string, strategy: Strategy) => `${strategy}:${url}`;
  const cache: AnalysisCache = {
    get: async (url, strategy) => store.get(key(url, strategy)) ?? null,
    set: async (url, strategy, result) => void store.set(key(url, strategy), result),
  };
  return { cache, store };
}

const allowed = { allowed: true, limit: 10, remaining: 9, resetAt: 0 };

describe("analysis service", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("calls PSI with the normalized URL and caches the result", async () => {
    const fetchPsi = vi.fn(async () => buildPsiResponse());
    const { cache, store } = memoryCache();
    const service = createAnalysisService({ fetchPsi, cache, rateLimit: async () => allowed });

    const outcome = await service.analyze(input);

    expect(fetchPsi).toHaveBeenCalledWith(NORMALIZED, "mobile");
    expect(outcome.cached).toBe(false);
    expect(store.size).toBe(1);
  });

  it("serves a repeat request from the cache without calling PSI", async () => {
    const fetchPsi = vi.fn(async () => buildPsiResponse());
    const { cache } = memoryCache();
    const service = createAnalysisService({ fetchPsi, cache, rateLimit: async () => allowed });

    await service.analyze(input);
    const second = await service.analyze({ ...input, url: "https://example.com/page" });

    expect(fetchPsi).toHaveBeenCalledTimes(1);
    expect(second.cached).toBe(true);
  });

  it("caches mobile and desktop separately", async () => {
    const fetchPsi = vi.fn(async () => buildPsiResponse());
    const { cache } = memoryCache();
    const service = createAnalysisService({ fetchPsi, cache, rateLimit: async () => allowed });

    await service.analyze(input);
    await service.analyze({ ...input, strategy: "desktop" });

    expect(fetchPsi).toHaveBeenCalledTimes(2);
  });

  it("rejects invalid URLs before spending any quota", async () => {
    const fetchPsi = vi.fn();
    const rateLimit = vi.fn(async () => allowed);
    const service = createAnalysisService({ fetchPsi, cache: memoryCache().cache, rateLimit });

    await expect(service.analyze({ ...input, url: "http://127.0.0.1" })).rejects.toMatchObject({
      code: "invalid_url",
      status: 400,
    });
    expect(fetchPsi).not.toHaveBeenCalled();
    expect(rateLimit).not.toHaveBeenCalled();
  });

  it("blocks over-limit clients, with the wait time", async () => {
    const fetchPsi = vi.fn();
    const service = createAnalysisService({
      fetchPsi,
      cache: memoryCache().cache,
      rateLimit: async () => ({ allowed: false, limit: 10, remaining: 0, resetAt: 31_000 }),
      now: () => 1_000,
    });

    await expect(service.analyze(input)).rejects.toMatchObject({
      code: "rate_limited",
      status: 429,
      retryAfterSeconds: 30,
    });
    expect(fetchPsi).not.toHaveBeenCalled();
  });

  it("limits by client, passing the right identifier", async () => {
    const rateLimit = vi.fn(async () => allowed);
    const service = createAnalysisService({
      fetchPsi: async () => buildPsiResponse(),
      cache: memoryCache().cache,
      rateLimit,
    });
    await service.analyze(input);
    expect(rateLimit).toHaveBeenCalledWith("1.1.1.1");
  });

  it("doesn't cache failures", async () => {
    const fetchPsi = vi
      .fn<() => Promise<unknown>>()
      .mockRejectedValueOnce(new AppError("psi_unavailable", "down", { status: 502 }))
      .mockResolvedValue(buildPsiResponse());
    const { cache, store } = memoryCache();
    const service = createAnalysisService({ fetchPsi, cache, rateLimit: async () => allowed });

    await expect(service.analyze(input)).rejects.toThrow("down");
    expect(store.size).toBe(0);
    await expect(service.analyze(input)).resolves.toMatchObject({ cached: false });
  });

  it("doesn't cache unusable Lighthouse runs", async () => {
    const { cache, store } = memoryCache();
    const service = createAnalysisService({
      fetchPsi: async () => buildPsiResponse({ runtimeError: { code: "NO_FCP" } }),
      cache,
      rateLimit: async () => allowed,
    });
    await expect(service.analyze(input)).rejects.toMatchObject({ code: "site_unreachable" });
    expect(store.size).toBe(0);
  });

  it("keeps working when Redis is down", async () => {
    const down = async () => {
      throw new Error("redis down");
    };
    const service = createAnalysisService({
      fetchPsi: async () => buildPsiResponse(),
      cache: { get: down, set: down },
      rateLimit: down,
    });

    const outcome = await service.analyze(input);

    expect(outcome.result.score).toBe(73);
    expect(outcome.rateLimit).toBeNull();
  });

  it("returns cached results unchanged", async () => {
    const { cache } = memoryCache();
    const stored = parsePsiResponse(buildPsiResponse(), "mobile", NORMALIZED);
    await cache.set(NORMALIZED, "mobile", stored);
    const service = createAnalysisService({
      fetchPsi: vi.fn(),
      cache,
      rateLimit: async () => allowed,
    });
    await expect(service.analyze(input)).resolves.toMatchObject({ result: stored, cached: true });
  });
});
