import type { LabMetricName, Rating, VitalName } from "@/domain/vitals/thresholds";

export const STRATEGIES = ["mobile", "desktop"] as const;
export type Strategy = (typeof STRATEGIES)[number];

export type FieldScope = "url" | "origin" | "none";
export type VitalsAssessment = "passed" | "failed" | "insufficient";

export interface FieldVital {
  /** 75th percentile. Milliseconds for LCP and INP, unitless for CLS. */
  value: number;
  rating: Rating;
  /** Share of page loads rated good, needs improvement and poor (0-1). */
  distribution: { good: number; needsImprovement: number; poor: number } | null;
}

export interface FieldData {
  scope: FieldScope;
  assessment: VitalsAssessment;
  vitals: Record<VitalName, FieldVital | null>;
}

export interface Opportunity {
  id: string;
  title: string;
  description: string;
  displayValue: string | null;
  savingsMs: number;
}

export interface AnalysisResult {
  requestedUrl: string;
  finalUrl: string;
  strategy: Strategy;
  fetchedAt: string;
  lighthouseVersion: string | null;
  score: number;
  field: FieldData;
  lab: Record<LabMetricName, number | null>;
  opportunities: Opportunity[];
  warnings: string[];
}

export type AnalyzeResponse =
  | { result: AnalysisResult; cached: boolean }
  | { error: { code: string; message: string; retryAfterSeconds?: number } };
