import type { RunMetrics, RunRecord } from "@/domain/projects/types";
import { STRATEGIES, type Strategy } from "@/domain/psi/types";
import { VITAL_THRESHOLDS } from "@/domain/vitals/thresholds";

export const RANGES = [7, 30, 90] as const;
export type RangeDays = (typeof RANGES)[number];

export type TrendMetric = keyof RunMetrics;
export type MetricUnit = "score" | "ms" | "unitless";

export interface MetricDefinition {
  label: string;
  group: "Overall" | "Real users" | "Lab";
  unit: MetricUnit;
  thresholds?: { good: number; poor: number };
}

export const TREND_METRICS: Record<TrendMetric, MetricDefinition> = {
  performanceScore: {
    label: "Performance score",
    group: "Overall",
    unit: "score",
    thresholds: { good: 90, poor: 50 },
  },
  fieldLcpMs: { label: "LCP", group: "Real users", unit: "ms", thresholds: VITAL_THRESHOLDS.lcp },
  fieldInpMs: { label: "INP", group: "Real users", unit: "ms", thresholds: VITAL_THRESHOLDS.inp },
  fieldCls: { label: "CLS", group: "Real users", unit: "unitless", thresholds: VITAL_THRESHOLDS.cls },
  labLcpMs: { label: "LCP", group: "Lab", unit: "ms", thresholds: VITAL_THRESHOLDS.lcp },
  labFcpMs: { label: "FCP", group: "Lab", unit: "ms" },
  labTbtMs: { label: "TBT", group: "Lab", unit: "ms" },
  labSiMs: { label: "Speed Index", group: "Lab", unit: "ms" },
  labTtfbMs: { label: "Server response", group: "Lab", unit: "ms" },
  labCls: { label: "CLS", group: "Lab", unit: "unitless", thresholds: VITAL_THRESHOLDS.cls },
};

export function parseRange(value: unknown): RangeDays {
  const days = Number(value);
  return RANGES.find((range) => range === days) ?? 30;
}

export function parseMetric(value: unknown): TrendMetric {
  return typeof value === "string" && Object.hasOwn(TREND_METRICS, value)
    ? (value as TrendMetric)
    : "performanceScore";
}

/**
 * One chart row. A series is split into numbered segments wherever a run failed,
 * so `mobile_0` and `mobile_1` are drawn as separate lines with a gap between.
 * `mobile` and `desktop` hold the row's values for tooltips.
 */
export interface TrendRow {
  time: number;
  mobile: number | null;
  desktop: number | null;
  [segmentKey: string]: number | null;
}

export interface TrendSeries {
  rows: TrendRow[];
  segments: Record<Strategy, string[]>;
  /** Length of each chart point when many runs were combined, otherwise null. */
  bucketHours: number | null;
  failedRuns: number;
}

const PAIRING_WINDOW_MS = 10 * 60 * 1000;
const MAX_RUNS_BEFORE_COMBINING = 300;
const COMBINED_POINTS = 150;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Builds chart data for one metric. Mobile and desktop tests from the same round
 * share a row. A run with no value (failed, or no field data) breaks its line, so
 * a bad run never appears as zero and a missing one never looks like a recovery.
 */
export function buildTrendSeries(
  runs: RunRecord[],
  metric: TrendMetric,
  rangeDays: RangeDays,
): TrendSeries {
  const finished = runs.filter((run) => run.status !== "pending");
  const combine = finished.length > MAX_RUNS_BEFORE_COMBINING;
  const bucketMs = combine
    ? (rangeDays * 24 * 60 * 60 * 1000) / COMBINED_POINTS
    : PAIRING_WINDOW_MS;

  const buckets = new Map<number, Record<Strategy, { values: number[]; seen: boolean }>>();
  for (const run of finished) {
    const bucket = Math.floor(run.createdAt.getTime() / bucketMs) * bucketMs;
    if (!buckets.has(bucket)) {
      buckets.set(bucket, {
        mobile: { values: [], seen: false },
        desktop: { values: [], seen: false },
      });
    }
    const slot = buckets.get(bucket)![run.strategy];
    slot.seen = true;
    const value = run.status === "success" ? run[metric] : null;
    if (value !== null) slot.values.push(value);
  }

  const segments: TrendSeries["segments"] = { mobile: [], desktop: [] };
  const current: Record<Strategy, number> = { mobile: 0, desktop: 0 };
  const rows: TrendRow[] = [];

  for (const time of [...buckets.keys()].sort((a, b) => a - b)) {
    const slots = buckets.get(time)!;
    const row: TrendRow = { time, mobile: null, desktop: null };

    for (const strategy of STRATEGIES) {
      const { values, seen } = slots[strategy];
      if (values.length > 0) {
        const value = median(values);
        const key = `${strategy}_${current[strategy]}`;
        row[strategy] = value;
        row[key] = value;
        if (!segments[strategy].includes(key)) segments[strategy].push(key);
      } else if (seen) {
        current[strategy] += 1;
      }
    }
    rows.push(row);
  }

  return {
    rows,
    segments,
    bucketHours: combine ? bucketMs / (60 * 60 * 1000) : null,
    failedRuns: finished.filter((run) => run.status === "failed").length,
  };
}
