import { randomUUID } from "crypto";
import { buildPaginatedResult, type PaginatedResult } from "@/lib/pagination";
import { scopeToTenant, findOwnedByTenant, stampTenant } from "@/lib/db/inMemoryTenantScope";
import type {
  CreateMeetingRecordInput,
  Meeting,
  MeetingListFilters,
  MeetingRepository,
  UpdateMeetingRecordInput,
} from "@/lib/services/calendar/types";

const store: Meeting[] = [];

function nowIso(): string {
  return new Date().toISOString();
}

export const inMemoryMeetingRepository: MeetingRepository = {
  async findById(id: string): Promise<Meeting | null> {
    return findOwnedByTenant(store, (m) => m.id === id) ?? null;
  },

  async create(input: CreateMeetingRecordInput): Promise<Meeting> {
    const meeting: Meeting = stampTenant<Meeting>({ ...input, id: randomUUID(), createdAt: nowIso(), updatedAt: nowIso() });
    store.push(meeting);
    return meeting;
  },

  async update(id: string, input: UpdateMeetingRecordInput): Promise<Meeting> {
    const meeting = findOwnedByTenant(store, (m) => m.id === id);
    if (!meeting) throw new Error(`Meeting ${id} not found`);
    Object.assign(meeting, input, { updatedAt: nowIso() });
    return meeting;
  },

  async list(filters: MeetingListFilters, page: number, limit: number): Promise<PaginatedResult<Meeting>> {
    let results = scopeToTenant(store);
    if (filters.relatedEntityType) results = results.filter((m) => m.relatedEntityType === filters.relatedEntityType);
    if (filters.relatedEntityId) results = results.filter((m) => m.relatedEntityId === filters.relatedEntityId);
    if (filters.provider) results = results.filter((m) => m.provider === filters.provider);
    if (filters.status) results = results.filter((m) => m.status === filters.status);
    if (!filters.includeDeleted) results = results.filter((m) => !m.deletedAt);
    results.sort((a, b) => b.startAt.localeCompare(a.startAt));

    const total = results.length;
    const start = (page - 1) * limit;
    const items = results.slice(start, start + limit);
    return buildPaginatedResult(items, total, { page, limit });
  },

  // Business OS Phase 8, Module 8.1 — deliberately NOT scoped to the
  // active tenant: this mirrors Task's own findPendingReminders
  // precedent exactly (see task.inMemory.repository.ts and this
  // method's own doc comment in calendar/types.ts) — the reminder
  // poller sweep must see every organization's due reminders in one
  // pass, not just whatever org happens to be in context when the
  // scheduler tick fires.
  async findPendingReminders(before: Date): Promise<Meeting[]> {
    return store.filter((m) => {
      if (!["scheduled", "confirmed"].includes(m.status)) return false;
      if (m.deletedAt) return false;
      if (m.reminderMinutesBefore === undefined || m.reminderMinutesBefore === null) return false;
      if (m.reminderSentAt) return false;
      const reminderAt = new Date(m.startAt).getTime() - m.reminderMinutesBefore * 60_000;
      return reminderAt <= before.getTime();
    });
  },
};
