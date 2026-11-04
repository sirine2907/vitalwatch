import { rateScore } from "@/domain/vitals/thresholds";
import { cn } from "@/lib/utils";
import { RATING_LABEL, RATING_TEXT } from "./rating";

// Lighthouse's rating bands, drawn as a track under the score.
const ZONES = [
  { from: 0, to: 50, className: "bg-poor/25" },
  { from: 50, to: 90, className: "bg-needs-improvement/25" },
  { from: 90, to: 100, className: "bg-good/25" },
];
// The band starts. 100 is left out because it would crowd 90.
const LABELS = [0, 50, 90];

export function ScoreGauge({ score }: { score: number }) {
  const rating = rateScore(score);

  return (
    <div
      className="w-full shrink-0 rounded-xl border border-dashed border-input bg-card px-5 pt-4 pb-3 sm:w-72"
      role="img"
      aria-label={`Performance score ${score} out of 100, ${RATING_LABEL[rating]}`}
    >
      <div aria-hidden>
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Performance</p>
        <p className="mt-1 flex items-start gap-1">
          <span className="text-7xl leading-none font-semibold tracking-tight tabular-nums">{score}</span>
          <span className="mt-1.5 text-sm font-medium text-muted-foreground">/100</span>
        </p>
        <p className={cn("mt-2 text-sm font-semibold", RATING_TEXT[rating])}>{RATING_LABEL[rating]}</p>

        <div className="relative mt-4 flex h-2 gap-0.5">
          {ZONES.map((zone) => (
            <span
              key={zone.from}
              className={cn("h-full rounded-full", zone.className)}
              style={{ width: `${zone.to - zone.from}%` }}
            />
          ))}
          <span
            className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-foreground shadow"
            style={{ left: `${score}%` }}
          />
        </div>
        <div className="relative mt-1.5 h-4 text-[0.7rem] text-muted-foreground tabular-nums">
          {LABELS.map((label) => (
            <span
              key={label}
              className={cn("absolute", label === 0 ? "left-0" : "-translate-x-1/2")}
              style={label === 0 ? undefined : { left: `${label}%` }}
            >
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
