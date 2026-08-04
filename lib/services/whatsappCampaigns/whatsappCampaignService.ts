import {
  getWhatsAppCampaignRepository,
  getCampaignTemplateRepository,
  getMessageRepository,
} from "@/lib/db";
import { leadService } from "@/lib/services/leads";
import type { LeadListFilters } from "@/lib/services/leads";
import { auditLogService, AUDIT_ACTIONS } from "@/lib/services/auditLog";
import type { AuditContext } from "@/lib/services/auditLog";
import { enqueueJob } from "@/lib/services/scheduler";
import type { PaginatedResult } from "@/lib/pagination";
import { CSV_IMPORT_MAX_ROWS, MESSAGE_RETRY_POLICY } from "@/config/whatsappCampaigns";
import { validateCreateCampaignInput, validateCreateCampaignTemplateInput } from "./validation";
import { parseAndValidateCsv, type CsvImportResult } from "./csvImportService";
import { SEND_MESSAGE_JOB_TYPE, PROMOTE_SCHEDULED_JOB_TYPE } from "./jobTypes";
import type {
  AudienceResolutionResult,
  CampaignTemplate,
  CampaignTemplateListFilters,
  CampaignValidationError,
  CreateCampaignTemplateResult,
  CreateMessageInput,
  CreateWhatsAppCampaignResult,
  MessageListFilters,
  MessageStatusCounts,
  ResolveAudienceInput,
  WhatsAppCampaign,
  WhatsAppCampaignListFilters,
} from "./types";

/**
 * Application layer for the WhatsApp Campaign Manager
 * (CAMPAIGN_ARCHITECTURE.md). Deliberately named `whatsappCampaignService`
 * — not `campaignService` — to avoid colliding with
 * lib/services/campaigns's existing export of that name (approved
 * decision 5: separate bounded contexts, separate services, no rename
 * of the pre-existing one).
 *
 * Every send/schedule/retry path goes through the shared scheduler
 * (lib/services/scheduler) — this module enqueues jobs, it never sends
 * a WhatsApp message itself (that's jobHandlers.ts, which calls the
 * existing lib/services/whatsapp's processSendJob() — zero new sending
 * logic, per the approved integration requirement).
 */

type NotFoundOrInvalidResult<T> =
  | { success: true; campaign: WhatsAppCampaign; data: T }
  | { success: false; errors: CampaignValidationError[] };

async function requireDraftCampaign(campaignId: string): Promise<
  { ok: true; campaign: WhatsAppCampaign } | { ok: false; errors: CampaignValidationError[] }
> {
  const repository = await getWhatsAppCampaignRepository();
  const campaign = await repository.findById(campaignId);
  if (!campaign) {
    return { ok: false, errors: [{ field: "campaignId", message: "Campaign not found." }] };
  }
  if (campaign.status !== "draft") {
    return {
      ok: false,
      errors: [{ field: "status", message: `Audience can only be resolved for a draft campaign (currently "${campaign.status}").` }],
    };
  }
  return { ok: true, campaign };
}

/** Shared by every audience-resolution path (filter/manual/csv) — see
 *  CAMPAIGN_ARCHITECTURE.md §5: regardless of source, the audience
 *  becomes a concrete, persisted set of Message rows exactly once. */
async function finalizeAudience(
  campaign: WhatsAppCampaign,
  source: NonNullable<WhatsAppCampaign["audienceSource"]>,
  messageInputs: CreateMessageInput[],
): Promise<WhatsAppCampaign> {
  if (messageInputs.length > 0) {
    const messageRepository = await getMessageRepository();
    await messageRepository.createMany(messageInputs);
  }
  const repository = await getWhatsAppCampaignRepository();
  return repository.update(campaign.id, {
    status: "ready",
    audienceSource: source,
    audienceSnapshotAt: new Date().toISOString(),
    recipientCount: messageInputs.length,
  });
}

/**
 * Creates a SEND_MESSAGE_JOB_TYPE job for every still-queued Message in
 * a campaign, with the approved 3-attempt/1-5-15-minute retry policy
 * (config/whatsappCampaigns.ts). Called by both sendNow() (immediate)
 * and jobHandlers.ts's promote-scheduled handler (once a scheduled
 * campaign's time arrives) — the one place this logic lives, not
 * duplicated between the two triggers.
 */
