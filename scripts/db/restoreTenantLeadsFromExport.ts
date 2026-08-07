import { readFileSync } from "fs";
import { getConnection } from "@/lib/db/connection";
import { OrganizationModel } from "@/lib/db/models/organization.model";
import { LeadModel } from "@/lib/db/models/lead.model";
import { ConversationModel } from "@/lib/db/models/conversation.model";
import { auditLogService, AUDIT_ACTIONS } from "@/lib/services/auditLog";
import type { LeadStatus } from "@/lib/services/leads/types";
import type { ConversationChannel, ConversationStatus } from "@/lib/services/conversations/types";

/**
 * RC-5 — Backup, Restore & Disaster Recovery: operator-level tenant
 * restore. The mission's own explicit instruction: do NOT build a
 * dangerous one-click tenant restore unless architecturally safe —
 * otherwise build operator-level tooling that preserves
 * organizationId/referential integrity/unique constraints/security
 * boundaries. This is that tool, deliberately scoped to what CAN be
 * restored safely, not a blind replay of an entire export.
 *
 * ── Why this only restores Leads + Conversations ──────────────────
 * The export (lib/services/dataExport/jobHandler.ts) also contains
 * Tasks, Opportunities, Campaigns, WhatsAppCampaigns, automation
 * definitions, and payment history — none of those are safe to
 * blindly reinsert into a target organization:
 *   - Task.assigneeId is a REQUIRED reference to a User. A restored
 *     export contains no Users (deliberately — see the export's own
 *     doc comment) and a target org's real users are never the same
 *     ids as the source org's. There is no safe default assignee.
 *   - Opportunity.pipelineId/stageId are REQUIRED references to a
 *     Pipeline + one of its stages. Pipelines aren't exported either
 *     (they're per-org configuration, not "data" in the same sense) —
 *     an Opportunity re-insert would reference a Pipeline that doesn't
 *     exist in the target org.
 *   - Campaign.code is validated as unique — re-inserting with the
 *     source org's exact code risks a real collision if the target org
 *     (or any org, if the index isn't tenant-scoped) already used it.
 *   - Payments/Subscription: the payment PROVIDER remains authoritative
 *     (see DR_RUNBOOK.md §9) — reinserting old payment rows without
 *     reconciling against the provider first is exactly the "assume an
 *     old DB snapshot reflects current external state" mistake this
 *     mission repeatedly warns against.
 * Restoring those safely requires an operator to first recreate the
 * target org's Pipelines/Users/payment-provider connection by hand
 * (normal org setup, not a "restore" operation) — see DR_RUNBOOK.md §8
 * for the full per-entity procedure.
 *
 * ── Safety properties ──────────────────────────────────────────────
 *   - Dry-run by default — pass --confirm to actually write anything.
 *   - `--target-org-id` is REQUIRED and must resolve to a real,
 *     EXISTING Organization — this tool never creates one implicitly.
 *   - organizationId on every restored document is forcibly the
 *     TARGET org — the export file's own organizationId is read only
 *     for the operator's own sanity-check logging, never trusted for
 *     the write itself.
 *   - Idempotent: leads upsert on (organizationId, phone, email),
 *     conversations upsert on (organizationId, contactPhoneE164 /
 *     contactEmail, channel) — the same natural keys the app's own
 *     unique indexes already enforce (lead.model.ts, conversation.model.ts)
 *     — re-running this script twice never creates duplicates.
 *   - Tag/assignee/counsellor references are dropped, never guessed —
 *     an id from the source org is meaningless in the target org.
 *
 * Usage:
 *   npx tsx scripts/db/restoreTenantLeadsFromExport.ts \
 *     --export ./organization-export-....json --target-org-id <id> [--confirm]
 */

interface ExportedLead {
  name: string;
  email: string;
  phone: string;
  program?: string;
  source: string;
  message?: string;
  status: LeadStatus;
  utm?: Record<string, string | undefined>;
  customFields?: Record<string, unknown>;
  score?: number;
  health?: string;
  archived?: boolean;
  id: string;
}

interface ExportedConversation {
  id: string;
  channel: ConversationChannel;
  contactPhoneE164?: string;
  contactEmail?: string;
  contactName?: string;
  leadId?: string;
  status: ConversationStatus;
  labels?: string[];
}

