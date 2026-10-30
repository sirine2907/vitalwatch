import { AppError } from "@/lib/errors";
import {
  rateVital,
  type LabMetricName,
  type VitalName,
} from "@/domain/vitals/thresholds";
import {
  psiResponseSchema,
  type PsiAudit,
  type PsiLoadingExperience,
  type PsiResponse,
} from "./schema";
import type {
  AnalysisResult,
  FieldData,
  FieldScope,
  FieldVital,
  Opportunity,
  Strategy,
  VitalsAssessment,
} from "./types";

const FIELD_KEYS: Record<VitalName, string> = {
  lcp: "LARGEST_CONTENTFUL_PAINT_MS",
  inp: "INTERACTION_TO_NEXT_PAINT",
  cls: "CUMULATIVE_LAYOUT_SHIFT_SCORE",
};

const LAB_AUDITS: Record<LabMetricName, string> = {
  lcp: "largest-contentful-paint",
  fcp: "first-contentful-paint",
  tbt: "total-blocking-time",
  si: "speed-index",
  ttfb: "server-response-time",
  cls: "cumulative-layout-shift",
};

// Layout shift savings are unitless, so they can't be compared with these.
const TIME_SAVING_METRICS = ["LCP", "FCP", "TBT", "INP"];
const SKIPPED_DISPLAY_MODES = new Set(["notApplicable", "manual", "error"]);
const PASSING_SCORE = 0.9;

function hasMetrics(experience: PsiLoadingExperience | undefined): boolean {
  return Object.keys(experience?.metrics ?? {}).length > 0;
}

/** Decides whose field data to show. Origin data must never pass as the page's own. */
function pickExperience(response: PsiResponse): {
  scope: FieldScope;
  experience?: PsiLoadingExperience;
} {
  const { loadingExperience, originLoadingExperience } = response;

  if (hasMetrics(loadingExperience)) {
    return {
      scope: loadingExperience?.origin_fallback ? "origin" : "url",
      experience: loadingExperience,
    };
  }
  if (hasMetrics(originLoadingExperience)) {
    return { scope: "origin", experience: originLoadingExperience };
  }
  return { scope: "none" };
}

function parseVital(
  name: VitalName,
  experience: PsiLoadingExperience | undefined,
): FieldVital | null {
  const metric = experience?.metrics?.[FIELD_KEYS[name]];
  if (!metric) return null;

  // CrUX reports CLS multiplied by 100, so a percentile of 12 means 0.12.
  const value = name === "cls" ? metric.percentile / 100 : metric.percentile;
  const buckets = metric.distributions;

  return {
    value,
    rating: rateVital(name, value),
    distribution:
      buckets?.length === 3
        ? {
            good: buckets[0].proportion,
            needsImprovement: buckets[1].proportion,
            poor: buckets[2].proportion,
          }
        : null,
  };
}

/**
 * Passing needs good LCP and CLS, and good INP when INP has data. Low-traffic
 * pages often have no INP, which alone doesn't fail them.
 */
function assess(vitals: FieldData["vitals"]): VitalsAssessment {
  const { lcp, inp, cls } = vitals;
  const present = [lcp, inp, cls].filter((vital) => vital !== null);

  if (present.some((vital) => vital.rating !== "good")) return "failed";
  if (!lcp || !cls) return "insufficient";
  return "passed";
}

function parseField(response: PsiResponse): FieldData {
  const { scope, experience } = pickExperience(response);
  const vitals = {
    lcp: parseVital("lcp", experience),
    inp: parseVital("inp", experience),
    cls: parseVital("cls", experience),
  };
  return { scope, assessment: assess(vitals), vitals };
}

/** Newer Lighthouse reports savings per metric; older ones report one total. */
function savingsMs(audit: PsiAudit): number {
  const perMetric = TIME_SAVING_METRICS.map((metric) => audit.metricSavings?.[metric] ?? 0);
  return Math.max(audit.details?.overallSavingsMs ?? 0, ...perMetric);
}

export function rankOpportunities(audits: Record<string, PsiAudit>): Opportunity[] {
  return Object.entries(audits)
    .filter(([, audit]) => {
      if (SKIPPED_DISPLAY_MODES.has(audit.scoreDisplayMode ?? "")) return false;
      if (audit.score !== null && audit.score !== undefined && audit.score >= PASSING_SCORE) {
        return false;
      }
      return savingsMs(audit) > 0;
    })
    .map(([id, audit]) => ({
      id,
      title: audit.title,
      description: audit.description ?? "",
      displayValue: audit.displayValue ?? null,
      savingsMs: Math.round(savingsMs(audit)),
    }))
    .sort((a, b) => b.savingsMs - a.savingsMs || a.id.localeCompare(b.id));
}

function parseLab(audits: Record<string, PsiAudit>): AnalysisResult["lab"] {
  const read = (name: LabMetricName) => audits[LAB_AUDITS[name]]?.numericValue ?? null;
  return {
    lcp: read("lcp"),
    fcp: read("fcp"),
    tbt: read("tbt"),
    si: read("si"),
    ttfb: read("ttfb"),
    cls: read("cls"),
  };
}

/**
 * Converts a raw PSI response into the app's own shape. Rejects runs that
 * Lighthouse itself marks as unreliable, because a bad score here would later
 * look like a real regression.
 */
export function parsePsiResponse(
  raw: unknown,
  strategy: Strategy,
  requestedUrl: string,
): AnalysisResult {
  const parsed = psiResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError(
      "psi_bad_response",
      "PageSpeed Insights returned a result we couldn't read. Please try again.",
      { status: 502 },
    );
  }

  const response = parsed.data;
  const { runtimeError, categories, audits } = response.lighthouseResult;
  const lighthouse = response.lighthouseResult;

  if (runtimeError?.code && runtimeError.code !== "NO_ERROR") {
    throw new AppError(
      "site_unreachable",
      `Lighthouse couldn't test this page (${runtimeError.code}). Check that it loads in a browser.`,
      { status: 422 },
    );
  }

  const score = categories.performance.score;
  if (score === null || score === undefined) {
    throw new AppError(
      "site_unreachable",
      "Lighthouse finished but couldn't score this page. Check that it loads in a browser.",
      { status: 422 },
    );
  }

  return {
    requestedUrl,
    finalUrl: lighthouse.finalUrl ?? requestedUrl,
    strategy,
    fetchedAt: lighthouse.fetchTime ?? new Date().toISOString(),
    lighthouseVersion: lighthouse.lighthouseVersion ?? null,
    score: Math.round(score * 100),
    field: parseField(response),
    lab: parseLab(audits),
    opportunities: rankOpportunities(audits),
    warnings: (lighthouse.runWarnings ?? []).filter(
      (warning): warning is string => typeof warning === "string",
    ),
  };
}
