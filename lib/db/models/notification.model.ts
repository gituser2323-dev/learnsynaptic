import { Schema, model, models, Types, type Document, type Model } from "mongoose";
import { tenantScopePlugin } from "@/lib/db/tenantScopePlugin";
import type { Notification } from "@/lib/services/crm/notifications/types";

export interface NotificationDocument extends Document {
  userId: Types.ObjectId;
  type: string;
  entityType: string;
  entityId: string;
  message: string;
  readAt?: Date;
  organizationId?: Types.ObjectId;
  createdAt: Date;
}

const notificationSchema = new Schema<NotificationDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["task_due_soon", "task_overdue", "meeting_reminder"], required: true },
    entityType: { type: String, enum: ["Task", "Meeting"], required: true },
    entityId: { type: String, required: true },
    message: { type: String, required: true, trim: true, maxlength: 300 },
    readAt: { type: Date },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// The header/sidebar badge's own query: this user's unread count.
notificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 });

notificationSchema.plugin(tenantScopePlugin);

export function toNotification(doc: NotificationDocument): Notification {
  return {
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    type: doc.type as Notification["type"],
    entityType: doc.entityType as Notification["entityType"],
    entityId: doc.entityId,
    message: doc.message,
    readAt: doc.readAt?.toISOString(),
    organizationId: doc.organizationId?.toString(),
    createdAt: doc.createdAt.toISOString(),
  };
}

export const NotificationModel: Model<NotificationDocument> =
  (models.Notification as Model<NotificationDocument>) ||
  model<NotificationDocument>("Notification", notificationSchema);
