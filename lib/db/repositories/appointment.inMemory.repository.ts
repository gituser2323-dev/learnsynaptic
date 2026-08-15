import { randomUUID } from "crypto";
import { DuplicateKeyError } from "@/lib/db/types";
import { buildPaginatedResult, type PaginatedResult } from "@/lib/pagination";
import { scopeToTenant, findOwnedByTenant, stampTenant } from "@/lib/db/inMemoryTenantScope";
import type {
  Appointment,
  AppointmentListFilters,
  AppointmentRepository,
  CreateAppointmentInput,
  UpdateAppointmentInput,
} from "@/lib/services/crm/appointments/types";

const store: Appointment[] = [];

function nowIso(): string {
  return new Date().toISOString();
}

export const inMemoryAppointmentRepository: AppointmentRepository = {
  async findById(id: string): Promise<Appointment | null> {
    return findOwnedByTenant(store, (a) => a.id === id) ?? null;
  },

  async create(input: CreateAppointmentInput): Promise<Appointment> {
    // The double-booking guard's in-memory equivalent — a synchronous
    // check-then-push with no `await` between them, the same idiom
    // leadCaptureForm.inMemory.repository.ts's own publicSlug check
    // already uses, which is what makes this race-safe against the
    // in-memory store even under same-process concurrent requests.
    const collision = store.some(
      (a) => a.assignedCounsellorId === input.assignedCounsellorId && a.startAt === input.startAt && a.status !== "cancelled",
    );
    if (collision) {
      throw new DuplicateKeyError("Appointment", { assignedCounsellorId: input.assignedCounsellorId, startAt: input.startAt });
    }
    const appointment: Appointment = stampTenant<Appointment>({
      ...input,
      id: randomUUID(),
      status: "scheduled",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    store.push(appointment);
    return appointment;
  },

  async update(id: string, input: UpdateAppointmentInput): Promise<Appointment> {
    const appointment = findOwnedByTenant(store, (a) => a.id === id);
    if (!appointment) throw new Error(`Appointment ${id} not found`);
    Object.assign(appointment, input, { updatedAt: nowIso() });
    return appointment;
  },

  async list(filters: AppointmentListFilters, page: number, limit: number): Promise<PaginatedResult<Appointment>> {
    let results = scopeToTenant(store);
    if (filters.leadId) results = results.filter((a) => a.leadId === filters.leadId);
    if (filters.appointmentTypeId) results = results.filter((a) => a.appointmentTypeId === filters.appointmentTypeId);
    if (filters.assignedCounsellorId) results = results.filter((a) => a.assignedCounsellorId === filters.assignedCounsellorId);
    if (filters.status) results = results.filter((a) => a.status === filters.status);
    results = [...results].sort((a, b) => b.startAt.localeCompare(a.startAt));

    const total = results.length;
    const start = (page - 1) * limit;
    const items = results.slice(start, start + limit);
    return buildPaginatedResult(items, total, { page, limit });
  },

  // No scopeToTenant here — same reasoning as the mongodb repository's
  // own doc comment: only ever called from inside an already-established
  // tenant context, so the assignedCounsellorId filter is the real
  // narrowing wanted, not a second tenant filter to bypass or reapply.
  async findActiveForCounsellorInRange(assignedCounsellorId: string, rangeStart: string, rangeEnd: string): Promise<Appointment[]> {
    const rangeStartMs = new Date(rangeStart).getTime();
    const rangeEndMs = new Date(rangeEnd).getTime();
    return store.filter(
      (a) =>
        a.assignedCounsellorId === assignedCounsellorId &&
        a.status !== "cancelled" &&
        new Date(a.startAt).getTime() < rangeEndMs &&
        new Date(a.endAt).getTime() > rangeStartMs,
    );
  },
};
