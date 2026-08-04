import { getFeatureFlagRepository } from "@/lib/db";
import { auditLogService, AUDIT_ACTIONS } from "@/lib/services/auditLog";
import type { AuditContext } from "@/lib/services/auditLog";
import type { CreateFeatureFlagInput, FeatureFlag, UpdateFeatureFlagInput } from "./types";

/**
 * Business OS Phase 8, Module 8.3 — platform feature flags, DELIBERATELY
 * separate from plan entitlements (see types.ts's own `FeatureFlag` doc
 * comment). `isEnabled()` is the one centralized check any future
 * gradual-rollout code should call — never a scattered `if
 * (process.env.SOME_FLAG)` or an ad hoc boolean threaded through props.
 */
export const featureFlagService = {
  async listFlags(): Promise<FeatureFlag[]> {
    const repo = await getFeatureFlagRepository();
    return repo.list();
  },

  async isEnabled(key: string, organizationId?: string): Promise<boolean> {
    const repo = await getFeatureFlagRepository();
    const flag = await repo.findByKey(key);
    // An undeclared flag defaults to OFF — the safe default for a
    // rollout toggle nobody has explicitly turned on yet, never
    // silently on-by-absence.
    if (!flag) return false;
    if (organizationId && flag.organizationOverrides && organizationId in flag.organizationOverrides) {
      return flag.organizationOverrides[organizationId];
    }
    return flag.enabled;
  },

  async createFlag(input: CreateFeatureFlagInput, context: AuditContext = {}): Promise<FeatureFlag> {
    const repo = await getFeatureFlagRepository();
    const flag = await repo.create(input);
    await auditLogService.record({
      action: AUDIT_ACTIONS.FEATURE_FLAG_CREATED,
      entityType: "FeatureFlag",
      entityId: flag.key,
      actorId: context.actorId,
      requestId: context.requestId,
      metadata: { key: flag.key, enabled: flag.enabled },
    });
    return flag;
  },

  async updateFlag(key: string, input: UpdateFeatureFlagInput, context: AuditContext = {}): Promise<FeatureFlag> {
    const repo = await getFeatureFlagRepository();
    const flag = await repo.update(key, input);
    await auditLogService.record({
      action: AUDIT_ACTIONS.FEATURE_FLAG_UPDATED,
      entityType: "FeatureFlag",
      entityId: flag.key,
      actorId: context.actorId,
      requestId: context.requestId,
      metadata: { key: flag.key, enabled: flag.enabled, hasOrganizationOverrides: !!flag.organizationOverrides },
    });
    return flag;
  },
};
