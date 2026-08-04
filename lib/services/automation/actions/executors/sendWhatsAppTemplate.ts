import { whatsappService } from "@/lib/services/whatsapp";
import type { WorkflowContext } from "../../types";
import type { WorkflowActionExecutor } from "../types";

interface TemplateVariableSpec {
  /** Key read from WorkflowContext.data, e.g. "name" or "program". */
  field: string;
  /** Used when the field is missing/not a string — same fallback the
   *  original hardcoded lead-nurture-sequence steps used inline. */
  fallback: string;
}

function isVariableSpec(value: unknown): value is TemplateVariableSpec {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as TemplateVariableSpec).field === "string" &&
    typeof (value as TemplateVariableSpec).fallback === "string"
  );
}

function recipientFromContext(context: WorkflowContext) {
  return {
    phoneE164: String(context.data.phone ?? ""),
    name: typeof context.data.name === "string" ? context.data.name : undefined,
  };
}

/**
 * Data-driven equivalent of the sendTemplateOrThrow() helper the
 * hardcoded lead-nurture-sequence workflow used to inline. Same
 * contract: whatsappService.sendTemplateMessage() never throws on
 * failure, so this adapter translates a failed send into a thrown
 * error, which is what drives the engine's retryPolicy. Also records a
 * campaignId-less Message row (create → update to sent/failed) around
 * the send, exactly as RC-1 established, so every automation-triggered
 * WhatsApp send stays visible to delivery/read/failed webhook tracking
 * regardless of which persisted definition sent it.
 */
export const sendWhatsAppTemplate: WorkflowActionExecutor = async (context, params) => {
  const templateName = typeof params.templateName === "string" ? params.templateName : "";
  if (!templateName) throw new Error("send_whatsapp_template action requires a templateName param.");

  const variableSpecs = Array.isArray(params.variables) ? params.variables.filter(isVariableSpec) : [];
  const variables = variableSpecs.map((spec) => String(context.data[spec.field] ?? spec.fallback));

  const { getMessageRepository } = await import("@/lib/db");
  const messageRepository = await getMessageRepository();
  const recipient = recipientFromContext(context);

  const message = await messageRepository.create({
    recipientPhoneE164: recipient.phoneE164,
    recipientName: recipient.name,
    leadId: context.entityType === "Lead" ? context.entityId : undefined,
    templateId: templateName,
    workflowRunId: context.runId,
  });

  const result = await whatsappService.sendTemplateMessage(recipient, templateName, "en", variables);

  if (!result.success) {
    await messageRepository.update(message.id, {
      status: "failed",
      failureReason: `${result.error.code}: ${result.error.message}`,
      failedAt: new Date().toISOString(),
    });
    throw new Error(`WhatsApp send failed (${result.error.code}): ${result.error.message}`);
  }

  await messageRepository.update(message.id, {
    status: "sent",
    provider: result.provider,
    providerMessageId: result.providerMessageId,
    sentAt: new Date().toISOString(),
  });
};
