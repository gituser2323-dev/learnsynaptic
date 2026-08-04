import { getConnection } from "@/lib/db/connection";
import { PlanModel, toPlan } from "@/lib/db/models/plan.model";
import { DuplicateKeyError, isDuplicateKeyError } from "@/lib/db/types";
import type { CreatePlanInput, Plan, PlanRepository, UpdatePlanInput } from "@/lib/services/billing/types";

export const mongodbPlanRepository: PlanRepository = {
  async findById(id: string): Promise<Plan | null> {
    await getConnection();
    const doc = await PlanModel.findById(id).exec();
    return doc ? toPlan(doc) : null;
  },

  async list(): Promise<Plan[]> {
    await getConnection();
    const docs = await PlanModel.find({}).sort({ basePriceInSmallestUnit: 1 }).exec();
    return docs.map(toPlan);
  },

  async create(input: CreatePlanInput): Promise<Plan> {
    await getConnection();
    try {
      const doc = await PlanModel.create({
        _id: input.id,
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
      });
      return toPlan(doc);
    } catch (error) {
      if (isDuplicateKeyError(error)) throw new DuplicateKeyError("Plan", { id: input.id });
      throw error;
    }
  },

  async update(id: string, input: UpdatePlanInput): Promise<Plan> {
    await getConnection();
    const update: Record<string, unknown> = { ...input };
    // Every real edit bumps `version` — see types.ts's own doc comment
    // on why this is provenance, not a resolution key.
    const doc = await PlanModel.findByIdAndUpdate(id, { $set: update, $inc: { version: 1 } }, { new: true }).exec();
    if (!doc) throw new Error(`Plan "${id}" not found`);
    return toPlan(doc);
  },
};
