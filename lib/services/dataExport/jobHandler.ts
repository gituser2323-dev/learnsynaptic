import {
  getDataExportRequestRepository,
  getBrandConfigurationRepository,
  getLeadRepository,
  getActivityRepository,
  getTaskRepository,
  getOpportunityRepository,
  getConversationRepository,
  getCampaignRepository,
  getWhatsAppCampaignRepository,
  getWorkflowDefinitionRepository,
  getPaymentRepository,
  getSubscriptionRepository,
  getOrganizationRepository,
} from "@/lib/db";
import { registerJobHandler } from "@/lib/services/scheduler";
import type { JobHandler, JobOutcome, ScheduledJob } from "@/lib/services/scheduler";
import { fileStorageService } from "@/lib/services/storage/fileStorageService";
import { getTenantContext } from "@/lib/tenancy/context";
import { auditLogService, AUDIT_ACTIONS } from "@/lib/services/auditLog";

interface TenantExportJobPayload {
  exportRequestId: string;
}

/** How many leads get an activity-timeline lookup per export — bounded
 *  so one enormous organization can't turn this into an unbounded
 *  number of repository calls inside a single background job. Disclosed
 *  in DR_RUNBOOK.md, not silently truncated without a trace: the export
 *  JSON records this cap alongside the actual lead count. */
const MAX_LEADS_WITH_ACTIVITY_LOOKUP = 2000;
const LIST_ALL_LIMIT = 10_000;

/**
 * RC-5 — Backup, Restore & Disaster Recovery: "tenant_export.generate"
 * job type. Runs inside `runWithTenantContext({ organizationId: job.organizationId })`
 * (schedulerService.ts's own per-job context setup) — every repository
 * call below is automatically scoped to the requesting organization via
 * `tenantScopePlugin`, the same mechanism every real HTTP request goes
 * through. This is what makes "Organization A must never export
 * Organization B" true by construction rather than by this handler
 * remembering to filter correctly.
 *
 * Produces ONE JSON file (portable, lossless for nested/relational data
 * — CSV per-entity export already exists separately for Leads, see
 * `app/api/admin/leads?format=csv`) uploaded via `fileStorageService`
 * under `FileCategory: "EXPORT"`, `visibility: "private"`, stamped with
 * the requesting `organizationId` — the same tenant-scoped FileAsset
 * row every other upload in this app produces, so RC-5's own
 * reconciliation tooling (scripts/db/reconcileFileStorage.ts) and
 * retention/lifecycle policy (§17) apply to export files with no
 * special-casing.
 *
 * Disclosed scope: message BODIES are not included (conversation
 * records are, matching the mission's own "conversations" line item;
 * full message-by-message content is a materially larger export left
 * for a future iteration if actually requested — see DR_RUNBOOK.md §7).
 */
