import {
  getMessageRepository,
  getMessageAttemptRepository,
  getCampaignTemplateRepository,
  getWhatsAppCampaignRepository,
} from "@/lib/db";
import { whatsappService } from "@/lib/services/whatsapp";
import { conversationService } from "@/lib/services/conversations";
import { registerJobHandler } from "@/lib/services/scheduler";
import type { JobOutcome, ScheduledJob } from "@/lib/services/scheduler";
import { enqueueMessagesForSending, checkCampaignCompletion } from "./whatsappCampaignService";
import { SEND_MESSAGE_JOB_TYPE, PROMOTE_SCHEDULED_JOB_TYPE } from "./jobTypes";

/**
 * Bridges the WhatsApp Campaign Manager onto the shared scheduler
 * (lib/services/scheduler) — the only place a campaign message actually
 * gets sent. Both handlers call into existing, unmodified modules for
 * the real work: `whatsappService.sendTemplateMessage()` (the WhatsApp
 * Cloud API module, zero new sending logic) and
 * `enqueueMessagesForSending()`/`checkCampaignCompletion()`
 * (whatsappCampaignService.ts, this same module).
 */

async function incrementCampaignCount(
  campaignId: string,
  field: "sentCount" | "failedCount",
): Promise<void> {
  const repository = await getWhatsAppCampaignRepository();
  await repository.incrementCounts(campaignId, { [field]: 1 });
}

/**
 * Fills every one of a template's variable slots with the recipient's
 * name — a deliberately scoped limitation, not an oversight. Message
 * only carries `recipientName` as per-recipient dynamic data (true
 * across all three audience sources: filter/manual/CSV); a template
 * needing richer per-recipient data (e.g. "program name") isn't
 * supported yet. Flagged in CHANGELOG.md's future considerations, not
 * silently worked around.
 */
function buildTemplateVariables(variableLabels: string[], recipientName: string | undefined): string[] {
  return variableLabels.map(() => recipientName || "there");
}

async function handleSendMessage(job: ScheduledJob): Promise<JobOutcome> {
  const { messageId } = job.payload as { messageId: string };
  const messageRepository = await getMessageRepository();
  const message = await messageRepository.findById(messageId);

  if (!message) {
    return { result: "failed", retryable: false, error: `Message ${messageId} not found` };
  }

  // A campaign cancelled after its messages were already enqueued must
  // actually stop them — checked here rather than left as a known gap,
  // since "Campaign Status" meaning something for a cancelled campaign
  // is part of what was requested. Not sent, not counted as failed —
  // just never attempted.
  if (message.campaignId) {
    const campaign = await (await getWhatsAppCampaignRepository()).findById(message.campaignId);
    if (campaign?.status === "cancelled") {
      return { result: "completed" };
    }
  }

  const attemptNumber = job.attempts + 1;
  const isFinalAttempt = attemptNumber >= (job.retryPolicy?.maxAttempts ?? 1);
  const messageAttemptRepository = await getMessageAttemptRepository();

  const template = message.templateId ? await (await getCampaignTemplateRepository()).findById(message.templateId) : null;
  if (!template) {
    const errorMessage = "No template found for this message";
    await messageAttemptRepository.create({ messageId, attemptNumber, status: "failure", errorMessage });
    await messageRepository.update(messageId, { status: "failed", failureReason: errorMessage, attempts: attemptNumber });
    if (message.campaignId) {
      await incrementCampaignCount(message.campaignId, "failedCount");
      await checkCampaignCompletion(message.campaignId);
    }
    // Not retryable: a missing template is a data problem, not a
    // transient one — the same "retrying won't fix a malformed
    // request" reasoning the Meta adapter already applies to 4xx errors.
    return { result: "failed", retryable: false, error: errorMessage };
  }

  const sendResult = await whatsappService.sendTemplateMessage(
    // This entire pipeline is WhatsApp-campaign-specific — recipientPhoneE164
    // is always set for a message that reaches this handler (only
    // module 4.2's email path ever omits it, and email has no campaign
    // concept yet).
    { phoneE164: message.recipientPhoneE164 as string, name: message.recipientName },
    template.metaTemplateName,
    template.languageCode,
    buildTemplateVariables(template.variableLabels, message.recipientName),
  );

  if (sendResult.success) {
    await messageAttemptRepository.create({
      messageId,
      attemptNumber,
      status: "success",
      providerMessageId: sendResult.providerMessageId,
    });
    await messageRepository.update(messageId, {
      status: "sent",
      provider: sendResult.provider,
      providerMessageId: sendResult.providerMessageId,
      sentAt: new Date().toISOString(),
      attempts: attemptNumber,
    });
    if (message.campaignId) {
      await incrementCampaignCount(message.campaignId, "sentCount");
      // "sent" is terminal for the bulk pipeline's own purposes — later
      // delivered/read updates arrive asynchronously via the webhook
      // and may take an unbounded time (or never arrive); a campaign
      // shouldn't stay "sending" waiting for those. See
      // checkCampaignCompletion()'s own doc comment.
      await checkCampaignCompletion(message.campaignId);
    }
    // WhatsApp Platform (Phase 2) — links this send into the contact's
    // unified thread. Never fails the job over this: a Conversation
    // write failing shouldn't mark an otherwise-successful WhatsApp
    // send as failed and trigger a real retry (which would re-send the
    // message to the recipient).
    try {
      await conversationService.linkOutboundMessage(
        messageId,
        message.recipientPhoneE164 as string,
        "whatsapp",
        `[Template: ${template.metaTemplateName}]`,
      );
    } catch {
      // best-effort — see comment above
    }
    return { result: "completed" };
  }

  // Failed send.
  await messageAttemptRepository.create({
    messageId,
    attemptNumber,
    status: "failure",
    errorCode: sendResult.error.code,
    errorMessage: sendResult.error.message,
  });

  if (isFinalAttempt || !sendResult.error.retryable) {
    await messageRepository.update(messageId, {
      status: "failed",
      failureReason: sendResult.error.message,
      attempts: attemptNumber,
    });
    if (message.campaignId) {
      await incrementCampaignCount(message.campaignId, "failedCount");
      await checkCampaignCompletion(message.campaignId);
    }
    // Already handled terminally above — tell the scheduler not to
    // retry too (retryable: false regardless of the vendor error's own
    // classification, since a retry decision has already been made).
    return { result: "failed", retryable: false, error: sendResult.error.message };
  }

  // Not the final attempt, and the vendor says this is transient — let
  // the shared scheduler apply the approved 1/5/15-minute backoff.
  await messageRepository.update(messageId, { attempts: attemptNumber });
  return { result: "failed", retryable: true, error: sendResult.error.message };
}

async function handlePromoteScheduled(job: ScheduledJob): Promise<JobOutcome> {
  const { campaignId } = job.payload as { campaignId: string };
  const repository = await getWhatsAppCampaignRepository();
  const campaign = await repository.findById(campaignId);

  if (!campaign) {
    return { result: "failed", retryable: false, error: `WhatsAppCampaign ${campaignId} not found` };
  }
  if (campaign.status !== "scheduled") {
    // Already cancelled (or, defensively, already promoted) — nothing
    // to do; not an error condition.
    return { result: "completed" };
  }

  await enqueueMessagesForSending(campaignId);
  await repository.update(campaignId, { status: "sending" });
  return { result: "completed" };
}

export function registerWhatsAppCampaignJobHandlers(): void {
  registerJobHandler(SEND_MESSAGE_JOB_TYPE, handleSendMessage);
  registerJobHandler(PROMOTE_SCHEDULED_JOB_TYPE, handlePromoteScheduled);
}
