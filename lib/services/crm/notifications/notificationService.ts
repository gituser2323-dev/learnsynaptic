import { getNotificationRepository } from "@/lib/db";
import type { CreateNotificationInput, Notification } from "./types";

export const notificationService = {
  async notify(input: CreateNotificationInput): Promise<Notification> {
    const repository = await getNotificationRepository();
    return repository.create(input);
  },

  async listForUser(userId: string, unreadOnly = false, limit = 20): Promise<Notification[]> {
    const repository = await getNotificationRepository();
    return repository.listForUser(userId, unreadOnly, limit);
  },

  async countUnread(userId: string): Promise<number> {
    const repository = await getNotificationRepository();
    return repository.countUnread(userId);
  },

  async markRead(id: string, userId: string): Promise<void> {
    const repository = await getNotificationRepository();
    await repository.markRead(id, userId);
  },
};
