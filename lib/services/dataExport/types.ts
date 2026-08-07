/**
 * RC-5 — Backup, Restore & Disaster Recovery: organization-level data
 * export. A tenant admin can request a portable export of everything
 * their organization owns (leads, activities, tasks, opportunities,
 * conversations, campaigns, automation definitions, payment history,
 * org config) — the mission's own explicit "Organization A must never
 * export Organization B" requirement is enforced the same way every
 * other cross-tenant boundary in this app is: `organizationId` is
 * always server-resolved (tenantScopePlugin / runWithTenantContext),
 * never client-supplied, and re-checked again at download time (see
 * exportService.getExportStatus's own doc comment).
 *
 * Generation runs as a background job (lib/services/scheduler), not
 * synchronously in the request — an org's full dataset has no fixed
 * upper bound, and RC-4's own "move long-running work to the job
 * queue, don't just raise timeouts" lesson applies directly here.
 */

export type DataExportStatus = "pending" | "processing" | "completed" | "failed";

export interface DataExportRequest {
  id: string;
  status: DataExportStatus;
  requestedBy: string;
  /** Set only once status is "completed" — the FileAsset holding the
   *  actual export bytes (category: "EXPORT", visibility: "private"). */
  fileAssetId?: string;
  /** Set only once status is "failed" — never includes secrets/PII,
   *  just enough to tell an operator what went wrong. */
  error?: string;
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDataExportRequestInput {
  requestedBy: string;
  organizationId?: string;
}

export interface UpdateDataExportRequestInput {
  status?: DataExportStatus;
  fileAssetId?: string;
  error?: string;
}

export interface DataExportRequestRepository {
  findById(id: string): Promise<DataExportRequest | null>;
  create(input: CreateDataExportRequestInput): Promise<DataExportRequest>;
  update(id: string, input: UpdateDataExportRequestInput): Promise<DataExportRequest>;
}
