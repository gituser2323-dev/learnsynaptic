import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withRetry as whatsappWithRetry } from "./retry";
import { withRetry as emailWithRetry } from "../email/retry";

/**
 * Covers the retry/backoff math itself — the piece the E2E suite can
 * only ever exercise incidentally (a real send either succeeds or fails
 * once; nothing in tests/e2e/ forces a vendor to fail N times in a row
 * to prove the backoff curve or the retry-exhaustion cutoff). Both
 * lib/services/whatsapp/retry.ts and lib/services/email/retry.ts are
 * deliberately separate, byte-identical copies (see each file's own
 * doc comment on why) — tested together here with one shared spec so a
 * future edit to one that silently drifts from the other fails a test,
 * without forcing the production code back into a single shared import
 * across channel modules.
 */
describe.each([
  ["whatsapp", whatsappWithRetry],
  ["email", emailWithRetry],
])("%s withRetry", (_label, withRetry) => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the result on first success without waiting", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 100, isRetryable: () => true });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries a retryable failure and succeeds on a later attempt", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("transient"))
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValueOnce("ok");

    const promise = withRetry(fn, { maxAttempts: 3, baseDelayMs: 100, isRetryable: () => true });
    // Two backoff sleeps stand between attempt 1 and the eventual
    // success — advance past both before awaiting the result.
    await vi.advanceTimersByTimeAsync(100); // 100 * 2^0 after attempt 1
    await vi.advanceTimersByTimeAsync(200); // 100 * 2^1 after attempt 2

    await expect(promise).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("waits with exponential backoff between attempts (100, 200, 400ms for baseDelayMs=100)", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("always fails"));
    const sleepSpy = vi.spyOn(global, "setTimeout");

    const promise = withRetry(fn, { maxAttempts: 4, baseDelayMs: 100, isRetryable: () => true }).catch((e) => e);
    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(200);
    await vi.advanceTimersByTimeAsync(400);
    await promise;

    const delays = sleepSpy.mock.calls.map((call) => call[1]);
    expect(delays).toEqual([100, 200, 400]);
    sleepSpy.mockRestore();
  });

  it("stops retrying and throws once maxAttempts is reached", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("permanent"));
    const promise = withRetry(fn, { maxAttempts: 3, baseDelayMs: 10, isRetryable: () => true });
    const assertion = expect(promise).rejects.toThrow("permanent");
    await vi.advanceTimersByTimeAsync(10);
    await vi.advanceTimersByTimeAsync(20);
    await assertion;
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("does not retry a non-retryable failure, even with attempts remaining", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("validation error"));
    const promise = withRetry(fn, { maxAttempts: 5, baseDelayMs: 1000, isRetryable: () => false });
    await expect(promise).rejects.toThrow("validation error");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("isRetryable sees the actual thrown error, not a wrapped/stringified version", async () => {
    class VendorError extends Error {
      constructor(public code: string) {
        super(`vendor error ${code}`);
      }
    }
    const fn = vi.fn().mockRejectedValue(new VendorError("RATE_LIMIT"));
    const isRetryable = vi.fn().mockReturnValue(false);

    await expect(withRetry(fn, { maxAttempts: 3, baseDelayMs: 10, isRetryable })).rejects.toThrow("vendor error RATE_LIMIT");
    expect(isRetryable).toHaveBeenCalledWith(expect.any(VendorError));
    expect((isRetryable.mock.calls[0][0] as VendorError).code).toBe("RATE_LIMIT");
  });
});
