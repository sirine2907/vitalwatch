import { LocalTime } from "@/components/local-time";
import type { AnalysisResult } from "@/domain/psi/types";
import { FieldSection } from "./field-section";
import { LabSection } from "./lab-section";
import { OpportunitiesSection } from "./opportunities-section";
import { ScoreGauge } from "./score-gauge";

// The white panel under the Mobile / Desktop tabs. Its top-left corner meets the first tab.
export const RESULT_PANEL = "rounded-tr-2xl rounded-b-2xl bg-card p-5 shadow-panel sm:p-8";

export function ResultPanel({ result, cached = false }: { result: AnalysisResult; cached?: boolean }) {
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <ScoreGauge score={result.score} />
        <div className="min-w-0">
          <h2 className="text-2xl font-bold">Performance score</h2>
          <p className="mt-1 text-sm break-words text-muted-foreground">
            {result.finalUrl !== result.requestedUrl && <>Redirected to {result.finalUrl}. </>}
            Tested <LocalTime iso={result.fetchedAt} />
            {cached && " (saved result, up to 5 minutes old)"}.
            {result.lighthouseVersion && ` Lighthouse ${result.lighthouseVersion}.`}
          </p>
          {result.warnings.map((warning) => (
            <p key={warning} className="mt-2 text-sm text-needs-improvement">
              {warning}
            </p>
          ))}
        </div>
      </div>
      <FieldSection field={result.field} />
      <LabSection lab={result.lab} />
      <OpportunitiesSection opportunities={result.opportunities} />
    </div>
  );
}
