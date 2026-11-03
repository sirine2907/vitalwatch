import { rateScore } from "@/domain/vitals/thresholds";
import { cn } from "@/lib/utils";
import { RATING_LABEL, RATING_TEXT } from "./rating";

const TICKS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
// The rating boundaries get a long tick and a number under the ruler.
const MAJOR_TICKS = [0, 50, 90, 100];

export function ScoreGauge({ score }: { score: number }) {
  const rating = rateScore(score);

  return (
    <div
      className="w-full shrink-0 border border-foreground bg-card px-5 pt-4 pb-3 sm:w-64"
      role="img"
      aria-label={`Performance score ${score} out of 100, ${RATING_LABEL[rating]}`}
    >
      <div className="flex items-start justify-between gap-3" aria-hidden>
        <span className="font-mono text-6xl leading-none font-semibold tabular-nums">{score}</span>
        <span
          className={cn(
            "mt-1 -rotate-3 border-2 border-current px-1.5 py-0.5 font-mono text-[0.7rem] font-semibold tracking-widest uppercase",
            RATING_TEXT[rating],
          )}
        >
          {RATING_LABEL[rating]}
        </span>
      </div>

      <div className="relative mt-5 h-3 border-b border-foreground" aria-hidden>
        {TICKS.map((tick) => (
          <span
            key={tick}
            className={cn(
              "absolute bottom-0 w-px bg-foreground",
              MAJOR_TICKS.includes(tick) ? "h-3" : "h-1.5",
            )}
            style={{ left: `${tick}%` }}
          />
        ))}
        <span
          className="absolute top-full mt-px size-0 -translate-x-1/2 border-x-[5px] border-b-[7px] border-x-transparent border-b-mark"
          style={{ left: `${score}%` }}
        />
      </div>
      <div className="relative mt-2.5 h-3 font-mono text-[0.65rem] text-muted-foreground" aria-hidden>
        {MAJOR_TICKS.map((tick) => (
          <span key={tick} className="absolute -translate-x-1/2" style={{ left: `${tick}%` }}>
            {tick}
          </span>
        ))}
      </div>
    </div>
  );
}
