export { appointmentTypeService } from "./appointmentTypeService";
export type { CreateAppointmentTypeResult, UpdateAppointmentTypeResult } from "./appointmentTypeService";
export { publicBookingService } from "./publicBookingService";
export type { PublicAppointmentTypeConfig, PublicBookingResult } from "./publicBookingService";
export { appointmentService } from "./appointmentService";
export type { UpdateAppointmentStatusResult } from "./appointmentService";
export type { AppointmentTypeValidationError } from "./validation";
export type {
  AppointmentType,
  WeeklyAvailabilitySlot,
  CreateAppointmentTypeInput,
  UpdateAppointmentTypeInput,
  AppointmentTypeRepository,
  Appointment,
  AppointmentStatus,
  CreateAppointmentInput,
  UpdateAppointmentInput,
  AppointmentListFilters,
  AppointmentRepository,
} from "./types";

// Deliberately NOT exported: getAppointmentTypeRepository/
// getAppointmentRepository (lib/db/registry.ts) and both concrete
// repositories per resource — consumers get the three services and
// domain types only, the same enforcement pattern
// lib/services/crm/leadCaptureForms/index.ts already established.