interface ExportFile {
  organizationId: string;
  leads: ExportedLead[];
  conversations: ExportedConversation[];
}

function readFlag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const exportPath = readFlag(args, "--export");
  const targetOrgId = readFlag(args, "--target-org-id");
  const confirm = args.includes("--confirm");

  if (!exportPath || !targetOrgId) {
    console.error("Usage: --export <path-to-export.json> --target-org-id <organizationId> [--confirm]");
    process.exit(1);
  }

  await getConnection();

  const targetOrg = await OrganizationModel.findById(targetOrgId);
  if (!targetOrg) {
    console.error(`Target organization ${targetOrgId} does not exist — this tool never creates one implicitly.`);
    process.exit(1);
  }

  const exportData = JSON.parse(readFileSync(exportPath, "utf-8")) as ExportFile;
  console.log(`Export source organizationId: ${exportData.organizationId} (informational only — not trusted for the write)`);
  console.log(`Target organization: ${targetOrg._id} (${targetOrg.name})`);
  console.log(`Mode: ${confirm ? "LIVE — writing to the database" : "DRY RUN — no writes (pass --confirm to apply)"}\n`);

  const leadIdMap = new Map<string, string>();
  let leadsCreated = 0;
  let leadsExisting = 0;

  for (const lead of exportData.leads ?? []) {
    const existing = await LeadModel.findOne({ organizationId: targetOrg._id, phone: lead.phone, email: lead.email });
    if (existing) {
      leadIdMap.set(lead.id, existing._id.toString());
      leadsExisting += 1;
      continue;
    }
    leadsCreated += 1;
    if (!confirm) continue;
    const created = await LeadModel.create({
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      program: lead.program,
      source: lead.source,
      message: lead.message,
      status: lead.status,
      utm: lead.utm,
      customFields: lead.customFields ?? {},
      score: lead.score ?? 0,
      health: lead.health ?? "cold",
      archived: lead.archived ?? false,
      organizationId: targetOrg._id,
    });
    leadIdMap.set(lead.id, created._id.toString());
  }

  console.log(`Leads: ${leadsCreated} to create, ${leadsExisting} already present (matched by phone+email)`);

  let conversationsCreated = 0;
  let conversationsExisting = 0;

  for (const conversation of exportData.conversations ?? []) {
    const naturalKey: Record<string, unknown> = { organizationId: targetOrg._id, channel: conversation.channel };
    if (conversation.contactPhoneE164) naturalKey.contactPhoneE164 = conversation.contactPhoneE164;
    else if (conversation.contactEmail) naturalKey.contactEmail = conversation.contactEmail;
    else continue; // Neither identity field present — nothing to key on, skip (matches getOrCreateForContact's own precondition).

    const existing = await ConversationModel.findOne(naturalKey);
    if (existing) {
      conversationsExisting += 1;
      continue;
    }
    conversationsCreated += 1;
    if (!confirm) continue;
    const remappedLeadId = conversation.leadId ? leadIdMap.get(conversation.leadId) : undefined;
    await ConversationModel.create({
      channel: conversation.channel,
      contactPhoneE164: conversation.contactPhoneE164,
      contactEmail: conversation.contactEmail,
      contactName: conversation.contactName,
      leadId: remappedLeadId,
      status: conversation.status,
      labels: conversation.labels ?? [],
      lastMessageAt: new Date(),
      organizationId: targetOrg._id,
    });
  }

  console.log(`Conversations: ${conversationsCreated} to create, ${conversationsExisting} already present (matched by contact identity)`);

  if (confirm) {
    await auditLogService.record({
      action: AUDIT_ACTIONS.TENANT_RESTORE_APPLIED,
      entityType: "DataExportRequest",
      entityId: exportData.organizationId,
      metadata: { targetOrganizationId: targetOrg._id.toString(), leadsCreated, conversationsCreated },
    });
    console.log("\nRestore applied. See DR_RUNBOOK.md §8 for the manual procedure covering Tasks/Opportunities/Campaigns/automation — not handled by this tool.");
  } else {
    console.log("\nDry run only — re-run with --confirm to write these changes.");
  }

  process.exit(0);
}

main().catch((error) => {
  console.error("Tenant restore script crashed:", error);
  process.exit(1);
});
