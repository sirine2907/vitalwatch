import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TrendChart } from "@/components/charts/trend-chart";
import { TrendFilters } from "@/components/charts/trend-filters";
import { ConfirmDelete } from "@/components/projects/confirm-delete";
import { LatestResults } from "@/components/projects/latest-results";
import { RunHistory } from "@/components/projects/run-history";
import { RunTestsButton } from "@/components/projects/run-tests-button";
import { buildTrendSeries, parseMetric, parseRange, TREND_METRICS } from "@/domain/history/trend";
import { FixSuggestionsView, StackList } from "@/components/ai/fix-suggestions";
import { GenerateFixesButton } from "@/components/ai/generate-fixes-button";
import { STRATEGIES } from "@/domain/psi/types";
import { requireUser } from "@/lib/session";
import { projectService, runService, suggestionService } from "@/services/app.factory";
import { orNotFound } from "../../../../helpers";
import { deleteUrlAction } from "../../../actions";

export const metadata: Metadata = { title: "Page history", robots: { index: false } };

export default async function UrlPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; urlId: string }>;
  searchParams: Promise<{ range?: string; metric?: string }>;
}) {
  const { id, urlId } = await params;
  const query = await searchParams;
  const user = await requireUser();

  const url = await orNotFound(projectService().requireUrl(user.id, urlId));
  if (url.projectId !== id) notFound();

  const range = parseRange(query.range);
  const metric = parseMetric(query.metric);
  const definition = TREND_METRICS[metric];

  const runs = runService();
  const [rangeRuns, recent, latest] = await Promise.all([
    runs.listForRange(user.id, urlId, range),
    runs.listRecent(user.id, urlId),
    runs.getLatestResults(user.id, urlId, url.url),
  ]);
  const series = buildTrendSeries(rangeRuns, metric, range);

  const suggestions = suggestionService();
  const fixes = await Promise.all(
    STRATEGIES.filter((strategy) => latest[strategy]).map(async (strategy) => ({
      strategy,
      result: latest[strategy]!,
      stored: await suggestions.getForRun(user.id, latest[strategy]!.runId),
    })),
  );
  const basePath = `/projects/${id}/urls/${urlId}`;

  return (
    <div>
      <Link href={`/projects/${id}`} className="text-sm text-muted-foreground hover:underline">
        {url.projectName}
      </Link>
      <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight break-all">{url.label ?? url.url}</h1>
          {url.label && <p className="mt-1 text-sm break-all text-muted-foreground">{url.url}</p>}
        </div>
        <ConfirmDelete
          action={deleteUrlAction.bind(null, id, urlId)}
          label="Remove URL"
          message="Remove this URL and all of its test history? This can't be undone."
        />
      </div>

      <div className="mt-6">
        <RunTestsButton urlId={urlId} />
      </div>

      {recent.length === 0 ? (
        <p className="mt-8 rounded-lg border bg-card p-4 text-muted-foreground">
          No tests yet. Run the first one to start this page&apos;s history.
        </p>
      ) : (
        <div className="mt-10 flex flex-col gap-12">
          <section aria-labelledby="trend-heading">
            <h2 id="trend-heading" className="text-xl font-semibold">
              Trends
            </h2>
            <div className="mt-4">
              <TrendFilters basePath={basePath} range={range} metric={metric} />
            </div>

            <div className="mt-6 rounded-lg border bg-card p-4">
              <h3 className="font-medium">
                {definition.group === "Overall" ? definition.label : `${definition.label} (${definition.group.toLowerCase()})`}
                , last {range} days
              </h3>
              {definition.group === "Real users" && (
                <p className="mt-1 text-sm text-muted-foreground">
                  Real-user data is a rolling 28-day figure, so it changes slowly between tests.
                </p>
              )}
              {series.bucketHours !== null && (
                <p className="mt-1 text-sm text-muted-foreground">
                  Each point is the median of about {Math.round(series.bucketHours)} hours of tests.
                </p>
              )}
              <div className="mt-4">
                {series.rows.length === 0 ? (
                  <p className="py-12 text-center text-muted-foreground">No tests in this range.</p>
                ) : (
                  <TrendChart series={series} metric={metric} />
                )}
              </div>
              {series.failedRuns > 0 && (
                <p className="mt-3 text-sm text-muted-foreground">
                  {series.failedRuns} failed {series.failedRuns === 1 ? "test appears" : "tests appear"} as{" "}
                  {series.failedRuns === 1 ? "a gap" : "gaps"} in the line.
                </p>
              )}
            </div>
          </section>

          {Object.keys(latest).length > 0 && (
            <section aria-labelledby="latest-heading">
              <h2 id="latest-heading" className="mb-4 text-xl font-semibold">
                Latest results
              </h2>
              <LatestResults results={latest} />
            </section>
          )}

          {fixes.length > 0 && (
            <section aria-labelledby="fixes-heading">
              <h2 id="fixes-heading" className="text-xl font-semibold">
                Fix suggestions
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Prioritized fixes for this site&apos;s stack, based on the latest test. Only audit names,
                measured savings, a few resource URLs and the detected stack are sent to the AI. Never the
                page&apos;s HTML, cookies or anything about you.
              </p>
              <div className="mt-6 flex flex-col gap-10">
                {fixes.map(({ strategy, result, stored }) => (
                  <div key={strategy}>
                    <h3 className="mb-3 font-medium capitalize">{strategy}</h3>
                    {stored ? (
                      <div className="flex flex-col gap-4">
                        <div>
                          <p className="mb-2 text-sm text-muted-foreground">Detected stack</p>
                          <StackList stack={stored.stack} />
                        </div>
                        <FixSuggestionsView
                          suggestions={stored.suggestions}
                          opportunities={result.opportunities}
                          model={stored.model}
                        />
                      </div>
                    ) : suggestions.isAvailable() ? (
                      <GenerateFixesButton runId={result.runId} label={`Suggest fixes for ${strategy}`} />
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        AI suggestions aren&apos;t set up on this server. Add a free GEMINI_API_KEY to turn them on.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          <section aria-labelledby="history-heading">
            <h2 id="history-heading" className="mb-4 text-xl font-semibold">
              Test history
            </h2>
            <RunHistory runs={recent} now={Date.now()} />
          </section>
        </div>
      )}
    </div>
  );
}
