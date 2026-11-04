import { rateScore } from "@/domain/vitals/thresholds";
import { cn } from "@/lib/utils";
import { RATING_LABEL, RATING_TEXT } from "./rating";

export function ScoreLabel({ score }: { score: number | null }) {
  if (score === null) return <span className="text-muted-foreground">Not tested</span>;
  const rating = rateScore(score);

  return (
    <span className="whitespace-nowrap">
      <span className="font-semibold tabular-nums">{score}</span>{" "}
      <span className={cn("text-xs font-medium", RATING_TEXT[rating])}>{RATING_LABEL[rating]}</span>
    </span>
  );
}
