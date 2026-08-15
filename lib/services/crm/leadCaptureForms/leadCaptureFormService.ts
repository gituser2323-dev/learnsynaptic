import { getLeadCaptureFormRepository } from "@/lib/db";
import { DuplicateKeyError } from "@/lib/db/types";
import { auditLogService, AUDIT_ACTIONS } from "@/lib/services/auditLog";
import type { AuditContext } from "@/lib/services/auditLog";
import { slugify, randomSlugSuffix } from "@/lib/utils/slugify";
import { validateCreateLeadCaptureFormInput, validateUpdateLeadCaptureFormInput, type LeadCaptureFormValidationError } from "./validation";
import type { LeadCaptureForm } from "./types";

export type CreateLeadCaptureFormResult =
  | { success: true; form: LeadCaptureForm }
  | { success: false; errors: LeadCaptureFormValidationError[] };

export type UpdateLeadCaptureFormResult =
  | { success: true; form: LeadCaptureForm }
  | { success: false; errors: LeadCaptureFormValidationError[] };

const MAX_SLUG_ATTEMPTS = 5;

/**
 * Admin-facing CRUD for Lead Capture Forms. Mirrors tagService.ts's own
 * shape (validate -> repository -> audit log). The one thing beyond a
 * plain CRUD resource: publicSlug generation with a collision-retry loop,
 * the same pattern onboardingService.createOrganizationForUser already
 * established for Organization.slug — reused here via lib/utils/slugify,
 * not reinvented.
 */
export const leadCaptureFormService = {
  async createForm(input: unknown, context: AuditContext = {}): Promise<CreateLeadCaptureFormResult> {
    const validation = validateCreateLeadCaptureFormInput(input);
    if (!validation.valid) return { success: false, errors: validation.errors };

    const repository = await getLeadCaptureFormRepository();

    let form: LeadCaptureForm | undefined;
    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt += 1) {
      const publicSlug = attempt === 0 ? slugify(validation.data.name) : `${slugify(validation.data.name)}-${randomSlugSuffix()}`;
      try {
        // Sequential by necessity — each attempt needs to know the
        // previous one collided before trying the next slug, the same
        // reasoning onboardingService's own identical retry loop documents.
        form = await repository.create({ ...validation.data, publicSlug });
        break;
      } catch (error) {
        lastError = error;
        if (!(error instanceof DuplicateKeyError)) throw error;
      }
    }

    if (!form) {
      throw lastError instanceof Error ? lastError : new Error("Failed to create lead capture form: slug collision retries exhausted.");
    }

    await auditLogService.record({
      action: AUDIT_ACTIONS.LEAD_CAPTURE_FORM_CREATED,
      entityType: "LeadCaptureForm",
      entityId: form.id,
      actorId: context.actorId,
      requestId: context.requestId,
      metadata: { name: form.name, publicSlug: form.publicSlug },
    });

    return { success: true, form };
  },

  async listForms(): Promise<LeadCaptureForm[]> {
    const repository = await getLeadCaptureFormRepository();
    return repository.list();
  },

  async getForm(id: string): Promise<LeadCaptureForm | null> {
    const repository = await getLeadCaptureFormRepository();
    return repository.findById(id);
  },

  async updateForm(id: string, input: unknown, context: AuditContext = {}): Promise<UpdateLeadCaptureFormResult> {
    const validation = validateUpdateLeadCaptureFormInput(input);
    if (!validation.valid) return { success: false, errors: validation.errors };

    const repository = await getLeadCaptureFormRepository();
    const form = await repository.update(id, validation.data);

    await auditLogService.record({
      action: AUDIT_ACTIONS.LEAD_CAPTURE_FORM_UPDATED,
      entityType: "LeadCaptureForm",
      entityId: id,
      actorId: context.actorId,
      requestId: context.requestId,
      metadata: { fields: Object.keys(validation.data) },
    });

    return { success: true, form };
  },

  async deleteForm(id: string, context: AuditContext = {}): Promise<void> {
    const repository = await getLeadCaptureFormRepository();
    await repository.delete(id);
    await auditLogService.record({
      action: AUDIT_ACTIONS.LEAD_CAPTURE_FORM_DELETED,
      entityType: "LeadCaptureForm",
      entityId: id,
      actorId: context.actorId,
      requestId: context.requestId,
    });
  },
};
