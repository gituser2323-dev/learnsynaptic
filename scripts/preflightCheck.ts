import { runPreflightChecks, type PreflightStatus } from "@/lib/services/systemHealth/preflightService";

/**
 * RC-4 — Deployment & Production Infrastructure. The CLI half of the
 * mission's own "safe preflight mechanism/checklist" — run this before
 * (or as part of) a production deploy to get a real answer for every
 * category the mission names: Database, Authentication, Encryption,
 * Queue, Cron, Workers, Storage, Observability — plus tenant-level
 * optional integrations, reported (never blocking). See
 * lib/services/systemHealth/preflightService.ts's own doc comment for
 * the full design; GET /api/admin/system/preflight is the live,
 * already-deployed-instance equivalent of this same check.
 *
 * Usage:
 *   npm run preflight
 *
 * Exit code 0 when every category is "ok" or "warning"; exit code 1
 * when any category is "critical" — wire this into a deploy pipeline
 * as a real gate if desired (this repo's own CI doesn't, since CI runs
 * with no environment configured at all, by design — see
 * .github/workflows/ci.yml's own comment).
 */
const STATUS_ICON: Record<PreflightStatus, string> = { ok: "✓", warning: "⚠", critical: "✗" };

async function main(): Promise<void> {
  const report = await runPreflightChecks();

  console.log(`\nPreflight check — environment: ${report.environment}\n`);
  console.log("Categories:");
  for (const c of report.categories) {
    console.log(`  ${STATUS_ICON[c.status]} ${c.category}: ${c.detail}`);
  }

  console.log("\nTenant-level / optional integrations (never block the platform):");
  for (const t of report.tenantIntegrations) {
    console.log(`  ${t.configured ? "✓" : "—"} ${t.integration}: ${t.detail}`);
  }

  console.log(`\nOverall: ${report.overallOk ? "READY" : "NOT READY — a critical category needs configuration"}\n`);

  if (!report.overallOk) process.exitCode = 1;
}

main().catch((error) => {
  console.error("Preflight check itself failed to run:", error);
  process.exitCode = 1;
});
