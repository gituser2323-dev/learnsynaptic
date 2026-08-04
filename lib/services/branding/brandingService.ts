import { getBrandConfigurationRepository } from "@/lib/db";
import { auditLogService, AUDIT_ACTIONS } from "@/lib/services/auditLog";
import type { AuditContext } from "@/lib/services/auditLog";
import { entitlementService, EntitlementError } from "@/lib/services/billing";
import { fileStorageService } from "@/lib/services/storage";
import { validateUpsertBrandConfiguration } from "./validation";
import { invalidateBrandingCache, resolveBranding } from "./themeResolver";
import type { BrandConfiguration } from "./types";

export type BrandingServiceError =
  | { code: "validation"; message: string; errors: { field: string; message: string }[] }
  | { code: "not_entitled"; message: string }
  | { code: "asset_not_found"; message: string };
export type BrandingServiceResult<T> = { success: true; data: T } | { success: false; error: BrandingServiceError };

/**
 * Business OS Phase 8, Module 8.4 — the write path for a tenant's own
 * branding, gated on the `white_label` plan capability (never a
 * hardcoded plan-name check — see `entitlementService`, Module 8.3).
 * Every successful write invalidates this organization's own cached
 * `ResolvedBranding` immediately (never relies solely on the cache's
 * own short TTL) so a saved change is visible on the very next
 * request, proven directly by this module's own cache-isolation test.
 */
export const brandingService = {
  async getRawConfiguration(organizationId: string): Promise<BrandConfiguration | null> {
    const repo = await getBrandConfigurationRepository();
    return repo.findByOrganizationId(organizationId);
  },

  async getResolvedBranding(organizationId: string) {
    return resolveBranding(organizationId);
  },

  async updateConfiguration(organizationId: string, rawInput: unknown, context: AuditContext = {}): Promise<BrandingServiceResult<BrandConfiguration>> {
    try {
      await entitlementService.assertCapability(organizationId, "white_label");
    } catch (error) {
      if (error instanceof EntitlementError) {
        return { success: false, error: { code: "not_entitled", message: "Your current plan does not include white-label branding." } };
      }
      throw error;
    }

    const validation = validateUpsertBrandConfiguration(rawInput);
    if (!validation.valid) return { success: false, error: { code: "validation", message: "Invalid branding configuration.", errors: validation.errors } };

    // Every referenced asset must be a real, non-deleted FileAsset this
    // organization actually owns — never trust a client-supplied file
    // id at face value (the same "verify ownership server-side, never
    // trust the id alone" posture every other entity-linking field in
    // this app already takes).
    for (const field of ["logoFileId", "compactLogoFileId", "faviconFileId"] as const) {
      const fileId = validation.data[field];
      if (typeof fileId === "string") {
        const file = await fileStorageService.getFile(fileId);
        if (!file || file.deletedAt || file.organizationId !== organizationId) {
          return { success: false, error: { code: "asset_not_found", message: `${field} does not reference a valid file owned by this organization.` } };
        }
      }
    }

    const repo = await getBrandConfigurationRepository();
    const config = await repo.upsert(organizationId, validation.data);
    invalidateBrandingCache(organizationId);

    await auditLogService.record({
      action: AUDIT_ACTIONS.BRAND_CONFIGURATION_UPDATED,
      entityType: "BrandConfiguration",
      entityId: config.id,
      actorId: context.actorId,
      requestId: context.requestId,
      metadata: { organizationId, changedFields: Object.keys(validation.data) },
    });
    return { success: true, data: config };
  },

  async resetConfiguration(organizationId: string, context: AuditContext = {}): Promise<void> {
    const repo = await getBrandConfigurationRepository();
    await repo.deleteByOrganizationId(organizationId);
    invalidateBrandingCache(organizationId);
    await auditLogService.record({
      action: AUDIT_ACTIONS.BRAND_CONFIGURATION_RESET,
      entityType: "BrandConfiguration",
      entityId: organizationId,
      actorId: context.actorId,
      requestId: context.requestId,
      metadata: { organizationId },
    });
  },
};
