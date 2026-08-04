import { Schema, model, models, Types, type Document, type Model } from "mongoose";
import { tenantScopePlugin } from "@/lib/db/tenantScopePlugin";
import type { Activity } from "@/lib/services/crm/activities/types";

export interface ActivityDocument extends Document {
  entityType: string;
  entityId: string;
  type: string;
  body: string;
  durationMinutes?: number;
  referenceMessageId?: string;
  actorId?: string;
  organizationId?: Types.ObjectId;
  createdAt: Date;
}

const activitySchema = new Schema<ActivityDocument>(
  {
    entityType: { type: String, enum: ["Lead", "Opportunity", "Conversation"], required: true },
    entityId: { type: String, required: true },
    type: {
      type: String,
      enum: ["note", "call", "meeting", "email", "whatsapp_reference", "system"],
      required: true,
    },
    body: { type: String, required: true, trim: true, maxlength: 5000 },
    durationMinutes: { type: Number, min: 0 },
    referenceMessageId: { type: String },
    actorId: { type: String },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
  },
  // Append-only timeline: no updatedAt — an activity entry is a
  // point-in-time record, same convention as AuditLog and MessageAttempt.
  { timestamps: { createdAt: true, updatedAt: false } },
);

// "This entity's timeline, newest first" — the only real access pattern.
activitySchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

activitySchema.plugin(tenantScopePlugin);

export function toActivity(doc: ActivityDocument): Activity {
  return {
    id: doc._id.toString(),
    entityType: doc.entityType as Activity["entityType"],
    entityId: doc.entityId,
    type: doc.type as Activity["type"],
    body: doc.body,
    durationMinutes: doc.durationMinutes,
    referenceMessageId: doc.referenceMessageId,
    actorId: doc.actorId,
    organizationId: doc.organizationId?.toString(),
    createdAt: doc.createdAt.toISOString(),
  };
}

export const ActivityModel: Model<ActivityDocument> =
  (models.Activity as Model<ActivityDocument>) || model<ActivityDocument>("Activity", activitySchema);
