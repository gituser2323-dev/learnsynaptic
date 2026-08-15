import { getLeadCaptureFormRepository } from "@/lib/db";
import { runWithTenantContext } from "@/lib/tenancy/context";
import { leadService } from "@/lib/services/leads";
import type { LeadValidationError } from "@/lib/services/leads";
import { activityService } from "@/lib/services/crm/activities";

export type PublicSubmissionResult =
  | { success: true; duplicate: boolean; successMessage: string }
  | { success: false; status: 404; message: string }
  | { success: false; status: 400; message: string; errors: LeadValidationError[] };

/** The public-safe subset of a LeadCaptureForm — no id/organizationId/
 *  counters, nothing an anonymous page render should ever serialize to
 *  the client. Used by the hosted public page (app/forms/[slug]/page.tsx)
 *  to render the right fields without reaching into the admin-facing
 *  leadCaptureFormService (reserved for authenticated CRUD) or the raw
 *  repository (reserved for this module's own use) directly. */
export interface PublicLeadCaptureFormConfig {
  name: string;
  active: boolean;
  fields: { program: { enabled: boolean; required: boolean }; message: { enabled: boolean; required: boolean } };
}

/**
 * The one genuinely new orchestration piece Lead Capture adds. Everything
 * it does is either a resolve-then-delegate step or a direct call into an
 * existing, unmodified service — see the module's own architecture doc
 * (the approved plan) for why: leadService.registerLead() already owns
 * validation, dedup, scoring, auto-assignment, audit logging, and
 * automation-trigger publishing, so this file's only real job is
 * multi-tenant routing — resolving an anonymous public submission to the
 * correct organization before handing off to that unchanged call.
 */
export const publicSubmissionService = {
  /** Server-rendered by app/forms/[slug]/page.tsx before any submission
   *  happens — `null` for an unknown OR inactive slug (deliberately
   *  indistinguishable, same reasoning as submit()'s own 404 below), so
   *  the page can render a real 404 either way. */
  async getPublicFormConfig(slug: string): Promise<PublicLeadCaptureFormConfig | null> {
    const repository = await getLeadCaptureFormRepository();
    const form = await repository.findByPublicSlug(slug);
    if (!form || !form.active) return null;
    return { name: form.name, active: form.active, fields: form.fields };
  },

  async submit(slug: string, input: unknown): Promise<PublicSubmissionResult> {
    const repository = await getLeadCaptureFormRepository();
    const form = await repository.findByPublicSlug(slug);

    // Unlike the WhatsApp webhook's own org-resolution fallback (which
    // falls through to default-organization behavior on an unresolved
    // identifier — safe there because Meta's payload is already
    // HMAC-signed and low attacker-value), a hard reject here: this slug
    // is a client-supplied, guessable public identifier reachable
    // directly by anonymous internet traffic. Falling back to a default
    // org would risk a real cross-tenant leak, not just a routing miss.
    // An inactive form is deliberately indistinguishable from an unknown
    // one to the caller — no signal to a scraper about which slugs exist
    // but are merely paused.
    if (!form || !form.active || !form.organizationId) {
      return { success: false, status: 404, message: "This form is not available." };
    }

    const body = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;

    // Honeypot: a hidden field no real visitor fills in. A non-empty
    // value is treated as a successful submission from the bot's own
    // point of view (never reveals that it was filtered) but never
    // reaches leadService at all.
    if (typeof body.website === "string" && body.website.trim() !== "") {
      return { success: true, duplicate: false, successMessage: form.successMessage };
    }

    const organizationId = form.organizationId;
    return runWithTenantContext({ organizationId }, async () => {
      const leadInput: Record<string, unknown> = {
        name: body.name,
        email: body.email,
        phone: body.phone,
        source: "lead_capture",
        capturedVia: { formId: form.id, formName: form.name },
      };
      if (form.fields.program.enabled && typeof body.program === "string") {
        leadInput.program = body.program;
      }
      if (form.fields.message.enabled && typeof body.message === "string") {
        leadInput.message = body.message;
      }

      const result = await leadService.registerLead(leadInput);
      if (!result.success) {
        return { success: false, status: 400, message: "Please check your details and try again.", errors: result.errors };
      }

      // Explicit organizationId — this call runs inside
      // runWithTenantContext above, but logSystemEvent's own 4th argument
      // is still required here rather than relied upon implicitly: see
      // this module's own architecture notes on why (a public route has
      // no ambient session the way an admin action does, so being
      // explicit here is the same discipline leadService.registerLead
      // itself already applies to its own organizationId resolution).
      await activityService.logSystemEvent("Lead", result.lead.id, `Lead captured through "${form.name}"`, organizationId);
      await repository.incrementCounts(form.id, { duplicate: result.duplicate });

      return { success: true, duplicate: result.duplicate, successMessage: form.successMessage };
    });
  },
};
