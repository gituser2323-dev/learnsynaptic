import { describe, it, expect } from "vitest";
import { INTEGRATION_PROVIDERS, getProviderDescriptor } from "./providerCatalog";

describe("INTEGRATION_PROVIDERS — the static provider registry", () => {
  it("has no duplicate provider ids", () => {
    const ids = INTEGRATION_PROVIDERS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every provider has at least one capability", () => {
    for (const provider of INTEGRATION_PROVIDERS) {
      expect(provider.capabilities.length).toBeGreaterThan(0);
    }
  });

  it("marks exactly the five already-implemented providers as builtIn", () => {
    const builtInIds = INTEGRATION_PROVIDERS.filter((p) => p.builtIn).map((p) => p.id);
    expect(new Set(builtInIds)).toEqual(new Set(["whatsapp", "email", "openai", "anthropic", "gemini"]));
  });

  it("every non-builtIn, not-yet-implemented provider names its own planned module", () => {
    // aws_s3/cloudinary (Module 6.2), the five calendar providers
    // (Module 6.3), slack/microsoft_teams/discord/generic_webhook
    // (Module 6.5), and razorpay/stripe/cashfree (Module 6.4) are the
    // real exceptions — real functionality now exists for them, so
    // they no longer name a future module; every other non-builtIn
    // provider still does, including phonepe/paypal (Module 6.4's own
    // explicitly-named future providers — disclosed scaffolds, not
    // real yet, so they correctly keep plannedModule).
    const realProviderIds = new Set([
      "aws_s3", "cloudinary",
      "google_calendar", "google_meet", "microsoft_outlook_calendar", "microsoft_teams_meetings", "zoom",
      "slack", "microsoft_teams", "discord", "generic_webhook",
      "razorpay", "stripe", "cashfree",
    ]);
    for (const provider of INTEGRATION_PROVIDERS.filter((p) => !p.builtIn && !realProviderIds.has(p.id))) {
      expect(provider.plannedModule).toBeTruthy();
    }
    for (const id of realProviderIds) {
      expect(getProviderDescriptor(id)?.plannedModule).toBeUndefined();
    }
  });

  it("covers every category the module's own mission names", () => {
    const categories = new Set(INTEGRATION_PROVIDERS.map((p) => p.category));
    expect(categories).toEqual(new Set(["communication", "ai", "storage", "calendar", "payments", "notifications", "other"]));
  });

  it("getProviderDescriptor resolves a known id and returns undefined for an unknown one", () => {
    expect(getProviderDescriptor("whatsapp")?.name).toBe("WhatsApp");
    expect(getProviderDescriptor("not-a-real-provider")).toBeUndefined();
  });
});
