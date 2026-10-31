import { describe, expect, it, vi } from "vitest";
import { getClientIp } from "@/lib/client-ip";
import { missingProductionEnv, readEnv } from "@/lib/env";
import { withRetry } from "@/lib/retry";

describe("withRetry", () => {
  const options = {
    retries: 2,
    baseDelayMs: 100,
    shouldRetry: () => true,
    random: () => 1,
  };

  it("returns the first success without waiting", async () => {
    const sleep = vi.fn(async () => {});
    await expect(withRetry(async () => "ok", { ...options, sleep })).resolves.toBe("ok");
    expect(sleep).not.toHaveBeenCalled();
  });

  it("backs off exponentially, then succeeds", async () => {
    const sleep = vi.fn<(ms: number) => Promise<void>>(async () => {});
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("1"))
      .mockRejectedValueOnce(new Error("2"))
      .mockResolvedValue("ok");

    await expect(withRetry(operation, { ...options, sleep })).resolves.toBe("ok");
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([100, 200]);
  });

  it("gives up after the retry limit with the last error", async () => {
    const operation = vi.fn(async () => {
      throw new Error("down");
    });
    await expect(
      withRetry(operation, { ...options, sleep: async () => {} }),
    ).rejects.toThrow("down");
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it("does not retry errors marked as permanent", async () => {
    const operation = vi.fn(async () => {
      throw new Error("bad input");
    });
    await expect(
      withRetry(operation, { ...options, shouldRetry: () => false }),
    ).rejects.toThrow("bad input");
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("applies jitter of up to half the delay", async () => {
    const sleep = vi.fn<(ms: number) => Promise<void>>(async () => {});
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("1"))
      .mockResolvedValue("ok");
    await withRetry(operation, { ...options, sleep, random: () => 0 });
    expect(sleep).toHaveBeenCalledWith(50);
  });
});

describe("getClientIp", () => {
  const headers = (values: Record<string, string>) => new Headers(values);

  it("ignores forged headers outside Vercel", () => {
    expect(getClientIp(headers({ "x-forwarded-for": "1.2.3.4" }), false)).toBe("unknown");
  });

  it("ignores headers Vercel doesn't set", () => {
    expect(
      getClientIp(headers({ "cf-connecting-ip": "6.6.6.6", "x-forwarded-for": "1.2.3.4" }), true),
    ).toBe("1.2.3.4");
  });

  it("prefers Vercel's own header and takes the first entry", () => {
    expect(
      getClientIp(
        headers({ "x-vercel-forwarded-for": "5.5.5.5, 9.9.9.9", "x-forwarded-for": "1.2.3.4" }),
        true,
      ),
    ).toBe("5.5.5.5");
  });

  it("uses the shared bucket when no header exists", () => {
    expect(getClientIp(headers({}), true)).toBe("unknown");
  });
});

describe("env", () => {
  it("treats empty values as unset", () => {
    expect(readEnv({ PAGESPEED_API_KEY: "" }).PAGESPEED_API_KEY).toBeUndefined();
  });

  it("reports what production is missing", () => {
    expect(missingProductionEnv(readEnv({ PAGESPEED_API_KEY: "k" }))).toEqual([
      "UPSTASH_REDIS_REST_URL",
      "UPSTASH_REDIS_REST_TOKEN",
      "DATABASE_URL",
      "AUTH_SECRET",
      "AUTH_GITHUB_ID",
      "AUTH_GITHUB_SECRET",
    ]);
  });

  it("rejects a malformed URL", () => {
    expect(() => readEnv({ UPSTASH_REDIS_REST_URL: "not a url" })).toThrow();
  });
});
