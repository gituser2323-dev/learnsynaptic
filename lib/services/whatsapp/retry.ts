export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  /** Called on each failure to decide whether another attempt is worth
   *  making — e.g. a network error or a 5xx/429 from the vendor is
   *  retryable, a 4xx validation error is not (retrying won't fix a
   *  malformed template name). */
  isRetryable: (error: unknown) => boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generic retry-with-exponential-backoff wrapper. Used by
 * providers/metaCloudApi.provider.ts's send methods; kept independent of
 * any vendor so a future real adapter (AiSensy, etc.) can reuse it
 * without duplicating retry logic.
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === options.maxAttempts || !options.isRetryable(error)) {
        throw error;
      }
      await sleep(options.baseDelayMs * 2 ** (attempt - 1));
    }
  }
  throw lastError;
}
