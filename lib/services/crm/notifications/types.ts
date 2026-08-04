/** Notification domain layer — Enterprise CRM (Phase 1), scoped
 *  narrowly: in-app, Task-reminder-only originally. A full cross-
 *  channel notification system (email/WhatsApp/push digests) belongs
 *  to the Communication Center phase, out of scope here — this exists
 *  only so "Task Reminder" (an explicitly requested Phase 1 feature)
 *  has somewhere real to write to, not a placeholder.
 *
 *  Calendar & Meeting Connectors (Module 6.3) reuses this same, still-
 *  narrow mechanism for its own "Reminder Support" requirement rather
 *  than building a second in-app notification system — `"Meeting"` is
 *  a small, real extension of the same "a due-soon reminder for
 *  something a counsellor owns" shape Task reminders already are, not
 *  a widening into general-purpose notifications. */

export type NotificationType = "task_due_soon" | "task_overdue" | "meeting_reminder";

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  entityType: "Task" | "Meeting";
  entityId: string;
  message: string;
  readAt?: string;
  organizationId?: string;
  createdAt: string;
}

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  entityType: "Task" | "Meeting";
  entityId: string;
  message: string;
  organizationId?: string;
}

export interface NotificationRepository {
  create(input: CreateNotificationInput): Promise<Notification>;
  listForUser(userId: string, unreadOnly: boolean, limit: number): Promise<Notification[]>;
  countUnread(userId: string): Promise<number>;
  /** Scoped to `userId` in the same write, not a separate ownership
   *  check beforehand — now that this is reachable by any authenticated
   *  staff member (not just admin), the guarantee "you can only mark
   *  your own notifications read" needs to be atomic, not a TOCTOU
   *  read-then-write. */
  markRead(id: string, userId: string): Promise<void>;
}
