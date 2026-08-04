import { randomUUID } from "crypto";
import { buildPaginatedResult, type PaginatedResult } from "@/lib/pagination";
import { scopeToTenant, stampTenant } from "@/lib/db/inMemoryTenantScope";
import type {
  Attendance,
  AttendanceListFilters,
  AttendanceRepository,
  CreateAttendanceInput,
} from "@/lib/services/attendance/types";

const store: Attendance[] = [];

function nowIso(): string {
  return new Date().toISOString();
}

export const inMemoryAttendanceRepository: AttendanceRepository = {
  async create(input: CreateAttendanceInput): Promise<Attendance> {
    const attendance: Attendance = stampTenant<Attendance>({
      ...input,
      id: randomUUID(),
      markedAt: nowIso(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    store.push(attendance);
    return attendance;
  },

  async list(filters: AttendanceListFilters, page: number, limit: number): Promise<PaginatedResult<Attendance>> {
    let results = scopeToTenant(store);
    if (filters.registrationId) results = results.filter((a) => a.registrationId === filters.registrationId);
    if (filters.sessionLabel) results = results.filter((a) => a.sessionLabel === filters.sessionLabel);
    results.sort((a, b) => b.sessionDate.localeCompare(a.sessionDate));

    const total = results.length;
    const start = (page - 1) * limit;
    const items = results.slice(start, start + limit);
    return buildPaginatedResult(items, total, { page, limit });
  },

  async overallAttendanceRate(): Promise<number | null> {
    const scoped = scopeToTenant(store);
    if (scoped.length === 0) return null;
    const present = scoped.filter((a) => a.present).length;
    return present / scoped.length;
  },
};
