import { getConnection } from "@/lib/db/connection";
import { ensureDefaultOrganization } from "@/lib/services/organizations";
import { ActivityModel } from "@/lib/db/models/activity.model";
import { AssignmentRuleModel } from "@/lib/db/models/assignmentRule.model";
import { AttendanceModel } from "@/lib/db/models/attendance.model";
import { AuditLogModel } from "@/lib/db/models/auditLog.model";
import { AutoReplyRuleModel } from "@/lib/db/models/autoReplyRule.model";
import { CampaignModel } from "@/lib/db/models/campaign.model";
import { CampaignTemplateModel } from "@/lib/db/models/campaignTemplate.model";
import { ConversationModel } from "@/lib/db/models/conversation.model";
import { ConversationInsightModel } from "@/lib/db/models/conversationInsight.model";
import { CustomFieldDefinitionModel } from "@/lib/db/models/customFieldDefinition.model";
import { FileAssetModel } from "@/lib/db/models/fileAsset.model";
import { IntegrationConnectionModel } from "@/lib/db/models/integrationConnection.model";
import { IntegrationLogModel } from "@/lib/db/models/integrationLog.model";
import { LeadModel } from "@/lib/db/models/lead.model";
import { LeadInsightModel } from "@/lib/db/models/leadInsight.model";
import { MeetingModel } from "@/lib/db/models/meeting.model";
import { MessageModel } from "@/lib/db/models/message.model";
import { MessageAttemptModel } from "@/lib/db/models/messageAttempt.model";
import { NotificationModel } from "@/lib/db/models/notification.model";
import { OpportunityModel } from "@/lib/db/models/opportunity.model";
import { PaymentModel } from "@/lib/db/models/payment.model";
import { PaymentWebhookEventModel } from "@/lib/db/models/paymentWebhookEvent.model";
import { PhoneNumberModel } from "@/lib/db/models/phoneNumber.model";
import { PipelineModel } from "@/lib/db/models/pipeline.model";
import { RegistrationModel } from "@/lib/db/models/registration.model";
import { TagModel } from "@/lib/db/models/tag.model";
import { TaskModel } from "@/lib/db/models/task.model";
import { WebhookDeliveryModel } from "@/lib/db/models/webhookDelivery.model";
import { WebhookDeliveryAttemptModel } from "@/lib/db/models/webhookDeliveryAttempt.model";
import { WebhookEndpointModel } from "@/lib/db/models/webhookEndpoint.model";
import { WhatsAppCampaignModel } from "@/lib/db/models/whatsappCampaign.model";
import { WorkflowDefinitionModel } from "@/lib/db/models/workflowDefinition.model";
import { WorkflowRunModel } from "@/lib/db/models/workflowRun.model";
import type { Model } from "mongoose";

/**
 * Business OS Phase 8, Module 8.1 — one-time backfill assigning the
 * deployment's default organization (see
 * lib/services/organizations/organizationService.ts's own
 * ensureDefaultOrganization()) to every existing tenant-owned record
 * that predates real tenant enforcement. Every one of these 32 models
 * has carried `organizationId` as OPTIONAL, unpopulated scaffolding
 * since Phase 0 (see each model file's own historical "tenant
 * scaffolding" doc comment) — this is the pass that finally populates
 * it, for records that existed before tenantScopePlugin.ts started
 * stamping it on every new write.
 *
 * Deliberately NOT run inside runWithTenantContext(): every query below
 * must see every organization's (in practice, today, the one real
 * default organization's) unassigned records, the same "escape any
 * context" reasoning schedulerService.ts's own runCrossTenantSweep
 * documents — a plain, unwrapped script run has no context to begin
 * with, so tenantScopePlugin's own hooks are already no-ops here (see
 * that file's own module doc on why "no context" means "no scoping"),
 * which is exactly the cross-tenant reach this backfill needs.
 *
 * Idempotent — every updateMany below is filtered to
 * `organizationId: { $exists: false }`, so a record already assigned
 * (by this script's own prior run, or by tenantScopePlugin stamping a
 * real write since) is never touched twice and never overwritten.
 * Safe to re-run any number of times; reruns simply report 0 for
 * collections already fully backfilled.
 *
 * User/RefreshToken/Organization/ScheduledJob are deliberately excluded
 * — see tenantScopePlugin.ts's own module doc on why those four are
 * never plugged into tenant scoping at all. (ScheduledJob rows that
 * predate this module simply run with no tenant context at all, the
 * same disclosed fallback schedulerService.ts's own runDueScheduledJobs
 * already documents — no backfill needed for job records specifically.)
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/backfillOrganizationId.ts
 */

