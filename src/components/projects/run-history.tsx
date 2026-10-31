import { LocalTime } from "@/components/local-time";
import { ScoreLabel } from "@/components/results/score-label";
import { STALE_PENDING_MS } from "@/domain/projects/limits";
import type { RunRecord } from "@/domain/projects/types";

const VISIBLE_RUNS = 10;

function RunResult({ run, now }: { run: RunRecord; now: number }) {
  if (run.status === "success") return <ScoreLabel score={run.performanceScore} />;
  if (run.status === "failed") {
    return <span className="text-muted-foreground">Failed: {run.error ?? "no details"}</span>;
  }
  const stale = now - run.createdAt.getTime() > STALE_PENDING_MS;
  return <span className="text-muted-foreground">{stale ? "Interrupted" : "Running"}</span>;
}

function RunTable({ runs, now }: { runs: RunRecord[]; now: number }) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b text-left text-muted-foreground">
          <tr>
            <th scope="col" className="p-3 font-medium">Time</th>
            <th scope="col" className="p-3 font-medium">Device</th>
            <th scope="col" className="p-3 font-medium">Result</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {runs.map((run) => (
            <tr key={run.id}>
              <td className="p-3">
                <LocalTime iso={run.createdAt.toISOString()} />
              </td>
              <td className="p-3 capitalize">{run.strategy}</td>
              <td className="p-3">
                <RunResult run={run} now={now} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RunHistory({ runs, now }: { runs: RunRecord[]; now: number }) {
  const older = runs.slice(VISIBLE_RUNS);

  return (
    <div>
      <RunTable runs={runs.slice(0, VISIBLE_RUNS)} now={now} />
      {older.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
            Show {older.length} older {older.length === 1 ? "test" : "tests"}
          </summary>
          <div className="mt-2">
            <RunTable runs={older} now={now} />
          </div>
        </details>
      )}
    </div>
  );
}
