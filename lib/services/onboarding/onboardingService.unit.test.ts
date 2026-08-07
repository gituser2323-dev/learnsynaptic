import { describe, it, expect } from "vitest";
import { onboardingService } from "./onboardingService";
import { authService } from "@/lib/services/auth";
import { getUserRepository } from "@/lib/db";

let counter = 0;
function uniqueEmail(label: string): string {
  counter += 1;
  return `${label}-${counter}@rc7-onboarding-test.local`;
}

async function registerAndVerify(label: string) {
  const email = uniqueEmail(label);
  const registerResult = await authService.registerUser({
    email,
    name: "Test Founder",
    password: "StrongPass123",
    termsAccepted: true,
  });
  if (!registerResult.success) throw new Error(`test setup failed: ${JSON.stringify(registerResult.errors)}`);

  const userRepository = await getUserRepository();
  await userRepository.update(registerResult.user.id, { emailVerifiedAt: new Date().toISOString() });
  return registerResult.user.id;
}

async function registerVerifyAndCreateOrg(label: string) {
  const userId = await registerAndVerify(label);
  const result = await onboardingService.createOrganizationForUser(userId, { name: `${label} Org` });
  if (!result.success) throw new Error(`test setup failed: ${JSON.stringify(result.errors)}`);
  return { userId, organizationId: result.organization.id };
}

