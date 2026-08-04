import type { PaginatedResult } from "@/lib/pagination";

/**
 * Attendance domain layer.
 *
 * Tied directly to Registration with a free-text session label, not a
 * full Cohort/Session hierarchy — ARCHITECTURE.md originally sketched a
 * SESSION collection belonging to a COHORT, but neither exists yet, and
 * Registration itself only has a free-text `cohortLabel`. Building a full
 * Session/Cohort subsystem now would be speculative infrastructure ahead
 * of anything that actually needs it; this matches the schema's current
 * level of maturity instead.
 */

export interface Attendance {
  id: string;
  registrationId: string;
  sessionLabel: string;
  sessionDate: string;
  present: boolean;
  markedAt: string;
  /** Business OS Phase 0 — tenant scaffolding, unset until multi-tenant
   *  activation (Phase 6). See lib/services/organizations/types.ts. */
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAttendanceInput {
  registrationId: string;
  sessionLabel: string;
  sessionDate: string;
  present: boolean;
}

export interface AttendanceListFilters {
  registrationId?: string;
  sessionLabel?: string;
}

export interface AttendanceValidationError {
  field: string;
  message: string;
}

export type CreateAttendanceResult =
  | { success: true; attendance: Attendance }
  | { success: false; errors: AttendanceValidationError[] };

export interface AttendanceRepository {
  create(input: CreateAttendanceInput): Promise<Attendance>;
  list(filters: AttendanceListFilters, page: number, limit: number): Promise<PaginatedResult<Attendance>>;
  /** Admin Dashboard Backend — Student Status: overall present-rate
   *  across every recorded attendance entry, or null if none exist yet
   *  (distinct from 0 — "no data" isn't "0% attendance"). */
  overallAttendanceRate(): Promise<number | null>;
}
