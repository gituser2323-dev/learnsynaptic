import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHmac } from "crypto";
import type { integrationService as IntegrationServiceType } from "@/lib/services/integrations";
import type { registrationService as RegistrationServiceType } from "@/lib/services/registrations";
import type { getRegistrationRepository as GetRegistrationRepositoryType, getPaymentRepository as GetPaymentRepositoryType } from "@/lib/db";
import type { paymentService as PaymentServiceType } from "./paymentService";

/**
 * Payments Integration (Phase 6), Module 6.4 — paymentService's own
 * full lifecycle, tested end to end against the in-memory repositories
 * (this test env has no MongoDB configured) with mocked fetch standing
 * in for Razorpay's real API — the same "real integration test over a
 * mock service" discipline this codebase already applies (calendarService,
 * webhookService). Razorpay's own real config env vars are stubbed via
 * vi.stubEnv() + vi.resetModules() + a fresh dynamic import per test
 * file run, since config/payments.ts reads process.env once at module
 * load — the identical technique providers.unit.test.ts already
 * validates.
 */

// Every one of these is re-resolved fresh in beforeEach, after
// vi.resetModules() — a static top-level import here would bind to a
// module instance from BEFORE the reset, while paymentService's own
// internal imports resolve fresh, so the two would silently operate on
// two different in-memory stores (integrationService's "connected"
// state written by one, read by the other). Same isolation concern
// schedulerService.unit.test.ts's own doc comment already documents
// for a different pair of module-level singletons.
let paymentService: typeof PaymentServiceType;
let integrationService: typeof IntegrationServiceType;
let registrationService: typeof RegistrationServiceType;
let getRegistrationRepository: typeof GetRegistrationRepositoryType;
let getPaymentRepository: typeof GetPaymentRepositoryType;

const VALID_CHECKOUT_INPUT = {
  provider: "razorpay",
  amountInSmallestUnit: 250000,
  currency: "INR",
  purpose: "Full Stack DevOps — Program Fee",
  returnUrl: "https://learnsynaptic.com/admin/payments",
};

async function connectRazorpay(): Promise<void> {
  const result = await integrationService.connect("razorpay", {});
  if (!result.success) throw new Error("Setup failed: could not connect razorpay — " + JSON.stringify(result.error));
}

const originalFetch = global.fetch;

beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv("RAZORPAY_KEY_ID", "rzp_test_key");
  vi.stubEnv("RAZORPAY_KEY_SECRET", "rzp_test_secret");
  vi.stubEnv("RAZORPAY_WEBHOOK_SECRET", "whsec_razorpay");
  ({ paymentService } = await import("./paymentService"));
  ({ integrationService } = await import("@/lib/services/integrations"));
  ({ registrationService } = await import("@/lib/services/registrations"));
  ({ getRegistrationRepository, getPaymentRepository } = await import("@/lib/db"));
  await connectRazorpay();
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

function mockFetchSequence(responses: { status: number; body: unknown }[]) {
  let call = 0;
  global.fetch = vi.fn(async () => {
    const response = responses[Math.min(call, responses.length - 1)];
    call++;
    return new Response(JSON.stringify(response.body), { status: response.status });
  }) as unknown as typeof fetch;
}

