import { STRATEGIES } from "@/domain/psi/types";
import { runsPerDay, type Schedule } from "./schedule";

/**
 * Scheduled tests per user per day. QStash's free tier allows 1,000 messages a
 * day for the whole app, so each user gets a slice of it.
 */
export const DAILY_SCHEDULED_TESTS_PER_USER = 100;

export interface ProjectLoad {
  schedule: Schedule;
  urlCount: number;
}

export function dailyTests(load: ProjectLoad): number {
  return runsPerDay(load.schedule) * load.urlCount * STRATEGIES.length;
}

/** Returns an error message when a change would push the user over their share. */
export function checkScheduleQuota(projects: ProjectLoad[]): string | null {
  const total = projects.reduce((sum, project) => sum + dailyTests(project), 0);
  if (total <= DAILY_SCHEDULED_TESTS_PER_USER) return null;
  return `That would run ${total} scheduled tests a day, over the limit of ${DAILY_SCHEDULED_TESTS_PER_USER}. Choose a slower schedule or track fewer URLs.`;
}
