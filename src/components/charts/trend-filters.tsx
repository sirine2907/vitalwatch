import Link from "next/link";
import { RANGES, TREND_METRICS, type RangeDays, type TrendMetric } from "@/domain/history/trend";
import { cn } from "@/lib/utils";

const GROUPS = ["Overall", "Real users", "Lab"] as const;

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={cn(
        "rounded-md border px-2.5 py-1 text-sm hover:bg-accent",
        active && "border-primary bg-primary text-primary-foreground hover:bg-primary",
      )}
    >
      {children}
    </Link>
  );
}

export function TrendFilters({
  basePath,
  range,
  metric,
}: {
  basePath: string;
  range: RangeDays;
  metric: TrendMetric;
}) {
  const href = (nextRange: RangeDays, nextMetric: TrendMetric) =>
    `${basePath}?range=${nextRange}&metric=${nextMetric}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Time range">
        <span className="w-20 text-sm text-muted-foreground">Range</span>
        {RANGES.map((option) => (
          <FilterLink key={option} href={href(option, metric)} active={option === range}>
            {option} days
          </FilterLink>
        ))}
      </div>
      {GROUPS.map((group) => (
        <div key={group} className="flex flex-wrap items-center gap-2" role="group" aria-label={group}>
          <span className="w-20 text-sm text-muted-foreground">{group}</span>
          {(Object.keys(TREND_METRICS) as TrendMetric[])
            .filter((key) => TREND_METRICS[key].group === group)
            .map((key) => (
              <FilterLink key={key} href={href(range, key)} active={key === metric}>
                {TREND_METRICS[key].label}
              </FilterLink>
            ))}
        </div>
      ))}
    </div>
  );
}
