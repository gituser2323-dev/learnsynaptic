import { getUserRepository, getOrganizationRepository, getIntegrationConnectionRepository } from "@/lib/db";
import { subscriptionService } from "@/lib/services/billing";
import { runCrossTenantSweep } from "@/lib/tenancy/context";
import type { IntegrationConnection } from "@/lib/services/integrations/types";

/**
 * RC-7 — Customer Onboarding & SaaS Activation. Mission §32/§44: an
 * aggregate onboarding funnel and a per-organization onboarding status
 * list, both for the Platform Super Admin console (RC-6) — reusing its
 * existing `requiredPlatformRole` gate and `runCrossTenantSweep()`
 * escape hatch directly, never a parallel platform-visibility system.
 * Every count here is a real query against real collections — no
 * estimated/fabricated numbers (the mission's own "do not fabricate
 * metrics" instruction, already applied identically to RC-6's own
 * platform dashboard).
 *
 * Deliberately does NOT expose tenant-private CRM contents (mission
 * §32's own "do not expose tenant-private CRM contents" instruction)
 * — every field below is either a real aggregate count or organization-
 * level metadata (name, status, timestamps) already visible on the
 * existing platform organizations list (RC-6), never a Lead/
 * Conversation/Task or any other tenant business record.
 */

export type OnboardingFunnelStage = "registered" | "verified" | "organizationCreated" | "trialStarted" | "integrationConnected" | "activated";

export interface OnboardingFunnelSnapshot {
  generatedAt: string;
  stages: Record<OnboardingFunnelStage, number>;
}

export type OrganizationOnboardingStatus = "not_started" | "in_progress" | "activated";

export interface OrganizationOnboardingSummary {
  organizationId: string;
  name: string;
  status: OrganizationOnboardingStatus;
  stepsCompleted: number;
  stepsSkipped: number;
  activatedAt?: string;
  createdAt: string;
}

function summarizeOrganization(organization: {
  id: string;
  name: string;
  createdAt: string;
  onboarding?: { steps?: Record<string, string>; activatedAt?: string };
}): OrganizationOnboardingSummary {
  const steps = organization.onboarding?.steps ?? {};
  const values = Object.values(steps);
  const stepsCompleted = values.filter((v) => v === "completed").length;
  const stepsSkipped = values.filter((v) => v === "skipped").length;
  const activatedAt = organization.onboarding?.activatedAt;

  let status: OrganizationOnboardingStatus = "not_started";
  if (activatedAt) status = "activated";
  else if (values.length > 0) status = "in_progress";

  return { organizationId: organization.id, name: organization.name, status, stepsCompleted, stepsSkipped, activatedAt, createdAt: organization.createdAt };
}

export const platformOnboardingService = {
  /** Mission §32's own funnel: Registered -> Verified -> Organization
   *  Created -> Trial Started -> Integration Connected -> Activated. */
  async getFunnelSnapshot(): Promise<OnboardingFunnelSnapshot> {
    const userRepository = await getUserRepository();
    const orgRepository = await getOrganizationRepository();

    const [users, organizations, subscriptions, connections] = await Promise.all([
      userRepository.listActive(),
      orgRepository.list({}, 1, 1_000_000),
      runCrossTenantSweep(() => subscriptionService.listAllForScheduler()),
      runCrossTenantSweep(async () => (await getIntegrationConnectionRepository()).list()),
    ]);

    const verified = users.filter((u) => u.emailVerifiedAt).length;
    const trialStartedOrgIds = new Set(subscriptions.filter((s) => s.trialEndsAt).map((s) => s.organizationId));
    const connectedOrgIds = new Set(
      (connections as IntegrationConnection[]).filter((c) => c.status === "connected" && c.organizationId).map((c) => c.organizationId as string),
    );
    const activated = organizations.items.filter((o) => o.onboarding?.activatedAt).length;

    return {
      generatedAt: new Date().toISOString(),
      stages: {
        registered: users.length,
        verified,
        organizationCreated: organizations.total,
        trialStarted: trialStartedOrgIds.size,
        integrationConnected: connectedOrgIds.size,
        activated,
      },
    };
  },

  /** Mission §44's own "safe onboarding status per organization" for
   *  operational troubleshooting — never tenant-private CRM data, only
   *  the same organization-level facts RC-6's own organizations list
   *  already shows. */
  async listOrganizationOnboardingStatus(page: number, limit: number): Promise<{ items: OrganizationOnboardingSummary[]; total: number }> {
    const orgRepository = await getOrganizationRepository();
    const result = await orgRepository.list({}, page, limit);
    return { items: result.items.map(summarizeOrganization), total: result.total };
  },
};
