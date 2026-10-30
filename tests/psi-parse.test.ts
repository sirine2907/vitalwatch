import { describe, expect, it } from "vitest";
import { classifyPsiError } from "@/domain/psi/classify-error";
import { parsePsiResponse, rankOpportunities } from "@/domain/psi/parse";
import { rateScore, rateVital, formatVital } from "@/domain/vitals/thresholds";
import { AppError } from "@/lib/errors";
import { buildPsiResponse, REAL_DAILY_QUOTA_BODY, withAudits } from "./fixtures/psi-response";

const URL = "https://example.com/";
const parse = (raw: unknown) => parsePsiResponse(raw, "mobile", URL);

function errorCode(action: () => unknown): string | undefined {
  try {
    action();
  } catch (error) {
    return error instanceof AppError ? error.code : "unexpected";
  }
  return undefined;
}

describe("parsePsiResponse", () => {
  it("reads the score and lab metrics", () => {
    const result = parse(buildPsiResponse());
    expect(result.score).toBe(73);
    expect(result.finalUrl).toBe("https://www.example.com/");
    expect(result.lab.lcp).toBe(3200.4);
    expect(result.lab.cls).toBe(0.04);
  });

  it("converts the CrUX CLS percentile to the real value", () => {
    expect(parse(buildPsiResponse()).field.vitals.cls?.value).toBe(0.05);
  });

  it("reads the field distribution", () => {
    expect(parse(buildPsiResponse()).field.vitals.lcp?.distribution).toEqual({
      good: 0.8,
      needsImprovement: 0.15,
      poor: 0.05,
    });
  });

  it("labels page-level field data as url scope", () => {
    expect(parse(buildPsiResponse()).field.scope).toBe("url");
  });

  it("labels origin_fallback data as origin scope", () => {
    const response = buildPsiResponse();
    response.loadingExperience.origin_fallback = true;
    expect(parse(response).field.scope).toBe("origin");
  });

  it("falls back to originLoadingExperience when the page has no data", () => {
    const base = buildPsiResponse();
    const result = parse({
      ...base,
      loadingExperience: { id: URL },
      originLoadingExperience: base.loadingExperience,
    });
    expect(result.field.scope).toBe("origin");
    expect(result.field.vitals.lcp?.value).toBe(2100);
  });

  it("reports no field data without inventing zeros", () => {
    const result = parse({ ...buildPsiResponse(), loadingExperience: undefined });
    expect(result.field.scope).toBe("none");
    expect(result.field.assessment).toBe("insufficient");
    expect(result.field.vitals).toEqual({ lcp: null, inp: null, cls: null });
  });

  it("rejects a run with a Lighthouse runtime error", () => {
    const raw = buildPsiResponse({ runtimeError: { code: "NO_FCP", message: "no paint" } });
    expect(errorCode(() => parse(raw))).toBe("site_unreachable");
  });

  it("accepts the NO_ERROR runtime code", () => {
    const raw = buildPsiResponse({ runtimeError: { code: "NO_ERROR" } });
    expect(parse(raw).score).toBe(73);
  });

  it("rejects a null score instead of treating it as zero", () => {
    const raw = buildPsiResponse({ categories: { performance: { score: null } } });
    expect(errorCode(() => parse(raw))).toBe("site_unreachable");
  });

  it("rejects responses of the wrong shape", () => {
    expect(errorCode(() => parse({ nope: true }))).toBe("psi_bad_response");
    expect(errorCode(() => parse(null))).toBe("psi_bad_response");
  });

  it("keeps a score of zero", () => {
    const raw = buildPsiResponse({ categories: { performance: { score: 0 } } });
    expect(parse(raw).score).toBe(0);
  });

  it("keeps only text warnings", () => {
    const raw = buildPsiResponse({ runWarnings: ["slow host", { odd: true }] });
    expect(parse(raw).warnings).toEqual(["slow host"]);
  });
});

describe("Core Web Vitals assessment", () => {
  function withVitals(values: { lcp?: number; inp?: number; cls?: number }) {
    const response = buildPsiResponse();
    const metrics = response.loadingExperience.metrics as Record<string, { percentile: number }>;
    const keys = {
      lcp: "LARGEST_CONTENTFUL_PAINT_MS",
      inp: "INTERACTION_TO_NEXT_PAINT",
      cls: "CUMULATIVE_LAYOUT_SHIFT_SCORE",
    };
    for (const [name, key] of Object.entries(keys)) {
      const value = values[name as keyof typeof values];
      if (value === undefined) delete metrics[key];
      else metrics[key].percentile = value;
    }
    return parse(response).field.assessment;
  }

  it("passes when all three are good", () => {
    expect(withVitals({ lcp: 2000, inp: 100, cls: 5 })).toBe("passed");
  });

  it("fails when any one is not good", () => {
    expect(withVitals({ lcp: 2600, inp: 100, cls: 5 })).toBe("failed");
    expect(withVitals({ lcp: 2000, inp: 201, cls: 5 })).toBe("failed");
    expect(withVitals({ lcp: 2000, inp: 100, cls: 11 })).toBe("failed");
  });

  it("still passes without INP data", () => {
    expect(withVitals({ lcp: 2000, cls: 5 })).toBe("passed");
  });

  it("is insufficient without LCP or CLS, unless something already fails", () => {
    expect(withVitals({ inp: 100, cls: 5 })).toBe("insufficient");
    expect(withVitals({ inp: 900, cls: 5 })).toBe("failed");
  });
});

