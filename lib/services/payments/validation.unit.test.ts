import { describe, it, expect } from "vitest";
import { validateCreateCheckoutSessionInput, validateCreatePaymentInput } from "./validation";

const VALID_INPUT = {
  provider: "razorpay",
  amountInSmallestUnit: 250000,
  currency: "inr",
  purpose: "Full Stack DevOps — Program Fee",
  returnUrl: "https://learnsynaptic.com/admin/payments",
};

describe("validateCreateCheckoutSessionInput", () => {
  it("accepts valid input and uppercases currency", () => {
    const result = validateCreateCheckoutSessionInput(VALID_INPUT);
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.data.currency).toBe("INR");
    expect(result.data.provider).toBe("razorpay");
  });

  it("rejects an unknown provider id", () => {
    const result = validateCreateCheckoutSessionInput({ ...VALID_INPUT, provider: "not-a-real-provider" });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.errors.some((e) => e.field === "provider")).toBe(true);
  });

  it("rejects a non-integer or non-positive amount", () => {
    expect(validateCreateCheckoutSessionInput({ ...VALID_INPUT, amountInSmallestUnit: 0 }).valid).toBe(false);
    expect(validateCreateCheckoutSessionInput({ ...VALID_INPUT, amountInSmallestUnit: -100 }).valid).toBe(false);
    expect(validateCreateCheckoutSessionInput({ ...VALID_INPUT, amountInSmallestUnit: 100.5 }).valid).toBe(false);
  });

  it("rejects a malformed currency code", () => {
    expect(validateCreateCheckoutSessionInput({ ...VALID_INPUT, currency: "rupees" }).valid).toBe(false);
    expect(validateCreateCheckoutSessionInput({ ...VALID_INPUT, currency: "" }).valid).toBe(false);
  });

  it("rejects a missing purpose", () => {
    const result = validateCreateCheckoutSessionInput({ ...VALID_INPUT, purpose: "" });
    expect(result.valid).toBe(false);
  });

  it("rejects a missing or malformed returnUrl", () => {
    expect(validateCreateCheckoutSessionInput({ ...VALID_INPUT, returnUrl: "" }).valid).toBe(false);
    expect(validateCreateCheckoutSessionInput({ ...VALID_INPUT, returnUrl: "not a url" }).valid).toBe(false);
    expect(validateCreateCheckoutSessionInput({ ...VALID_INPUT, returnUrl: "ftp://example.com" }).valid).toBe(false);
  });

  it("rejects a malformed customer email but accepts a valid one", () => {
    expect(validateCreateCheckoutSessionInput({ ...VALID_INPUT, customerEmail: "not-an-email" }).valid).toBe(false);
    const result = validateCreateCheckoutSessionInput({ ...VALID_INPUT, customerEmail: "lead@example.com" });
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.data.customerEmail).toBe("lead@example.com");
  });

  it("filters metadata to string/number values only, capped at 20 entries", () => {
    const result = validateCreateCheckoutSessionInput({ ...VALID_INPUT, metadata: { a: "x", b: 5, c: { nested: true }, d: null } });
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.data.metadata).toEqual({ a: "x", b: "5" });
  });
});

describe("validateCreatePaymentInput", () => {
  it("accepts valid input with optional CRM linkage fields", () => {
    const result = validateCreatePaymentInput({ ...VALID_INPUT, leadId: "lead_1", registrationId: "reg_1" });
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.data.checkout.provider).toBe("razorpay");
    expect(result.data.leadId).toBe("lead_1");
    expect(result.data.registrationId).toBe("reg_1");
  });

  it("omits linkage fields when not supplied", () => {
    const result = validateCreatePaymentInput(VALID_INPUT);
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.data.leadId).toBeUndefined();
  });

  it("propagates checkout validation errors", () => {
    const result = validateCreatePaymentInput({ ...VALID_INPUT, provider: "unknown" });
    expect(result.valid).toBe(false);
  });
});
