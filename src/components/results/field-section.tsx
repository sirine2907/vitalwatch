import { Badge } from "@/components/ui/badge";
import type { FieldData, FieldVital } from "@/domain/psi/types";
import {
  formatVital,
  VITAL_LABELS,
  type VitalName,
} from "@/domain/vitals/thresholds";
import { cn } from "@/lib/utils";
import { RATING_LABEL, RATING_TEXT } from "./rating";

const ASSESSMENT = {
  passed: { label: "Core Web Vitals: passed", className: "text-good" },
  failed: { label: "Core Web Vitals: failed", className: "text-poor" },
  insufficient: { label: "Core Web Vitals: not enough data", className: "text-muted-foreground" },
};

const VITAL_ORDER: VitalName[] = ["lcp", "inp", "cls"];

function DistributionBar({ distribution }: { distribution: NonNullable<FieldVital["distribution"]> }) {
  const percent = (share: number) => `${Math.round(share * 100)}%`;
  const { good, needsImprovement, poor } = distribution;

  return (
    <div className="mt-4">
      <div className="flex h-2 gap-px overflow-hidden rounded-full" aria-hidden>
        <div className="bg-good" style={{ width: percent(good) }} />
        <div className="bg-needs-improvement" style={{ width: percent(needsImprovement) }} />
        <div className="bg-poor" style={{ width: percent(poor) }} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground tabular-nums">
        {percent(good)} good · {percent(needsImprovement)} needs work · {percent(poor)} poor
      </p>
    </div>
  );
}

function VitalCard({ name, vital }: { name: VitalName; vital: FieldVital | null }) {
  const label = VITAL_LABELS[name];

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="font-medium">{label.short}</h4>
        {vital && (
          <span className={cn("text-sm font-medium", RATING_TEXT[vital.rating])}>
            {RATING_LABEL[vital.rating]}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{label.long}</p>
      {vital ? (
        <>
          <p className="mt-3 font-mono text-2xl font-semibold tabular-nums">
            {formatVital(name, vital.value)}
          </p>
          {vital.distribution && <DistributionBar distribution={vital.distribution} />}
        </>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">Not enough real-user data.</p>
      )}
    </div>
  );
}

export function FieldSection({ field }: { field: FieldData }) {
  if (field.scope === "none") {
    return (
      <section aria-labelledby="field-heading">
        <h3 id="field-heading" className="text-lg font-semibold">
          Real-user experience
        </h3>
        <p className="mt-2 rounded-lg border bg-card p-4 text-sm text-muted-foreground">
          Chrome doesn&apos;t have enough real-user data for this page or site yet. This is normal
          for low-traffic sites, and the lab results below still apply.
        </p>
      </section>
    );
  }

  const assessment = ASSESSMENT[field.assessment];

  return (
    <section aria-labelledby="field-heading">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 id="field-heading" className="text-lg font-semibold">
          Real-user experience
        </h3>
        <Badge variant="secondary">
          {field.scope === "url" ? "This page" : "Whole site"}
        </Badge>
        <span className={cn("text-sm font-medium", assessment.className)}>{assessment.label}</span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        75th percentile from Chrome users over the last 28 days.
        {field.scope === "origin" &&
          " This page doesn't have enough traffic, so these numbers cover the whole site."}
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {VITAL_ORDER.map((name) => (
          <VitalCard key={name} name={name} vital={field.vitals[name]} />
        ))}
      </div>
    </section>
  );
}
