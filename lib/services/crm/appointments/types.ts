import type { PaginatedResult } from "@/lib/pagination";

/**
 * Appointment Booking — the Growth-track module after Lead Capture. An
 * AppointmentType is tenant configuration only (it never owns booking
 * data itself): it describes a public URL (`publicSlug`), a fixed
 * duration, weekly working hours, and one assigned counsellor. A real
 * booking against it produces an `Appointment`, which always references
 * a real CRM Lead (see publicBookingService.ts) — never a standalone
 * customer record.
 */

export interface WeeklyAvailabilitySlot {
  /** 0 = Sunday, matching Date.prototype.getDay()'s own convention. */
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /** Minutes from midnight, in `AppointmentType.timezone` — e.g. 540 for 9:00. */
  startMinute: number;
  endMinute: number;
}

export interface AppointmentType {
  id: string;
  organizationId?: string;
  name: string;
  description?: string;
  /** Globally unique (not compound with organizationId) — same reason
   *  LeadCaptureForm.publicSlug already established: the public URL
   *  (/book/{slug}) has no org prefix, so uniqueness must be platform-wide. */
  publicSlug: string;
  durationMinutes: number;
  bufferMinutes: number;
  /** IANA timezone, e.g. "Asia/Kolkata". */
  timezone: string;
  weeklyAvailability: WeeklyAvailabilitySlot[];
  assignedCounsellorId: string;
  /** An inactive type's public page/route both reject new bookings with a
   *  clear message — never silently drops them. */
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAppointmentTypeInput {
  name: string;
  description?: string;
  durationMinutes: number;
  bufferMinutes: number;
  timezone: string;
  weeklyAvailability: WeeklyAvailabilitySlot[];
  assignedCounsellorId: string;
  organizationId?: string;
}

export interface UpdateAppointmentTypeInput {
  name?: string;
  description?: string;
  durationMinutes?: number;
  bufferMinutes?: number;
  timezone?: string;
  weeklyAvailability?: WeeklyAvailabilitySlot[];
  assignedCounsellorId?: string;
  active?: boolean;
}

export interface AppointmentTypeRepository {
  findById(id: string): Promise<AppointmentType | null>;
  /** Deliberately bypasses tenant scope — the same "resolve org before
   *  org is known" reason LeadCaptureForm.findByPublicSlug already
   *  established. The ONE read path a public, unauthenticated request is
   *  allowed to make before any tenant context exists. */
  findByPublicSlug(slug: string): Promise<AppointmentType | null>;
  /** Throws DuplicateKeyError (lib/db/types.ts) if publicSlug already
   *  exists — the caller (appointmentTypeService) retries with a
   *  suffixed slug, mirroring leadCaptureFormService.createForm's own
   *  collision-retry loop. */
  create(input: CreateAppointmentTypeInput & { publicSlug: string }): Promise<AppointmentType>;
  list(): Promise<AppointmentType[]>;
  update(id: string, input: UpdateAppointmentTypeInput): Promise<AppointmentType>;
  delete(id: string): Promise<void>;
}

export type AppointmentStatus = "scheduled" | "confirmed" | "completed" | "cancelled" | "no_show";

export interface Appointment {
  id: string;
  organizationId?: string;
  leadId: string;
  appointmentTypeId: string;
  /** Copied from AppointmentType.assignedCounsellorId at booking time —
   *  denormalized so a later edit to the type's counsellor doesn't
   *  retroactively rewrite history, same reasoning Meeting's own
   *  denormalized fields follow. */
  assignedCounsellorId: string;
  startAt: string;
  endAt: string;
  timezone: string;
  status: AppointmentStatus;
  /** Free-form, same non-union convention as Lead.source. Always
   *  "appointment_booking" for the public flow today. */
  source: string;
  notes?: string;
  /** Pointer to the Meeting calendarService created for this booking, if
   *  a calendar provider was connected at booking time — absent (never
   *  faked) if none was. */
  meetingId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAppointmentInput {
  leadId: string;
  appointmentTypeId: string;
  assignedCounsellorId: string;
  startAt: string;
  endAt: string;
  timezone: string;
  source: string;
  notes?: string;
  organizationId?: string;
}

export interface UpdateAppointmentInput {
  status?: AppointmentStatus;
  notes?: string;
  meetingId?: string;
}

export interface AppointmentListFilters {
  leadId?: string;
  appointmentTypeId?: string;
  assignedCounsellorId?: string;
  status?: AppointmentStatus;
}

export interface AppointmentRepository {
  findById(id: string): Promise<Appointment | null>;
  /** Throws DuplicateKeyError("Appointment", {assignedCounsellorId, startAt})
   *  when a non-cancelled Appointment already occupies this exact
   *  counsellor+start-time slot — the double-booking guard (see
   *  publicBookingService.book's own doc comment). */
  create(input: CreateAppointmentInput): Promise<Appointment>;
  update(id: string, input: UpdateAppointmentInput): Promise<Appointment>;
  list(filters: AppointmentListFilters, page: number, limit: number): Promise<PaginatedResult<Appointment>>;
  /** Every non-cancelled Appointment for one counsellor whose range
   *  overlaps [rangeStart, rangeEnd) — the availability-computation and
   *  read-time overlap-exclusion query (see publicBookingService.getAvailability). */
  findActiveForCounsellorInRange(assignedCounsellorId: string, rangeStart: string, rangeEnd: string): Promise<Appointment[]>;
}
