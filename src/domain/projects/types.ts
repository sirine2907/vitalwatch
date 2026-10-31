import type { FieldScope, Strategy } from "@/domain/psi/types";

export type RunStatus = "pending" | "success" | "failed";
export type RunTrigger = "manual" | "scheduled" | "retest";

export interface ProjectSummary {
  id: string;
  name: string;
  urlCount: number;
  createdAt: Date;
}

export interface MonitoredUrl {
  id: string;
  projectId: string;
  url: string;
  label: string | null;
}

export interface RunMetrics {
  performanceScore: number | null;
  labLcpMs: number | null;
  labFcpMs: number | null;
  labTbtMs: number | null;
  labSiMs: number | null;
  labTtfbMs: number | null;
  labCls: number | null;
  fieldLcpMs: number | null;
  fieldInpMs: number | null;
  fieldCls: number | null;
}

/** A run without its raw JSON: enough for charts and history tables. */
export interface RunRecord extends RunMetrics {
  id: string;
  urlId: string;
  strategy: Strategy;
  status: RunStatus;
  trigger: RunTrigger;
  fieldScope: FieldScope | null;
  error: string | null;
  createdAt: Date;
}

export interface LatestScore {
  urlId: string;
  strategy: Strategy;
  score: number;
  createdAt: Date;
}
