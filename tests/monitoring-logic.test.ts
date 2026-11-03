import { describe, expect, it } from "vitest";
import { alertDetail, alertTitle } from "@/domain/monitoring/alert-text";
import { checkScheduleQuota, dailyTests } from "@/domain/monitoring/quota";
import {
  confirmedByRetest,
  evaluateRun,
  median,
  MIN_BASELINE_RUNS,
  type Check,
} from "@/domain/monitoring/regression";
import { firstRunAt, nextRunAfter, runsPerDay } from "@/domain/monitoring/schedule";
import type { RunMetrics } from "@/domain/projects/types";

const HOUR = 60 * 60 * 1000;
const T0 = new Date(Date.UTC(2026, 9, 31, 23, 0));

describe("schedule", () => {
  it("moves to the next slot", () => {
    expect(nextRunAfter("hourly", T0, T0)).toEqual(new Date(T0.getTime() + HOUR));
    expect(nextRunAfter("daily", T0, T0)).toEqual(new Date(T0.getTime() + 24 * HOUR));
    expect(nextRunAfter("weekly", T0, T0)).toEqual(new Date(T0.getTime() + 7 * 24 * HOUR));
  });

  it("crosses month and year ends", () => {
    const newYearsEve = new Date(Date.UTC(2026, 11, 31, 23, 30));
    expect(nextRunAfter("daily", newYearsEve, newYearsEve)).toEqual(new Date(Date.UTC(2027, 0, 1, 23, 30)));
  });

  it("skips missed slots instead of running a backlog", () => {
    const now = new Date(T0.getTime() + 5.5 * HOUR);
    expect(nextRunAfter("hourly", T0, now)).toEqual(new Date(T0.getTime() + 6 * HOUR));
  });

  it("always returns a time after now", () => {
    const now = new Date(T0.getTime() + 3 * HOUR);
    expect(nextRunAfter("hourly", T0, now)!.getTime()).toBeGreaterThan(now.getTime());
  });

  it("returns nothing when off", () => {
    expect(nextRunAfter("off", T0, T0)).toBeNull();
    expect(firstRunAt("off", T0)).toBeNull();
  });

  it("starts a new schedule at the next tick", () => {
    expect(firstRunAt("daily", T0)).toEqual(T0);
  });

  it("counts runs per day", () => {
    expect(runsPerDay("hourly")).toBe(24);
    expect(runsPerDay("daily")).toBe(1);
    expect(runsPerDay("weekly")).toBeCloseTo(1 / 7);
    expect(runsPerDay("off")).toBe(0);
  });
});

describe("schedule quota", () => {
  it("counts both devices", () => {
    expect(dailyTests({ schedule: "hourly", urlCount: 2 })).toBe(96);
  });

  it("allows loads within the limit", () => {
    expect(checkScheduleQuota([{ schedule: "hourly", urlCount: 2 }])).toBeNull();
    expect(checkScheduleQuota([{ schedule: "daily", urlCount: 10 }, { schedule: "daily", urlCount: 10 }])).toBeNull();
  });

  it("rejects loads over the limit, across projects", () => {
    expect(checkScheduleQuota([{ schedule: "hourly", urlCount: 3 }])).toMatch(/144 scheduled tests/);
    expect(
      checkScheduleQuota([
        { schedule: "hourly", urlCount: 2 },
        { schedule: "daily", urlCount: 3 },
      ]),
    ).toMatch(/102/);
  });

  it("ignores projects that are off", () => {
    expect(checkScheduleQuota([{ schedule: "off", urlCount: 10 }])).toBeNull();
  });
});

function metrics(overrides: Partial<RunMetrics> = {}): RunMetrics {
  return {
    performanceScore: 80,
    labLcpMs: 2000,
    labFcpMs: 1200,
    labTbtMs: 200,
    labSiMs: 2500,
    labTtfbMs: 300,
    labCls: 0.05,
    fieldLcpMs: 2100,
    fieldInpMs: 150,
    fieldCls: 0.05,
    ...overrides,
  };
}

const settings = { scoreDropThreshold: 10, baselineSize: 10 };
const history = (count: number, overrides: Partial<RunMetrics> = {}) =>
  Array.from({ length: count }, () => metrics(overrides));

function check(evaluation: ReturnType<typeof evaluateRun>, metric: string): Check | undefined {
  return evaluation.status === "evaluated" ? evaluation.checks.find((c) => c.metric === metric) : undefined;
}

