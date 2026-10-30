import { AppError } from "@/lib/errors";

const LIGHTHOUSE_ERROR = /lighthouse returned error|FAILED_DOCUMENT_REQUEST|ERRORED_DOCUMENT_REQUEST|DNS_FAILURE|NO_FCP|DOCUMENT_REQUEST/i;
const DAILY_QUOTA = /per day|1\/d\/|PerDay/i;

/**
 * Turns a failed PSI response into a user-safe error and decides whether
 * retrying could help. Sites that fail to load and exhausted daily quotas won't
 * recover within a retry window.
 */
export function classifyPsiError(status: number, body: string): AppError {
  if (status === 429) {
    if (DAILY_QUOTA.test(body)) {
      return new AppError(
        "psi_quota",
        "The daily PageSpeed Insights quota has run out. Add an API key or try again tomorrow.",
        { status: 503 },
      );
    }
    return new AppError("psi_busy", "PageSpeed Insights is busy. Please try again in a minute.", {
      status: 503,
      retryable: true,
      retryAfterSeconds: 60,
    });
  }

  if (LIGHTHOUSE_ERROR.test(body)) {
    return new AppError(
      "site_unreachable",
      "Google couldn't load this page. Check that it's public and loads in a browser.",
      { status: 422 },
    );
  }

  if (status === 400 || status === 404) {
    return new AppError(
      "site_unreachable",
      "PageSpeed Insights couldn't test this URL. Check that it's correct and public.",
      { status: 422 },
    );
  }

  if (status === 401 || status === 403) {
    return new AppError(
      "not_configured",
      "The PageSpeed Insights API key was rejected. Check the server configuration.",
      { status: 503 },
    );
  }

  return new AppError(
    "psi_unavailable",
    "PageSpeed Insights is having trouble right now. Please try again shortly.",
    { status: 502, retryable: status >= 500 },
  );
}
