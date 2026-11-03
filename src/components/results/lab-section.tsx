import type { AnalysisResult } from "@/domain/psi/types";
import { formatVital, LAB_LABELS, type LabMetricName } from "@/domain/vitals/thresholds";
import { SectionMark } from "./section-mark";

const LAB_ORDER: LabMetricName[] = ["lcp", "fcp", "tbt", "si", "ttfb", "cls"];

export function LabSection({ lab }: { lab: AnalysisResult["lab"] }) {
  return (
    <section aria-labelledby="lab-heading">
      <h3 id="lab-heading" className="text-xl font-semibold">
        <SectionMark number={2} />
        Lab metrics
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        One simulated page load. Good for diagnosing problems, but it can vary between runs.
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden border border-foreground bg-border md:grid-cols-3">
        {LAB_ORDER.map((name) => {
          const value = lab[name];
          return (
            <div key={name} className="bg-card p-4">
              <dt className="font-mono text-xs tracking-wider text-muted-foreground uppercase">{LAB_LABELS[name]}</dt>
              <dd className="mt-1 font-mono text-xl font-semibold tabular-nums">
                {value === null ? "Not available" : formatVital(name, value)}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
