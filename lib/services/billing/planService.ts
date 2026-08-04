import { getPlanRepository } from "@/lib/db";
import { auditLogService, AUDIT_ACTIONS } from "@/lib/services/auditLog";
import type { AuditContext } from "@/lib/services/auditLog";
import { validateCreatePlanInput, validateUpdatePlanInput } from "./validation";
import type { BillingValidationError } from "./validation";
import type { CreatePlanInput, Plan, UpdatePlanInput } from "./types";

export type PlanServiceError = { code: "not_found"; message: string } | { code: "validation"; message: string; errors: BillingValidationError[] } | { code: "duplicate"; message: string };
export type PlanServiceResult<T> = { success: true; data: T } | { success: false; error: PlanServiceError };

/**
 * Business OS Phase 8, Module 8.3 — the global SaaS Plan catalog's own
 * CRUD service. Platform-level, not tenant-owned (see plan.model.ts's
 * own doc comment) — routes calling this must gate on a platform
 * capability, never a tenant `admin` role alone (see this module's own
 * `requiredCapability`/platform-route doc comments for how "tenant
 * Admin" and "can edit the global Plan catalog" are kept separate,
 * per the mission's own explicit "do NOT accidentally give tenant
 * Admins permission to modify global SaaS plan definitions").
 */
export const planService = {
  async listPlans(): Promise<Plan[]> {
    const repo = await getPlanRepository();
    return repo.list();
  },

  async getPlan(id: string): Promise<Plan | null> {
    const repo = await getPlanRepository();
    return repo.findById(id);
  },

  async createPlan(rawInput: unknown, context: AuditContext = {}): Promise<PlanServiceResult<Plan>> {
    const validation = validateCreatePlanInput(rawInput);
    if (!validation.valid) return { success: false, error: { code: "validation", message: "Invalid plan.", errors: validation.errors } };

    const repo = await getPlanRepository();
    const existing = await repo.findById(validation.data.id);
    if (existing) return { success: false, error: { code: "duplicate", message: `Plan "${validation.data.id}" already exists.` } };

    const plan = await repo.create(validation.data as CreatePlanInput);
    await auditLogService.record({
      action: AUDIT_ACTIONS.PLAN_CREATED,
      entityType: "Plan",
      entityId: plan.id,
      actorId: context.actorId,
      requestId: context.requestId,
      metadata: { planId: plan.id, capabilities: plan.capabilities, billingInterval: plan.billingInterval },
    });
    return { success: true, data: plan };
  },

  async updatePlan(id: string, rawInput: unknown, context: AuditContext = {}): Promise<PlanServiceResult<Plan>> {
    const repo = await getPlanRepository();
    const existing = await repo.findById(id);
    if (!existing) return { success: false, error: { code: "not_found", message: `Plan "${id}" not found.` } };

    const validation = validateUpdatePlanInput(rawInput);
    if (!validation.valid) return { success: false, error: { code: "validation", message: "Invalid plan update.", errors: validation.errors } };

    const plan = await repo.update(id, validation.data as UpdatePlanInput);
    await auditLogService.record({
      action: AUDIT_ACTIONS.PLAN_UPDATED,
      entityType: "Plan",
      entityId: plan.id,
      actorId: context.actorId,
      requestId: context.requestId,
      metadata: { planId: plan.id, version: plan.version, changedFields: Object.keys(validation.data) },
    });
    return { success: true, data: plan };
  },
};
