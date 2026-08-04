import { enqueueJob, registerJobHandler } from "@/lib/services/scheduler";
import { getCampaignTemplateRepository, getIntegrationConnectionRepository } from "@/lib/db";
import { runCrossTenantSweep, runWithTenantContext, getTenantContext } from "@/lib/tenancy/context";
import { createLogger } from "@/lib/logger";
import { whatsappService } from "./whatsappService";
import { phoneNumberService } from "./phoneNumbers";

const logger = createLogger({ service: "whatsapp.accountHealth" });

const TEMPLATE_SYNC_JOB_TYPE = "whatsapp.template_sync";
const PHONE_HEALTH_JOB_TYPE = "whatsapp.phone_health_check";

/** Blueprint doesn't specify an exact interval for either job — these
 *  are reasonable defaults for something that only needs to catch a
 *  status change "within one sync cycle" (the module's own Definition
 *  of Done), not real-time. Template approval review and quality-rating
 *  drift both move on the order of hours, not minutes, on Meta's side. */
const TEMPLATE_SYNC_INTERVAL_MINUTES = 60;
const PHONE_HEALTH_INTERVAL_MINUTES = 30;

/**
 * Business OS Phase 8, Module 8.5 — every organization that has
 * self-connected its own WhatsApp Business Account via Embedded
 * Signup, resolved with a real cross-tenant sweep (the same "resolve
 * the list across every org first, then enter each one's own tenant
 * context for the part that touches its data" pattern Module 8.3's
 * own billing period-check job already established, and 8.1's own
 * scheduler/automation-engine tick before that). Deliberately filters
 * to `credentialRef.type === "tenant_secret"` — this deployment's own
 * default/env-configured number (if any) has no IntegrationConnection
 * row of this shape, so it's never double-processed here; the
 * unconditional no-context call each handler below still makes first
 * covers that default number exactly as it did before this module
 * existed.
 */
async function forEachConnectedOrganization(fn: (organizationId: string) => Promise<void>): Promise<void> {
  const repository = await getIntegrationConnectionRepository();
  const connections = await runCrossTenantSweep(() => repository.list());
  const connected = connections.filter((c) => c.providerId === "whatsapp" && c.credentialRef.type === "tenant_secret" && c.organizationId);

  for (const connection of connected) {
    const organizationId = connection.organizationId!;
    try {
      await runWithTenantContext({ organizationId }, () => fn(organizationId));
    } catch (error) {
      // One organization's own vendor/network failure must never abort
      // every other organization's own sync cycle — logged, skipped,
      // retried next cycle, the same fail-soft posture this job already
      // took for a single deployment-wide provider.
      logger.warn("whatsapp.per_organization_sync_failed", { organizationId, error: error instanceof Error ? error.message : String(error) });
    }
  }
}

/**
 * Module 2.3 — Template Sync. Bridges onto the shared scheduler
 * (Campaign Architecture, same "one scheduling infrastructure, no
 * separate pollers" precedent lib/services/automation/schedulerIntegration.ts
 * already established). Reconciles every persisted CampaignTemplate
 * against the vendor's live approval status, matched by
 * `metaTemplateName` — a template this app knows about that the vendor
 * doesn't return (deleted on Meta's side, or a typo'd name) is left
 * alone, not deleted or flagged; that's a data-quality question for a
 * human, not something a sync job should guess at.
 *
 * Business OS Phase 8, Module 8.5 — now runs once for this deployment's
 * own default/env-configured number (unchanged, no tenant context —
 * `whatsappService.listTemplateApprovalStatuses()`'s own tenant-aware
 * provider resolution correctly falls through to env config with no
 * ambient organization), THEN once more per organization that has
 * self-connected its own WABA — each inside its own tenant context, so
 * `CampaignTemplateRepository.listAll()` (tenant-scoped since Module
 * 8.1) only ever sees and updates that one organization's own templates.
 */
async function syncTemplatesOnce(): Promise<void> {
  const statuses = await whatsappService.listTemplateApprovalStatuses();
  if (statuses === null) {
    logger.info("whatsapp.template_sync_skipped", { reason: "provider does not support template sync or the call failed" });
    return;
  }

  const byName = new Map(statuses.map((s) => [s.metaTemplateName, s.status]));
  const repository = await getCampaignTemplateRepository();
  const templates = await repository.listAll();
  const checkedAt = new Date().toISOString();

  let updated = 0;
  for (const template of templates) {
    const liveStatus = byName.get(template.metaTemplateName);
    if (!liveStatus || liveStatus === template.approvalStatus) continue;
    await repository.updateApprovalStatus(template.id, { approvalStatus: liveStatus, approvalStatusCheckedAt: checkedAt });
    updated++;
  }
  logger.info("whatsapp.template_sync_completed", { checked: templates.length, updated });
}

export function registerTemplateSyncHandler(): void {
  registerJobHandler(TEMPLATE_SYNC_JOB_TYPE, async () => {
    await syncTemplatesOnce();
    await forEachConnectedOrganization(() => syncTemplatesOnce());

    // Always "reschedule" — this is a recurring heartbeat, not a job
    // with a real success/failure outcome the scheduler should retry on
    // its own timeline (same posture automation.tick already takes).
    return { result: "reschedule", runAt: nextRunAt(TEMPLATE_SYNC_INTERVAL_MINUTES) };
  });
}

/** Module 2.3 — Business Account Health. Business OS Phase 8, Module
 *  8.5 — same "default number once, then once per connected
 *  organization" shape as syncTemplatesOnce above; `organizationId` is
 *  read from ambient tenant context (undefined for the default-number
 *  call, matching this app's own pre-8.5 behavior exactly). */
async function checkPhoneHealthOnce(): Promise<void> {
  const health = await whatsappService.getPhoneNumberHealth();
  if (health === null) {
    logger.info("whatsapp.phone_health_check_skipped", { reason: "provider does not support health checks or the call failed" });
    return;
  }
  const organizationId = getTenantContext()?.organizationId;
  await phoneNumberService.upsertHealth({ ...health, organizationId });
  logger.info("whatsapp.phone_health_check_completed", { phoneNumberId: health.phoneNumberId, qualityRating: health.qualityRating, organizationId });
}

export function registerPhoneHealthCheckHandler(): void {
  registerJobHandler(PHONE_HEALTH_JOB_TYPE, async () => {
    await checkPhoneHealthOnce();
    await forEachConnectedOrganization(() => checkPhoneHealthOnce());
    return { result: "reschedule", runAt: nextRunAt(PHONE_HEALTH_INTERVAL_MINUTES) };
  });
}

function nextRunAt(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

let ticksEnsured = false;

/** Creates the first tick of each job if this process hasn't ensured
 *  one yet — after that, each processed tick reschedules itself, the
 *  same "unconditional heartbeat, the handler is what's cheap to
 *  no-op" posture automation.tick already takes. Whether the active
 *  provider actually supports either capability is the handler's own
 *  concern (whatsappService's null-on-unsupported convention), not a
 *  gate here — this file shouldn't need to know which vendor is
 *  configured. */
export async function ensureWhatsAppHealthTicksScheduled(): Promise<void> {
  if (ticksEnsured) return;
  ticksEnsured = true;

  await enqueueJob({ jobType: TEMPLATE_SYNC_JOB_TYPE, payload: {}, runAt: new Date().toISOString() });
  await enqueueJob({ jobType: PHONE_HEALTH_JOB_TYPE, payload: {}, runAt: new Date().toISOString() });
}
