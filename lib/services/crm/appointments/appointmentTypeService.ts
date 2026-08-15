import { getAppointmentTypeRepository } from "@/lib/db";
import { DuplicateKeyError } from "@/lib/db/types";
import { auditLogService, AUDIT_ACTIONS } from "@/lib/services/auditLog";
import type { AuditContext } from "@/lib/services/auditLog";
import { slugify, randomSlugSuffix } from "@/lib/utils/slugify";
import { validateCreateAppointmentTypeInput, validateUpdateAppointmentTypeInput, type AppointmentTypeValidationError } from "./validation";
import type { AppointmentType } from "./types";

export type CreateAppointmentTypeResult =
  | { success: true; appointmentType: AppointmentType }
  | { success: false; errors: AppointmentTypeValidationError[] };

export type UpdateAppointmentTypeResult =
  | { success: true; appointmentType: AppointmentType }
  | { success: false; errors: AppointmentTypeValidationError[] };

const MAX_SLUG_ATTEMPTS = 5;

/**
 * Admin-facing CRUD for Appointment Types. Mirrors
 * leadCaptureFormService.ts's own shape exactly (validate → repository →
 * audit log), including the identical publicSlug generation +
 * collision-retry loop via lib/utils/slugify.ts — reused, not reinvented.
 */
export const appointmentTypeService = {
  async createAppointmentType(input: unknown, context: AuditContext = {}): Promise<CreateAppointmentTypeResult> {
    const validation = validateCreateAppointmentTypeInput(input);
    if (!validation.valid) return { success: false, errors: validation.errors };

    const repository = await getAppointmentTypeRepository();

    let appointmentType: AppointmentType | undefined;
    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt += 1) {
      const publicSlug = attempt === 0 ? slugify(validation.data.name) : `${slugify(validation.data.name)}-${randomSlugSuffix()}`;
      try {
        // Sequential by necessity — each attempt needs to know the
        // previous one collided before trying the next slug, the same
        // reasoning onboardingService's and leadCaptureFormService's own
        // identical retry loops document.
        appointmentType = await repository.create({ ...validation.data, publicSlug });
        break;
      } catch (error) {
        lastError = error;
        if (!(error instanceof DuplicateKeyError)) throw error;
      }
    }

    if (!appointmentType) {
      throw lastError instanceof Error ? lastError : new Error("Failed to create appointment type: slug collision retries exhausted.");
    }

    await auditLogService.record({
      action: AUDIT_ACTIONS.APPOINTMENT_TYPE_CREATED,
      entityType: "AppointmentType",
      entityId: appointmentType.id,
      actorId: context.actorId,
      requestId: context.requestId,
      metadata: { name: appointmentType.name, publicSlug: appointmentType.publicSlug },
    });

    return { success: true, appointmentType };
  },

  async listAppointmentTypes(): Promise<AppointmentType[]> {
    const repository = await getAppointmentTypeRepository();
    return repository.list();
  },

  async getAppointmentType(id: string): Promise<AppointmentType | null> {
    const repository = await getAppointmentTypeRepository();
    return repository.findById(id);
  },

  async updateAppointmentType(id: string, input: unknown, context: AuditContext = {}): Promise<UpdateAppointmentTypeResult> {
    const validation = validateUpdateAppointmentTypeInput(input);
    if (!validation.valid) return { success: false, errors: validation.errors };

    const repository = await getAppointmentTypeRepository();
    const appointmentType = await repository.update(id, validation.data);

    await auditLogService.record({
      action: AUDIT_ACTIONS.APPOINTMENT_TYPE_UPDATED,
      entityType: "AppointmentType",
      entityId: id,
      actorId: context.actorId,
      requestId: context.requestId,
      metadata: { fields: Object.keys(validation.data) },
    });

    return { success: true, appointmentType };
  },

  async deleteAppointmentType(id: string, context: AuditContext = {}): Promise<void> {
    const repository = await getAppointmentTypeRepository();
    await repository.delete(id);
    await auditLogService.record({
      action: AUDIT_ACTIONS.APPOINTMENT_TYPE_DELETED,
      entityType: "AppointmentType",
      entityId: id,
      actorId: context.actorId,
      requestId: context.requestId,
    });
  },
};
