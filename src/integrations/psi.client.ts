import { classifyPsiError } from "@/domain/psi/classify-error";
import type { Strategy } from "@/domain/psi/types";
import { AppError } from "@/lib/errors";
import { withRetry } from "@/lib/retry";

const PSI_ENDPOINT = "https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed";
const REQUEST_TIMEOUT_MS = 80_000;
const MAX_RETRIES = 2;
const BASE_DELAY_MS = 2_000;

export interface PsiClientConfig {
  apiKey: string;
  endpoint?: string;
}

async function requestOnce(
  url: string,
  strategy: Strategy,
  config: PsiClientConfig,
): Promise<unknown> {
  const request = new URL(config.endpoint ?? PSI_ENDPOINT);
  request.searchParams.set("url", url);
  request.searchParams.set("strategy", strategy.toUpperCase());
  request.searchParams.set("category", "PERFORMANCE");
  request.searchParams.set("key", config.apiKey);

  let response: Response;
  try {
    response = await fetch(request, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    // Fetch errors can quote the request URL, which contains the API key, so
    // only the error's type is kept.
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    throw new AppError(
      "psi_unavailable",
      timedOut
        ? "The test took too long. Slow pages can time out, so please try again."
        : "We couldn't reach PageSpeed Insights. Please try again shortly.",
      { status: 504, retryable: true },
    );
  }

  if (!response.ok) {
    throw classifyPsiError(response.status, await response.text());
  }

  try {
    return await response.json();
  } catch {
    throw new AppError("psi_bad_response", "PageSpeed Insights sent an unreadable response.", {
      status: 502,
      retryable: true,
    });
  }
}

/** Runs PSI for one URL and strategy, retrying only failures that can recover. */
export function fetchPsi(
  url: string,
  strategy: Strategy,
  config: PsiClientConfig,
): Promise<unknown> {
  return withRetry(() => requestOnce(url, strategy, config), {
    retries: MAX_RETRIES,
    baseDelayMs: BASE_DELAY_MS,
    shouldRetry: (error) => error instanceof AppError && error.retryable,
  });
}
