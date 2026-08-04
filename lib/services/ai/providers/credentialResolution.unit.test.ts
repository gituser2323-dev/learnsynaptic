import { describe, it, expect, vi, afterEach } from "vitest";
import { runWithTenantContext } from "@/lib/tenancy/context";
import { integrationService } from "@/lib/services/integrations/integrationService";
import { openaiProvider } from "./openai.provider";
import { AiProviderNotConfiguredError } from "../errors";

/**
 * Business OS Phase 8, Module 8.2 — proves openai.provider.ts actually
 * resolves and uses a per-organization tenant_secret credential (not
 * just that the resolver function exists in isolation, already covered
 * by credentialResolver.unit.test.ts). This test environment has no
 * OPENAI_API_KEY set, so any success here is only possible because the
 * tenant credential path was really used, never an env fallback.
 */
describe("openai.provider — tenant credential resolution", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws AiProviderNotConfiguredError when neither env nor a tenant credential is configured", async () => {
    await expect(
      runWithTenantContext({ organizationId: "org-ai-cred-none" }, () => openaiProvider.complete({ systemPrompt: "s", userPrompt: "u" })),
    ).rejects.toBeInstanceOf(AiProviderNotConfiguredError);
  });

  it("uses this organization's own tenant credential (env is blank) — sends it as the Authorization bearer token", async () => {
    await runWithTenantContext({ organizationId: "org-ai-cred-a" }, () => integrationService.setTenantCredentials("openai", { apiKey: "org-a-openai-key" }));

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "hello from org a" } }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await runWithTenantContext({ organizationId: "org-ai-cred-a" }, () => openaiProvider.complete({ systemPrompt: "s", userPrompt: "u" }));

    expect(result.text).toBe("hello from org a");
    const [, requestInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((requestInit.headers as Record<string, string>).Authorization).toBe("Bearer org-a-openai-key");
  });

  it("a different organization with no tenant credential still fails, even though org-ai-cred-a has one configured", async () => {
    await runWithTenantContext({ organizationId: "org-ai-cred-a" }, () => integrationService.setTenantCredentials("openai", { apiKey: "org-a-openai-key" }));

    await expect(
      runWithTenantContext({ organizationId: "org-ai-cred-b" }, () => openaiProvider.complete({ systemPrompt: "s", userPrompt: "u" })),
    ).rejects.toBeInstanceOf(AiProviderNotConfiguredError);
  });
});
