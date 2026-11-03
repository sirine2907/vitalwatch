import type { RunMetrics } from "@/domain/projects/types";
import { formatVital } from "@/domain/vitals/thresholds";

export interface CompareColumn {
  label: string;
  url: string;
  isYours: boolean;
  metrics: RunMetrics | null;
  testedAt: Date | null;
}

interface RowDefinition {
  key: keyof RunMetrics;
  label: string;
  higherIsBetter: boolean;
  format: (value: number) => string;
}

const ROWS: RowDefinition[] = [
  { key: "performanceScore", label: "Performance score", higherIsBetter: true, format: (v) => String(Math.round(v)) },
  { key: "fieldLcpMs", label: "LCP (real users)", higherIsBetter: false, format: (v) => formatVital("lcp", v) },
  { key: "fieldInpMs", label: "INP (real users)", higherIsBetter: false, format: (v) => formatVital("inp", v) },
  { key: "fieldCls", label: "CLS (real users)", higherIsBetter: false, format: (v) => formatVital("cls", v) },
  { key: "labLcpMs", label: "LCP (lab)", higherIsBetter: false, format: (v) => formatVital("lcp", v) },
  { key: "labFcpMs", label: "FCP (lab)", higherIsBetter: false, format: (v) => formatVital("fcp", v) },
  { key: "labTbtMs", label: "Total Blocking Time", higherIsBetter: false, format: (v) => formatVital("tbt", v) },
  { key: "labSiMs", label: "Speed Index", higherIsBetter: false, format: (v) => formatVital("si", v) },
  { key: "labTtfbMs", label: "Server response", higherIsBetter: false, format: (v) => formatVital("ttfb", v) },
  { key: "labCls", label: "CLS (lab)", higherIsBetter: false, format: (v) => formatVital("cls", v) },
];

export interface CompareRow {
  label: string;
  cells: (string | null)[];
  /** Columns holding the best value. Ties are all marked; one value alone isn't "best". */
  best: number[];
}

export function buildComparison(columns: CompareColumn[]): CompareRow[] {
  return ROWS.map((row) => {
    const values = columns.map((column) => column.metrics?.[row.key] ?? null);
    const present = values.filter((value): value is number => value !== null);
    const target = row.higherIsBetter ? Math.max(...present) : Math.min(...present);

    return {
      label: row.label,
      cells: values.map((value) => (value === null ? null : row.format(value))),
      best:
        present.length < 2
          ? []
          : values.flatMap((value, index) => (value !== null && value === target ? [index] : [])),
    };
  });
}
