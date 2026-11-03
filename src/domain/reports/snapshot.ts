import { z } from "zod";
import type { AnalysisResult } from "@/domain/psi/types";

export const BRAND_COLOR = /^#[0-9a-f]{6}$/i;
export const DEFAULT_BRAND_COLOR = "#b42318";
const TOP_FIXES = 5;

const nullableNumber = z.number().nullable();

const deviceSummarySchema = z.object({
  score: z.number(),
  testedAt: z.string(),
  fieldScope: z.enum(["url", "origin", "none"]),
  field: z.object({ lcp: nullableNumber, inp: nullableNumber, cls: nullableNumber }),
  lab: z.object({ lcp: nullableNumber, tbt: nullableNumber, cls: nullableNumber }),
  topFixes: z.array(z.object({ title: z.string(), savingsMs: z.number() })),
});

const pageSchema = z.object({
  label: z.string().nullable(),
  url: z.string(),
  mobile: deviceSummarySchema.nullable(),
  desktop: deviceSummarySchema.nullable(),
});

/**
 * Everything a shared report shows, frozen when the link is made. A link never
 * reveals newer data than its owner chose to share, and holds no internal IDs.
 */
export const reportSnapshotSchema = z.object({
  version: z.literal(1),
  projectName: z.string(),
  brandColor: z.string().regex(BRAND_COLOR),
  generatedAt: z.string(),
  pages: z.array(pageSchema),
  competitors: z.array(pageSchema),
});

export type ReportSnapshot = z.infer<typeof reportSnapshotSchema>;
export type ReportPage = z.infer<typeof pageSchema>;
export type DeviceSummary = z.infer<typeof deviceSummarySchema>;

export function summarizeResult(result: AnalysisResult): DeviceSummary {
  const { vitals } = result.field;
  return {
    score: result.score,
    testedAt: result.fetchedAt,
    fieldScope: result.field.scope,
    field: { lcp: vitals.lcp?.value ?? null, inp: vitals.inp?.value ?? null, cls: vitals.cls?.value ?? null },
    lab: { lcp: result.lab.lcp, tbt: result.lab.tbt, cls: result.lab.cls },
    topFixes: result.opportunities.slice(0, TOP_FIXES).map(({ title, savingsMs }) => ({ title, savingsMs })),
  };
}

/** Stored snapshots are read back through the schema, so a bad row can't break a page. */
export function readSnapshot(value: unknown): ReportSnapshot | null {
  const parsed = reportSnapshotSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function reportFileName(projectName: string, generatedAt: string): string {
  const slug = projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return `${slug || "report"}-${generatedAt.slice(0, 10)}.pdf`;
}
