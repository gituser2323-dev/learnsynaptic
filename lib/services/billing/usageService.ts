import { getUsageCounterRepository } from "@/lib/db";
import type { UsageCounter, UsageMetric } from "./types";
import { EntitlementError } from "./types";
import { entitlementService } from "./entitlementService";

/** `"YYYY-MM"`, IST-anchored (`Asia/Kolkata` — this app's own
 *  established billing/reporting timezone convention, see
 *  `lib/cohortDate.ts` and `lib/services/revenueAnalytics/dateRanges.ts`),
 *  never the server process's own local timezone. A plain calendar
 *  month, deliberately not a rolling 30-day window — the simplest
 *  correct definition of "this billing period" for a monthly-interval
 *  plan, and trivial to reason about in the admin UI ("usage resets on
 *  the 1st"). */
export function currentBillingPeriod(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit" }).formatToParts(now);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  return `${year}-${month}`;
}

export interface UsageCheckResult {
  allowed: boolean;
  current: number;
  limit: number | null;
}

/** For STOCK metrics (a current level that goes up AND down — e.g.
 *  `storage_bytes`, incremented on upload and decremented on delete) as
 *  opposed to FLOW metrics (a per-period count that only ever
 *  increments and resets — e.g. `whatsapp_messages`). A stock metric
 *  passes this constant as its `period` instead of
 *  `currentBillingPeriod()`, since "this billing period" has no
 *  meaning for a running total that doesn't reset monthly. */
export const LIFETIME_USAGE_PERIOD = "lifetime";

/**
 * Business OS Phase 8, Module 8.3 — real, persisted, atomically
 * incrementable usage counters, scoped by organizationId + metric +
 * billing period. Never derived by counting another collection on
 * every request (the mission's own explicit "avoid expensive full-
 * database counting").
 *
 * **Concurrency**: `checkAndIncrementUsage()` uses an
 * increment-then-compensate algorithm, not a read-then-write check —
 * the only correct way to make a limit check race-safe without a
 * database transaction. `UsageCounterRepository.incrementAndGet()` is
 * a single atomic `$inc` (MongoDB applies it to one document
 * indivisibly regardless of how many callers race it simultaneously);
 * this function increments first, unconditionally, then checks whether
 * the RESULT is over the limit and — only if so — issues a second
 * atomic `$inc` of `-delta` to roll back its own contribution. Two
 * requests racing the last available unit of a limit can never both
 * "win": MongoDB serializes the two `$inc`s in some real order, the
 * second one to land sees a count that's already at/over the limit and
 * rolls itself back, the first one keeps its slot. This is a
 * well-established atomic-counter-with-limit pattern, not a heuristic —
 * proven directly by `usageService.concurrency.unit.test.ts`'s own
 * parallel `Promise.all` race test.
 */
export const usageService = {
  async getUsage(organizationId: string, metric: UsageMetric, period: string = currentBillingPeriod()): Promise<number> {
    const repo = await getUsageCounterRepository();
    const counter = await repo.find(organizationId, metric, period);
    return counter?.count ?? 0;
  },

  async listUsage(organizationId: string, period: string = currentBillingPeriod()): Promise<UsageCounter[]> {
    const repo = await getUsageCounterRepository();
    return repo.listForOrganization(organizationId, period);
  },

  /** Unconditional increment — for metering a metric this plan doesn't
   *  actually limit (still worth tracking for visibility/future
   *  pricing), or after `checkAndIncrementUsage` has already decided
   *  the action is allowed elsewhere in the same request. */
  async incrementUsage(organizationId: string, metric: UsageMetric, amount = 1, period: string = currentBillingPeriod()): Promise<number> {
    const repo = await getUsageCounterRepository();
    const counter = await repo.incrementAndGet(organizationId, metric, period, amount);
    return counter.count;
  },

  /** The real enforcement primitive: atomically increments usage and
   *  reports whether that increment stayed within the organization's
   *  plan limit for `metric`. When `allowed` is false, the increment
   *  has already been rolled back — the caller's own billable action
   *  (send the WhatsApp message, run the automation step, call the AI
   *  vendor, accept the upload) must NOT proceed; per the mission's own
   *  "do not partially execute paid actions." */
  async checkAndIncrementUsage(organizationId: string, metric: UsageMetric, amount = 1, period: string = currentBillingPeriod()): Promise<UsageCheckResult> {
    const limit = await entitlementService.getLimit(organizationId, metric);
    const repo = await getUsageCounterRepository();

    const afterIncrement = await repo.incrementAndGet(organizationId, metric, period, amount);
    // Captured into a primitive immediately — the in-memory repository
    // returns the SAME mutable object it stores internally (not a
    // snapshot copy, the same convention every in-memory repository in
    // this codebase already follows), so reading `afterIncrement.count`
    // again AFTER the rollback call below would silently see the
    // rollback's own mutation applied retroactively to this reference.
    // A real bug caught by this module's own concurrency test suite,
    // not a hypothetical.
    const countAfterIncrement = afterIncrement.count;
    if (limit === null || countAfterIncrement <= limit) {
      return { allowed: true, current: countAfterIncrement, limit };
    }

    await repo.incrementAndGet(organizationId, metric, period, -amount);
    return { allowed: false, current: countAfterIncrement - amount, limit };
  },

  /** Same contract as `checkAndIncrementUsage`, but throws
   *  `EntitlementError("limit_exceeded")` instead of returning
   *  `allowed: false` — for call sites that want the same
   *  throw-on-denial ergonomics `assertCapability` already gives. */
  async assertWithinLimit(organizationId: string, metric: UsageMetric, amount = 1): Promise<UsageCheckResult> {
    const result = await this.checkAndIncrementUsage(organizationId, metric, amount);
    if (!result.allowed) {
      throw new EntitlementError("limit_exceeded", `Usage limit reached for "${metric}" (${result.current}/${result.limit}).`, {
        organizationId,
        metric,
        current: result.current,
        limit: result.limit,
      });
    }
    return result;
  },
};