export async function enqueueMessagesForSending(campaignId: string): Promise<number> {
  const messageRepository = await getMessageRepository();
  const { items } = await messageRepository.list({ campaignId, status: "queued" }, 1, CSV_IMPORT_MAX_ROWS);
  for (const message of items) {
    await enqueueJob({
      jobType: SEND_MESSAGE_JOB_TYPE,
      payload: { messageId: message.id },
      runAt: new Date().toISOString(),
      retryPolicy: MESSAGE_RETRY_POLICY,
    });
  }
  return items.length;
}

/**
 * Marks a campaign "completed" once every Message it owns has reached a
 * terminal status (delivered/read/failed) — "completed" does not mean
 * "everything delivered," see CAMPAIGN_ARCHITECTURE.md §4. Called by
 * jobHandlers.ts's send-message handler after each message resolves.
 * A no-op unless the campaign is currently "sending" (so it never
 * flips a cancelled/draft campaign).
 */
export async function checkCampaignCompletion(campaignId: string): Promise<void> {
  const repository = await getWhatsAppCampaignRepository();
  const campaign = await repository.findById(campaignId);
  if (!campaign || campaign.status !== "sending") return;

  const messageRepository = await getMessageRepository();
  const counts = await messageRepository.countByStatus(campaignId);
  const stillInFlight = counts.queued + counts.sending;
  if (stillInFlight === 0) {
    await repository.update(campaignId, { status: "completed" });
    if (campaign.recurrenceRule) {
      await createNextRecurrence(campaign);
    }
  }
}

/**
 * Module 2.5 — Campaign Enhancements. Auto-creates the next
 * occurrence as a fresh draft the moment a recurring campaign
 * completes — deliberately NOT a fully unattended re-send. No
 * audience-resolution "recipe" is persisted anywhere in this
 * architecture (`audienceSource` is just a tag, never the actual
 * `LeadListFilters`/recipient list a human supplied) — auto-resolving
 * and auto-sending an audience nobody reviewed would be the wrong kind
 * of automation for a WhatsApp send a real contact receives. What
 * recurrence saves a marketer is re-typing the name/template every
 * cohort and remembering the cadence, not the whole lifecycle — the
 * clean-draft shape is identical to a manual "Duplicate," just
 * triggered by completion instead of a button.
 */
async function createNextRecurrence(completed: WhatsAppCampaign): Promise<void> {
  const repository = await getWhatsAppCampaignRepository();
  const next = await repository.create({
    name: completed.name,
    templateId: completed.templateId,
    marketingCampaignId: completed.marketingCampaignId,
    recurrenceRule: completed.recurrenceRule,
    clonedFromId: completed.id,
  });

  await auditLogService.record({
    action: AUDIT_ACTIONS.WHATSAPP_CAMPAIGN_CLONED,
    entityType: "WhatsAppCampaign",
    entityId: next.id,
    actorType: "system",
    metadata: { clonedFromId: completed.id, reason: "recurrence" },
  });
}

