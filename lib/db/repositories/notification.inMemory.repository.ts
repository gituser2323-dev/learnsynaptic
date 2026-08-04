import { randomUUID } from "crypto";
import { scopeToTenant, findOwnedByTenant, stampTenant } from "@/lib/db/inMemoryTenantScope";
import type { CreateNotificationInput, Notification, NotificationRepository } from "@/lib/services/crm/notifications/types";

const store: Notification[] = [];

export const inMemoryNotificationRepository: NotificationRepository = {
  async create(input: CreateNotificationInput): Promise<Notification> {
    const notification: Notification = stampTenant<Notification>({ ...input, id: randomUUID(), createdAt: new Date().toISOString() });
    store.push(notification);
    return notification;
  },

  async listForUser(userId: string, unreadOnly: boolean, limit: number): Promise<Notification[]> {
    return scopeToTenant(store)
      .filter((n) => n.userId === userId && (!unreadOnly || !n.readAt))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  },

  async countUnread(userId: string): Promise<number> {
    return scopeToTenant(store).filter((n) => n.userId === userId && !n.readAt).length;
  },

  async markRead(id: string, userId: string): Promise<void> {
    const notification = findOwnedByTenant(store, (n) => n.id === id && n.userId === userId);
    if (notification) notification.readAt = new Date().toISOString();
  },
};
