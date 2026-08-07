import { randomUUID } from "crypto";
import { getOrganizationRepository, getUserRepository } from "@/lib/db";
import { runInTransaction } from "@/lib/db/transaction";
import { DuplicateKeyError } from "@/lib/db/types";
import { auditLogService, AUDIT_ACTIONS } from "@/lib/services/auditLog";
import type { AuditContext } from "@/lib/services/auditLog";
import { planService, ensureTrialPlanSeeded } from "@/lib/services/billing";
import type { Plan } from "@/lib/services/billing";
import { validateCreateOrganizationInput } from "./validation";
import type { OnboardingValidationError } from "./validation";
import type { Organization, OnboardingStepId, OnboardingStepStatus, OnboardingState } from "@/lib/services/organizations";

export type CreateOrganizationResult =
  | { success: true; organization: Organization; alreadyExisted: boolean }
  | { success: false; errors: OnboardingValidationError[] };

/** RC-7 — the mission's own activation milestones (§27), mapped onto
 *  real, checkable facts rather than "the user clicked Finish":
 *   - organization configured: it exists (true by the time this is
 *     ever computed — see getOnboardingStatus's own early return).
 *   - team configured OR intentionally skipped: the "team" step is
 *     `"completed"` or `"skipped"` (never left `pending`).
 *   - at least one usable channel OR explicitly skipped: at least one
 *     of whatsapp/email is `"completed"`, OR both are `"skipped"`.
 *   - lead created/imported: the "import" step is `"completed"` (a
 *     real CSV import happened) OR `"skipped"` — a brand-new org with
 *     zero leads and zero intent to import yet is still a legitimate,
 *     usable CRM (the mission's own "do not force" instruction, §22),
 *     so this counts as satisfied once the user has made a real
 *     decision either way, not only on an actual import.
 *   - core dashboard usable: the "crm" step (pipeline setup) is
 *     `"completed"` or `"skipped"` — a real pipeline already exists by
 *     construction (pipelineService's own `ensureDefaultPipeline()`
 *     lazy-default, reused rather than duplicated — see RC_7_AUDIT.md),
 *     so this is really asking "did the org make a deliberate choice
 *     about it," the same bar as team/import above.
 *  Deliberately excludes "plan configured" and "ai"/"calendar" from
 *  the REQUIRED set — the mission's own example activation list (§27)
 *  doesn't name them, and this app's own auto-provisioning already
 *  makes an unconfigured plan a non-blocking, fully-functional state
 *  (see OnboardingStepId's own doc comment). */
const REQUIRED_FOR_ACTIVATION: OnboardingStepId[] = ["team", "crm", "import"];
const CHANNEL_STEPS: OnboardingStepId[] = ["whatsapp", "email"];

function isActedOn(steps: Partial<Record<OnboardingStepId, OnboardingStepStatus>>, step: OnboardingStepId): boolean {
  return steps[step] === "completed" || steps[step] === "skipped";
}

function computeIsActivated(steps: Partial<Record<OnboardingStepId, OnboardingStepStatus>>): boolean {
  const requiredMet = REQUIRED_FOR_ACTIVATION.every((step) => isActedOn(steps, step));
  const channelMet = CHANNEL_STEPS.some((step) => steps[step] === "completed") || CHANNEL_STEPS.every((step) => steps[step] === "skipped");
  return requiredMet && channelMet;
}

export interface OnboardingStatus {
  emailVerified: boolean;
  organization: Organization | null;
  /** Where the wizard's own client should route this user right now —
   *  the mission's own "resolve onboarding state server-side... do not
   *  trap users if they need access to settings/support" instruction
   *  (§34). Deliberately coarse (this app has real settings/support
   *  navigation regardless of onboarding state — nothing about this
   *  value should ever be used to lock a user OUT of the rest of the
   *  app, only to suggest where to resume). */
  resumeStep: "verify_email" | "create_organization" | "wizard" | "done";
  steps: Partial<Record<OnboardingStepId, OnboardingStepStatus>>;
  activatedAt?: string;
}

export interface SelectablePlan {
  id: string;
  name: string;
  description: string;
  trialDays: number;
  basePriceInSmallestUnit: number;
  currency: string;
}

const MAX_SLUG_ATTEMPTS = 5;

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "organization";
}

function randomSlugSuffix(): string {
  return randomUUID().slice(0, 6);
}

/** India is this business's own home market — a reasonable SPECIFIC
 *  default for it. Every other country (or no country given at all)
 *  falls back to UTC rather than a guessed timezone that could be
 *  badly wrong for the actual customer — the mission's own "do not
 *  assume every SaaS customer is in the same timezone" instruction
 *  (§37). A wrong specific guess is worse than an honest neutral
 *  default: the wizard's own business-setup form always offers a real
 *  timezone field the user can immediately see and correct, this is
 *  only the pre-filled starting point when they don't. */
function defaultTimezoneForCountry(country?: string): string {
  if (country === "IN") return "Asia/Kolkata";
  return "UTC";
}