const MODELS: { name: string; model: Model<{ organizationId?: unknown }> }[] = [
  { name: "Activity", model: ActivityModel as unknown as Model<{ organizationId?: unknown }> },
  { name: "AssignmentRule", model: AssignmentRuleModel as unknown as Model<{ organizationId?: unknown }> },
  { name: "Attendance", model: AttendanceModel as unknown as Model<{ organizationId?: unknown }> },
  { name: "AuditLog", model: AuditLogModel as unknown as Model<{ organizationId?: unknown }> },
  { name: "AutoReplyRule", model: AutoReplyRuleModel as unknown as Model<{ organizationId?: unknown }> },
  { name: "Campaign", model: CampaignModel as unknown as Model<{ organizationId?: unknown }> },
  { name: "CampaignTemplate", model: CampaignTemplateModel as unknown as Model<{ organizationId?: unknown }> },
  { name: "Conversation", model: ConversationModel as unknown as Model<{ organizationId?: unknown }> },
  { name: "ConversationInsight", model: ConversationInsightModel as unknown as Model<{ organizationId?: unknown }> },
  { name: "CustomFieldDefinition", model: CustomFieldDefinitionModel as unknown as Model<{ organizationId?: unknown }> },
  { name: "FileAsset", model: FileAssetModel as unknown as Model<{ organizationId?: unknown }> },
  { name: "IntegrationConnection", model: IntegrationConnectionModel as unknown as Model<{ organizationId?: unknown }> },
  { name: "IntegrationLog", model: IntegrationLogModel as unknown as Model<{ organizationId?: unknown }> },
  { name: "Lead", model: LeadModel as unknown as Model<{ organizationId?: unknown }> },
  { name: "LeadInsight", model: LeadInsightModel as unknown as Model<{ organizationId?: unknown }> },
  { name: "Meeting", model: MeetingModel as unknown as Model<{ organizationId?: unknown }> },
  { name: "Message", model: MessageModel as unknown as Model<{ organizationId?: unknown }> },
  { name: "MessageAttempt", model: MessageAttemptModel as unknown as Model<{ organizationId?: unknown }> },
  { name: "Notification", model: NotificationModel as unknown as Model<{ organizationId?: unknown }> },
  { name: "Opportunity", model: OpportunityModel as unknown as Model<{ organizationId?: unknown }> },
  { name: "Payment", model: PaymentModel as unknown as Model<{ organizationId?: unknown }> },
  { name: "PaymentWebhookEvent", model: PaymentWebhookEventModel as unknown as Model<{ organizationId?: unknown }> },
  { name: "PhoneNumber", model: PhoneNumberModel as unknown as Model<{ organizationId?: unknown }> },
  { name: "Pipeline", model: PipelineModel as unknown as Model<{ organizationId?: unknown }> },
  { name: "Registration", model: RegistrationModel as unknown as Model<{ organizationId?: unknown }> },
  { name: "Tag", model: TagModel as unknown as Model<{ organizationId?: unknown }> },
  { name: "Task", model: TaskModel as unknown as Model<{ organizationId?: unknown }> },
  { name: "WebhookDelivery", model: WebhookDeliveryModel as unknown as Model<{ organizationId?: unknown }> },
  { name: "WebhookDeliveryAttempt", model: WebhookDeliveryAttemptModel as unknown as Model<{ organizationId?: unknown }> },
  { name: "WebhookEndpoint", model: WebhookEndpointModel as unknown as Model<{ organizationId?: unknown }> },
  { name: "WhatsAppCampaign", model: WhatsAppCampaignModel as unknown as Model<{ organizationId?: unknown }> },
  { name: "WorkflowDefinition", model: WorkflowDefinitionModel as unknown as Model<{ organizationId?: unknown }> },
  { name: "WorkflowRun", model: WorkflowRunModel as unknown as Model<{ organizationId?: unknown }> },
];

async function main(): Promise<void> {
  await getConnection();
  const defaultOrg = await ensureDefaultOrganization();
  console.log(`Default organization: ${defaultOrg.name} (${defaultOrg.id})\n`);

  let totalMatched = 0;
  let totalModified = 0;
  const report: { name: string; matched: number; modified: number }[] = [];

  for (const { name, model } of MODELS) {
    const result = await model.updateMany(
      { organizationId: { $exists: false } },
      { $set: { organizationId: defaultOrg.id } },
    );
    const matched = result.matchedCount ?? 0;
    const modified = result.modifiedCount ?? 0;
    totalMatched += matched;
    totalModified += modified;
    report.push({ name, matched, modified });
    if (matched > 0) {
      console.log(`${name}: backfilled ${modified} of ${matched} unassigned record(s)`);
    }
  }

  const untouched = report.filter((r) => r.matched === 0);
  console.log(`\n${report.length - untouched.length} of ${report.length} collections had unassigned records.`);
  console.log(`Total: ${totalModified} record(s) backfilled to the default organization.`);

  // Observability requirement (mission's own §"EXISTING DATA
  // MIGRATION"): explicitly report anything that matched the query but
  // wasn't modified — would only happen if a write conflicted mid-run
  // (e.g. another process assigned it between matchedCount and the
  // actual update), never silently swallowed.
  const partial = report.filter((r) => r.matched !== r.modified);
  if (partial.length > 0) {
    console.warn("\nWARNING — some matched records were not modified (possible concurrent write):");
    for (const r of partial) {
      console.warn(`  ${r.name}: matched ${r.matched}, modified ${r.modified}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Unexpected error:", error);
    process.exitCode = 1;
  });
