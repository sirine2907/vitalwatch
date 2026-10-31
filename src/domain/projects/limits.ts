// Every user shares one free PageSpeed and database quota, so accounts are capped.
export const MAX_PROJECTS_PER_USER = 5;
export const MAX_URLS_PER_PROJECT = 10;
export const MAX_PROJECT_NAME_LENGTH = 80;
export const MAX_URL_LABEL_LENGTH = 80;
export const MANUAL_RUNS_PER_HOUR = 30;

/** A run still pending after this long was killed before it could finish. */
export const STALE_PENDING_MS = 6 * 60 * 1000;
