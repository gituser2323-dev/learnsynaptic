/** Pipeline / Opportunity domain layer — Enterprise CRM (Phase 1).
 *  Deliberately a distinct concept from Registration (see Business OS
 *  Blueprint §3): an Opportunity is a pre-enrollment sales-motion
 *  record that can be Lost without a Lead ever becoming a Registration.
 *  Stages are embedded inside Pipeline (one small, ordered, owned list
 *  — the same shape ScheduledJob.retryPolicy already embeds rather than
 *  externalizing), not a separate top-level collection; Opportunity
 *  stays top-level since it's independently queried and high write
 *  frequency (every stage move). */

export interface PipelineStage {
  id: string;
  name: string;
  order: number;
  isWon: boolean;
  isLost: boolean;
}

export interface Pipeline {
  id: string;
  name: string;
  isDefault: boolean;
  /** Optional program this pipeline is scoped to (e.g. "full-stack-devops")
   *  — unset means "general purpose," matching every pipeline that
   *  existed before this field did. */
  program?: string;
  stages: PipelineStage[];
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePipelineInput {
  name: string;
  isDefault?: boolean;
  program?: string;
  stages: { name: string; isWon?: boolean; isLost?: boolean }[];
  organizationId?: string;
}

export type OpportunityStatus = "open" | "won" | "lost";

/** One stage transition. Appended by the repository itself whenever an
 *  update carries a `stageId` (see UpdateOpportunityInput) — the service
 *  layer never builds this array directly. `create()` seeds a single
 *  entry for the opportunity's starting stage, so the array is never
 *  empty for anything created after this field was introduced; older
 *  opportunities have no entries until backfilled (see
 *  scripts/backfillOpportunityStageHistory.ts) or until their next move. */
export interface OpportunityStageHistoryEntry {
  stageId: string;
  enteredAt: string;
}

export interface Opportunity {
  id: string;
  leadId: string;
  pipelineId: string;
  stageId: string;
  status: OpportunityStatus;
  expectedRevenueInr?: number;
  /** 0–100. */
  probability: number;
  lostReason?: string;
  ownerId?: string;
  organizationId?: string;
  stageHistory: OpportunityStageHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateOpportunityInput {
  leadId: string;
  pipelineId: string;
  stageId: string;
  expectedRevenueInr?: number;
  probability?: number;
  ownerId?: string;
  organizationId?: string;
}

export interface UpdateOpportunityInput {
  stageId?: string;
  status?: OpportunityStatus;
  expectedRevenueInr?: number;
  probability?: number;
  lostReason?: string;
  ownerId?: string;
}

export interface OpportunityListFilters {
  pipelineId?: string;
  stageId?: string;
  status?: OpportunityStatus;
  ownerId?: string;
  /** AI CRM (Phase 5), Module 5.1 — leadInsightService's own lookup: a
   *  lead's open/won/lost opportunities for AI-analysis context. */
  leadId?: string;
}

export interface PipelineRepository {
  findById(id: string): Promise<Pipeline | null>;
  getDefault(): Promise<Pipeline | null>;
  create(input: CreatePipelineInput): Promise<Pipeline>;
  list(): Promise<Pipeline[]>;
  /** Hard delete — the service layer is what enforces "never delete the
   *  default pipeline or one with opportunities on it," not this. */
  delete(id: string): Promise<void>;
}

export interface OpportunityRepository {
  findById(id: string): Promise<Opportunity | null>;
  create(input: CreateOpportunityInput): Promise<Opportunity>;
  update(id: string, input: UpdateOpportunityInput): Promise<Opportunity>;
  list(filters: OpportunityListFilters): Promise<Opportunity[]>;
  /** One-time backfill support only (see
   *  scripts/backfillOpportunityStageHistory.ts) — sets stageHistory
   *  directly to a single entry rather than appending through the
   *  normal moveStage() path, since it's only ever called for
   *  opportunities whose array is still empty. */
  seedStageHistory(id: string, entry: OpportunityStageHistoryEntry): Promise<void>;
}