const tenantExportGenerateHandler: JobHandler = async (job: ScheduledJob): Promise<JobOutcome> => {
  const payload = job.payload as unknown as TenantExportJobPayload;
  const exportRequestRepository = await getDataExportRequestRepository();
  const organizationId = getTenantContext()?.organizationId ?? job.organizationId;

  if (!organizationId) {
    await exportRequestRepository.update(payload.exportRequestId, {
      status: "failed",
      error: "No organization context — export cannot be tenant-scoped.",
    });
    return { result: "failed", retryable: false, error: "missing organizationId" };
  }

  try {
    await exportRequestRepository.update(payload.exportRequestId, { status: "processing" });

    const [
      organizationRepo,
      brandConfigRepo,
      leadRepo,
      activityRepo,
      taskRepo,
      opportunityRepo,
      conversationRepo,
      campaignRepo,
      whatsappCampaignRepo,
      workflowDefinitionRepo,
      paymentRepo,
      subscriptionRepo,
    ] = await Promise.all([
      getOrganizationRepository(),
      getBrandConfigurationRepository(),
      getLeadRepository(),
      getActivityRepository(),
      getTaskRepository(),
      getOpportunityRepository(),
      getConversationRepository(),
      getCampaignRepository(),
      getWhatsAppCampaignRepository(),
      getWorkflowDefinitionRepository(),
      getPaymentRepository(),
      getSubscriptionRepository(),
    ]);

    const [organization, brandConfiguration, leadsPage, tasksPage, opportunities, conversationsPage, campaignsPage, whatsappCampaignsPage, workflowDefinitions, paymentsPage, subscription] =
      await Promise.all([
        organizationRepo.findById(organizationId),
        brandConfigRepo.findByOrganizationId(organizationId),
        leadRepo.list({ deleted: false }, 1, LIST_ALL_LIMIT),
        taskRepo.list({}, 1, LIST_ALL_LIMIT),
        opportunityRepo.list({}),
        conversationRepo.list({}, 1, LIST_ALL_LIMIT),
        campaignRepo.list({}, 1, LIST_ALL_LIMIT),
        whatsappCampaignRepo.list({}, 1, LIST_ALL_LIMIT),
        workflowDefinitionRepo.list(),
        paymentRepo.list({}, 1, LIST_ALL_LIMIT),
        subscriptionRepo.findByOrganizationId(organizationId),
      ]);

    const leadsForActivityLookup = leadsPage.items.slice(0, MAX_LEADS_WITH_ACTIVITY_LOOKUP);
    const activityLists = await Promise.all(
      leadsForActivityLookup.map((lead: (typeof leadsPage.items)[number]) =>
        activityRepo.listForEntity({ entityType: "Lead", entityId: lead.id }, 1, 200),
      ),
    );
    const activities = activityLists.flatMap((page: (typeof activityLists)[number]) => page.items);

    const exportPayload = {
      exportedAt: new Date().toISOString(),
      organizationId,
      organizationConfig: organization ? { name: organization.name, slug: organization.slug } : null,
      brandConfiguration: brandConfiguration ?? null,
      leads: leadsPage.items,
      activities: {
        note:
          leadsPage.items.length > MAX_LEADS_WITH_ACTIVITY_LOOKUP
            ? `Activity lookup capped at ${MAX_LEADS_WITH_ACTIVITY_LOOKUP} of ${leadsPage.items.length} leads — see DR_RUNBOOK.md §7.`
            : `All ${leadsPage.items.length} leads' activity timelines included.`,
        items: activities,
      },
      tasks: tasksPage.items,
      opportunities,
      conversations: conversationsPage.items,
      campaigns: campaignsPage.items,
      whatsappCampaigns: whatsappCampaignsPage.items,
      automationDefinitions: workflowDefinitions,
      payments: paymentsPage.items,
      subscription: subscription ?? null,
    };

    const buffer = Buffer.from(JSON.stringify(exportPayload, null, 2), "utf-8");
    const uploadResult = await fileStorageService.uploadFile({
      buffer,
      originalFilename: `organization-export-${organizationId}-${Date.now()}.json`,
      mimeType: "application/json",
      category: "EXPORT",
      visibility: "private",
      relatedEntityType: "DataExportRequest",
      relatedEntityId: payload.exportRequestId,
      organizationId,
    });

    if (!uploadResult.success) {
      const errorMessage = uploadResult.errors.map((e) => e.message).join("; ");
      await exportRequestRepository.update(payload.exportRequestId, { status: "failed", error: errorMessage });
      return { result: "failed", retryable: false, error: errorMessage };
    }

    await exportRequestRepository.update(payload.exportRequestId, {
      status: "completed",
      fileAssetId: uploadResult.file.id,
    });

    await auditLogService.record({
      action: AUDIT_ACTIONS.DATA_EXPORT_COMPLETED,
      entityType: "DataExportRequest",
      entityId: payload.exportRequestId,
      metadata: { fileAssetId: uploadResult.file.id, sizeBytes: uploadResult.file.sizeBytes },
    });

    return { result: "completed" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown export error";
    await exportRequestRepository.update(payload.exportRequestId, { status: "failed", error: message });
    return { result: "failed", retryable: false, error: message };
  }
};

export function registerTenantExportJobHandler(): void {
  registerJobHandler("tenant_export.generate", tenantExportGenerateHandler);
}
