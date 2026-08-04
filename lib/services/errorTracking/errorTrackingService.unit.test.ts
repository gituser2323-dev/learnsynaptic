import { describe, it, expect, vi, afterEach } from "vitest";

/**
 * RC-3 — the one behavior worth a dedicated test beyond the per-provider
 * suites: errorTrackingService.captureException() must NEVER throw, even
 * if the active provider itself has a bug and throws — error-reporting
 * infrastructure failing must never mask or replace the ORIGINAL error
 * the caller was already handling (see errorTrackingService.ts's own
 * doc comment).
 */

vi.mock("./registry", () => ({
  getErrorTrackingProvider: vi.fn(),
}));

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("errorTrackingService.captureException", () => {
  it("delegates to the active provider with the error and context unchanged", async () => {
    const captureException = vi.fn().mockResolvedValue(undefined);
    const { getErrorTrackingProvider } = await import("./registry");
    vi.mocked(getErrorTrackingProvider).mockReturnValue({ id: "disabled", captureException });

    const { errorTrackingService } = await import("./errorTrackingService");
    const error = new Error("boom");
    await errorTrackingService.captureException(error, { operation: "test.op", jobId: "job-1" });

    expect(captureException).toHaveBeenCalledWith(error, { operation: "test.op", jobId: "job-1" });
  });

  it("swallows a throwing provider instead of propagating — the original caller's error handling must never be disrupted by this", async () => {
    const { getErrorTrackingProvider } = await import("./registry");
    vi.mocked(getErrorTrackingProvider).mockReturnValue({
      id: "webhook",
      captureException: vi.fn().mockRejectedValue(new Error("provider itself is broken")),
    });

    const { errorTrackingService } = await import("./errorTrackingService");
    await expect(errorTrackingService.captureException(new Error("original error"))).resolves.toBeUndefined();
  });
});
