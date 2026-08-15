/**
 * Lead Capture Form domain layer — the tenant-facing public entry point
 * into the existing CRM (Lead) lifecycle. A LeadCaptureForm is
 * configuration only: it never owns lead data itself, it just describes
 * a public URL (`publicSlug`) and which optional fields it collects
 * before handing the submission to the existing leadService.registerLead()
 * unchanged (see publicSubmissionService.ts).
 */

export interface LeadCaptureFormFieldConfig {
  enabled: boolean;
  required: boolean;
}

export interface LeadCaptureFormFields {
  program: LeadCaptureFormFieldConfig;
  message: LeadCaptureFormFieldConfig;
}

export interface LeadCaptureForm {
  id: string;
  organizationId?: string;
  name: string;
  /** Globally unique (not compound with organizationId) — the public URL
   *  (/forms/{slug}) has no org prefix, so slug uniqueness must be
   *  platform-wide, the same shape Organization.slug already uses. */
  publicSlug: string;
  /** An inactive form's public page/route both reject new submissions
   *  with a clear message — never silently drops them. */
  active: boolean;
  fields: LeadCaptureFormFields;
  successMessage: string;
  /** Every POST that reaches the public route for this form, including
   *  ones recognized as a duplicate touch. */
  submissionCount: number;
  /** The subset of submissionCount that registerLead() recognized as an
   *  existing lead (duplicate: true) rather than a new one. */
  duplicateCount: number;
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_FIELDS: LeadCaptureFormFields = {
  program: { enabled: true, required: false },
  message: { enabled: true, required: false },
};

export function defaultLeadCaptureFormFields(): LeadCaptureFormFields {
  return { program: { ...DEFAULT_FIELDS.program }, message: { ...DEFAULT_FIELDS.message } };
}

export const DEFAULT_LEAD_CAPTURE_SUCCESS_MESSAGE = "Thanks — we've received your details and will be in touch soon.";

export interface CreateLeadCaptureFormInput {
  name: string;
  fields: LeadCaptureFormFields;
  successMessage: string;
  organizationId?: string;
}

export interface UpdateLeadCaptureFormInput {
  name?: string;
  active?: boolean;
  fields?: LeadCaptureFormFields;
  successMessage?: string;
}

export interface LeadCaptureFormRepository {
  findById(id: string): Promise<LeadCaptureForm | null>;
  /** Deliberately bypasses tenant scope — the same "resolve org before
   *  org is known" reason phoneNumber.mongodb.repository.ts's own
   *  findByPhoneNumberId does (see that file's doc comment). This is the
   *  ONE read path a public, unauthenticated request is allowed to make
   *  before any tenant context exists. */
  findByPublicSlug(slug: string): Promise<LeadCaptureForm | null>;
  /** Throws DuplicateKeyError (lib/db/types.ts) if publicSlug already
   *  exists — the caller (leadCaptureFormService) retries with a
   *  suffixed slug on that specific error, mirroring
   *  onboardingService.createOrganizationForUser's own collision-retry
   *  loop. */
  create(input: CreateLeadCaptureFormInput & { publicSlug: string }): Promise<LeadCaptureForm>;
  list(): Promise<LeadCaptureForm[]>;
  update(id: string, input: UpdateLeadCaptureFormInput): Promise<LeadCaptureForm>;
  delete(id: string): Promise<void>;
  /** Atomic — called once per public submission (see
   *  publicSubmissionService.ts), after the tenant context for this
   *  form's own organization is already established. */
  incrementCounts(id: string, options: { duplicate: boolean }): Promise<void>;
}
