import { getCampaignRepository, DuplicateKeyError } from "@/lib/db";
import { validateCreateCampaignInput } from "./validation";
import { auditLogService, AUDIT_ACTIONS } from "@/lib/services/auditLog";
import type { AuditContext } from "@/lib/services/auditLog";
import type { PaginatedResult } from "@/lib/pagination";
import type { Campaign, CampaignListFilters, CreateCampaignResult } from "./types";

/**
 * Application layer for campaigns — the module any route/future admin
 * tool should call (re-exported from index.ts).
 *
 * Duplicate-handling policy here is deliberately different from
 * leadService's: a repeat Lead submission is expected (the same person
 * re-filling a form) and gets silently recognized as a touchpoint. A
 * campaign code collision is not expected — campaigns are created
 * deliberately, usually by a marketer — so it's rejected with a clear
 * error instead of silently returning the existing one. Same
 * architecture (repository lookup + application-level policy), two
 * different, entity-appropriate decisions.
 */
export const campaignService = {
  async createCampaign(input: unknown, context: AuditContext = {}): Promise<CreateCampaignResult> {
    const validation = validateCreateCampaignInput(input);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }

    const repository = await getCampaignRepository();

    const existing = await repository.findByCode(validation.data.code);
    if (existing) {
      // Rejected attempt, not a state change — not audited. See
      // AUDIT_ARCHITECTURE.md §2/§3 (approved decision): revisit once
      // authentication/authorization exist and "who attempted this" is
      // answerable. Already captured as an operational log via
      // lib/api's request logging in the meantime.
      return {
        success: false,
        errors: [{ field: "code", message: `A campaign with code "${validation.data.code}" already exists.` }],
      };
    }

    try {
      const campaign = await repository.create(validation.data);
      await auditLogService.record({
        action: AUDIT_ACTIONS.CAMPAIGN_CREATED,
        entityType: "Campaign",
        entityId: campaign.id,
        requestId: context.requestId,
        metadata: { code: campaign.code, channel: campaign.channel },
      });
      return { success: true, campaign };
    } catch (error) {
      // Two concurrent requests can both pass the findByCode check above
      // before either finishes creating — the unique index on `code`
      // (lib/db/models/campaign.model.ts) is the real guarantee against
      // that race. This catches it and returns the same clean error
      // instead of a raw duplicate-key exception reaching the caller.
      if (error instanceof DuplicateKeyError) {
        return {
          success: false,
          errors: [
            { field: "code", message: `A campaign with code "${validation.data.code}" already exists.` },
          ],
        };
      }
      throw error;
    }
  },

  async listActiveCampaigns(): Promise<Campaign[]> {
    const repository = await getCampaignRepository();
    return repository.listActive();
  },

  /** Marketing Dashboard — resolves a single campaign, e.g. to look up its
   *  externalAdCampaignId before querying an AdsProvider for spend. */
  async getCampaignById(id: string): Promise<Campaign | null> {
    const repository = await getCampaignRepository();
    return repository.findById(id);
  },

  /** Admin Dashboard Backend — Campaign Tracking: all campaigns
   *  (not just active), filtered/searched/paginated. */
  async listCampaigns(
    filters: CampaignListFilters,
    page = 1,
    limit = 20,
  ): Promise<PaginatedResult<Campaign>> {
    const repository = await getCampaignRepository();
    return repository.list(filters, page, limit);
  },
};
