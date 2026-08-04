import { leadService } from "@/lib/services/leads";

/**
 * Enterprise CRM (Phase 1) — one-time backfill for leads created before
 * lead scoring existed. Every write path added by Phase 1
 * (registerLead/updateLead/tagLead/bulk operations) recomputes score on
 * its own from here on; this script only ever needs to run once per
 * environment, against leads that predate all of them.
 *
 * Same out-of-band precedent as scripts/createAdminUser.ts and
 * scripts/resetAdminPassword.ts — requires shell/deploy access to the
 * running environment, not a public endpoint. Only meaningfully durable
 * once MONGODB_URI is configured.
 *
 * Usage:
 *   npx tsx scripts/backfillLeadScores.ts
 */
async function main(): Promise<void> {
  const { processed } = await leadService.backfillScores();
  console.log(`Backfilled score/health for ${processed} lead(s).`);
}

main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exitCode = 1;
});
