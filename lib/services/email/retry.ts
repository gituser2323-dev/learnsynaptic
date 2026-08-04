export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  /** Called on each failure to decide whether another attempt is worth
   *  making — e.g. a network error or a 5xx/429 from the vendor is
   *  retryable, a 4xx validation error is not. */
  isRetryable: (error: unknown) => boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generic retry-with-exponential-backoff wrapper — the same shape
 * lib/services/whatsapp/retry.ts already established for its own
 * vendor adapters. Kept as its own copy rather than a shared import
 * across modules: each channel module (WhatsApp, Email, ...) stays
 * independently swappable/removable, the same isolation the registry's
 * own doc comment already calls out ("no caller anywhere else
 * changes") — a generic 20-line function isn't worth a cross-phase
 * dependency to save the duplication.
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
