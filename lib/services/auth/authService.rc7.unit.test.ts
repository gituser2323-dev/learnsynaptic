import { describe, it, expect, vi, afterEach } from "vitest";
import { authService } from "./authService";
import { verifyAccessToken } from "./tokens";
import { getUserRepository } from "@/lib/db";

vi.mock("./authEmails", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./authEmails")>();
  return { ...actual, sendEmailVerificationEmail: vi.fn(actual.sendEmailVerificationEmail) };
});

import { sendEmailVerificationEmail } from "./authEmails";

/**
 * RC-7 — Customer Onboarding & SaaS Activation. Real service-level
 * coverage for authService.registerUser() — the first hop of the whole
 * onboarding funnel and, by construction, the one place a real
 * cross-tenant leak could get introduced (see resolveOrganizationId's
 * own doc comment): a self-registered account must never end up
 * carrying the deployment's real default organization's id anywhere.
 */

let counter = 0;
function uniqueEmail(label: string): string {
  counter += 1;
  return `${label}-${counter}@rc7-test.local`;
}

const VALID_INPUT = (overrides: Record<string, unknown> = {}) => ({
  email: uniqueEmail("register"),
  name: "Jamie Founder",
  password: "StrongPass123",
  termsAccepted: true,
  ...overrides,
});

describe("authService.registerUser — RC-7 self-service registration", () => {
  afterEach(() => vi.clearAllMocks());

  it("creates a real account with NO organizationId set — never silently defaults onto the deployment's default org", async () => {
    const result = await authService.registerUser(VALID_INPUT());
    expect(result.success).toBe(true);
    if (!result.success) return;

    const repo = await getUserRepository();
    const stored = await repo.findById(result.user.id);
    expect(stored?.organizationId).toBeUndefined();
  });

  it("the returned access token also carries no organizationId claim — the actual security property withApiRoute.ts's pre-organization gate relies on", async () => {
    const result = await authService.registerUser(VALID_INPUT());
    expect(result.success).toBe(true);
    if (!result.success) return;

    const claims = await verifyAccessToken(result.tokens.accessToken);
    expect(claims?.organizationId).toBeUndefined();
    expect(claims?.role).toBe("admin");
  });

  it("auto-signs the new account in — a real, usable session, not just an account record", async () => {
    const result = await authService.registerUser(VALID_INPUT());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.tokens.accessToken).toBeTruthy();
    expect(result.tokens.refreshToken).toBeTruthy();
  });

  it("fires a real verification email, and the account starts unverified", async () => {
    const email = uniqueEmail("verify-me");
    const result = await authService.registerUser(VALID_INPUT({ email }));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.user.emailVerified).toBe(false);
    expect(sendEmailVerificationEmail).toHaveBeenCalledWith(email, expect.any(String));
  });

  it("rejects a duplicate email with a real, field-specific error — never a silent second account", async () => {
    const email = uniqueEmail("dup");
    const first = await authService.registerUser(VALID_INPUT({ email }));
    expect(first.success).toBe(true);

    const second = await authService.registerUser(VALID_INPUT({ email }));
    expect(second.success).toBe(false);
    if (second.success) return;
    expect(second.errors[0].field).toBe("email");
  });

  it("rejects a weak password with the real strength validator (createUser's own validator only checks length — registration must not be weaker)", async () => {
    const result = await authService.registerUser(VALID_INPUT({ password: "alllowercase" }));
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.some((e) => e.field === "password")).toBe(true);
  });

  it("rejects registration without terms acceptance", async () => {
    const result = await authService.registerUser(VALID_INPUT({ termsAccepted: false }));
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.some((e) => e.field === "termsAccepted")).toBe(true);
  });

  it("rejects registration with no name", async () => {
    const result = await authService.registerUser(VALID_INPUT({ name: "" }));
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.some((e) => e.field === "name")).toBe(true);
  });

  it("ignores any client-supplied role — always becomes admin of their future organization, never client-chosen", async () => {
    const result = await authService.registerUser(VALID_INPUT({ role: "counsellor" }));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.user.role).toBe("admin");
  });
});
