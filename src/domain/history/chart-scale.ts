import { formatMs } from "@/domain/vitals/thresholds";
import { TREND_METRICS, type MetricUnit, type TrendMetric, type TrendRow } from "./trend";

const HEADROOM = 1.15;

export interface ThresholdLine {
  value: number;
  label: string;
}

export interface ChartScale {
  max: number;
  thresholds: ThresholdLine[];
}

export function formatMetricValue(unit: MetricUnit, value: number): string {
  if (unit === "ms") return formatMs(value);
  if (unit === "unitless") return value.toFixed(2);
  return String(Math.round(value));
}

/**
 * Picks the y-axis top. Always keeps the "good" line in view for context, but a
 * far-away "poor" line is left out rather than flattening the data against the floor.
 */
export function buildChartScale(rows: TrendRow[], metric: TrendMetric): ChartScale {
  const { unit, thresholds } = TREND_METRICS[metric];

  if (unit === "score") {
    return {
      max: 100,
      thresholds: [
        { value: 90, label: "Good from 90" },
        { value: 50, label: "Poor below 50" },
      ],
    };
  }

  const values = rows.flatMap((row) =>
    [row.mobile, row.desktop].filter((value): value is number => value !== null),
  );
  const highest = Math.max(0, ...values);
  const max = Math.max(highest, thresholds?.good ?? 0) * HEADROOM || 1;

  const lines: ThresholdLine[] = [];
  if (thresholds) {
    lines.push({ value: thresholds.good, label: `Good up to ${formatMetricValue(unit, thresholds.good)}` });
    if (thresholds.poor <= max) {
      lines.push({ value: thresholds.poor, label: `Poor above ${formatMetricValue(unit, thresholds.poor)}` });
    }
  }
  return { max, thresholds: lines };
}