describe("rankOpportunities", () => {
  const audit = (values: Record<string, unknown>) => ({ title: "Audit", score: 0.3, ...values });
  const rank = (audits: Record<string, ReturnType<typeof audit>>) =>
    rankOpportunities(audits as never);

  it("sorts by time saved, largest first", () => {
    const ids = rank({
      small: audit({ metricSavings: { LCP: 100 } }),
      large: audit({ metricSavings: { LCP: 900 } }),
      middle: audit({ details: { overallSavingsMs: 400 } }),
    }).map((item) => item.id);
    expect(ids).toEqual(["large", "middle", "small"]);
  });

  it("uses the largest of the time-based savings", () => {
    const [item] = rank({ a: audit({ metricSavings: { LCP: 100, TBT: 700, FCP: 50 } }) });
    expect(item.savingsMs).toBe(700);
  });

  it("ignores unitless layout shift savings", () => {
    expect(rank({ a: audit({ metricSavings: { CLS: 0.2 } }) })).toEqual([]);
  });

  it("skips passed audits", () => {
    expect(rank({ a: audit({ score: 0.95, metricSavings: { LCP: 500 } }) })).toEqual([]);
  });

  it("skips audits that don't apply or errored", () => {
    for (const scoreDisplayMode of ["notApplicable", "manual", "error"]) {
      expect(rank({ a: audit({ scoreDisplayMode, metricSavings: { LCP: 500 } }) })).toEqual([]);
    }
  });

  it("skips audits with no saving", () => {
    expect(rank({ a: audit({}) })).toEqual([]);
  });

  it("keeps unscored audits that report savings", () => {
    expect(rank({ a: audit({ score: null, metricSavings: { LCP: 500 } }) })).toHaveLength(1);
  });

  it("works through the full parser", () => {
    const result = parse(
      withAudits({ "render-blocking": audit({ metricSavings: { LCP: 640.6 } }) }),
    );
    expect(result.opportunities[0]).toMatchObject({ id: "render-blocking", savingsMs: 641 });
  });
});

describe("classifyPsiError", () => {
  it("doesn't retry a real daily quota error", () => {
    const error = classifyPsiError(429, REAL_DAILY_QUOTA_BODY);
    expect(error.code).toBe("psi_quota");
    expect(error.retryable).toBe(false);
  });

  it("retries a short-term 429", () => {
    const error = classifyPsiError(429, '{"error":{"message":"Queries per minute"}}');
    expect(error.code).toBe("psi_busy");
    expect(error.retryable).toBe(true);
  });

  it("retries 5xx responses", () => {
    expect(classifyPsiError(503, "upstream").retryable).toBe(true);
  });

  it("treats a Lighthouse failure as the site's problem, even on a 500", () => {
    const error = classifyPsiError(
      500,
      "Lighthouse returned error: FAILED_DOCUMENT_REQUEST. Lighthouse was unable to reliably load the page.",
    );
    expect(error.code).toBe("site_unreachable");
    expect(error.retryable).toBe(false);
  });

  it("flags a rejected API key without retrying", () => {
    const error = classifyPsiError(403, "API key not valid");
    expect(error.code).toBe("not_configured");
    expect(error.retryable).toBe(false);
  });

  it("recognizes the real 400 Google sends for a bad key", () => {
    const error = classifyPsiError(
      400,
      '{"error":{"code":400,"message":"API key not valid. Please pass a valid API key.","details":[{"reason":"API_KEY_INVALID"}]}}',
    );
    expect(error.code).toBe("not_configured");
  });

  it("never exposes the upstream body", () => {
    expect(classifyPsiError(500, "secret-key-abc").message).not.toContain("secret-key-abc");
  });
});

describe("thresholds", () => {
  it.each([
    ["lcp", 2500, "good"],
    ["lcp", 2501, "needs-improvement"],
    ["lcp", 4000, "needs-improvement"],
    ["lcp", 4001, "poor"],
    ["inp", 200, "good"],
    ["inp", 501, "poor"],
    ["cls", 0.1, "good"],
    ["cls", 0.25, "needs-improvement"],
    ["cls", 0.26, "poor"],
  ] as const)("%s at %d is %s", (name, value, rating) => {
    expect(rateVital(name, value)).toBe(rating);
  });

  it("uses Lighthouse's score bands", () => {
    expect(rateScore(90)).toBe("good");
    expect(rateScore(89)).toBe("needs-improvement");
    expect(rateScore(50)).toBe("needs-improvement");
    expect(rateScore(49)).toBe("poor");
  });

  it("formats values", () => {
    expect(formatVital("lcp", 2100)).toBe("2.1 s");
    expect(formatVital("inp", 150)).toBe("150 ms");
    expect(formatVital("cls", 0.05)).toBe("0.05");
  });
});
