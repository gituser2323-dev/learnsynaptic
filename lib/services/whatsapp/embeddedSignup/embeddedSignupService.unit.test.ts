import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { embeddedSignupService } from "./embeddedSignupService";

/**
 * Business OS Phase 8, Module 8.5 — WhatsApp Embedded Signup's own
 * orchestration: entitlement gating, real ownership re-verification
 * against Meta (never trusting the client-reported wabaId/phoneNumberId
 * alone), idempotent connect/reconnect, cross-tenant conflict
 * rejection, and the derived rich connection-state summary.
 *
 * This test environment has no real WHATSAPP_META_APP_ID/CONFIG_ID/
 * APP_SECRET set, so `isEmbeddedSignupConfigured()` would otherwise
 * short-circuit every test with a "not_configured" error before any
 * of the real logic below ever runs. Fixed with the same
 * `vi.resetModules()` + `vi.stubEnv()` + dynamic re-import pattern
 * fileStorageService.unit.test.ts already established for an
 * identical env-gated-config problem (Module 6.2's own aws_s3
 * not-configured gate) — critically, EVERY module a test needs
 * (billing, db, and the service under test) is re-imported together
 * from the SAME fresh module graph in each test, since a stale
 * top-level import would read a different in-memory store instance
 * than the freshly-imported service writes to.
 */
async function freshModules() {
  const billing = await import("@/lib/services/billing");
  const db = await import("@/lib/db");
  const embeddedSignup = await import("./embeddedSignupService");
  return {
    planService: billing.planService,
    subscriptionService: billing.subscriptionService,
    getPhoneNumberRepository: db.getPhoneNumberRepository,
    service: embeddedSignup.embeddedSignupService,
  };
}

async function givenPlanWithCapabilities(planService: Awaited<ReturnType<typeof freshModules>>["planService"], planId: string, capabilities: string[]) {
  await planService.createPlan({
    id: planId,
    name: planId,
    description: "Test plan.",
    status: "active",
    billingInterval: "monthly",
    currency: "INR",
    basePriceInSmallestUnit: 0,
    capabilities: capabilities as never,
    limits: {},
  });
}

function mockMetaSuccess(phoneNumberId = "phone-1", wabaId = "waba-1", accessToken = "EAAB-token") {
  void wabaId;
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("oauth/access_token")) {
      return new Response(JSON.stringify({ access_token: accessToken }), { status: 200 });
    }
    if (url.includes("/phone_numbers")) {
      return new Response(
        JSON.stringify({ data: [{ id: phoneNumberId, display_phone_number: "+1 555-0100", code_verification_status: "VERIFIED", quality_rating: "GREEN" }] }),
        { status: 200 },
      );
    }
    if (url.includes("subscribed_apps")) {
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }
    return new Response(JSON.stringify({ error: { message: "unexpected mocked call" } }), { status: 500 });
  }) as unknown as typeof fetch;
}

describe("embeddedSignupService — entitlement + platform-config gating (real config)", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("rejects connecting for an organization whose plan lacks whatsapp_embedded_signup", async () => {
    vi.stubEnv("WHATSAPP_META_APP_ID", "test-app-id");
    vi.stubEnv("WHATSAPP_META_EMBEDDED_SIGNUP_CONFIG_ID", "test-config-id");
    vi.stubEnv("WHATSAPP_META_APP_SECRET", "test-app-secret");
    const { planService, subscriptionService, service } = await freshModules();
    await givenPlanWithCapabilities(planService, "plan-wa-signup-no-cap", ["whatsapp"]);
    await subscriptionService.assignPlan("org-wa-signup-no-cap", "plan-wa-signup-no-cap");
    mockMetaSuccess();

    await expect(service.connect("org-wa-signup-no-cap", { code: "any-code" })).rejects.toMatchObject({ code: "not_entitled" });
  });

  it("rejects connecting when the platform itself isn't configured, regardless of entitlement", async () => {
    const { planService, subscriptionService, service } = await freshModules();
    await givenPlanWithCapabilities(planService, "plan-wa-signup-no-platform", ["whatsapp", "whatsapp_embedded_signup"]);
    await subscriptionService.assignPlan("org-wa-signup-no-platform", "plan-wa-signup-no-platform");

    await expect(service.connect("org-wa-signup-no-platform", { code: "any-code" })).rejects.toMatchObject({ code: "not_configured" });
  });
});

