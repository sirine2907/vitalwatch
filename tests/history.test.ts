import { describe, expect, it } from "vitest";
import {
  buildTrendSeries,
  parseMetric,
  parseRange,
  TREND_METRICS,
} from "@/domain/history/trend";
import type { RunRecord } from "@/domain/projects/types";
import { parsePsiResponse } from "@/domain/psi/parse";
import { trimPsiResponse } from "@/domain/psi/trim";
import type { Strategy } from "@/domain/psi/types";
import { buildPsiResponse, withAudits } from "./fixtures/psi-response";

const START = Date.UTC(2026, 9, 1);
const HOUR = 60 * 60 * 1000;
let nextId = 0;

function run(
  strategy: Strategy,
  hour: number,
  score: number | null,
  overrides: Partial<RunRecord> = {},
): RunRecord {
  return {
    id: String(nextId++),
    urlId: "u",
    strategy,
    status: score === null ? "failed" : "success",
    trigger: "manual",
    fieldScope: "url",
    error: null,
    createdAt: new Date(START + hour * HOUR),
    performanceScore: score,
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
  };
}

const series = (runs: RunRecord[]) => buildTrendSeries(runs, "performanceScore", 30);

describe("buildTrendSeries", () => {
  it("returns nothing for no runs", () => {
    expect(series([])).toMatchObject({ rows: [], failedRuns: 0, bucketHours: null });
  });

  it("puts mobile and desktop from the same round on one row", () => {
    const { rows } = series([
      run("mobile", 0, 50),
      run("desktop", 0, 90, { createdAt: new Date(START + 60_000) }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ mobile: 50, desktop: 90 });
  });

  it("keeps separate rounds on separate rows, oldest first", () => {
    const { rows } = series([run("mobile", 5, 60), run("mobile", 1, 40)]);
    expect(rows.map((row) => row.mobile)).toEqual([40, 60]);
  });

  it("keeps one line through consecutive successful runs", () => {
    const { segments, rows } = series([
      run("mobile", 0, 50),
      run("mobile", 1, 55),
      run("mobile", 2, 60),
    ]);
    expect(segments.mobile).toEqual(["mobile_0"]);
    expect(rows.every((row) => typeof row.mobile_0 === "number")).toBe(true);
  });

  it("breaks the line at a failed run instead of plotting zero", () => {
    const { rows, segments, failedRuns } = series([
      run("mobile", 0, 50),
      run("mobile", 1, null),
      run("mobile", 2, 60),
    ]);
    expect(segments.mobile).toEqual(["mobile_0", "mobile_1"]);
    expect(rows[1].mobile).toBeNull();
    expect(rows[1].mobile_0).toBeUndefined();
    expect(rows[2].mobile_1).toBe(60);
    expect(failedRuns).toBe(1);
  });

  it("a failure in one strategy doesn't break the other", () => {
    const { segments } = series([
      run("mobile", 0, 50),
      run("desktop", 0, 80),
      run("mobile", 1, null),
      run("desktop", 1, 85),
      run("mobile", 2, 60),
      run("desktop", 2, 90),
    ]);
    expect(segments.desktop).toEqual(["desktop_0"]);
    expect(segments.mobile).toHaveLength(2);
  });

  it("doesn't break a line when the other strategy simply wasn't tested", () => {
    const { segments } = series([
      run("mobile", 0, 50),
      run("desktop", 1, 80),
      run("mobile", 2, 60),
    ]);
    expect(segments.mobile).toEqual(["mobile_0"]);
  });

  it("treats a successful run missing this metric as a gap", () => {
    const { rows, segments } = buildTrendSeries(
      [
        run("mobile", 0, 50, { fieldInpMs: 180 }),
        run("mobile", 1, 50, { fieldInpMs: null }),
        run("mobile", 2, 50, { fieldInpMs: 200 }),
      ],
      "fieldInpMs",
      30,
    );
    expect(rows[1].mobile).toBeNull();
    expect(segments.mobile).toHaveLength(2);
  });

  it("keeps a real value of zero", () => {
    const { rows } = series([run("mobile", 0, 0)]);
    expect(rows[0].mobile).toBe(0);
  });

  it("ignores runs still in progress", () => {
    const { rows } = series([run("mobile", 0, null, { status: "pending" })]);
    expect(rows).toEqual([]);
  });

  it("uses the median when runs share a round", () => {
    const { rows } = series([
      run("mobile", 0, 10),
      run("mobile", 0, 80),
      run("mobile", 0, 90),
    ]);
    expect(rows[0].mobile).toBe(80);
  });

  it("doesn't count a failure as a gap if the round also succeeded", () => {
    const { segments, rows } = series([
      run("mobile", 0, 50),
      run("mobile", 1, 60),
      run("mobile", 1, null),
      run("mobile", 2, 70),
    ]);
    expect(rows[1].mobile).toBe(60);
    expect(segments.mobile).toEqual(["mobile_0"]);
  });

  it("combines very large histories into fewer points", () => {
    const runs = Array.from({ length: 2000 }, (_, hour) => run("mobile", hour, 50 + (hour % 10)));
    const result = buildTrendSeries(runs, "performanceScore", 90);
    expect(result.rows.length).toBeLessThanOrEqual(151);
    expect(result.bucketHours).toBeCloseTo(14.4);
  });

  it("doesn't combine small histories", () => {
    expect(series([run("mobile", 0, 50)]).bucketHours).toBeNull();
  });
});

describe("chart options from the URL", () => {
  it("accepts valid ranges and falls back to 30 days", () => {
    expect(parseRange("7")).toBe(7);
    expect(parseRange("90")).toBe(90);
    expect(parseRange("365")).toBe(30);
    expect(parseRange(undefined)).toBe(30);
  });

  it("accepts known metrics and falls back to the score", () => {
    expect(parseMetric("fieldLcpMs")).toBe("fieldLcpMs");
    expect(parseMetric("constructor")).toBe("performanceScore");
    expect(parseMetric(["fieldLcpMs"])).toBe("performanceScore");
  });

  it("uses published thresholds", () => {
    expect(TREND_METRICS.fieldInpMs.thresholds).toEqual({ good: 200, poor: 500 });
    expect(TREND_METRICS.performanceScore.thresholds).toEqual({ good: 90, poor: 50 });
  });
});

describe("trimPsiResponse", () => {
  const heavy = () =>
    withAudits({
      "final-screenshot": { title: "x", details: { data: "data:image/jpeg;base64,AAAA" } },
      "network-requests": { title: "x", details: { items: [{ url: "a" }] } },
      "unused-javascript": {
        title: "Unused JS",
        score: 0.2,
        metricSavings: { TBT: 300 },
        details: { items: Array.from({ length: 40 }, (_, i) => ({ url: `https://x/${i}.js` })) },
      },
      "lcp-element": {
        title: "LCP element",
        details: { nodes: [{ screenshot: "data:image/png;base64,BBBB", selector: "img" }] },
      },
    });

  it("gives the same parsed result as the full response", () => {
    const raw = heavy();
    expect(parsePsiResponse(trimPsiResponse(raw), "mobile", "https://example.com/")).toEqual(
      parsePsiResponse(raw, "mobile", "https://example.com/"),
    );
  });

  it("removes screenshots, wherever they are", () => {
    expect(JSON.stringify(trimPsiResponse(heavy()))).not.toContain("data:image");
  });

  it("removes dropped audits and result sections", () => {
    const raw = buildPsiResponse({ i18n: { rendererFormattedStrings: {} }, entities: [{}] });
    const trimmed = trimPsiResponse(raw) as typeof raw;
    expect(trimmed.lighthouseResult).not.toHaveProperty("i18n");
    expect(trimmed.lighthouseResult).not.toHaveProperty("entities");
    const audits = (trimPsiResponse(heavy()) as typeof raw).lighthouseResult.audits;
    expect(audits).not.toHaveProperty("network-requests");
    expect(audits).not.toHaveProperty("final-screenshot");
  });

  it("caps long audit item lists", () => {
    const audits = (trimPsiResponse(heavy()) as ReturnType<typeof heavy>).lighthouseResult
      .audits as unknown as Record<string, { details: { items: unknown[] } }>;
    expect(audits["unused-javascript"].details.items).toHaveLength(10);
  });

  it("keeps stack packs for later, without their icons", () => {
    const raw = buildPsiResponse({
      stackPacks: [{ id: "wordpress", title: "WordPress", iconDataURL: "data:image/svg+xml,x" }],
    });
    const trimmed = JSON.stringify(trimPsiResponse(raw));
    expect(trimmed).toContain("wordpress");
    expect(trimmed).not.toContain("iconDataURL");
  });

  it("doesn't touch the original", () => {
    const raw = heavy();
    const before = JSON.stringify(raw);
    trimPsiResponse(raw);
    expect(JSON.stringify(raw)).toBe(before);
  });

  it("returns unexpected input unchanged", () => {
    expect(trimPsiResponse(null)).toBeNull();
    expect(trimPsiResponse({ other: 1 })).toEqual({ other: 1 });
  });
});
