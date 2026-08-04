import { describe, it, expect } from "vitest";
import { disabledErrorTrackingProvider } from "./disabled.provider";

describe("disabledErrorTrackingProvider", () => {
  it("never throws for a real Error", async () => {
    await expect(disabledErrorTrackingProvider.captureException(new Error("boom"), { operation: "test.op" })).resolves.toBeUndefined();
  });

  it("never throws for a non-Error thrown value", async () => {
    await expect(disabledErrorTrackingProvider.captureException("a string, not an Error", {})).resolves.toBeUndefined();
  });

  it("never throws for an empty context", async () => {
    await expect(disabledErrorTrackingProvider.captureException(new Error("boom"), {})).resolves.toBeUndefined();
  });
});
