import { rateScore } from "@/domain/vitals/thresholds";
import { cn } from "@/lib/utils";
import { RATING_LABEL, RATING_TEXT } from "./rating";

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function ScoreGauge({ score }: { score: number }) {
  const rating = rateScore(score);

  return (
    <div
      className="relative size-36 shrink-0"
      role="img"
      aria-label={`Performance score ${score} out of 100, ${RATING_LABEL[rating]}`}
    >
      <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden>
        <circle cx="60" cy="60" r={RADIUS} fill="none" strokeWidth="9" className="stroke-muted" />
        <circle
          cx="60"
          cy="60"
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - score / 100)}
          className={RATING_TEXT[rating]}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-4xl font-semibold tabular-nums">{score}</span>
        <span className={cn("text-xs font-medium", RATING_TEXT[rating])}>
          {RATING_LABEL[rating]}
        </span>
      </div>
    </div>
  );
}
