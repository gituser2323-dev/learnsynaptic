import type {
  CreateRegistrationInput,
  Registration,
  RegistrationAnalytics,
  RegistrationListFilters,
  RegistrationStatus,
} from "@/lib/db";

/**
 * Registration application layer.
 *
 * Registration, CreateRegistrationInput, RegistrationStatus, and the
 * RegistrationRepository port live in lib/db/repositories/types.ts,
 * imported here rather than redefined — same pattern as
 * lib/services/campaigns/types.ts.
 */

export interface RegistrationValidationError {
  field: string;
  message: string;
}

/**
 * duplicate: true means an existing registration for this (leadId,
 * programSlug) pair was returned instead of a new one being created — a
 * repeat registration attempt is treated as an idempotent success, not
 * an error (see registrationService.ts for why this differs from
 * Campaign's reject-on-duplicate policy).
 */
export type CreateRegistrationResult =
  | { success: true; registration: Registration; duplicate: boolean }
  | { success: false; errors: RegistrationValidationError[] };

export type {
  Registration,
  RegistrationStatus,
  CreateRegistrationInput,
  RegistrationListFilters,
  RegistrationAnalytics,
};