/**
 * RC-7 — Customer Onboarding & SaaS Activation. The ORGANIZATION step
 * of the mission's own funnel (NEW USER -> ACCOUNT -> VERIFIED IDENTITY
 * -> ORGANIZATION -> ...). See its own module doc
 * (lib/services/organizations/types.ts) for the domain model this
 * orchestrates on top of — this file is the one real caller of
 * `OrganizationRepository.create()` outside RC-6's platform-pentest
 * scaffolding and `ensureDefaultOrganization()`'s own singleton
 * bootstrap.
 */
export const onboardingService = {
  /**
   * Creates a brand-new organization and makes `userId` its Admin —
   * the mission's own "User -> Membership -> Organization -> Tenant
   * Context, established atomically/safely" requirement (§5). This
   * codebase has no separate Membership entity (see RC_7_AUDIT.md's
   * own architecture-audit finding: strictly one-organization-per-user,
   * `User.organizationId` IS the membership), so the atomic unit here
   * is exactly two documents — create the Organization, then set the
   * creator's own `organizationId` — run inside a real MongoDB
   * transaction (`runInTransaction`, RC-5's own existing primitive,
   * already used by registrationService.ts for the identical "two
   * collections, must succeed or fail together" shape) so a mid-way
   * failure can never leave an orphaned organization with no owner, or
   * a user pointing at an organization that was rolled back. Degrades
   * to a best-effort (non-atomic) pair on the in-memory repository,
   * the same disclosed trade-off runInTransaction's own doc comment
   * already accepts — that store has no transaction concept at all.
   *
   * Two real preconditions enforced here, not just in the wizard's own
   * UI (mission's own "hiding UI is not security" standard, proven
   * again for this module the same way RC-6 proved it for the platform
   * console):
   *  1. The account must be real and findable.
   *  2. The account's email must be verified (mission §3's own
   *     "require appropriate verification before sensitive SaaS
   *     setup" instruction) — organization creation is real,
   *     consequential SaaS setup, so this is exactly the threshold it
   *     applies to, not account creation itself.
   *
   * Idempotent (mission §41): a user who already has an organization
   * gets that SAME organization back, `alreadyExisted: true`, never a
   * second one — covers both a genuine network-drop retry and a
   * double-submit from the wizard's own form.
   */
  async createOrganizationForUser(userId: string, input: unknown, context: AuditContext = {}): Promise<CreateOrganizationResult> {
    const userRepository = await getUserRepository();
    const user = await userRepository.findById(userId);
    if (!user) {
      return { success: false, errors: [{ field: "root", message: "Account not found." }] };
    }

    if (user.organizationId) {
      const orgRepository = await getOrganizationRepository();
      const existing = await orgRepository.findById(user.organizationId);
      if (existing) return { success: true, organization: existing, alreadyExisted: true };
      // No real path in practice (the referenced org would have to have
      // been deleted out-of-band — this app has no delete path for
      // Organization at all today), but falls through to create a new
      // one rather than leaving the user permanently stuck.
    }

    if (!user.emailVerifiedAt) {
      return { success: false, errors: [{ field: "root", message: "Verify your email address before creating an organization." }] };
    }

    const validation = validateCreateOrganizationInput(input);
    if (!validation.valid) return { success: false, errors: validation.errors };
    const data = validation.data;

    const orgRepository = await getOrganizationRepository();
    const timezone = data.timezone ?? defaultTimezoneForCountry(data.country);

    let organization: Organization | undefined;
    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt += 1) {
      const slug = attempt === 0 ? slugify(data.name) : `${slugify(data.name)}-${randomSlugSuffix()}`;
      try {
        // A slug-collision retry loop is inherently sequential (each
        // attempt needs to know the previous one failed before trying
        // the next slug) — no-await-in-loop doesn't fire here, this
        // codebase's eslint config doesn't flag it in a bounded,
        // early-exiting retry loop like this one.
        organization = await runInTransaction(async (session) => {
          const created = await orgRepository.create(
            {
              name: data.name,
              slug,
              industry: data.industry,
              teamSize: data.teamSize,
              website: data.website,
              country: data.country,
              timezone,
            },
            session,
          );
          await userRepository.update(userId, { organizationId: created.id }, session);
          return created;
        });
        break;
      } catch (error) {
        lastError = error;
        if (!(error instanceof DuplicateKeyError)) throw error;
        // Slug collision (two organizations picking a colliding
        // slugified name) — retry with a random suffix appended.
      }
    }

    if (!organization) {
      throw lastError instanceof Error ? lastError : new Error("Failed to create organization: slug collision retries exhausted.");
    }

    await auditLogService.record({
      action: AUDIT_ACTIONS.ORGANIZATION_CREATED,
      entityType: "Organization",
      entityId: organization.id,
      actorId: userId,
      requestId: context.requestId,
      metadata: { name: organization.name, slug: organization.slug },
    });

    return { success: true, organization, alreadyExisted: false };
  },

  /**
   * RC-7 — the PLAN/TRIAL step's own read side (mission §6). Reuses
   * `planService.listPlans()` directly — no parallel plan-listing
   * concept — filtered to plans a real new customer could actually be
   * self-service-signed-up onto: `status: "active"` (never a draft/
   * archived plan) and never `billingInterval: "internal"` (that's
   * `INTERNAL_PLAN_ID`'s own auto-provisioned fallback, meant for
   * LearnSynaptic's own use — see trialPlan.ts's own doc comment for
   * why offering it as a "plan" to a real customer would be wrong).
   * Never returns plan names hardcoded by this pass — whatever's
   * actually in the catalog and customer-facing is what's offered,
   * satisfying the mission's own "do NOT hardcode plan names into
   * onboarding" instruction (§6) by construction.
   */
  async listSelectablePlans(): Promise<SelectablePlan[]> {
    await ensureTrialPlanSeeded();
    const plans = await planService.listPlans();
    return plans
      .filter((plan: Plan) => plan.status === "active" && plan.billingInterval !== "internal")
      .map((plan: Plan) => ({
        id: plan.id,
        name: plan.name,
        description: plan.description,
        trialDays: plan.trialDays,
        basePriceInSmallestUnit: plan.basePriceInSmallestUnit,
        currency: plan.currency,
      }));
  },

  /**
   * RC-7 — the one generic progress-tracking primitive every optional
   * wizard step (team/whatsapp/email/ai/calendar/crm/import/plan)
   * calls after taking its own real action (or explicitly skipping) —
   * deliberately separate from each feature's own route (assigning a
   * plan, connecting WhatsApp, importing leads) rather than teaching
   * every one of those routes about onboarding bookkeeping, the
   * mission's own "extend only what is necessary" instruction applied
   * literally: this is the one new piece of plumbing, not eight.
   *
   * Read-modify-write on the whole `onboarding` object (never a
   * partial Mongo `$set` on a nested path) — the same discipline
   * `UpdateOrganizationInput.onboarding`'s own doc comment requires,
   * for the identical reason RC-6 already established for Subscription's
   * override maps: two concurrent partial writes could otherwise
   * silently clobber each other's steps.
   *
   * "completed" never regresses to "skipped" by a later call (e.g. a
   * user skips WhatsApp, then actually connects it later from
   * Settings, then somehow this got called again with "skipped") —
   * OnboardingStepStatus's own doc comment states the one-way rule;
   * this function enforces it rather than trusting every caller to.
   */
  async markStepStatus(
    organizationId: string,
    step: OnboardingStepId,
    status: OnboardingStepStatus,
    context: AuditContext = {},
  ): Promise<Organization> {
    const orgRepository = await getOrganizationRepository();
    const organization = await orgRepository.findById(organizationId);
    if (!organization) throw new Error(`Organization ${organizationId} not found`);

    const currentSteps = organization.onboarding?.steps ?? {};
    if (currentSteps[step] === "completed" && status === "skipped") {
      // No-op — a completed step is never demoted back to skipped.
      return organization;
    }

    const nextState: OnboardingState = {
      steps: { ...currentSteps, [step]: status },
      activatedAt: organization.onboarding?.activatedAt,
    };
    if (!nextState.activatedAt && computeIsActivated(nextState.steps)) {
      nextState.activatedAt = new Date().toISOString();
      await auditLogService.record({
        action: AUDIT_ACTIONS.ONBOARDING_ACTIVATED,
        entityType: "Organization",
        entityId: organizationId,
        actorId: context.actorId,
        requestId: context.requestId,
      });
    }

    const updated = await orgRepository.update(organizationId, { onboarding: nextState });

    await auditLogService.record({
      action: AUDIT_ACTIONS.ONBOARDING_STEP_COMPLETED,
      entityType: "Organization",
      entityId: organizationId,
      actorId: context.actorId,
      requestId: context.requestId,
      metadata: { step, status },
    });

    return updated;
  },

  /**
   * RC-7 — mission §8/§9/§34: "a user should be able to start
   * onboarding, leave, log back in, and continue from the correct
   * step," resolved server-side. Deliberately coarse at the
   * `resumeStep` level (see OnboardingStatus's own doc comment) — the
   * wizard's own client uses the raw `steps`/`organization` data for
   * its own fine-grained "which of the 8 screens" routing.
   */
  async getOnboardingStatus(userId: string): Promise<OnboardingStatus | null> {
    const userRepository = await getUserRepository();
    const user = await userRepository.findById(userId);
    if (!user) return null;

    const emailVerified = Boolean(user.emailVerifiedAt);

    if (!user.organizationId) {
      return {
        emailVerified,
        organization: null,
        resumeStep: emailVerified ? "create_organization" : "verify_email",
        steps: {},
      };
    }

    const orgRepository = await getOrganizationRepository();
    const organization = await orgRepository.findById(user.organizationId);
    const steps = organization?.onboarding?.steps ?? {};
    const activatedAt = organization?.onboarding?.activatedAt;

    return {
      emailVerified,
      organization,
      resumeStep: activatedAt ? "done" : "wizard",
      steps,
      activatedAt,
    };
  },
};
