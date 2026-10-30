export interface RetryOptions {
  retries: number;
  baseDelayMs: number;
  shouldRetry: (error: unknown) => boolean;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Runs `operation`, retrying with exponential backoff. Jitter keeps concurrent
 * callers from all retrying at the same moment.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const sleep = options.sleep ?? defaultSleep;
  const random = options.random ?? Math.random;

  for (let attempt = 0; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= options.retries || !options.shouldRetry(error)) {
        throw error;
      }
      const backoff = options.baseDelayMs * 2 ** attempt;
      await sleep(backoff * (0.5 + random() * 0.5));
    }
  }
}
