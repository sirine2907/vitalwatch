import type { Metadata } from "next";
import Link from "next/link";
import { LocalTime } from "@/components/local-time";
import { CompareTestsButton } from "@/components/reports/compare-tests-button";
import { STRATEGIES, type Strategy } from "@/domain/psi/types";
import { cn } from "@/lib/utils";
import { requireUser } from "@/lib/session";
import { reportService } from "@/services/app.factory";
import { orNotFound } from "../../../helpers";

export const metadata: Metadata = { title: "Compare", robots: { index: false } };

export default async function ComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ url?: string; strategy?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const user = await requireUser();
  const strategy: Strategy = query.strategy === "desktop" ? "desktop" : "mobile";
  const { project, yours, columns, rows, urls, competitors } = await orNotFound(
    reportService().compare(user.id, id, query.url, strategy),
  );
  const href = (urlId: string | undefined, device: Strategy) =>
    `/projects/${id}/compare?${new URLSearchParams({ ...(urlId ? { url: urlId } : {}), strategy: device })}`;

  return (
    <div>
      <Link href={`/projects/${id}`} className="text-sm text-muted-foreground hover:underline">
        {project.name}
      </Link>
      <h1 className="mt-1 text-4xl leading-none font-bold sm:text-5xl">Compare with competitors</h1>

      {!yours || competitors.length === 0 ? (
        <p className="mt-6 rounded-2xl border bg-card shadow-panel p-4 text-muted-foreground">
          Add at least one page and one competitor on the{" "}
          <Link href={`/projects/${id}`} className="underline underline-offset-2">
            project page
          </Link>{" "}
          to compare them.
        </p>
      ) : (
        <>
          <div className="mt-6 flex flex-col gap-3">
            {urls.length > 1 && (
              <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Your page">
                <span className="w-20 text-sm text-muted-foreground">Your page</span>
                {urls.map((url) => (
                  <Link
                    key={url.id}
                    href={href(url.id, strategy)}
                    aria-current={url.id === yours.id ? "true" : undefined}
                    className={cn(
                      "rounded-md border px-2.5 py-1 text-sm break-all hover:bg-accent",
                      url.id === yours.id && "border-primary bg-primary text-primary-foreground hover:bg-primary",
                    )}
                  >
                    {url.label ?? url.url}
                  </Link>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Device">
              <span className="w-20 text-sm text-muted-foreground">Device</span>
              {STRATEGIES.map((device) => (
                <Link
                  key={device}
                  href={href(yours.id, device)}
                  aria-current={device === strategy ? "true" : undefined}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-sm capitalize hover:bg-accent",
                    device === strategy && "border-primary bg-primary text-primary-foreground hover:bg-primary",
                  )}
                >
                  {device}
                </Link>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <CompareTestsButton urlIds={[yours.id, ...competitors.map((c) => c.id)]} strategy={strategy} />
          </div>

          <div className="mt-6 overflow-x-auto rounded-2xl border bg-card shadow-panel">
            <table className="w-full text-sm">
              <caption className="sr-only">
                Your page against competitors on {strategy}. The best value in each row is marked.
              </caption>
              <thead className="border-b text-left">
                <tr>
                  <th scope="col" className="p-3 font-medium text-muted-foreground">Metric</th>
                  {columns.map((column) => (
                    <th key={column.url} scope="col" className="p-3 align-bottom font-medium">
                      <span className="block break-all">{column.label}</span>
                      <span className="block text-xs font-normal text-muted-foreground">
                        {column.isYours ? "Yours. " : ""}
                        {column.testedAt ? <LocalTime iso={column.testedAt.toISOString()} /> : "Not tested"}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => (
                  <tr key={row.label}>
                    <th scope="row" className="p-3 text-left font-normal text-muted-foreground">
                      {row.label}
                    </th>
                    {row.cells.map((cell, index) => {
                      const best = row.best.includes(index);
                      return (
                        <td key={index} className={cn("p-3 tabular-nums", best && "font-semibold")}>
                          {cell ?? <span className="font-sans text-muted-foreground">No data</span>}
                          {best && <span className="ml-1.5 font-sans text-xs font-medium text-good">Best</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Competitors are only tested when you ask, and never raise alerts.
          </p>
        </>
      )}
    </div>
  );
}
