import type { RunMetrics } from "@/domain/projects/types";
import { rateVital, type VitalName } from "@/domain/vitals/thresholds";

export const MIN_BASELINE_RUNS = 5;

export type AlertType = "score_drop" | "vital_poor";
export type AlertMetric = "score" | VitalName;
export type AlertSource = "lab" | "field";

export interface MonitoringSettings {
  scoreDropThreshold: number;
  baselineSize: number;
}

/** One rule applied to one run. `breached` says whether the problem is present now. */
export interface Check {
  type: AlertType;
  metric: AlertMetric;
  source: AlertSource;
  baseline: number;
  current: number;
  threshold: number;
  breached: boolean;
  /** Lab numbers are noisy, so a lab breach is retested before anyone is alerted. */
  needsConfirmation: boolean;
}

export type Evaluation = { status: "building"; runs: number } | { status: "evaluated"; checks: Check[] };

type MetricKey = keyof RunMetrics;

const VITAL_SOURCES: Record<VitalName, { field: MetricKey; lab: MetricKey | null }> = {
  lcp: { field: "fieldLcpMs", lab: "labLcpMs" },
  // INP needs real interactions, so it has no lab equivalent and is never estimated.
  inp: { field: "fieldInpMs", lab: null },
  cls: { field: "fieldCls", lab: "labCls" },
};

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function baselineOf(history: RunMetrics[], key: MetricKey): number | null {
  const values = history.map((run) => run[key]).filter((value): value is number => value !== null);
  return values.length >= MIN_BASELINE_RUNS ? median(values) : null;
}

function checkVital(name: VitalName, current: RunMetrics, history: RunMetrics[]): Check | null {
  const sources = VITAL_SOURCES[name];
  // Field data wins when this run has it. Mixing sources would compare unlike numbers.
  const source: AlertSource | null =
    current[sources.field] !== null ? "field" : sources.lab && current[sources.lab] !== null ? "lab" : null;
  if (!source) return null;

  const key = source === "field" ? sources.field : sources.lab!;
  const value = current[key]!;
  const baseline = baselineOf(history, key);
  if (baseline === null) return null;

  return {
    type: "vital_poor",
    metric: name,
    source,
    baseline,
    current: value,
    threshold: name === "inp" ? 500 : name === "lcp" ? 4000 : 0.25,
    breached: rateVital(name, value) === "poor" && rateVital(name, baseline) !== "poor",
    needsConfirmation: source === "lab",
  };
}

/**
 * Compares a run with the median of earlier runs. A median ignores the odd
 * outlier, so one slow test in the history doesn't move the baseline.
 *
 * `history` holds earlier successful runs for the same URL and device, newest
 * first, without retests.
 */
export function evaluateRun(
  current: RunMetrics,
  history: RunMetrics[],
  settings: MonitoringSettings,
): Evaluation {
  const window = history.slice(0, settings.baselineSize);
  if (window.length < MIN_BASELINE_RUNS) return { status: "building", runs: window.length };

  const checks: Check[] = [];

  const scoreBaseline = baselineOf(window, "performanceScore");
  if (scoreBaseline !== null && current.performanceScore !== null) {
    checks.push({
      type: "score_drop",
      metric: "score",
      source: "lab",
      baseline: scoreBaseline,
      current: current.performanceScore,
      threshold: settings.scoreDropThreshold,
      breached: scoreBaseline - current.performanceScore > settings.scoreDropThreshold,
      needsConfirmation: true,
    });
  }

  for (const name of ["lcp", "inp", "cls"] as const) {
    const check = checkVital(name, current, window);
    if (check) checks.push(check);
  }

  return { status: "evaluated", checks };
}

const sameRule = (a: Check, b: Check) =>
  a.type === b.type && a.metric === b.metric && a.source === b.source;

/** Breaches from the original run that the retest also shows. Only these alert. */
export function confirmedByRetest(original: Evaluation, retest: Evaluation): Check[] {
  if (original.status !== "evaluated" || retest.status !== "evaluated") return [];
  return retest.checks.filter(
    (check) =>
      check.breached &&
      check.needsConfirmation &&
      original.checks.some((first) => first.breached && sameRule(first, check)),
  );
}