export const whatsappCampaignService = {
  // ─── Templates ─────────────────────────────────────────────────────

  async createTemplate(input: unknown): Promise<CreateCampaignTemplateResult> {
    const validation = validateCreateCampaignTemplateInput(input);
    if (!validation.valid) return { success: false, errors: validation.errors };

    const repository = await getCampaignTemplateRepository();
    const template = await repository.create(validation.data);
    return { success: true, template };
  },

  async listTemplates(
    filters: CampaignTemplateListFilters,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<CampaignTemplate>> {
    const repository = await getCampaignTemplateRepository();
    return repository.list(filters, page, limit);
  },

  // ─── Campaign creation ─────────────────────────────────────────────

  async createCampaign(input: unknown, context: AuditContext = {}): Promise<CreateWhatsAppCampaignResult> {
    const validation = validateCreateCampaignInput(input);
    if (!validation.valid) return { success: false, errors: validation.errors };

    const templateRepository = await getCampaignTemplateRepository();
    const template = await templateRepository.findById(validation.data.templateId);
    if (!template) {
      return { success: false, errors: [{ field: "templateId", message: "No template found with this id." }] };
    }

    const repository = await getWhatsAppCampaignRepository();
    const campaign = await repository.create(validation.data);

    await auditLogService.record({
      action: AUDIT_ACTIONS.WHATSAPP_CAMPAIGN_CREATED,
      entityType: "WhatsAppCampaign",
      entityId: campaign.id,
      actorId: context.actorId,
      actorType: context.actorId ? "user" : "system",
      requestId: context.requestId,
      metadata: { name: campaign.name, templateId: campaign.templateId },
    });

    return { success: true, campaign };
  },

  // ─── Audience resolution (draft -> ready) ───────────────────────────

  async resolveAudience(
    campaignId: string,
    input: ResolveAudienceInput,
  ): Promise<NotFoundOrInvalidResult<AudienceResolutionResult>> {
    const check = await requireDraftCampaign(campaignId);
    if (!check.ok) return { success: false, errors: check.errors };
    const { campaign } = check;

    if (input.source === "filter") {
      const page = await leadService.listLeads(input.leadFilters as LeadListFilters, 1, CSV_IMPORT_MAX_ROWS);
      const messageInputs: CreateMessageInput[] = page.items.map((lead) => ({
        campaignId,
        recipientPhoneE164: lead.phone,
        recipientName: lead.name,
        leadId: lead.id,
        templateId: campaign.templateId,
      }));
      const updated = await finalizeAudience(campaign, "filter", messageInputs);
      return { success: true, campaign: updated, data: { recipientCount: messageInputs.length, rejected: [] } };
    }

    // manual
    const seen = new Set<string>();
    const messageInputs: CreateMessageInput[] = [];
    const rejected: AudienceResolutionResult["rejected"] = [];
    for (const recipient of input.recipients) {
      if (!recipient.phoneE164) {
        rejected.push({ rawPhone: "", reason: "Missing phone number" });
        continue;
      }
      if (seen.has(recipient.phoneE164)) {
        rejected.push({ rawPhone: recipient.phoneE164, reason: "Duplicate in this list" });
        continue;
      }
      seen.add(recipient.phoneE164);
      messageInputs.push({
        campaignId,
        recipientPhoneE164: recipient.phoneE164,
        recipientName: recipient.name,
        templateId: campaign.templateId,
      });
    }
    const updated = await finalizeAudience(campaign, "manual", messageInputs);
    return { success: true, campaign: updated, data: { recipientCount: messageInputs.length, rejected } };
  },

  async resolveAudienceFromCsv(
    campaignId: string,
    csvText: string,
  ): Promise<
    | { success: true; campaign: WhatsAppCampaign; result: CsvImportResult }
    | { success: false; errors: CampaignValidationError[] }
  > {
    const check = await requireDraftCampaign(campaignId);
    if (!check.ok) return { success: false, errors: check.errors };
    const { campaign } = check;

    const parseResult = parseAndValidateCsv(csvText);
    if (parseResult.fileError) {
      return { success: false, errors: [{ field: "file", message: parseResult.fileError }] };
    }

    const messageInputs: CreateMessageInput[] = parseResult.recipients.map((recipient) => ({
      campaignId,
      recipientPhoneE164: recipient.phoneE164,
      recipientName: recipient.name,
      templateId: campaign.templateId,
    }));
    const updated = await finalizeAudience(campaign, "csv_import", messageInputs);
    return { success: true, campaign: updated, result: parseResult };
  },

  // ─── Send / schedule / cancel / retry ───────────────────────────────

  async sendNow(
    campaignId: string,
    context: AuditContext = {},
  ): Promise<{ success: true; campaign: WhatsAppCampaign } | { success: false; errors: CampaignValidationError[] }> {
    const repository = await getWhatsAppCampaignRepository();
    const campaign = await repository.findById(campaignId);
    if (!campaign) return { success: false, errors: [{ field: "campaignId", message: "Campaign not found." }] };
    if (campaign.status !== "ready") {
      return {
        success: false,
        errors: [{ field: "status", message: `Campaign must be "ready" to send (currently "${campaign.status}").` }],
      };
    }

    await enqueueMessagesForSending(campaignId);
    const updated = await repository.update(campaignId, { status: "sending" });

    await auditLogService.record({
      action: AUDIT_ACTIONS.WHATSAPP_CAMPAIGN_SEND_STARTED,
      entityType: "WhatsAppCampaign",
      entityId: campaignId,
      actorId: context.actorId,
      actorType: context.actorId ? "user" : "system",
      requestId: context.requestId,
      metadata: { recipientCount: campaign.recipientCount },
    });

    return { success: true, campaign: updated };
  },

  async scheduleCampaign(
    campaignId: string,
    scheduledFor: string,
    context: AuditContext = {},
  ): Promise<{ success: true; campaign: WhatsAppCampaign } | { success: false; errors: CampaignValidationError[] }> {
    const repository = await getWhatsAppCampaignRepository();
    const campaign = await repository.findById(campaignId);
    if (!campaign) return { success: false, errors: [{ field: "campaignId", message: "Campaign not found." }] };
    if (campaign.status !== "ready") {
      return {
        success: false,
        errors: [{ field: "status", message: `Campaign must be "ready" to schedule (currently "${campaign.status}").` }],
      };
    }

    const scheduledDate = new Date(scheduledFor);
    if (Number.isNaN(scheduledDate.getTime()) || scheduledDate.getTime() <= Date.now()) {
      return { success: false, errors: [{ field: "scheduledFor", message: "scheduledFor must be a valid future date." }] };
    }

    await enqueueJob({
      jobType: PROMOTE_SCHEDULED_JOB_TYPE,
      payload: { campaignId },
      runAt: scheduledDate.toISOString(),
    });

    const updated = await repository.update(campaignId, {
      status: "scheduled",
      scheduledFor: scheduledDate.toISOString(),
    });

    await auditLogService.record({
      action: AUDIT_ACTIONS.WHATSAPP_CAMPAIGN_SCHEDULED,
      entityType: "WhatsAppCampaign",
      entityId: campaignId,
      actorId: context.actorId,
      actorType: context.actorId ? "user" : "system",
      requestId: context.requestId,
      metadata: { scheduledFor: scheduledDate.toISOString() },
    });

    return { success: true, campaign: updated };
  },

  async cancelCampaign(
    campaignId: string,
  ): Promise<{ success: true; campaign: WhatsAppCampaign } | { success: false; errors: CampaignValidationError[] }> {
    const repository = await getWhatsAppCampaignRepository();
    const campaign = await repository.findById(campaignId);
    if (!campaign) return { success: false, errors: [{ field: "campaignId", message: "Campaign not found." }] };
    if (!["ready", "scheduled", "sending"].includes(campaign.status)) {
      return {
        success: false,
        errors: [{ field: "status", message: `Cannot cancel a campaign in "${campaign.status}" status.` }],
      };
    }
    const updated = await repository.update(campaignId, { status: "cancelled" });
    return { success: true, campaign: updated };
  },

  // ─── Module 2.5: Archive / Duplicate ────────────────────────────────

  /** Hides a campaign from the default Campaign History list — purely
   *  a visibility toggle (Lead.archived's own precedent), no status/
   *  counter is touched. No status restriction: archiving a live
   *  campaign is an odd thing to do but not unsafe, so this doesn't
   *  second-guess the operator the way cancelCampaign's status check
   *  does for an actually destructive action. */
  async archiveCampaign(
    campaignId: string,
    context: AuditContext = {},
  ): Promise<{ success: true; campaign: WhatsAppCampaign } | { success: false; errors: CampaignValidationError[] }> {
    const repository = await getWhatsAppCampaignRepository();
    const campaign = await repository.findById(campaignId);
    if (!campaign) return { success: false, errors: [{ field: "campaignId", message: "Campaign not found." }] };

    const updated = await repository.update(campaignId, { archived: true });
    await auditLogService.record({
      action: AUDIT_ACTIONS.WHATSAPP_CAMPAIGN_ARCHIVED,
      entityType: "WhatsAppCampaign",
      entityId: campaignId,
      actorId: context.actorId,
      actorType: context.actorId ? "user" : "system",
      requestId: context.requestId,
    });
    return { success: true, campaign: updated };
  },

  async unarchiveCampaign(
    campaignId: string,
  ): Promise<{ success: true; campaign: WhatsAppCampaign } | { success: false; errors: CampaignValidationError[] }> {
    const repository = await getWhatsAppCampaignRepository();
    const campaign = await repository.findById(campaignId);
    if (!campaign) return { success: false, errors: [{ field: "campaignId", message: "Campaign not found." }] };
    const updated = await repository.update(campaignId, { archived: false });
    return { success: true, campaign: updated };
  },

  /**
   * Creates a brand-new draft from an existing campaign's reusable
   * parts (name, template, marketing attribution, recurrence rule) —
   * and nothing else. Deliberately does not call anything that creates
   * a Message row: `repository.create()` always starts a campaign at
   * status "draft" with recipientCount/every counter at 0 and no
   * audienceSource, the same fresh-start shape `createCampaign` itself
   * produces. This is what makes the module's own Definition of Done
   * true by construction — "cloning a completed campaign produces a
   * clean draft with zero carried-over Message rows" — not something
   * this method has to separately guard against.
   */
  async cloneCampaign(
    campaignId: string,
    context: AuditContext = {},
  ): Promise<{ success: true; campaign: WhatsAppCampaign } | { success: false; errors: CampaignValidationError[] }> {
    const repository = await getWhatsAppCampaignRepository();
    const source = await repository.findById(campaignId);
    if (!source) return { success: false, errors: [{ field: "campaignId", message: "Campaign not found." }] };

    const clone = await repository.create({
      name: `${source.name} (Copy)`,
      templateId: source.templateId,
      marketingCampaignId: source.marketingCampaignId,
      recurrenceRule: source.recurrenceRule,
      clonedFromId: source.id,
    });

    await auditLogService.record({
      action: AUDIT_ACTIONS.WHATSAPP_CAMPAIGN_CLONED,
      entityType: "WhatsAppCampaign",
      entityId: clone.id,
      actorId: context.actorId,
      actorType: context.actorId ? "user" : "system",
      requestId: context.requestId,
      metadata: { clonedFromId: source.id, reason: "manual" },
    });

    return { success: true, campaign: clone };
  },

  // ─── Send lifecycle ──────────────────────────────────────────────────

  /** Resets every failed Message in a campaign back to "queued" and
   *  re-enqueues a send job for each — the operator-facing "Retry
   *  Failed" action, distinct from the immediate in-process retry every
   *  individual send already gets (CAMPAIGN_ARCHITECTURE.md §8). */
  async retryFailed(
    campaignId: string,
    context: AuditContext = {},
  ): Promise<{ success: true; retriedCount: number } | { success: false; errors: CampaignValidationError[] }> {
    const repository = await getWhatsAppCampaignRepository();
    const campaign = await repository.findById(campaignId);
    if (!campaign) return { success: false, errors: [{ field: "campaignId", message: "Campaign not found." }] };

    const messageRepository = await getMessageRepository();
    const failedMessages = await messageRepository.findFailedByCampaign(campaignId);

    for (const message of failedMessages) {
      await messageRepository.update(message.id, { status: "queued", failureReason: undefined });
      await enqueueJob({
        jobType: SEND_MESSAGE_JOB_TYPE,
        payload: { messageId: message.id },
        runAt: new Date().toISOString(),
        retryPolicy: MESSAGE_RETRY_POLICY,
      });
    }

    if (failedMessages.length > 0) {
      await repository.incrementCounts(campaignId, { failedCount: -failedMessages.length });
      // The campaign may have already been marked "completed" (every
      // Message reached a terminal state, including these failures) —
      // resurrect it to "sending" since there's now in-flight work again.
      if (campaign.status === "completed") {
        await repository.update(campaignId, { status: "sending" });
      }
    }

    await auditLogService.record({
      action: AUDIT_ACTIONS.WHATSAPP_CAMPAIGN_RETRY_REQUESTED,
      entityType: "WhatsAppCampaign",
      entityId: campaignId,
      actorId: context.actorId,
      actorType: context.actorId ? "user" : "system",
      requestId: context.requestId,
      metadata: { retriedCount: failedMessages.length },
    });

    return { success: true, retriedCount: failedMessages.length };
  },

  // ─── History / analytics ────────────────────────────────────────────

  async listCampaigns(
    filters: WhatsAppCampaignListFilters,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResult<WhatsAppCampaign>> {
    const repository = await getWhatsAppCampaignRepository();
    return repository.list(filters, page, limit);
  },

  async getCampaignAnalytics(
    campaignId: string,
  ): Promise<{ campaign: WhatsAppCampaign; messageCounts: MessageStatusCounts } | null> {
    const repository = await getWhatsAppCampaignRepository();
    const campaign = await repository.findById(campaignId);
    if (!campaign) return null;

    const messageRepository = await getMessageRepository();
    const messageCounts = await messageRepository.countByStatus(campaignId);
    return { campaign, messageCounts };
  },

  async listMessages(filters: MessageListFilters, page = 1, limit = 20) {
    const repository = await getMessageRepository();
    return repository.list(filters, page, limit);
  },

  /** App-wide WhatsApp delivery performance — every Message regardless
   *  of source (bulk campaign send or automation-triggered nurture
   *  send). Admin Dashboard Analytics page's WhatsApp section (RC-1) —
   *  previously nothing surfaced this outside a single campaign's own
   *  detail page. */
  async getOverallMessageStats(): Promise<MessageStatusCounts> {
    const repository = await getMessageRepository();
    return repository.countByStatus();
  },
};
