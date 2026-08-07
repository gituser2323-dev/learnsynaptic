import { getPlanRepository } from "@/lib/db";
import { DuplicateKeyError } from "@/lib/db/types";

/**
 * RC-7 — Customer Onboarding & SaaS Activation. The one real,
 * customer-facing plan a brand-new self-service organization can
 * actually be offered during onboarding's own PLAN/TRIAL step.
 *
 * Confirmed by direct inspection of the live deployment's own Plan
 * catalog before this pass: the only two plans that existed were
 * `internal-unlimited` (INTERNAL_PLAN_ID — the auto-provisioned
 * fallback every organization silently lands on if nothing ever
 * assigns it a real plan; its own name/doc comment make clear it's
 * meant for LearnSynaptic's own internal use, not a real customer) and
 * a one-off `verify-plan-wa-embedded-signup` test fixture from an
 * earlier RC's live verification — genuinely nothing a new customer
 * could be self-service-signed-up onto.
 *
 * This mirrors `internalPlan.ts`'s own established pattern exactly
 * (idempotent, self-seeding on first need, `DuplicateKeyError`
 * tolerated as "already seeded") rather than requiring an operator to
 * run a one-time script before the very first real customer can
 * onboard — the mission's own "No Manual Database Requirement"
 * Definition of Done (§46) applies here as much as it does to the rest
 * of the funnel.
 *
 * Real commercial tiers/pricing beyond this one free trial are a
 * genuine business decision this pass has no mandate to invent (see
 * RC_7_AUDIT.md's own disclosed-limitations section) — this plan is
 * deliberately priced at ₹0 because there is no live payment provider
 * configured in this deployment to actually collect a real price yet
 * (RC-4's own audit already disclosed this same gap for
 * PLATFORM_ADMIN_SECRET-gated commercial configuration). `trialDays`
 * is real and wired into Module 8.3's own existing trial/expiry
 * machinery (`subscriptionService.assignPlan()`'s trialing branch,
 * the scheduler's own trial-expiry check) — nothing about trial
 * mechanics is new in this file, only the plan row itself.
 */
export const TRIAL_PLAN_ID = "starter-trial";
const TRIAL_DAYS = 14;

let seeded = false;

export async function ensureTrialPlanSeeded(): Promise<void> {
  if (seeded) return;
  const repo = await getPlanRepository();
  const existing = await repo.findById(TRIAL_PLAN_ID);
  if (existing) {
    seeded = true;
    return;
  }
  try {
    await repo.create({
      id: TRIAL_PLAN_ID,
      name: "Free Trial",
      description: `Full core CRM, WhatsApp, automation, and email access for ${TRIAL_DAYS} days — no card required. Upgrade anytime.`,
      status: "active",
      billingInterval: "monthly",
      currency: "INR",
      basePriceInSmallestUnit: 0,
      capabilities: [
        "crm",
        "whatsapp",
        "whatsapp_campaigns",
        "automation",
        "email",
        "analytics",
        "integrations",
        "file_storage",
        "calendar",
        "team_members",
      ],
      limits: {
        seats: 3,
        leads: 500,
        whatsapp_messages: 200,
        whatsapp_campaign_sends: 200,
        automation_executions: 100,
        storage_bytes: 500 * 1024 * 1024,
        integrations: 3,
      },
      trialDays: TRIAL_DAYS,
    });
  } catch (error) {
    if (!(error instanceof DuplicateKeyError)) throw error;
  }
  seeded = true;
}
