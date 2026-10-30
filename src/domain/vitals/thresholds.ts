export type Rating = "good" | "needs-improvement" | "poor";
export type VitalName = "lcp" | "inp" | "cls";
export type LabMetricName = "lcp" | "fcp" | "tbt" | "si" | "ttfb" | "cls";

/** Google's published Core Web Vitals boundaries. Values at a boundary count as the better rating. */
export const VITAL_THRESHOLDS: Record<VitalName, { good: number; poor: number }> = {
  lcp: { good: 2500, poor: 4000 },
  inp: { good: 200, poor: 500 },
  cls: { good: 0.1, poor: 0.25 },
};

export const VITAL_LABELS: Record<VitalName, { short: string; long: string }> = {
  lcp: { short: "LCP", long: "Largest Contentful Paint" },
  inp: { short: "INP", long: "Interaction to Next Paint" },
  cls: { short: "CLS", long: "Cumulative Layout Shift" },
};

export const LAB_LABELS: Record<LabMetricName, string> = {
  lcp: "Largest Contentful Paint",
  fcp: "First Contentful Paint",
  tbt: "Total Blocking Time",
  si: "Speed Index",
  ttfb: "Server Response Time",
  cls: "Cumulative Layout Shift",
};

export function rateVital(name: VitalName, value: number): Rating {
  const { good, poor } = VITAL_THRESHOLDS[name];
  if (value <= good) return "good";
  if (value <= poor) return "needs-improvement";
  return "poor";
}

/** Lighthouse's score bands: 90+ good, 50-89 needs improvement, below 50 poor. */
export function rateScore(score: number): Rating {
  if (score >= 90) return "good";
  if (score >= 50) return "needs-improvement";
  return "poor";
}

export function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

export function formatVital(name: VitalName | LabMetricName, value: number): string {
  return name === "cls" ? value.toFixed(2) : formatMs(value);
}