describe("evaluateRun", () => {
  it("waits for enough history before judging", () => {
    const result = evaluateRun(metrics({ performanceScore: 10 }), history(MIN_BASELINE_RUNS - 1), settings);
    expect(result).toEqual({ status: "building", runs: MIN_BASELINE_RUNS - 1 });
  });

  it("only uses the configured number of recent runs", () => {
    const old = history(20, { performanceScore: 30 });
    const recent = history(10, { performanceScore: 80 });
    const result = evaluateRun(metrics({ performanceScore: 75 }), [...recent, ...old], settings);
    expect(check(result, "score")).toMatchObject({ baseline: 80, breached: false });
  });

  it("flags a drop of more than the threshold, and asks for a retest", () => {
    const result = evaluateRun(metrics({ performanceScore: 69 }), history(10), settings);
    expect(check(result, "score")).toMatchObject({
      breached: true,
      needsConfirmation: true,
      baseline: 80,
      current: 69,
    });
  });

  it("doesn't flag a drop of exactly the threshold", () => {
    const result = evaluateRun(metrics({ performanceScore: 70 }), history(10), settings);
    expect(check(result, "score")?.breached).toBe(false);
  });

  it("ignores one outlier in the history thanks to the median", () => {
    const runs = [...history(9), metrics({ performanceScore: 5 })];
    const result = evaluateRun(metrics({ performanceScore: 75 }), runs, settings);
    expect(check(result, "score")).toMatchObject({ baseline: 80, breached: false });
  });

  it("flags a field vital crossing into poor without a retest", () => {
    const result = evaluateRun(metrics({ fieldLcpMs: 4200 }), history(10), settings);
    expect(check(result, "lcp")).toMatchObject({
      source: "field",
      breached: true,
      needsConfirmation: false,
    });
  });

  it("doesn't flag a vital that was already poor", () => {
    const result = evaluateRun(metrics({ fieldLcpMs: 4500 }), history(10, { fieldLcpMs: 4300 }), settings);
    expect(check(result, "lcp")?.breached).toBe(false);
  });

  it("doesn't flag 'needs improvement'", () => {
    const result = evaluateRun(metrics({ fieldInpMs: 450 }), history(10), settings);
    expect(check(result, "inp")?.breached).toBe(false);
  });

  it("treats a value at the poor boundary as not poor", () => {
    const result = evaluateRun(metrics({ fieldCls: 0.25 }), history(10), settings);
    expect(check(result, "cls")?.breached).toBe(false);
  });

  it("falls back to lab LCP and CLS without field data, with a retest", () => {
    const noField = { fieldLcpMs: null, fieldInpMs: null, fieldCls: null };
    const result = evaluateRun(metrics({ ...noField, labCls: 0.4 }), history(10, noField), settings);
    expect(check(result, "cls")).toMatchObject({ source: "lab", breached: true, needsConfirmation: true });
  });

  it("never estimates INP from lab data", () => {
    const noField = { fieldLcpMs: null, fieldInpMs: null, fieldCls: null };
    const result = evaluateRun(metrics(noField), history(10, noField), settings);
    expect(check(result, "inp")).toBeUndefined();
  });

  it("skips a vital whose history has too few values", () => {
    const sparse = [...history(4), ...history(6, { fieldInpMs: null })];
    const result = evaluateRun(metrics({ fieldInpMs: 900 }), sparse, settings);
    expect(check(result, "inp")).toBeUndefined();
  });

  it("doesn't compare field numbers with a lab baseline", () => {
    const labOnlyHistory = history(10, { fieldLcpMs: null });
    const result = evaluateRun(metrics({ fieldLcpMs: 4200 }), labOnlyHistory, settings);
    expect(check(result, "lcp")).toBeUndefined();
  });

  it("respects a custom threshold", () => {
    const result = evaluateRun(metrics({ performanceScore: 76 }), history(10), { ...settings, scoreDropThreshold: 3 });
    expect(check(result, "score")?.breached).toBe(true);
  });
});

describe("confirmedByRetest", () => {
  const breach = evaluateRun(metrics({ performanceScore: 60 }), history(10), settings);

  it("confirms when the retest also breaches", () => {
    const retest = evaluateRun(metrics({ performanceScore: 62 }), history(10), settings);
    expect(confirmedByRetest(breach, retest).map((c) => c.metric)).toEqual(["score"]);
  });

  it("drops a one-off blip", () => {
    const retest = evaluateRun(metrics({ performanceScore: 79 }), history(10), settings);
    expect(confirmedByRetest(breach, retest)).toEqual([]);
  });

  it("doesn't alert on a problem only the retest shows", () => {
    const clean = evaluateRun(metrics(), history(10), settings);
    const retest = evaluateRun(metrics({ performanceScore: 50 }), history(10), settings);
    expect(confirmedByRetest(clean, retest)).toEqual([]);
  });

  it("never re-confirms field checks, which alert straight away", () => {
    const original = evaluateRun(metrics({ fieldLcpMs: 4200 }), history(10), settings);
    const retest = evaluateRun(metrics({ fieldLcpMs: 4200 }), history(10), settings);
    expect(confirmedByRetest(original, retest)).toEqual([]);
  });
});

describe("median", () => {
  it("handles odd and even lengths", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});

describe("alert text", () => {
  const base = { strategy: "mobile" as const, source: "lab" as const };

  it("describes a score drop", () => {
    const alert = { ...base, type: "score_drop" as const, metric: "score" as const, baselineValue: 82, currentValue: 61.4, threshold: 10 };
    expect(alertTitle(alert)).toBe("Mobile score dropped from 82 to 61");
    expect(alertDetail(alert)).toContain("more than 10 points");
  });

  it("describes a poor vital with its source", () => {
    const alert = {
      ...base,
      source: "field" as const,
      strategy: "desktop" as const,
      type: "vital_poor" as const,
      metric: "lcp" as const,
      baselineValue: 2100,
      currentValue: 4300,
      threshold: 4000,
    };
    expect(alertTitle(alert)).toBe("Desktop real-user LCP is now poor: 4.3 s");
    expect(alertDetail(alert)).toBe("It's usually 2.1 s. Google rates anything over 4.0 s as poor.");
  });

  it("mentions the retest for lab vitals", () => {
    const alert = { ...base, type: "vital_poor" as const, metric: "cls" as const, baselineValue: 0.05, currentValue: 0.3, threshold: 0.25 };
    expect(alertDetail(alert)).toContain("A second test confirmed it.");
  });
});
