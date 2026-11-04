"use client";

import { CartesianGrid, Line, LineChart, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";
import { useHydrated } from "@/components/local-time";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { buildChartScale, formatMetricValue } from "@/domain/history/chart-scale";
import { TREND_METRICS, type TrendMetric, type TrendRow, type TrendSeries } from "@/domain/history/trend";
import { STRATEGIES, type Strategy } from "@/domain/psi/types";
import { cn } from "@/lib/utils";

// Black and pink to match the page. Desktop is also dashed, so the
// lines stay apart in print and for colorblind readers.
const SERIES_COLOR: Record<Strategy, string> = { mobile: "#141416", desktop: "#c2255c" };
const SERIES_DASH: Record<Strategy, string | undefined> = { mobile: undefined, desktop: "6 3" };
const SERIES_LABEL: Record<Strategy, string> = { mobile: "Mobile", desktop: "Desktop" };
const MAX_ROWS_WITH_DOTS = 60;
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

const chartConfig: ChartConfig = {
  mobile: { label: "Mobile", color: SERIES_COLOR.mobile },
  desktop: { label: "Desktop", color: SERIES_COLOR.desktop },
};

function formatTick(time: number, spanMs: number): string {
  const date = new Date(time);
  return spanMs < TWO_DAYS_MS
    ? date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function LineSwatch({ strategy, className }: { strategy: Strategy; className: string }) {
  return (
    <span
      className={cn("border-t-2", className)}
      style={{
        borderColor: SERIES_COLOR[strategy],
        borderTopStyle: SERIES_DASH[strategy] ? "dashed" : "solid",
      }}
      aria-hidden
    />
  );
}

function ChartTooltip({
  active,
  payload,
  metric,
}: {
  active?: boolean;
  payload?: readonly { payload?: unknown }[];
  metric: TrendMetric;
}) {
  const row = payload?.[0]?.payload as TrendRow | undefined;
  if (!active || !row) return null;
  const { unit } = TREND_METRICS[metric];

  return (
    <div className="rounded-lg border bg-card p-3 text-sm shadow-panel">
      <p className="text-xs text-muted-foreground">{new Date(row.time).toLocaleString()}</p>
      {STRATEGIES.map((strategy) => {
        const value = row[strategy];
        return (
          <p key={strategy} className="mt-1 flex items-center gap-2">
            <LineSwatch strategy={strategy} className="w-4" />
            <span className="font-semibold tabular-nums">
              {value === null ? "No data" : formatMetricValue(unit, value)}
            </span>
            <span className="text-muted-foreground">{SERIES_LABEL[strategy]}</span>
          </p>
        );
      })}
    </div>
  );
}

function latestValue(rows: TrendRow[], strategy: Strategy): number | null {
  for (let index = rows.length - 1; index >= 0; index--) {
    const value = rows[index][strategy];
    if (value !== null) return value;
  }
  return null;
}

export function TrendChart({ series, metric }: { series: TrendSeries; metric: TrendMetric }) {
  // Times use the viewer's locale and timezone, which the server can't know.
  const hydrated = useHydrated();
  const { unit } = TREND_METRICS[metric];
  const { rows, segments } = series;
  const scale = buildChartScale(rows, metric);
  const spanMs = rows.length > 1 ? rows[rows.length - 1].time - rows[0].time : 0;

  return (
    <div>
      <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        {STRATEGIES.map((strategy) => {
          const latest = latestValue(rows, strategy);
          return (
            <li key={strategy} className="flex items-center gap-2">
              <LineSwatch strategy={strategy} className="w-5" />
              <span className="text-muted-foreground">{SERIES_LABEL[strategy]}</span>
              <span className="font-semibold tabular-nums">
                {latest === null ? "No data" : formatMetricValue(unit, latest)}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 h-72">
        {hydrated && (
          <ChartContainer config={chartConfig} className="aspect-auto h-full w-full">
            <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="time"
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
                padding={{ left: 16, right: 16 }}
                tickFormatter={(time: number) => formatTick(time, spanMs)}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
                minTickGap={40}
              />
              <YAxis
                domain={[0, scale.max]}
                tickFormatter={(value: number) => (value === 0 ? "0" : formatMetricValue(unit, value))}
                tickLine={false}
                axisLine={false}
                width={56}
              />
              {scale.thresholds.map((line) => (
                <ReferenceLine
                  key={line.value}
                  y={line.value}
                  stroke="var(--muted-foreground)"
                  strokeOpacity={0.5}
                  label={{
                    value: line.label,
                    position: "insideTopRight",
                    fill: "var(--muted-foreground)",
                    fontSize: 11,
                  }}
                />
              ))}
              <Tooltip
                content={<ChartTooltip metric={metric} />}
                cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }}
              />
              {STRATEGIES.flatMap((strategy) =>
                segments[strategy].map((key) => {
                  // A lone point has no line, so it always needs its dot.
                  const points = rows.filter((row) => row[key] !== undefined).length;
                  const showDots = rows.length <= MAX_ROWS_WITH_DOTS || points === 1;
                  return (
                    <Line
                      key={key}
                      dataKey={key}
                      name={SERIES_LABEL[strategy]}
                      stroke={SERIES_COLOR[strategy]}
                      strokeWidth={2}
                      strokeDasharray={SERIES_DASH[strategy]}
                      strokeLinejoin="round"
                      connectNulls
                      isAnimationActive={false}
                      dot={
                        showDots
                          ? {
                              r: 3.5,
                              fill: SERIES_COLOR[strategy],
                              stroke: "var(--card)",
                              strokeWidth: 2,
                              strokeDasharray: "none",
                            }
                          : false
                      }
                      activeDot={{ r: 5, stroke: "var(--card)", strokeWidth: 2, strokeDasharray: "none" }}
                    />
                  );
                }),
              )}
            </LineChart>
          </ChartContainer>
        )}
      </div>

      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
          View as table
        </summary>
        <div className="mt-2 max-h-72 overflow-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 border-b bg-card text-left text-muted-foreground">
              <tr>
                <th scope="col" className="p-2 font-medium">Time</th>
                <th scope="col" className="p-2 font-medium">Mobile</th>
                <th scope="col" className="p-2 font-medium">Desktop</th>
              </tr>
            </thead>
            <tbody className="divide-y tabular-nums">
              {hydrated &&
                [...rows].reverse().map((row) => (
                  <tr key={row.time}>
                    <td className="p-2 font-sans">{new Date(row.time).toLocaleString()}</td>
                    {STRATEGIES.map((strategy) => {
                      const value = row[strategy];
                      return (
                        <td key={strategy} className="p-2">
                          {value === null ? "No data" : formatMetricValue(unit, value)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
