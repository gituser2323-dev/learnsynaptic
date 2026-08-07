import { describe, it, expect } from "vitest";
import { AuditLogModel } from "./auditLog.model";

/**
 * `entityType`'s Mongoose enum is a hand-maintained array that has to
 * be kept in sync with the `AuditEntityType` TS union
 * (lib/db/repositories/types.ts) — Mongoose can't derive it from the
 * type automatically, and the in-memory audit repository used by every
 * other test in this suite never validates entityType at all, so
 * drift between the two is invisible until a real MongoDB write fails
 * at runtime. That's exactly what happened here: Integration/File/
 * Meeting (Modules 6.1/6.2/6.3) were all missing from this enum,
 * silently failing every audit write for those entity types in a real
 * deployment — caught only by Module 6.5's own live browser
 * verification. This test is the guard against it happening again.
 *
 * The expected list is intentionally hardcoded here (not imported from
 * the AuditEntityType union) — a TS union has no runtime
 * representation to compare against, so keeping this list in sync by
 * hand, deliberately, is the whole point of the test.
 */
const EXPECTED_AUDIT_ENTITY_TYPES = [
  "Lead",
  "Campaign",
  "Registration",
  "User",
  "WhatsAppCampaign",
  "Activity",
  "Task",
  "Tag",
  "CustomFieldDefinition",
  "Opportunity",
  "Pipeline",
  "Conversation",
  "WorkflowDefinition",
  "AutoReplyRule",
  "Integration",
  "File",
  "Meeting",
  "WebhookEndpoint",
  "Payment",
  "Plan",
  "Subscription",
  "FeatureFlag",
  "BrandConfiguration",
  "DataExportRequest",
  "Organization",
  "TeamInvitation",
];

describe("AuditLogModel's entityType enum stays in sync with AuditEntityType", () => {
  it("accepts every entity type the AuditEntityType TS union declares", () => {
    const enumValues = AuditLogModel.schema.path("entityType").options.enum as string[];
    for (const entityType of EXPECTED_AUDIT_ENTITY_TYPES) {
      expect(enumValues).toContain(entityType);
    }
  });

  it("declares no entity type beyond what this test's own list expects — a new entry here means AuditEntityType needs updating too", () => {
    const enumValues = AuditLogModel.schema.path("entityType").options.enum as string[];
    expect(enumValues.sort()).toEqual([...EXPECTED_AUDIT_ENTITY_TYPES].sort());
  });
});
