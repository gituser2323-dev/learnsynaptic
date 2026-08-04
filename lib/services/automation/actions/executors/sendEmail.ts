import { emailService } from "@/lib/services/email";
import type { WorkflowContext } from "../../types";
import type { WorkflowActionExecutor } from "../types";

function recipientFromContext(context: WorkflowContext) {
  return {
    email: String(context.data.email ?? ""),
    name: typeof context.data.name === "string" ? context.data.name : undefined,
  };
}

/**
 * Fifth entry in the action registry, same create-Message→send→update
 * shape as sendWhatsAppTemplate.ts: emailService.sendEmail() never
 * throws on failure (EmailSendResult is a discriminated union, same
 * convention as WhatsApp's send result), so this adapter is what
 * translates a failed send into a thrown error for the engine's
 * retryPolicy to see. subject/body are plain strings, not a template —
 * EmailProvider itself has no template/pre-approval concept (see
 * lib/services/email/types.ts's own doc comment), so there's nothing
 * here analogous to send_whatsapp_template's templateName + positional
 * variables; an admin authoring a step writes the literal subject/body
 * text, same as create_task's plain description field.
 */
export const sendEmail: WorkflowActionExecutor = async (context, params) => {
  const subject = typeof params.subject === "string" ? params.subject : "";
  if (!subject) throw new Error("send_email action requires a subject param.");

  const body = typeof params.body === "string" ? params.body : "";
  if (!body) throw new Error("send_email action requires a body param.");

  const recipient = recipientFromContext(context);
  if (!recipient.email) throw new Error("send_email action requires a lead email address in workflow context data.");

  const { getMessageRepository } = await import("@/lib/db");
  const messageRepository = await getMessageRepository();

  const message = await messageRepository.create({
    recipientEmail: recipient.email,
    recipientName: recipient.name,
    leadId: context.entityType === "Lead" ? context.entityId : undefined,
    subject,
    body,
    messageType: "email",
    workflowRunId: context.runId,
  });

  const result = await emailService.sendEmail({ email: recipient.email, name: recipient.name }, { subject, bodyText: body });

  if (!result.success) {
    await messageRepository.update(message.id, {
      status: "failed",
      failureReason: `${result.error.code}: ${result.error.message}`,
      failedAt: new Date().toISOString(),
    });
    throw new Error(`Email send failed (${result.error.code}): ${result.error.message}`);
  }

  await messageRepository.update(message.id, {
    status: "sent",
    provider: result.provider,
    providerMessageId: result.providerMessageId,
    sentAt: new Date().toISOString(),
  });
};
