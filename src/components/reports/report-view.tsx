import { LocalTime } from "@/components/local-time";
import { ScoreLabel } from "@/components/results/score-label";
import type { DeviceSummary, ReportPage, ReportSnapshot } from "@/domain/reports/snapshot";
import { formatMs, formatVital } from "@/domain/vitals/thresholds";

const show = (name: "lcp" | "inp" | "cls" | "tbt", value: number | null) =>
  value === null ? "No data" : formatVital(name, value);

function DeviceBlock({ label, summary }: { label: string; summary: DeviceSummary | null }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      {summary ? (
        <>
          <p className="mt-1 text-lg">
            <ScoreLabel score={summary.score} />
          </p>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">LCP{summary.fieldScope === "origin" ? " (site)" : ""}</dt>
            <dd className="font-mono tabular-nums">{show("lcp", summary.field.lcp)}</dd>
            <dt className="text-muted-foreground">INP</dt>
            <dd className="font-mono tabular-nums">{show("inp", summary.field.inp)}</dd>
            <dt className="text-muted-foreground">CLS</dt>
            <dd className="font-mono tabular-nums">{show("cls", summary.field.cls)}</dd>
            <dt className="text-muted-foreground">Lab TBT</dt>
            <dd className="font-mono tabular-nums">{show("tbt", summary.lab.tbt)}</dd>
          </dl>
          {summary.topFixes.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm">
              {summary.topFixes.slice(0, 3).map((fix) => (
                <li key={fix.title}>
                  {fix.title} <span className="text-muted-foreground">(~{formatMs(fix.savingsMs)})</span>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">Not tested</p>
      )}
    </div>
  );
}

function PageBlock({ page }: { page: ReportPage }) {
  return (
    <li className="rounded-lg border bg-card p-4">
      <p className="font-medium break-all">{page.label ?? page.url}</p>
      {page.label && <p className="text-sm break-all text-muted-foreground">{page.url}</p>}
      <div className="mt-4 flex flex-col gap-6 sm:flex-row">
        <DeviceBlock label="Mobile" summary={page.mobile} />
        <DeviceBlock label="Desktop" summary={page.desktop} />
      </div>
    </li>
  );
}

export function ReportView({ snapshot, pdfHref }: { snapshot: ReportSnapshot; pdfHref: string }) {
  return (
    <article>
      <div className="h-1.5 rounded-full" style={{ backgroundColor: snapshot.brandColor }} aria-hidden />
      <p className="mt-6 text-xs font-medium tracking-widest text-muted-foreground uppercase">Performance report</p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight break-words">{snapshot.projectName}</h1>
        <a href={pdfHref} className="text-sm underline underline-offset-2">
          Download PDF
        </a>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        A read-only snapshot from <LocalTime iso={snapshot.generatedAt} />. Data from Google PageSpeed Insights.
      </p>

      <section aria-labelledby="pages-heading" className="mt-8">
        <h2 id="pages-heading" className="text-lg font-semibold">Pages</h2>
        <ul className="mt-4 flex flex-col gap-4">
          {snapshot.pages.map((page) => (
            <PageBlock key={page.url} page={page} />
          ))}
        </ul>
      </section>

      {snapshot.competitors.length > 0 && (
        <section aria-labelledby="competitors-heading" className="mt-10">
          <h2 id="competitors-heading" className="text-lg font-semibold">Competitors</h2>
          <ul className="mt-4 flex flex-col gap-4">
            {snapshot.competitors.map((page) => (
              <PageBlock key={page.url} page={page} />
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
