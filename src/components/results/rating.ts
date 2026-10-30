import type { Rating } from "@/domain/vitals/thresholds";

export const RATING_LABEL: Record<Rating, string> = {
  good: "Good",
  "needs-improvement": "Needs work",
  poor: "Poor",
};

export const RATING_TEXT: Record<Rating, string> = {
  good: "text-good",
  "needs-improvement": "text-needs-improvement",
  poor: "text-poor",
};
