import { DuplicateKeyError } from "@/lib/db/types";
import type { CreatePlanInput, Plan, PlanRepository, UpdatePlanInput } from "@/lib/services/billing/types";

const store: Plan[] = [];

function nowIso(): string {
  return new Date().toISOString();
}

export const inMemoryPlanRepository: PlanRepository = {
  async findById(id: string): Promise<Plan | null> {
    return store.find((p) => p.id === id) ?? null;
  },

  async list(): Promise<Plan[]> {
    return [...store].sort((a, b) => a.basePriceInSmallestUnit - b.basePriceInSmallestUnit);
  },

  async create(input: CreatePlanInput): Promise<Plan> {
    if (store.some((p) => p.id === input.id)) throw new DuplicateKeyError("Plan", { id: input.id });
    const now = nowIso();
    const plan: Plan = {
      id: input.id,
      name: input.name,
      description: input.description,
      status: input.status ?? "draft",
      billingInterval: input.billingInterval,
      currency: input.currency,
      basePriceInSmallestUnit: input.basePriceInSmallestUnit,
      capabilities: input.capabilities,
      limits: input.limits,
      trialDays: input.trialDays ?? 0,
      metadata: input.metadata,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    store.push(plan);
    return plan;
  },

  async update(id: string, input: UpdatePlanInput): Promise<Plan> {
    const plan = store.find((p) => p.id === id);
    if (!plan) throw new Error(`Plan "${id}" not found`);
    Object.assign(plan, input, { version: plan.version + 1, updatedAt: nowIso() });
    return plan;
  },
};
