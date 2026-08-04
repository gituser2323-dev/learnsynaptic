import { getConnection } from "@/lib/db/connection";
import { NotificationModel, toNotification } from "@/lib/db/models/notification.model";
import type { CreateNotificationInput, Notification, NotificationRepository } from "@/lib/services/crm/notifications/types";

export const mongodbNotificationRepository: NotificationRepository = {
  async create(input: CreateNotificationInput): Promise<Notification> {
    await getConnection();
    const doc = await NotificationModel.create(input);
    return toNotification(doc);
  },

  async listForUser(userId: string, unreadOnly: boolean, limit: number): Promise<Notification[]> {
    await getConnection();
    const query: Record<string, unknown> = { userId };
    if (unreadOnly) query.readAt = { $exists: false };
    const docs = await NotificationModel.find(query).sort({ createdAt: -1 }).limit(limit).exec();
    return docs.map(toNotification);
  },

  async countUnread(userId: string): Promise<number> {
    await getConnection();
    return NotificationModel.countDocuments({ userId, readAt: { $exists: false } }).exec();
  },

  async markRead(id: string, userId: string): Promise<void> {
    await getConnection();
    await NotificationModel.updateOne({ _id: id, userId }, { $set: { readAt: new Date() } }).exec();
  },
};
