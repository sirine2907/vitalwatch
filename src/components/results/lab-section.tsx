import type { AnalysisResult } from "@/domain/psi/types";
import { formatVital, LAB_LABELS, type LabMetricName } from "@/domain/vitals/thresholds";

const LAB_ORDER: LabMetricName[] = ["lcp", "fcp", "tbt", "si", "ttfb", "cls"];

export function LabSection({ lab }: { lab: AnalysisResult["lab"] }) {
  return (
    <section aria-labelledby="lab-heading">
      <h3 id="lab-heading" className="text-2xl font-bold">
        Lab metrics
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        One simulated page load. Good for diagnosing problems, but it can vary between runs.
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
        {LAB_ORDER.map((name) => {
          const value = lab[name];
          return (
            <div key={name} className="rounded-xl border border-dashed border-input bg-card p-4">
              <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{LAB_LABELS[name]}</dt>
              <dd className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
                {value === null ? "Not available" : formatVital(name, value)}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
