import { parseDescription } from "@/domain/psi/description";
import type { Opportunity } from "@/domain/psi/types";
import { formatMs } from "@/domain/vitals/thresholds";

function Description({ text }: { text: string }) {
  return (
    <p className="mt-2 text-sm text-muted-foreground">
      {parseDescription(text).map((part, index) =>
        part.type === "link" ? (
          <a
            key={index}
            href={part.href}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            {part.text}
          </a>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </p>
  );
}

export function OpportunitiesSection({ opportunities }: { opportunities: Opportunity[] }) {
  const largest = opportunities[0]?.savingsMs ?? 1;

  return (
    <section aria-labelledby="opportunities-heading">
      <h3 id="opportunities-heading" className="text-lg font-semibold">
        Opportunities
      </h3>
      {opportunities.length === 0 ? (
        <p className="mt-2 rounded-lg border bg-card p-4 text-sm text-muted-foreground">
          Lighthouse didn&apos;t find any time-saving opportunities on this run.
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted-foreground">
            Ranked by estimated time saved. Savings can overlap, so they don&apos;t add up.
          </p>
          <ol className="mt-4 divide-y rounded-lg border bg-card">
            {opportunities.map((item) => (
              <li key={item.id} className="p-4">
                <details className="group">
                  <summary className="cursor-pointer list-none">
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="font-medium group-open:underline">{item.title}</span>
                      <span className="shrink-0 font-mono text-sm font-semibold tabular-nums">
                        ~{formatMs(item.savingsMs)}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.max(3, (item.savingsMs / largest) * 100)}%` }}
                      />
                    </div>
                  </summary>
                  {item.displayValue && (
                    <p className="mt-2 text-sm font-medium">{item.displayValue}</p>
                  )}
                  <Description text={item.description} />
                </details>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
