export const SCHEDULES = ["off", "hourly", "daily", "weekly"] as const;
export type Schedule = (typeof SCHEDULES)[number];

const HOUR_MS = 60 * 60 * 1000;

const INTERVAL_MS: Record<Exclude<Schedule, "off">, number> = {
  hourly: HOUR_MS,
  daily: 24 * HOUR_MS,
  weekly: 7 * 24 * HOUR_MS,
};

export const SCHEDULE_LABELS: Record<Schedule, string> = {
  off: "Off",
  hourly: "Every hour",
  daily: "Every day",
  weekly: "Every week",
};

export function runsPerDay(schedule: Schedule): number {
  return schedule === "off" ? 0 : (24 * HOUR_MS) / INTERVAL_MS[schedule];
}

/**
 * The slot after `due`. Slots that were missed, for example while the
 * scheduler was down, are skipped rather than run all at once.
 */
export function nextRunAfter(schedule: Schedule, due: Date, now: Date): Date | null {
  if (schedule === "off") return null;
  const interval = INTERVAL_MS[schedule];
  const missed = Math.max(0, Math.floor((now.getTime() - due.getTime()) / interval));
  return new Date(due.getTime() + (missed + 1) * interval);
}

/** A new or changed schedule starts at the next dispatcher tick. */
export function firstRunAt(schedule: Schedule, now: Date): Date | null {
  return schedule === "off" ? null : now;
}
