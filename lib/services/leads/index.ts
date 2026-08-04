export { leadService } from "./leadService";
export type { BulkOperationResult, LeadImportResult, LeadImportPreview } from "./leadService";
export type {
  Lead,
  LeadStatus,
  LeadUtmParams,
  CreateLeadInput,
  CreateLeadResult,
  LeadValidationError,
  LeadListFilters,
  UtmBreakdownRow,
  // Enterprise CRM (Phase 1)
  UpdateLeadInput,
  DuplicateLeadGroup,
} from "./types";

// Deliberately NOT exported: getLeadRepository (registry.ts) and both
// concrete repositories. Consumers get leadService and the domain types
// only, the same enforcement pattern used in lib/services/whatsapp and
// lib/services/analytics.