describe("embeddedSignupService.connect — real ownership re-verification and idempotency", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("WHATSAPP_META_APP_ID", "test-app-id");
    vi.stubEnv("WHATSAPP_META_EMBEDDED_SIGNUP_CONFIG_ID", "test-config-id");
    vi.stubEnv("WHATSAPP_META_APP_SECRET", "test-app-secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("connects successfully when the client-reported phone number genuinely belongs to the authorized WABA", async () => {
    const { planService, subscriptionService, service } = await freshModules();
    await givenPlanWithCapabilities(planService, "plan-wa-signup", ["whatsapp", "whatsapp_embedded_signup"]);
    await subscriptionService.assignPlan("org-wa-connect-ok", "plan-wa-signup");
    mockMetaSuccess("phone-ok", "waba-ok");

    const summary = await service.connect("org-wa-connect-ok", { code: "real-code", wabaId: "waba-ok", phoneNumberId: "phone-ok" });
    expect(summary.state).not.toBe("not_connected");
    expect(summary.phoneNumberId).toBe("phone-ok");
    expect(summary.wabaId).toBe("waba-ok");
  });

  it("rejects when the client-reported phoneNumberId does NOT actually appear in the authorized WABA's own phone list — never trusts the client alone", async () => {
    const { planService, subscriptionService, service } = await freshModules();
    await givenPlanWithCapabilities(planService, "plan-wa-signup", ["whatsapp", "whatsapp_embedded_signup"]);
    await subscriptionService.assignPlan("org-wa-connect-mismatch", "plan-wa-signup");
    mockMetaSuccess("real-phone-from-meta", "waba-x");

    await expect(
      service.connect("org-wa-connect-mismatch", { code: "real-code", wabaId: "waba-x", phoneNumberId: "a-phone-id-the-client-made-up" }),
    ).rejects.toMatchObject({ code: "waba_mismatch" });
  });

  it("rejects when Meta reports zero phone numbers on the authorized WABA", async () => {
    const { planService, subscriptionService, service } = await freshModules();
    await givenPlanWithCapabilities(planService, "plan-wa-signup", ["whatsapp", "whatsapp_embedded_signup"]);
    await subscriptionService.assignPlan("org-wa-connect-empty", "plan-wa-signup");
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("oauth/access_token")) return new Response(JSON.stringify({ access_token: "tok" }), { status: 200 });
      if (url.includes("/phone_numbers")) return new Response(JSON.stringify({ data: [] }), { status: 200 });
      return new Response(JSON.stringify({ error: {} }), { status: 500 });
    }) as unknown as typeof fetch;

    await expect(service.connect("org-wa-connect-empty", { code: "real-code", wabaId: "waba-empty" })).rejects.toMatchObject({ code: "phone_not_found" });
  });

  it("is idempotent — connecting twice with the same phone number updates the same connection, never creates a duplicate", async () => {
    const { planService, subscriptionService, service, getPhoneNumberRepository } = await freshModules();
    await givenPlanWithCapabilities(planService, "plan-wa-signup", ["whatsapp", "whatsapp_embedded_signup"]);
    await subscriptionService.assignPlan("org-wa-idempotent", "plan-wa-signup");
    mockMetaSuccess("phone-idem", "waba-idem");

    const first = await service.connect("org-wa-idempotent", { code: "code-1", wabaId: "waba-idem", phoneNumberId: "phone-idem" });
    const second = await service.connect("org-wa-idempotent", { code: "code-2", wabaId: "waba-idem", phoneNumberId: "phone-idem" });

    expect(first.phoneNumberId).toBe("phone-idem");
    expect(second.phoneNumberId).toBe("phone-idem");

    const phoneNumberRepository = await getPhoneNumberRepository();
    const allPhoneRows = (await phoneNumberRepository.list()).filter((p) => p.phoneNumberId === "phone-idem");
    expect(allPhoneRows.length).toBe(1);
  });

  it("real cross-tenant conflict guard: rejects connecting a phone number already routed to a DIFFERENT organization", async () => {
    const { planService, subscriptionService, service } = await freshModules();
    await givenPlanWithCapabilities(planService, "plan-wa-signup", ["whatsapp", "whatsapp_embedded_signup"]);
    await subscriptionService.assignPlan("org-wa-conflict-a", "plan-wa-signup");
    await subscriptionService.assignPlan("org-wa-conflict-b", "plan-wa-signup");
    mockMetaSuccess("phone-contested", "waba-contested");

    await service.connect("org-wa-conflict-a", { code: "code-a", wabaId: "waba-contested", phoneNumberId: "phone-contested" });

    await expect(
      service.connect("org-wa-conflict-b", { code: "code-b", wabaId: "waba-contested", phoneNumberId: "phone-contested" }),
    ).rejects.toMatchObject({ code: "phone_already_connected" });
  });

  it("reconnecting to a DIFFERENT phone number releases the organization's own prior routing entry", async () => {
    const { planService, subscriptionService, service, getPhoneNumberRepository } = await freshModules();
    await givenPlanWithCapabilities(planService, "plan-wa-signup", ["whatsapp", "whatsapp_embedded_signup"]);
    await subscriptionService.assignPlan("org-wa-switch", "plan-wa-signup");

    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("oauth/access_token")) return new Response(JSON.stringify({ access_token: "tok" }), { status: 200 });
      if (url.includes("waba-first/phone_numbers")) return new Response(JSON.stringify({ data: [{ id: "phone-first", code_verification_status: "VERIFIED", quality_rating: "GREEN" }] }), { status: 200 });
      if (url.includes("waba-second/phone_numbers")) return new Response(JSON.stringify({ data: [{ id: "phone-second", code_verification_status: "VERIFIED", quality_rating: "GREEN" }] }), { status: 200 });
      if (url.includes("subscribed_apps")) return new Response(JSON.stringify({ success: true }), { status: 200 });
      return new Response(JSON.stringify({ error: {} }), { status: 500 });
    }) as unknown as typeof fetch;

    await service.connect("org-wa-switch", { code: "c1", wabaId: "waba-first", phoneNumberId: "phone-first" });
    await service.connect("org-wa-switch", { code: "c2", wabaId: "waba-second", phoneNumberId: "phone-second" });

    const phoneNumberRepository = await getPhoneNumberRepository();
    const oldRoute = await phoneNumberRepository.findByPhoneNumberId("phone-first");
    const newRoute = await phoneNumberRepository.findByPhoneNumberId("phone-second");
    expect(oldRoute?.organizationId).toBeUndefined();
    expect(newRoute?.organizationId).toBe("org-wa-switch");
  });
});

