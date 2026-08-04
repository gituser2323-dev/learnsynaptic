import { PLAN_CAPABILITIES, USAGE_METRICS } from "./types";
import type { PlanCapability, PlanLimits, UsageMetric } from "./types";

export interface BillingValidationError {
  field: string;
  message: string;
}

const ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,63}$/;
const PLAN_STATUSES = ["active", "archived", "draft"] as const;
const BILLING_INTERVALS = ["monthly", "yearly", "one_time", "internal"] as const;

function isPlanCapability(value: unknown): value is PlanCapability {
  return typeof value === "string" && (PLAN_CAPABILITIES as readonly string[]).includes(value);
}

function isUsageMetric(value: unknown): value is UsageMetric {
  return typeof value === "string" && (USAGE_METRICS as readonly string[]).includes(value);
}

export function validateCapabilities(value: unknown): { valid: true; data: PlanCapability[] } | { valid: false; errors: BillingValidationError[] } {
  if (!Array.isArray(value)) return { valid: false, errors: [{ field: "capabilities", message: "capabilities must be an array." }] };
  const invalid = value.filter((v) => !isPlanCapability(v));
  if (invalid.length > 0) {
    return { valid: false, errors: [{ field: "capabilities", message: `Unknown capability id(s): ${invalid.join(", ")}.` }] };
  }
  return { valid: true, data: [...new Set(value as PlanCapability[])] };
}

export function validateLimits(value: unknown): { valid: true; data: PlanLimits } | { valid: false; errors: BillingValidationError[] } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { valid: false, errors: [{ field: "limits", message: "limits must be an object." }] };
  }
  const entries = Object.entries(value as Record<string, unknown>);
  const errors: BillingValidationError[] = [];
  const data: PlanLimits = {};
  for (const [key, raw] of entries) {
    if (!isUsageMetric(key)) {
      errors.push({ field: `limits.${key}`, message: `Unknown usage metric "${key}".` });
      continue;
    }
    if (raw !== null && (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0)) {
      errors.push({ field: `limits.${key}`, message: "A limit must be null (unlimited) or a non-negative number." });
      continue;
    }
    data[key] = raw as number | null;
  }
  if (errors.length > 0) return { valid: false, errors };
  return { valid: true, data };
}

export function validateCreatePlanInput(body: unknown): { valid: true; data: import("./types").CreatePlanInput } | { valid: false; errors: BillingValidationError[] } {
  if (typeof body !== "object" || body === null) return { valid: false, errors: [{ field: "root", message: "Request body must be an object." }] };
  const b = body as Record<string, unknown>;
  const errors: BillingValidationError[] = [];

  if (typeof b.id !== "string" || !ID_PATTERN.test(b.id)) {
    errors.push({ field: "id", message: "id must be a lowercase-kebab-case slug, 2-64 characters." });
  }
  if (typeof b.name !== "string" || !b.name.trim()) errors.push({ field: "name", message: "name is required." });
  if (typeof b.description !== "string" || !b.description.trim()) errors.push({ field: "description", message: "description is required." });
  if (b.status !== undefined && !(PLAN_STATUSES as readonly string[]).includes(b.status as string)) {
    errors.push({ field: "status", message: `status must be one of: ${PLAN_STATUSES.join(", ")}.` });
  }
  if (typeof b.billingInterval !== "string" || !(BILLING_INTERVALS as readonly string[]).includes(b.billingInterval)) {
    errors.push({ field: "billingInterval", message: `billingInterval must be one of: ${BILLING_INTERVALS.join(", ")}.` });
  }
  if (typeof b.currency !== "string" || b.currency.trim().length !== 3) {
    errors.push({ field: "currency", message: "currency must be a 3-letter ISO 4217 code." });
  }
  if (typeof b.basePriceInSmallestUnit !== "number" || b.basePriceInSmallestUnit < 0) {
    errors.push({ field: "basePriceInSmallestUnit", message: "basePriceInSmallestUnit must be a non-negative number." });
  }
  if (b.trialDays !== undefined && (typeof b.trialDays !== "number" || b.trialDays < 0)) {
    errors.push({ field: "trialDays", message: "trialDays must be a non-negative number." });
  }

  const capabilities = validateCapabilities(b.capabilities ?? []);
  if (!capabilities.valid) errors.push(...capabilities.errors);
  const limits = validateLimits(b.limits ?? {});
  if (!limits.valid) errors.push(...limits.errors);

  if (errors.length > 0) return { valid: false, errors };

  return {
    valid: true,
    data: {
      id: b.id as string,
      name: (b.name as string).trim(),
      description: (b.description as string).trim(),
      status: b.status as import("./types").PlanStatus | undefined,
      billingInterval: b.billingInterval as import("./types").BillingInterval,
      currency: (b.currency as string).trim().toUpperCase(),
      basePriceInSmallestUnit: b.basePriceInSmallestUnit as number,
      capabilities: capabilities.valid ? capabilities.data : [],
      limits: limits.valid ? limits.data : {},
      trialDays: (b.trialDays as number | undefined) ?? 0,
      metadata: typeof b.metadata === "object" && b.metadata !== null ? (b.metadata as Record<string, string>) : undefined,
    },
  };
}

