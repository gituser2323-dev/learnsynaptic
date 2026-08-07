import { getDataExportRequestRepository } from "@/lib/db";
import { enqueueJob } from "@/lib/services/scheduler";
import { auditLogService, AUDIT_ACTIONS, type AuditContext } from "@/lib/services/auditLog";
import { fileStorageService } from "@/lib/services/storage/fileStorageService";
import { getTenantContext } from "@/lib/tenancy/context";
import type { DataExportRequest } from "./types";

const EXPORT_DOWNLOAD_URL_EXPIRY_SECONDS = 300;

export type ExportStatusResult =
  | { found: false }
  | { found: true; request: DataExportRequest; downloadUrl?: string };

export const exportService = {
  /** RC-5 — enqueues async generation (lib/services/dataExport/jobHandler.ts),
   *  never generates synchronously in the request — an org's dataset has
   *  no fixed upper bound. `organizationId` comes ONLY from the active
   *  tenant context (never a client-supplied value) — this is what
   *  makes the export request itself tenant-bound from the moment it's
   *  created, before generation even starts. */
  async requestExport(requestedBy: string, context: AuditContext = {}): Promise<DataExportRequest> {
    const organizationId = getTenantContext()?.organizationId;
    const repository = await getDataExportRequestRepository();
    const request = await repository.create({ requestedBy, organizationId });

    await enqueueJob({
      jobType: "tenant_export.generate",
      payload: { exportRequestId: request.id },
      runAt: new Date().toISOString(),
    });

    await auditLogService.record({
      action: AUDIT_ACTIONS.DATA_EXPORT_REQUESTED,
      entityType: "DataExportRequest",
      entityId: request.id,
      actorId: context.actorId,
      requestId: context.requestId,
    });

    return request;
  },

  /** RC-5 — the ONLY read path for an export request. `DataExportRequest`
   *  carries `tenantScopePlugin` (same as Lead/Task/Conversation), so a
   *  request belonging to another organization simply doesn't resolve
   *  here — `findById` returns null, this returns `{ found: false }`,
   *  identical to "id doesn't exist" (the same cross-tenant-safe 404
   *  convention every other entity in this app already follows, see
   *  tenantScopePlugin.ts's own doc comment). This is the concrete
   *  mechanism behind the mission's "Organization A must never export
   *  Organization B" requirement — not a special case, the same
   *  boundary every tenant-owned entity gets automatically.
   *
   *  A signed, time-limited download URL is only ever generated once
   *  status is "completed" — `fileStorageService.getDownloadUrl` is
   *  itself tenant-scoped the same way (FileAsset also carries
   *  `tenantScopePlugin`), so this is checked twice by construction,
   *  not by this method remembering to. */
  async getExportStatus(id: string): Promise<ExportStatusResult> {
    const repository = await getDataExportRequestRepository();
    const request = await repository.findById(id);
    if (!request) return { found: false };

    if (request.status === "completed" && request.fileAssetId) {
      const downloadUrl = await fileStorageService.getDownloadUrl(request.fileAssetId, EXPORT_DOWNLOAD_URL_EXPIRY_SECONDS);
      return { found: true, request, downloadUrl: downloadUrl ?? undefined };
    }

    return { found: true, request };
  },
};
