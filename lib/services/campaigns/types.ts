import type { Campaign, CampaignChannel, CampaignListFilters, CampaignStatus, CreateCampaignInput } from "@/lib/db";

/**
 * Campaign application layer.
 *
 * The domain type, CreateCampaignInput, and the CampaignRepository port
 * live in lib/db/repositories/types.ts (built before this service module
 * existed) and are re-exported through lib/db's barrel — imported here
 * rather than redefined, per the plan already documented there when the
 * Database Layer module was built.
 *
 * CampaignValidationError is intentionally its own type here, even
 * though it's structurally identical to lib/services/leads/types.ts's
 * LeadValidationError and lib/api/errors.ts's ApiFieldError. Each layer
 * owns its own vocabulary on purpose: this service must stay callable
 * from contexts that know nothing about HTTP (a future admin script, a
 * queue worker), so it never imports an API-layer type.
 */

export interface CampaignValidationError {
  field: string;
  message: string;
}

export type CreateCampaignResult =
  | { success: true; campaign: Campaign }
  | { success: false; errors: CampaignValidationError[] };

export type { Campaign, CampaignChannel, CampaignStatus, CreateCampaignInput, CampaignListFilters };
