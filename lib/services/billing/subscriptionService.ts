import { getSubscriptionRepository } from "@/lib/db";
import { DuplicateKeyError } from "@/lib/db/types";
import { auditLogService, AUDIT_ACTIONS } from "@/lib/services/auditLog";
import type { AuditContext } from "@/lib/services/auditLog";
import { planService } from "./planService";
import { INTERNAL_PLAN_ID, ensureInternalPlanSeeded } from "./internalPlan";
import type { Subscription, SubscriptionStatus } from "./types";

const YEARS_100_MS = 100 * 365 * 24 * 60 * 60 * 1000;

function addDays(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Business OS Phase 8, Module 8.3 — the one Subscription per
 * organization state machine: trialing -> active -> past_due ->
 * cancelled/suspended/expired. Every method takes `organizationId`
 * explicitly (never reads ambient tenant context itself) — the same
 * "safe to call from anywhere, trust the argument" contract
 * `credentialResolver.ts` established in Module 8.2.
 */
export const subscriptionService = {
  /**
   * Self-healing "get" — the mechanism that makes "Do NOT break the
   * internal Business OS" true by construction rather than by a
   * one-time migration script: ANY organization (the existing
   * LearnSynaptic default org, or a brand-new one created after this
   * module shipped) that has no Subscription row yet is transparently,
   * idempotently provisioned onto a real, fully-capable
   * `internal-unlimited` Plan the first time anything asks for its
   * entitlements — never a hard failure, never a silently-broken
   * feature. Race-safe: a duplicate-key on create (two concurrent
   * first-callers) is resolved by re-reading the row the other caller
   * just created, the same pattern `ensureDefaultOrganization()`
   * already established.
   */
  async getForOrganization(organizationId: string): Promise<Subscription> {
    const repo = await getSubscriptionRepository();
    const existing = await repo.findByOrganizationId(organizationId);
    if (existing) return existing;

    await ensureInternalPlanSeeded();
    const now = new Date().toISOString();
    try {
      const subscription = await repo.create({
        organizationId,
        planId: INTERNAL_PLAN_ID,
        status: "active",
        startedAt: now,
        currentPeriodStart: now,
        currentPeriodEnd: new Date(Date.now() + YEARS_100_MS).toISOString(),
      });
      await auditLogService.record({
        action: AUDIT_ACTIONS.SUBSCRIPTION_PLAN_ASSIGNED,
        entityType: "Subscription",
        entityId: subscription.id,
        actorType: "system",
        metadata: { organizationId, planId: INTERNAL_PLAN_ID, reason: "auto_provisioned_default" },
      });
      return subscription;
    } catch (error) {
      if (error instanceof DuplicateKeyError) {
        const createdByOtherCaller = await repo.findByOrganizationId(organizationId);
        if (createdByOtherCaller) return createdByOtherCaller;
      }
      throw error;
    }
  },

  /**
   * Assigns a plan to an organization — creates the first real
   * Subscription (a genuine signup) or changes the plan on an existing
   * one (upgrade/downgrade), never destroying any tenant data either
   * way. A brand-new subscription to a plan with `trialDays > 0`
   * starts `"trialing"`; every other case (an internal-plan org
   * signing up for real, a plan change, a zero-trial plan) goes
   * straight to `"active"` — real payment collection for a paid plan
   * is a separate, explicit step (see paymentIntegration.ts), not
   * implied by merely assigning the plan.
   */
  async assignPlan(organizationId: string, planId: string, context: AuditContext = {}): Promise<Subscription> {
    const plan = await planService.getPlan(planId);
    if (!plan) throw new Error(`Plan "${planId}" not found`);

    const repo = await getSubscriptionRepository();
    const existing = await repo.findByOrganizationId(organizationId);
    const now = new Date().toISOString();

    if (!existing) {
      const startsTrial = plan.trialDays > 0;
      const subscription = await repo.create({
        organizationId,
        planId,
        status: startsTrial ? "trialing" : "active",
        startedAt: now,
        currentPeriodStart: now,
        currentPeriodEnd: startsTrial ? addDays(now, plan.trialDays) : addDays(now, 30),
        trialEndsAt: startsTrial ? addDays(now, plan.trialDays) : undefined,
      });
      await auditLogService.record({
        action: startsTrial ? AUDIT_ACTIONS.SUBSCRIPTION_TRIAL_STARTED : AUDIT_ACTIONS.SUBSCRIPTION_PLAN_ASSIGNED,
        entityType: "Subscription",
        entityId: subscription.id,
        actorId: context.actorId,
        requestId: context.requestId,
        metadata: { organizationId, planId, status: subscription.status },
      });
      return subscription;
    }

    const updated = await repo.update(organizationId, {
      planId,
      status: existing.status === "trialing" || existing.status === "active" ? existing.status : "active",
      cancelAt: null,
    });
    await auditLogService.record({
      action: AUDIT_ACTIONS.SUBSCRIPTION_PLAN_CHANGED,
      entityType: "Subscription",
      entityId: updated.id,
      actorId: context.actorId,
      requestId: context.requestId,
      metadata: { organizationId, fromPlanId: existing.planId, toPlanId: planId },
    });
    return updated;
  },

  /** Cancel at period end (default — the org keeps full access through
   *  `currentPeriodEnd`) or immediately (`immediate: true` — status
   *  flips to `"cancelled"` right away). Neither path deletes any
   *  tenant data; entitlement resolution simply stops granting access
   *  once the subscription is no longer in an active-equivalent
   *  status, per `ACTIVE_SUBSCRIPTION_STATUSES`. */
  async cancel(organizationId: string, options: { immediate?: boolean } = {}, context: AuditContext = {}): Promise<Subscription> {
    const repo = await getSubscriptionRepository();
    const existing = await repo.findByOrganizationId(organizationId);
    if (!existing) throw new Error(`No subscription found for organization "${organizationId}"`);

    const now = new Date().toISOString();
    const updated = options.immediate
      ? await repo.update(organizationId, { status: "cancelled", cancelledAt: now, cancelAt: null })
      : await repo.update(organizationId, { cancelAt: existing.currentPeriodEnd });

    await auditLogService.record({
      action: AUDIT_ACTIONS.SUBSCRIPTION_CANCELLED,
      entityType: "Subscription",
      entityId: updated.id,
      actorId: context.actorId,
      requestId: context.requestId,
      metadata: { organizationId, immediate: !!options.immediate, effectiveAt: options.immediate ? now : existing.currentPeriodEnd },
    });
    return updated;
  },

  /** The reverse of `cancel({immediate:false})` — clears a pending
   *  cancel-at-period-end before it takes effect. Not exposed in the
   *  admin UI this pass (no product requirement named it), but a real,
   *  safe primitive any future UI can call. */
  async resumeCancellation(organizationId: string, context: AuditContext = {}): Promise<Subscription> {
    const repo = await getSubscriptionRepository();
    const updated = await repo.update(organizationId, { cancelAt: null });
    await auditLogService.record({
      action: AUDIT_ACTIONS.SUBSCRIPTION_PLAN_ASSIGNED,
      entityType: "Subscription",
      entityId: updated.id,
      actorId: context.actorId,
      requestId: context.requestId,
      metadata: { organizationId, action: "cancellation_resumed" },
    });
    return updated;
  },

  /** Called after a real successful renewal Payment (see
   *  paymentIntegration.ts) or by an admin manually extending a period —
   *  moves the subscription back to `"active"` and pushes
   *  `currentPeriodEnd` forward. */
  async recordRenewal(organizationId: string, newPeriodEnd: string, context: AuditContext = {}): Promise<Subscription> {
    const repo = await getSubscriptionRepository();
    const existing = await repo.findByOrganizationId(organizationId);
    if (!existing) throw new Error(`No subscription found for organization "${organizationId}"`);

    const updated = await repo.update(organizationId, {
      status: "active",
      currentPeriodStart: existing.currentPeriodEnd,
      currentPeriodEnd: newPeriodEnd,
    });
    await auditLogService.record({
      action: AUDIT_ACTIONS.SUBSCRIPTION_RENEWED,
      entityType: "Subscription",
      entityId: updated.id,
      actorId: context.actorId,
      requestId: context.requestId,
      metadata: { organizationId, currentPeriodEnd: newPeriodEnd },
    });
    return updated;
  },

  /** Set by the scheduler job (see schedulerIntegration.ts) when a
   *  renewal payment attempt fails — `"past_due"` still counts as
   *  active for entitlement purposes (`ACTIVE_SUBSCRIPTION_STATUSES`),
   *  a deliberate grace period, not an immediate hard cutoff. */
  async markPastDue(organizationId: string): Promise<Subscription> {
    const repo = await getSubscriptionRepository();
    const updated = await repo.update(organizationId, { status: "past_due" });
    await auditLogService.record({
      action: AUDIT_ACTIONS.SUBSCRIPTION_SUSPENDED,
      entityType: "Subscription",
      entityId: updated.id,
      actorType: "system",
      metadata: { organizationId, status: "past_due" },
    });
    return updated;
  },

  /** Set by the scheduler when a trial's `trialEndsAt` has passed with
   *  no conversion to a real paid/active plan, OR a `past_due`
   *  subscription's own grace period has run out. Tenant data is never
   *  touched — only future entitlement resolution changes. */
  async expire(organizationId: string, reason: "trial_ended" | "grace_period_ended"): Promise<Subscription> {
    const repo = await getSubscriptionRepository();
    const updated = await repo.update(organizationId, { status: "expired" });
    await auditLogService.record({
      action: reason === "trial_ended" ? AUDIT_ACTIONS.SUBSCRIPTION_TRIAL_EXPIRED : AUDIT_ACTIONS.SUBSCRIPTION_EXPIRED,
      entityType: "Subscription",
      entityId: updated.id,
      actorType: "system",
      metadata: { organizationId, reason },
    });
    return updated;
  },

  /** Cross-tenant sweep — see `SubscriptionRepository.findAll()`'s own
   *  doc comment. Callers must wrap this in `runCrossTenantSweep()`. */
  async listAllForScheduler(): Promise<Subscription[]> {
    const repo = await getSubscriptionRepository();
    return repo.findAll();
  },
};

export type { SubscriptionStatus };
