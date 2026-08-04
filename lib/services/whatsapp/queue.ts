import { resolveWhatsAppProviderForSend } from "./registry";
import { getTenantContext } from "@/lib/tenancy/context";
import { entitlementService, usageService, EntitlementError } from "@/lib/services/billing";
import { createLogger } from "@/lib/logger";
import type { WhatsAppRecipient, WhatsAppSendResult, WhatsAppTemplatePayload } from "./types";

const logger = createLogger({ service: "whatsapp", module: "queue" });

/**
 * A single send, as a plain, JSON-serializable object — deliberately
 * shaped to be queue-friendly (no closures, no class instances, nothing
 * that can't survive being pushed onto a real queue and popped off by a
 * separate worker process later).
 */
export interface WhatsAppSendJob {
  id: string;
  type: "template" | "text";
  recipient: WhatsAppRecipient;
  templatePayload?: WhatsAppTemplatePayload;
  textBody?: string;
  enqueuedAt: string;
}

/**
 * Processes a single send job by calling the active provider. This
 * function is the seam a future queue consumer would call — it depends
 * only on a serializable WhatsAppSendJob, nothing about how it was
 * invoked. Today, whatsappService calls this directly ("a queue of one,
 * run now"); adding a real queue (Redis/SQS-backed) later means writing
 * a producer that pushes WhatsAppSendJob objects and a consumer that
 * calls this same function — this function itself would not change.
 */
export async function processSendJob(job: WhatsAppSendJob): Promise<WhatsAppSendResult> {
  // Business OS Phase 8, Module 8.3 — the one real chokepoint every
  // template/text send funnels through (registration confirmations,
  // cohort reminders, automation-triggered template sends, and
  // conversation-reply free-text sends) — server-enforced capability +
  // usage-limit check here covers all of them without touching any
  // individual call site. Reads ambient tenant context rather than
  // taking organizationId as a parameter, the same pattern
  // metaCloudApi.provider.ts's own credential resolution already
  // established one call deeper in this exact path (Module 8.2) — a
  // real WhatsApp send never reaches this function from outside an
  // established tenant context in practice. No context at all (a
  // genuinely untenanted system path) fails OPEN with a warning log,
  // the same "no context means no enforcement is even meaningful"
  // posture Module 8.1's own tenant-scoping hooks established — never
  // a silent block of a legitimate send with no organization to blame
  // it on.
  const organizationId = getTenantContext()?.organizationId;
  // Business OS Phase 8, Module 8.5 — resolves to the org's own
  // connected Meta Cloud API provider when it has real tenant
  // credentials configured (via Embedded Signup), regardless of this
  // deployment's own default WHATSAPP_PROVIDER — see registry.ts's own
  // doc comment on resolveWhatsAppProviderForSend.
  const provider = await resolveWhatsAppProviderForSend(organizationId);
  if (organizationId) {
    try {
      await entitlementService.assertCapability(organizationId, "whatsapp");
      const usage = await usageService.checkAndIncrementUsage(organizationId, "whatsapp_messages");
      if (!usage.allowed) {
        return {
          success: false,
          provider: provider.id,
          error: { code: "usage_limit_exceeded", message: `WhatsApp message limit reached (${usage.current}/${usage.limit}) for this billing period.`, retryable: false },
        };
      }
    } catch (error) {
      if (error instanceof EntitlementError) {
        return { success: false, provider: provider.id, error: { code: error.code, message: error.message, retryable: false } };
      }
      throw error;
    }
  } else {
    logger.warn("whatsapp.send_without_tenant_context", { jobId: job.id });
  }

  if (job.type === "template" && job.templatePayload) {
    return provider.sendTemplate(job.recipient, job.templatePayload);
  }
  return provider.sendText(job.recipient, job.textBody ?? "");
}
