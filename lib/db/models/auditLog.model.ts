import { Schema, model, models, Types, type Document, type Model } from "mongoose";
import { tenantScopePlugin } from "@/lib/db/tenantScopePlugin";
import type { AuditActorType, AuditCategory, AuditLogEntry } from "@/lib/db/repositories/types";

export interface AuditLogDocument extends Document {
  action: string;
  category: string;
  entityType: string;
  entityId: string;
  actorId?: string;
  actorType: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
  /** Business OS Phase 0 — tenant scaffolding, unset until multi-tenant
   *  activation (Phase 6). See lib/services/organizations/types.ts. */
  organizationId?: Types.ObjectId;
  createdAt: Date;
}

const auditLogSchema = new Schema<AuditLogDocument>(
  {
    action: { type: String, required: true, trim: true },
    category: { type: String, enum: ["business", "security"], required: true, default: "business" },
    entityType: {
      type: String,
      // Kept in sync with AuditEntityType (lib/db/repositories/types.ts)
      // by hand — Mongoose enums don't derive from a TS union
      // automatically. This fell out of sync three modules in a row
      // (Integration/File/Meeting from 6.1/6.2/6.3 were all missing
      // here despite being valid in the TS type), silently failing
      // every audit write for those entity types in a real MongoDB
      // deployment — caught only by this module's own live
      // verification surfacing the resulting audit.write_failed log.
      enum: [
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
      ],
      required: true,
    },
    entityId: { type: String, required: true },
    actorId: { type: String },
    actorType: { type: String, enum: ["system", "user", "api"], required: true, default: "system" },
    requestId: { type: String },
    metadata: { type: Schema.Types.Mixed },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
  },
  // Append-only log: no updatedAt — an audit entry is never modified
  // after creation.
  { timestamps: { createdAt: true, updatedAt: false } },
);

// "All events for this entity" is the primary access pattern for an
// audit trail (e.g. an admin viewing a Lead's history).
auditLogSchema.index({ entityType: 1, entityId: 1 });
// Recent-first queries (activity feed) AND retention pruning's
// findOlderThan() range query — a single-field index supports range
// queries in either direction, so no separate ascending index is needed.
auditLogSchema.index({ createdAt: -1 });

auditLogSchema.plugin(tenantScopePlugin);

export function toAuditLogEntry(doc: AuditLogDocument): AuditLogEntry {
  return {
    id: doc._id.toString(),
    action: doc.action,
    category: doc.category as AuditCategory,
    entityType: doc.entityType as AuditLogEntry["entityType"],
    entityId: doc.entityId,
    actorId: doc.actorId,
    actorType: doc.actorType as AuditActorType,
    requestId: doc.requestId,
    metadata: doc.metadata,
    organizationId: doc.organizationId?.toString(),
    createdAt: doc.createdAt.toISOString(),
  };
}

export const AuditLogModel: Model<AuditLogDocument> =
  (models.AuditLog as Model<AuditLogDocument>) || model<AuditLogDocument>("AuditLog", auditLogSchema);
