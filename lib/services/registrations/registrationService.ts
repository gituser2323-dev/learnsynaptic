import {
  getLeadRepository,
  getCampaignRepository,
  getRegistrationRepository,
  runInTransaction,
  DuplicateKeyError,
} from "@/lib/db";
import { validateCreateRegistrationInput } from "./validation";
import { auditLogService, AUDIT_ACTIONS } from "@/lib/services/auditLog";
import { publish } from "@/lib/events";
import { getTenantContext } from "@/lib/tenancy/context";
import { ensureDefaultOrganization } from "@/lib/services/organizations";
import type { AuditContext } from "@/lib/services/auditLog";
import type { PaginatedResult } from "@/lib/pagination";
import type {
  CreateRegistrationResult,
  Registration,
  RegistrationAnalytics,
  RegistrationListFilters,
} from "./types";

/**
 * Application layer for registrations — the first service in this
 * codebase that touches more than one entity in a single write, and
 * therefore the first real caller of lib/db/transaction.ts's
 * runInTransaction().
 *
 * Duplicate-handling policy here is a third variant, deliberately
 * different from both siblings:
 *  - Lead: silently recognize a repeat submission (same person, expected).
 *  - Campaign: reject a code collision (an admin mistake, not expected).
 *  - Registration: return the EXISTING registration as a success. A user
 *    re-registering for something they're already registered for isn't
 *    an error — it's a no-op that should feel like success, not a
 *    scary validation failure on a double-click or retried request.
 * Same architecture (repository lookup + application-level policy),
 * three different, entity-appropriate outcomes.
 */
export const registrationService = {
  async createRegistration(input: unknown, context: AuditContext = {}): Promise<CreateRegistrationResult> {
    const validation = validateCreateRegistrationInput(input);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }
    const { leadId, programSlug, campaignId } = validation.data;

    const leadRepository = await getLeadRepository();
    const lead = await leadRepository.findById(leadId);
    if (!lead) {
      return { success: false, errors: [{ field: "leadId", message: "No lead found with this id." }] };
    }

    if (campaignId) {
      const campaignRepository = await getCampaignRepository();
      const campaign = await campaignRepository.findById(campaignId);
      if (!campaign) {
        return { success: false, errors: [{ field: "campaignId", message: "No campaign found with this id." }] };
      }
    }

    const registrationRepository = await getRegistrationRepository();
    const existing = await registrationRepository.findByLeadAndProgram(leadId, programSlug);
    if (existing) {
      // Not audited — an idempotent repeat, not a new state change. See
      // AUDIT_ARCHITECTURE.md §2 (approved decision), same reasoning as
      // Lead's duplicate touch.
      return { success: true, registration: existing, duplicate: true };
    }

    // Business OS Phase 8, Module 8.1 — same posture as
    // leadService.registerLead(): POST /api/registrations is a public,
    // unauthenticated route, so there's no admin session to derive an
    // organization from — resolve to the deployment's default rather
    // than leaving it unset (see leadService.ts's own doc comment for
    // why an unset organizationId would make this registration silently
    // invisible under tenant-scoped admin queries).
    const organizationId = getTenantContext()?.organizationId ?? (await ensureDefaultOrganization()).id;

    let registration;
    try {
      registration = await runInTransaction(async (session) => {
        const created = await registrationRepository.create({ ...validation.data, organizationId }, session);
        if (campaignId) {
          const campaignRepository = await getCampaignRepository();
          await campaignRepository.incrementRegistrationCount(campaignId, session);
        }
        return created;
      });
    } catch (error) {
      // Two concurrent requests can both pass the findByLeadAndProgram
      // check above before either finishes writing — the unique compound
      // index on (leadId, programSlug) (lib/db/models/registration.model.ts)
      // is the real guarantee against that race. Catch it and return the
      // now-existing registration, the same outcome the non-race
      // duplicate path above already returns.
      if (error instanceof DuplicateKeyError) {
        const raceExisting = await registrationRepository.findByLeadAndProgram(leadId, programSlug);
        if (raceExisting) {
          return { success: true, registration: raceExisting, duplicate: true };
        }
      }
      throw error;
    }

    // Deliberately OUTSIDE the transaction above — see
    // AUDIT_ARCHITECTURE.md §5/§8/§9: an audit-write failure must never
    // roll back a successful Registration creation + Campaign-count
    // update. The business operation has already fully succeeded by the
    // time this runs.
    await auditLogService.record({
      action: AUDIT_ACTIONS.REGISTRATION_CREATED,
      entityType: "Registration",
      entityId: registration.id,
      requestId: context.requestId,
      metadata: { leadId, programSlug, campaignId },
    });

    // Stops any of this lead's in-flight automation workflows early —
    // see lib/services/automation/triggers.ts, which subscribes to this
    // event specifically to model "Student Conversion" as an exit
    // condition rather than a workflow step.
    await publish("registration.created", { leadId, programSlug, registrationId: registration.id, campaignId });
    // Generic Webhooks & Team Notifications (Phase 6), Module 6.5 — the
    // same occurrence, published a second time under the CRM's own
    // "Lead Converted" business name (the mission's named event), for
    // subscribers (webhooks/Slack/Teams/Discord) that think in CRM
    // terms rather than "registration" specifically. Additive, not a
    // replacement — registration.created's own existing subscriber
    // (triggers.ts) is untouched.
    await publish("lead.converted", { leadId, programSlug, registrationId: registration.id, campaignId });

    return { success: true, registration, duplicate: false };
  },

  /** Admin Dashboard Backend — filtered/paginated listing. */
  async listRegistrations(
    filters: RegistrationListFilters,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResult<Registration>> {
    const repository = await getRegistrationRepository();
    return repository.list(filters, page, limit);
  },

  /** Admin Dashboard Backend — Registration Analytics. */
  async getAnalytics(): Promise<RegistrationAnalytics> {
    const repository = await getRegistrationRepository();
    return repository.analytics();
  },

  /** Payments Integration (Phase 6), Module 6.4 — the real CRM
   *  integration point for a successful payment linked to a
   *  Registration: "pending" moves to "confirmed" the same way a
   *  counsellor's own manual confirmation would, via the repository's
   *  own pre-existing `updateStatus()` (present since this module was
   *  first built, unused by any service method until now). A no-op for
   *  a registration that's already confirmed/cancelled — payment
   *  success never resurrects a cancelled registration or re-confirms
   *  an already-confirmed one. */
  async confirmRegistration(id: string): Promise<Registration | null> {
    const repository = await getRegistrationRepository();
    const existing = await repository.findById(id);
    if (!existing) return null;
    if (existing.status !== "pending") return existing;
    return repository.updateStatus(id, "confirmed");
  },
};
