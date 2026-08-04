import { getPlanRepository } from "@/lib/db";
import { DuplicateKeyError } from "@/lib/db/types";
import { PLAN_CAPABILITIES } from "./types";

/**
 * Business OS Phase 8, Module 8.3 — the self-provisioned, fully-capable
 * plan every organization with no explicit Subscription yet is
 * grandfathered onto (see `subscriptionService.getForOrganization()`).
 * This is what makes "Do NOT break the internal Business OS" true for
 * the existing LearnSynaptic organization AND any future org created
 * before an admin explicitly assigns it a real commercial plan — never
 * a hard failure or a silently-disabled feature just because Module
 * 8.3 shipped. `billingInterval: "internal"` (not `"one_time"`) keeps
 * it structurally distinguishable from a real future free/one-off plan
 * in any revenue reporting.
 */
export const INTERNAL_PLAN_ID = "internal-unlimited";

let seeded = false;

/** Idempotent — safe to call on every `getForOrganization()` miss; the
 *  `seeded` flag avoids a redundant repository read on the hot path
 *  once this process has confirmed the plan exists at least once. */
export async function ensureInternalPlanSeeded(): Promise<void> {
  if (seeded) return;
  const repo = await getPlanRepository();
  const existing = await repo.findById(INTERNAL_PLAN_ID);
  if (existing) {
    seeded = true;
    return;
  }
  try {
    await repo.create({
      id: INTERNAL_PLAN_ID,
      name: "Internal (Unlimited)",
      description: "Full-capability, unlimited-usage plan auto-assigned to any organization with no explicit commercial plan yet — including LearnSynaptic's own internal use of this platform.",
      status: "active",
      billingInterval: "internal",
      currency: "INR",
      basePriceInSmallestUnit: 0,
      capabilities: [...PLAN_CAPABILITIES],
      limits: {},
      trialDays: 0,
    });
  } catch (error) {
    if (!(error instanceof DuplicateKeyError)) throw error;
  }
  seeded = true;
}
