import { Badge } from "@/components/ui/badge";
import type { Fix, FixSuggestions } from "@/domain/ai/fix-schema";
import type { Opportunity } from "@/domain/psi/types";
import type { DetectedTech } from "@/domain/stack/detect";
import { formatMs } from "@/domain/vitals/thresholds";

const LEVEL_LABEL = { high: "High impact", medium: "Medium impact", low: "Low impact" };
const DIFFICULTY_LABEL = { easy: "Easy", medium: "Moderate", hard: "Hard" };

export function StackList({ stack }: { stack: DetectedTech[] }) {
  if (stack.length === 0) {
    return <p className="text-sm text-muted-foreground">No technologies detected, so the advice is general.</p>;
  }
  return (
    <ul className="flex flex-wrap gap-2">
      {stack.map((tech) => (
        <li key={tech.name}>
          <details className="group">
            <summary className="cursor-pointer list-none rounded-md border bg-card px-2 py-1 text-sm hover:bg-accent">
              {tech.name}
              {tech.confidence === "medium" && <span className="text-muted-foreground"> (likely)</span>}
            </summary>
            <ul className="mt-1 max-w-xs rounded-md border bg-card p-2 text-xs text-muted-foreground">
              {tech.evidence.map((item) => (
                <li key={item} className="break-words">{item}</li>
              ))}
            </ul>
          </details>
        </li>
      ))}
    </ul>
  );
}

function FixCard({ fix, opportunities }: { fix: Fix; opportunities: Opportunity[] }) {
  // Savings come from Lighthouse's measurement, not from the model.
  const measured = opportunities.filter((item) => fix.auditIds.includes(item.id));
  const savings = Math.max(0, ...measured.map((item) => item.savingsMs));

  return (
    <li className="p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm text-muted-foreground">{fix.priority}.</span>
        <h4 className="font-medium">{fix.title}</h4>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Badge variant="secondary">{LEVEL_LABEL[fix.impact]}</Badge>
        <Badge variant="outline">{DIFFICULTY_LABEL[fix.difficulty]}</Badge>
        {savings > 0 && <Badge variant="outline">Lighthouse estimate: ~{formatMs(savings)}</Badge>}
      </div>
      <p className="mt-3 text-sm">{fix.why}</p>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
        {fix.steps.map((step, index) => (
          <li key={index}>{step}</li>
        ))}
      </ol>
      {fix.code && (
        <pre className="mt-3 overflow-x-auto rounded-md border bg-muted p-3 text-xs">
          <code aria-label={`${fix.code.language} example`}>{fix.code.snippet}</code>
        </pre>
      )}
    </li>
  );
}

export function FixSuggestionsView({
  suggestions,
  opportunities,
  model,
}: {
  suggestions: FixSuggestions;
  opportunities: Opportunity[];
  model: string;
}) {
  return (
    <div>
      <p className="text-sm">{suggestions.summary}</p>
      <ol className="mt-4 divide-y rounded-lg border bg-card">
        {suggestions.fixes.map((fix) => (
          <FixCard key={fix.priority} fix={fix} opportunities={opportunities} />
        ))}
      </ol>
      <p className="mt-2 text-xs text-muted-foreground">
        Written by {model}. Check suggestions before applying them.
      </p>
    </div>
  );
}