export function validateUpdatePlanInput(body: unknown): { valid: true; data: import("./types").UpdatePlanInput } | { valid: false; errors: BillingValidationError[] } {
  if (typeof body !== "object" || body === null) return { valid: false, errors: [{ field: "root", message: "Request body must be an object." }] };
  const b = body as Record<string, unknown>;
  const errors: BillingValidationError[] = [];
  const data: import("./types").UpdatePlanInput = {};

  if (b.name !== undefined) {
    if (typeof b.name !== "string" || !b.name.trim()) errors.push({ field: "name", message: "name must be a non-empty string." });
    else data.name = b.name.trim();
  }
  if (b.description !== undefined) {
    if (typeof b.description !== "string" || !b.description.trim()) errors.push({ field: "description", message: "description must be a non-empty string." });
    else data.description = b.description.trim();
  }
  if (b.status !== undefined) {
    if (!(PLAN_STATUSES as readonly string[]).includes(b.status as string)) errors.push({ field: "status", message: `status must be one of: ${PLAN_STATUSES.join(", ")}.` });
    else data.status = b.status as import("./types").PlanStatus;
  }
  if (b.billingInterval !== undefined) {
    if (!(BILLING_INTERVALS as readonly string[]).includes(b.billingInterval as string)) errors.push({ field: "billingInterval", message: `billingInterval must be one of: ${BILLING_INTERVALS.join(", ")}.` });
    else data.billingInterval = b.billingInterval as import("./types").BillingInterval;
  }
  if (b.currency !== undefined) {
    if (typeof b.currency !== "string" || b.currency.trim().length !== 3) errors.push({ field: "currency", message: "currency must be a 3-letter ISO 4217 code." });
    else data.currency = b.currency.trim().toUpperCase();
  }
  if (b.basePriceInSmallestUnit !== undefined) {
    if (typeof b.basePriceInSmallestUnit !== "number" || b.basePriceInSmallestUnit < 0) errors.push({ field: "basePriceInSmallestUnit", message: "basePriceInSmallestUnit must be a non-negative number." });
    else data.basePriceInSmallestUnit = b.basePriceInSmallestUnit;
  }
  if (b.trialDays !== undefined) {
    if (typeof b.trialDays !== "number" || b.trialDays < 0) errors.push({ field: "trialDays", message: "trialDays must be a non-negative number." });
    else data.trialDays = b.trialDays;
  }
  if (b.capabilities !== undefined) {
    const capabilities = validateCapabilities(b.capabilities);
    if (!capabilities.valid) errors.push(...capabilities.errors);
    else data.capabilities = capabilities.data;
  }
  if (b.limits !== undefined) {
    const limits = validateLimits(b.limits);
    if (!limits.valid) errors.push(...limits.errors);
    else data.limits = limits.data;
  }
  if (b.metadata !== undefined) {
    if (typeof b.metadata !== "object" || b.metadata === null) errors.push({ field: "metadata", message: "metadata must be an object." });
    else data.metadata = b.metadata as Record<string, string>;
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true, data };
}
