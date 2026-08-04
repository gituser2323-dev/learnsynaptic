import { getConnection } from "@/lib/db/connection";
import { UsageCounterModel, toUsageCounter } from "@/lib/db/models/usageCounter.model";
import type { UsageCounter, UsageCounterRepository, UsageMetric } from "@/lib/services/billing/types";

export const mongodbUsageCounterRepository: UsageCounterRepository = {
  async find(organizationId: string, metric: UsageMetric, period: string): Promise<UsageCounter | null> {
    await getConnection();
    const doc = await UsageCounterModel.findOne({ organizationId, metric, period }).exec();
    return doc ? toUsageCounter(doc) : null;
  },

  async listForOrganization(organizationId: string, period: string): Promise<UsageCounter[]> {
    await getConnection();
    const docs = await UsageCounterModel.find({ organizationId, period }).exec();
    return docs.map(toUsageCounter);
  },

  /** The one real atomic primitive this repository exists for — a
   *  single `findOneAndUpdate`+`$inc`+`upsert`, never a read followed
   *  by a separate write. MongoDB applies `$inc` to a single document
   *  atomically regardless of how many concurrent callers race this
   *  same call — see `usageService.ts`'s own doc comment for how this
   *  becomes a real concurrency-safe limit check. */
  async incrementAndGet(organizationId: string, metric: UsageMetric, period: string, delta: number): Promise<UsageCounter> {
    await getConnection();
    const doc = await UsageCounterModel.findOneAndUpdate(
      { organizationId, metric, period },
      { $inc: { count: delta } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).exec();
    return toUsageCounter(doc);
  },
};