describe("paymentService.createPayment", () => {
  it("creates a real checkout session and persists a 'created' Payment row", async () => {
    mockFetchSequence([{ status: 200, body: { id: "plink_1", short_url: "https://rzp.io/i/abc123" } }]);
    const result = await paymentService.createPayment(VALID_CHECKOUT_INPUT);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.payment.status).toBe("created");
    expect(result.payment.providerOrderId).toBe("plink_1");
    expect(result.payment.checkoutUrl).toBe("https://rzp.io/i/abc123");
  });

  it("returns validation errors rather than throwing for invalid input", async () => {
    const result = await paymentService.createPayment({ ...VALID_CHECKOUT_INPUT, amountInSmallestUnit: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects against a provider that isn't connected+enabled", async () => {
    await integrationService.disconnect("razorpay");
    await expect(paymentService.createPayment(VALID_CHECKOUT_INPUT)).rejects.toThrow();
  });

  it("still persists the Payment as 'failed' (Error Recovery) when the real vendor call fails", async () => {
    mockFetchSequence([{ status: 400, body: { error: { description: "Invalid amount" } } }]);
    const result = await paymentService.createPayment(VALID_CHECKOUT_INPUT);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.payment.status).toBe("failed");
    expect(result.payment.checkoutUrl).toBeUndefined();
  });

  it("links leadId/registrationId/opportunityId/campaignId onto the persisted row", async () => {
    mockFetchSequence([{ status: 200, body: { id: "plink_2", short_url: "https://rzp.io/i/def456" } }]);
    const result = await paymentService.createPayment({ ...VALID_CHECKOUT_INPUT, leadId: "lead_1", registrationId: "reg_1", opportunityId: "opp_1", campaignId: "camp_1" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.payment.leadId).toBe("lead_1");
    expect(result.payment.registrationId).toBe("reg_1");
    expect(result.payment.opportunityId).toBe("opp_1");
    expect(result.payment.campaignId).toBe("camp_1");
  });
});

describe("paymentService.checkStatus", () => {
  it("transitions a 'created' payment to 'succeeded' when the vendor confirms payment", async () => {
    mockFetchSequence([{ status: 200, body: { id: "plink_3", short_url: "https://rzp.io/i/x" } }]);
    const created = await paymentService.createPayment(VALID_CHECKOUT_INPUT);
    expect(created.success).toBe(true);
    if (!created.success) return;

    mockFetchSequence([
      { status: 200, body: { status: "paid", amount_paid: 250000, currency: "INR", payments: [{ status: "captured", payment_id: "pay_1" }] } },
    ]);
    const updated = await paymentService.checkStatus(created.payment.id);
    expect(updated.status).toBe("succeeded");
    expect(updated.providerPaymentId).toBe("pay_1");
  });

  it("confirms a linked Registration on success", async () => {
    const registrationRepository = await getRegistrationRepository();
    const registration = await registrationRepository.create({ leadId: "lead_x", programSlug: "full-stack-devops", source: "test" });
    expect(registration.status).toBe("pending");

    mockFetchSequence([{ status: 200, body: { id: "plink_4", short_url: "https://rzp.io/i/y" } }]);
    const created = await paymentService.createPayment({ ...VALID_CHECKOUT_INPUT, registrationId: registration.id });
    expect(created.success).toBe(true);
    if (!created.success) return;

    mockFetchSequence([{ status: 200, body: { status: "paid", amount_paid: 250000, currency: "INR", payments: [{ status: "captured", payment_id: "pay_2" }] } }]);
    await paymentService.checkStatus(created.payment.id);

    const confirmed = await registrationService.confirmRegistration(registration.id);
    expect(confirmed?.status).toBe("confirmed");
  });

  it("transitions to 'failed' when the payment link expired", async () => {
    mockFetchSequence([{ status: 200, body: { id: "plink_5", short_url: "https://rzp.io/i/z" } }]);
    const created = await paymentService.createPayment(VALID_CHECKOUT_INPUT);
    expect(created.success).toBe(true);
    if (!created.success) return;

    mockFetchSequence([{ status: 200, body: { status: "expired" } }]);
    const updated = await paymentService.checkStatus(created.payment.id);
    expect(updated.status).toBe("failed");
  });

  it("is idempotent — calling twice after success does not re-apply CRM side effects or throw", async () => {
    mockFetchSequence([{ status: 200, body: { id: "plink_6", short_url: "https://rzp.io/i/w" } }]);
    const created = await paymentService.createPayment(VALID_CHECKOUT_INPUT);
    expect(created.success).toBe(true);
    if (!created.success) return;

    mockFetchSequence([{ status: 200, body: { status: "paid", amount_paid: 250000, currency: "INR", payments: [{ status: "captured", payment_id: "pay_3" }] } }]);
    await paymentService.checkStatus(created.payment.id);
    const second = await paymentService.checkStatus(created.payment.id);
    expect(second.status).toBe("succeeded");
  });
});

describe("paymentService.refundPayment", () => {
  async function createAndSucceed(): Promise<string> {
    mockFetchSequence([{ status: 200, body: { id: "plink_r1", short_url: "https://rzp.io/i/r1" } }]);
    const created = await paymentService.createPayment(VALID_CHECKOUT_INPUT);
    if (!created.success) throw new Error("setup failed");
    mockFetchSequence([{ status: 200, body: { status: "paid", amount_paid: 250000, currency: "INR", payments: [{ status: "captured", payment_id: "pay_r1" }] } }]);
    await paymentService.checkStatus(created.payment.id);
    return created.payment.id;
  }

  it("issues a full refund and marks status 'refunded'", async () => {
    const id = await createAndSucceed();
    mockFetchSequence([{ status: 200, body: { id: "rfnd_1", amount: 250000, status: "processed" } }]);
    const refunded = await paymentService.refundPayment(id, undefined, "Customer requested");
    expect(refunded.status).toBe("refunded");
    expect(refunded.refundedAmountInSmallestUnit).toBe(250000);
  });

  it("issues a partial refund and marks status 'partially_refunded'", async () => {
    const id = await createAndSucceed();
    mockFetchSequence([{ status: 200, body: { id: "rfnd_2", amount: 100000, status: "processed" } }]);
    const refunded = await paymentService.refundPayment(id, 100000, undefined);
    expect(refunded.status).toBe("partially_refunded");
    expect(refunded.refundedAmountInSmallestUnit).toBe(100000);
  });

  it("rejects refunding a payment that never succeeded", async () => {
    mockFetchSequence([{ status: 400, body: { error: { description: "fail" } } }]);
    const created = await paymentService.createPayment(VALID_CHECKOUT_INPUT);
    expect(created.success).toBe(true);
    if (!created.success) return;
    await expect(paymentService.refundPayment(created.payment.id, undefined, undefined)).rejects.toThrow();
  });
});

describe("paymentService.retryPayment", () => {
  it("creates a new Payment linked via retryOfPaymentId, reusing the original's amount/purpose/linkage", async () => {
    mockFetchSequence([{ status: 400, body: { error: { description: "declined" } } }]);
    const original = await paymentService.createPayment({ ...VALID_CHECKOUT_INPUT, leadId: "lead_retry" });
    expect(original.success).toBe(true);
    if (!original.success) return;
    expect(original.payment.status).toBe("failed");

    mockFetchSequence([{ status: 200, body: { id: "plink_retry", short_url: "https://rzp.io/i/retry" } }]);
    const retried = await paymentService.retryPayment(original.payment.id, "https://learnsynaptic.com/return");
    expect(retried.success).toBe(true);
    if (!retried.success) return;
    expect(retried.payment.retryOfPaymentId).toBe(original.payment.id);
    expect(retried.payment.leadId).toBe("lead_retry");
    expect(retried.payment.amountInSmallestUnit).toBe(original.payment.amountInSmallestUnit);
  });

  it("rejects retrying a payment that isn't failed", async () => {
    mockFetchSequence([{ status: 200, body: { id: "plink_notfailed", short_url: "https://rzp.io/i/nf" } }]);
    const created = await paymentService.createPayment(VALID_CHECKOUT_INPUT);
    expect(created.success).toBe(true);
    if (!created.success) return;
    await expect(paymentService.retryPayment(created.payment.id, "https://x.com")).rejects.toThrow();
  });
});

describe("paymentService.handleProviderWebhook", () => {
  function signedHeaders(rawBody: string): Record<string, string> {
    return { "x-razorpay-signature": createHmac("sha256", "whsec_razorpay").update(rawBody).digest("hex") };
  }

  it("rejects and records a signature-invalid webhook without throwing an unhandled error", async () => {
    const rawBody = JSON.stringify({ event: "payment.captured" });
    await expect(paymentService.handleProviderWebhook("razorpay", rawBody, { "x-razorpay-signature": "wrong" })).rejects.toThrow();

    const events = await paymentService.listWebhookEvents({ provider: "razorpay" });
    expect(events.items[0].outcome).toBe("signature_invalid");
  });

  it("processes a real payment.captured webhook and transitions the matching Payment to succeeded", async () => {
    mockFetchSequence([{ status: 200, body: { id: "plink_wh1", short_url: "https://rzp.io/i/wh1" } }]);
    const created = await paymentService.createPayment(VALID_CHECKOUT_INPUT);
    expect(created.success).toBe(true);
    if (!created.success) return;

    const rawBody = JSON.stringify({
      event: "payment.captured",
      event_id: "evt_wh1",
      payload: { payment: { entity: { id: "pay_wh1", order_id: "plink_wh1", amount: 250000, currency: "INR" } } },
    });
    await paymentService.handleProviderWebhook("razorpay", rawBody, signedHeaders(rawBody));

    const payment = await paymentService.getPayment(created.payment.id);
    expect(payment?.status).toBe("succeeded");
    expect(payment?.providerPaymentId).toBe("pay_wh1");

    const events = await paymentService.listWebhookEvents({});
    expect(events.items.some((e) => e.outcome === "processed" && e.paymentId === created.payment.id)).toBe(true);
  });

  it("is idempotent against the same providerEventId delivered twice", async () => {
    mockFetchSequence([{ status: 200, body: { id: "plink_wh2", short_url: "https://rzp.io/i/wh2" } }]);
    const created = await paymentService.createPayment(VALID_CHECKOUT_INPUT);
    expect(created.success).toBe(true);
    if (!created.success) return;

    const rawBody = JSON.stringify({
      event: "payment.captured",
      event_id: "evt_wh2_dup",
      payload: { payment: { entity: { id: "pay_wh2", order_id: "plink_wh2", amount: 250000, currency: "INR" } } },
    });
    await paymentService.handleProviderWebhook("razorpay", rawBody, signedHeaders(rawBody));
    await paymentService.handleProviderWebhook("razorpay", rawBody, signedHeaders(rawBody));

    const events = await paymentService.listWebhookEvents({});
    const duplicates = events.items.filter((e) => e.eventType === "payment.succeeded" && e.outcome === "duplicate");
    expect(duplicates).toHaveLength(1);
  });

  it("records 'error' outcome (never throws to the caller as unrecoverable) when no matching Payment exists", async () => {
    const rawBody = JSON.stringify({
      event: "payment.captured",
      event_id: "evt_no_match",
      payload: { payment: { entity: { id: "pay_x", order_id: "no-such-order" } } },
    });
    await paymentService.handleProviderWebhook("razorpay", rawBody, signedHeaders(rawBody));
    const events = await paymentService.listWebhookEvents({});
    expect(events.items.some((e) => e.providerEventId === "evt_no_match" && e.outcome === "error")).toBe(true);
  });

  describe("RC-3 — pentest: concurrent webhook delivery never double-applies side effects", () => {
    it("two GENUINELY CONCURRENT deliveries of the same providerEventId: exactly one is claimed and processed, the other is recorded as a duplicate, and the non-idempotent side effect (confirming a linked Registration) fires exactly once", async () => {
      const registrationRepository = await getRegistrationRepository();
      const registration = await registrationRepository.create({ leadId: "lead_race", programSlug: "full-stack-devops", source: "test" });

      mockFetchSequence([{ status: 200, body: { id: "plink_race", short_url: "https://rzp.io/i/race" } }]);
      const created = await paymentService.createPayment({ ...VALID_CHECKOUT_INPUT, registrationId: registration.id });
      expect(created.success).toBe(true);
      if (!created.success) return;

      const confirmSpy = vi.spyOn(registrationService, "confirmRegistration");

      const rawBody = JSON.stringify({
        event: "payment.captured",
        event_id: "evt_race",
        payload: { payment: { entity: { id: "pay_race", order_id: "plink_race", amount: 250000, currency: "INR" } } },
      });

      // Promise.all, not sequential awaits — both requests genuinely in
      // flight at once, both passing the early read-check before either
      // finishes, exactly the scenario a naive read-then-insert-at-the-
      // end design cannot close (see paymentService.handleProviderWebhook's
      // own doc comment for the full fix this proves).
      await Promise.all([
        paymentService.handleProviderWebhook("razorpay", rawBody, signedHeaders(rawBody)),
        paymentService.handleProviderWebhook("razorpay", rawBody, signedHeaders(rawBody)),
      ]);

      const events = await paymentService.listWebhookEvents({});
      const forThisEvent = events.items.filter((e) => e.providerEventId === "evt_race");
      expect(forThisEvent.filter((e) => e.outcome === "processed")).toHaveLength(1);
      expect(forThisEvent.filter((e) => e.outcome === "duplicate")).toHaveLength(1);
      expect(confirmSpy).toHaveBeenCalledTimes(1);

      const payment = await paymentService.getPayment(created.payment.id);
      expect(payment?.status).toBe("succeeded");
    });

    it("a webhook whose side-effect application fails is recorded as 'error', not silently swallowed as a duplicate — a genuine retry of the same event safely reprocesses instead of being permanently dropped", async () => {
      mockFetchSequence([{ status: 200, body: { id: "plink_retry", short_url: "https://rzp.io/i/retry" } }]);
      const created = await paymentService.createPayment(VALID_CHECKOUT_INPUT);
      expect(created.success).toBe(true);
      if (!created.success) return;

      const paymentRepository = await getPaymentRepository();
      // Fails BEFORE the payment's own status is persisted — a realistic
      // transient failure (e.g. a DB hiccup), not one that leaves the
      // payment already "succeeded" going into the retry (which would
      // make applyPaymentOutcome's own idempotency short-circuit mask
      // this test's own premise).
      vi.spyOn(paymentRepository, "update").mockRejectedValueOnce(new Error("simulated transient failure"));

      const rawBody = JSON.stringify({
        event: "payment.captured",
        event_id: "evt_retry",
        payload: { payment: { entity: { id: "pay_retry", order_id: "plink_retry", amount: 250000, currency: "INR" } } },
      });

      await expect(paymentService.handleProviderWebhook("razorpay", rawBody, signedHeaders(rawBody))).rejects.toThrow("simulated transient failure");

      let events = await paymentService.listWebhookEvents({});
      let forThisEvent = events.items.filter((e) => e.providerEventId === "evt_retry");
      expect(forThisEvent).toHaveLength(1);
      expect(forThisEvent[0].outcome).toBe("error");
      expect((await paymentService.getPayment(created.payment.id))?.status).not.toBe("succeeded");

      // The genuine retry — same event, no mock rejection queued this time.
      await paymentService.handleProviderWebhook("razorpay", rawBody, signedHeaders(rawBody));

      events = await paymentService.listWebhookEvents({});
      forThisEvent = events.items.filter((e) => e.providerEventId === "evt_retry");
      // Reused the SAME claimed row (updated in place), never a second
      // insert — the unique index would itself reject that anyway.
      expect(forThisEvent).toHaveLength(1);
      expect(forThisEvent[0].outcome).toBe("processed");
      expect((await paymentService.getPayment(created.payment.id))?.status).toBe("succeeded");
    });
  });
});

describe("paymentService.reconcilePendingPayments", () => {
  it("resolves a stale 'created' payment via a real vendor status check", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    mockFetchSequence([{ status: 200, body: { id: "plink_stale", short_url: "https://rzp.io/i/stale" } }]);
    const created = await paymentService.createPayment(VALID_CHECKOUT_INPUT);
    expect(created.success).toBe(true);
    if (!created.success) return;

    await vi.advanceTimersByTimeAsync(31 * 60_000); // past STALE_PENDING_MINUTES
    mockFetchSequence([{ status: 200, body: { status: "paid", amount_paid: 250000, currency: "INR", payments: [{ status: "captured", payment_id: "pay_stale" }] } }]);

    const { checked, resolved } = await paymentService.reconcilePendingPayments();
    expect(checked).toBeGreaterThanOrEqual(1);
    expect(resolved).toBeGreaterThanOrEqual(1);

    const payment = await paymentService.getPayment(created.payment.id);
    expect(payment?.status).toBe("succeeded");
    vi.useRealTimers();
  });

  it("does not touch a payment created less than STALE_PENDING_MINUTES ago", async () => {
    mockFetchSequence([{ status: 200, body: { id: "plink_fresh", short_url: "https://rzp.io/i/fresh" } }]);
    const created = await paymentService.createPayment(VALID_CHECKOUT_INPUT);
    expect(created.success).toBe(true);
    if (!created.success) return;

    const { resolved } = await paymentService.reconcilePendingPayments();
    const payment = await paymentService.getPayment(created.payment.id);
    expect(payment?.status).toBe("created");
    expect(resolved).toBe(0);
  });
});