describe("onboardingService.createOrganizationForUser — RC-7", () => {
  it("creates a real organization and atomically assigns the creator as its owner", async () => {
    const userId = await registerAndVerify("happy-path");
    const result = await onboardingService.createOrganizationForUser(userId, { name: "Acme Robotics" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.organization.name).toBe("Acme Robotics");
    expect(result.alreadyExisted).toBe(false);

    const userRepository = await getUserRepository();
    const user = await userRepository.findById(userId);
    expect(user?.organizationId).toBe(result.organization.id);
    expect(user?.role).toBe("admin");
  });

  it("stores the optional business-setup fields, and derives a UTC default timezone when no country/timezone is given", async () => {
    const userId = await registerAndVerify("business-setup");
    const result = await onboardingService.createOrganizationForUser(userId, {
      name: "Global Traders",
      industry: "Retail",
      teamSize: "11-50",
      website: "https://example.com",
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.organization.industry).toBe("Retail");
    expect(result.organization.teamSize).toBe("11-50");
    expect(result.organization.website).toBe("https://example.com");
    expect(result.organization.timezone).toBe("UTC");
  });

  it("defaults to Asia/Kolkata specifically for country: IN, never assuming every customer is in the same timezone otherwise", async () => {
    const userIdIN = await registerAndVerify("country-in");
    const inResult = await onboardingService.createOrganizationForUser(userIdIN, { name: "Bharat Corp", country: "IN" });
    expect(inResult.success).toBe(true);
    if (inResult.success) expect(inResult.organization.timezone).toBe("Asia/Kolkata");

    const userIdUS = await registerAndVerify("country-us");
    const usResult = await onboardingService.createOrganizationForUser(userIdUS, { name: "Freedom LLC", country: "US" });
    expect(usResult.success).toBe(true);
    if (usResult.success) expect(usResult.organization.timezone).toBe("UTC");
  });

  it("rejects organization creation before the account's email is verified — the mission's own 'verify before sensitive SaaS setup' requirement", async () => {
    const email = uniqueEmail("unverified");
    const registerResult = await authService.registerUser({ email, name: "Not Verified", password: "StrongPass123", termsAccepted: true });
    expect(registerResult.success).toBe(true);
    if (!registerResult.success) return;

    const result = await onboardingService.createOrganizationForUser(registerResult.user.id, { name: "Should Not Exist Inc" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors[0].message).toMatch(/verify/i);
  });

  it("rejects a nonexistent account id", async () => {
    const result = await onboardingService.createOrganizationForUser("does-not-exist", { name: "Ghost Inc" });
    expect(result.success).toBe(false);
  });

  it("rejects missing/invalid input via the real validator", async () => {
    const userId = await registerAndVerify("bad-input");
    const result = await onboardingService.createOrganizationForUser(userId, { name: "" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.some((e) => e.field === "name")).toBe(true);
  });

  it("idempotent — calling twice for the same user returns the SAME organization, never a second one (mission §41)", async () => {
    const userId = await registerAndVerify("idempotent");
    const first = await onboardingService.createOrganizationForUser(userId, { name: "Once Only Ltd" });
    expect(first.success).toBe(true);
    if (!first.success) return;

    const second = await onboardingService.createOrganizationForUser(userId, { name: "Once Only Ltd" });
    expect(second.success).toBe(true);
    if (!second.success) return;
    expect(second.alreadyExisted).toBe(true);
    expect(second.organization.id).toBe(first.organization.id);
  });

  it("two different organizations with the same chosen name get distinct slugs, never colliding", async () => {
    const userIdA = await registerAndVerify("slug-collision-a");
    const userIdB = await registerAndVerify("slug-collision-b");
    const resultA = await onboardingService.createOrganizationForUser(userIdA, { name: "Collision Co" });
    const resultB = await onboardingService.createOrganizationForUser(userIdB, { name: "Collision Co" });
    expect(resultA.success).toBe(true);
    expect(resultB.success).toBe(true);
    if (!resultA.success || !resultB.success) return;
    expect(resultA.organization.slug).not.toBe(resultB.organization.slug);
    expect(resultA.organization.id).not.toBe(resultB.organization.id);
  });
});

describe("onboardingService.listSelectablePlans — RC-7", () => {
  it("self-seeds and returns a real, customer-facing trial plan — never the internal-unlimited fallback", async () => {
    const plans = await onboardingService.listSelectablePlans();
    expect(plans.length).toBeGreaterThan(0);
    expect(plans.some((p) => p.id === "internal-unlimited")).toBe(false);
    const trial = plans.find((p) => p.trialDays > 0);
    expect(trial).toBeTruthy();
    expect(trial?.basePriceInSmallestUnit).toBe(0);
  });
});

describe("onboardingService.markStepStatus / getOnboardingStatus — RC-7 server-side state machine", () => {
  it("getOnboardingStatus resolves 'verify_email' for an unverified account with no organization", async () => {
    const email = uniqueEmail("status-unverified");
    const registerResult = await authService.registerUser({ email, name: "Unverified", password: "StrongPass123", termsAccepted: true });
    expect(registerResult.success).toBe(true);
    if (!registerResult.success) return;

    const status = await onboardingService.getOnboardingStatus(registerResult.user.id);
    expect(status?.resumeStep).toBe("verify_email");
    expect(status?.organization).toBeNull();
  });

  it("getOnboardingStatus resolves 'create_organization' once verified but before an organization exists", async () => {
    const userId = await registerAndVerify("status-verified-no-org");
    const status = await onboardingService.getOnboardingStatus(userId);
    expect(status?.resumeStep).toBe("create_organization");
    expect(status?.emailVerified).toBe(true);
  });

  it("getOnboardingStatus resolves 'wizard' once an organization exists but activation hasn't happened yet", async () => {
    const { userId } = await registerVerifyAndCreateOrg("status-wizard");
    const status = await onboardingService.getOnboardingStatus(userId);
    expect(status?.resumeStep).toBe("wizard");
    expect(status?.organization).toBeTruthy();
    expect(status?.activatedAt).toBeUndefined();
  });

  it("markStepStatus records a step and it's reflected in getOnboardingStatus", async () => {
    const { userId, organizationId } = await registerVerifyAndCreateOrg("status-mark-step");
    await onboardingService.markStepStatus(organizationId, "whatsapp", "skipped", { actorId: userId });
    const status = await onboardingService.getOnboardingStatus(userId);
    expect(status?.steps.whatsapp).toBe("skipped");
  });

  it("a completed step is never demoted back to skipped by a later call", async () => {
    const { userId, organizationId } = await registerVerifyAndCreateOrg("status-no-demote");
    await onboardingService.markStepStatus(organizationId, "team", "completed", { actorId: userId });
    await onboardingService.markStepStatus(organizationId, "team", "skipped", { actorId: userId });
    const status = await onboardingService.getOnboardingStatus(userId);
    expect(status?.steps.team).toBe("completed");
  });

  it("activation fires once the required steps (team, crm, import) are acted on AND at least one channel (whatsapp/email) is completed or both are skipped", async () => {
    const { userId, organizationId } = await registerVerifyAndCreateOrg("status-activation");
    await onboardingService.markStepStatus(organizationId, "team", "skipped", { actorId: userId });
    await onboardingService.markStepStatus(organizationId, "crm", "completed", { actorId: userId });
    await onboardingService.markStepStatus(organizationId, "import", "skipped", { actorId: userId });

    let status = await onboardingService.getOnboardingStatus(userId);
    expect(status?.activatedAt).toBeUndefined();
    expect(status?.resumeStep).toBe("wizard");

    await onboardingService.markStepStatus(organizationId, "whatsapp", "completed", { actorId: userId });

    status = await onboardingService.getOnboardingStatus(userId);
    expect(status?.activatedAt).toBeTruthy();
    expect(status?.resumeStep).toBe("done");
  });

  it("activation also fires when both channel steps are explicitly skipped, never silently marking a skipped channel as configured", async () => {
    const { userId, organizationId } = await registerVerifyAndCreateOrg("status-activation-skip-channels");
    await onboardingService.markStepStatus(organizationId, "team", "skipped", { actorId: userId });
    await onboardingService.markStepStatus(organizationId, "crm", "skipped", { actorId: userId });
    await onboardingService.markStepStatus(organizationId, "import", "skipped", { actorId: userId });
    await onboardingService.markStepStatus(organizationId, "whatsapp", "skipped", { actorId: userId });
    await onboardingService.markStepStatus(organizationId, "email", "skipped", { actorId: userId });

    const status = await onboardingService.getOnboardingStatus(userId);
    expect(status?.activatedAt).toBeTruthy();
  });

  it("activatedAt is a one-way milestone — never cleared once set", async () => {
    const { userId, organizationId } = await registerVerifyAndCreateOrg("status-one-way");
    await onboardingService.markStepStatus(organizationId, "team", "skipped", { actorId: userId });
    await onboardingService.markStepStatus(organizationId, "crm", "skipped", { actorId: userId });
    await onboardingService.markStepStatus(organizationId, "import", "skipped", { actorId: userId });
    await onboardingService.markStepStatus(organizationId, "whatsapp", "skipped", { actorId: userId });
    await onboardingService.markStepStatus(organizationId, "email", "skipped", { actorId: userId });
    const activatedStatus = await onboardingService.getOnboardingStatus(userId);
    const firstActivatedAt = activatedStatus?.activatedAt;
    expect(firstActivatedAt).toBeTruthy();

    await onboardingService.markStepStatus(organizationId, "ai", "skipped", { actorId: userId });
    const laterStatus = await onboardingService.getOnboardingStatus(userId);
    expect(laterStatus?.activatedAt).toBe(firstActivatedAt);
  });
});