describe("embeddedSignupService.disconnect — safe, never deletes history", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("WHATSAPP_META_APP_ID", "test-app-id");
    vi.stubEnv("WHATSAPP_META_EMBEDDED_SIGNUP_CONFIG_ID", "test-config-id");
    vi.stubEnv("WHATSAPP_META_APP_SECRET", "test-app-secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("disconnect clears the credential and releases phone routing, but a subsequent status read reports not_connected, never throws", async () => {
    const { planService, subscriptionService, service, getPhoneNumberRepository } = await freshModules();
    await givenPlanWithCapabilities(planService, "plan-wa-disconnect", ["whatsapp", "whatsapp_embedded_signup"]);
    await subscriptionService.assignPlan("org-wa-disconnect", "plan-wa-disconnect");
    mockMetaSuccess("phone-disc", "waba-disc");

    await service.connect("org-wa-disconnect", { code: "c1", wabaId: "waba-disc", phoneNumberId: "phone-disc" });
    await service.disconnect("org-wa-disconnect");

    const summary = await service.getConnectionSummary("org-wa-disconnect");
    expect(summary.state).toBe("not_connected");

    const phoneNumberRepository = await getPhoneNumberRepository();
    const route = await phoneNumberRepository.findByPhoneNumberId("phone-disc");
    expect(route?.organizationId).toBeUndefined();
  });

  it("an organization that was never connected can call disconnect without error", async () => {
    const { planService, subscriptionService, service } = await freshModules();
    await givenPlanWithCapabilities(planService, "plan-wa-disconnect", ["whatsapp", "whatsapp_embedded_signup"]);
    await subscriptionService.assignPlan("org-wa-disconnect-never", "plan-wa-disconnect");
    await expect(service.disconnect("org-wa-disconnect-never")).resolves.toBeUndefined();
  });
});

describe("embeddedSignupService.getConnectionSummary — derived state, never a stored drift-prone field", () => {
  it("an organization with no connection at all resolves to not_connected", async () => {
    const summary = await embeddedSignupService.getConnectionSummary("org-wa-summary-none");
    expect(summary.state).toBe("not_connected");
  });
});
