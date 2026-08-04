import { randomUUID } from "crypto";
import type { UsageCounter, UsageCounterRepository, UsageMetric } from "@/lib/services/billing/types";

const store: UsageCounter[] = [];

function nowIso(): string {
  return new Date().toISOString();
}

export const inMemoryUsageCounterRepository: UsageCounterRepository = {
  async find(organizationId: string, metric: UsageMetric, period: string): Promise<UsageCounter | null> {
    return store.find((u) => u.organizationId === organizationId && u.metric === metric && u.period === period) ?? null;
  },

  async listForOrganization(organizationId: string, period: string): Promise<UsageCounter[]> {
    return store.filter((u) => u.organizationId === organizationId && u.period === period);
  },

  /** No real concurrency exists in this single-threaded in-memory store
   *  (Node's event loop never preempts mid-synchronous-block), so a
   *  plain synchronous find-or-create + mutate is genuinely atomic
   *  here — no `await` appears between the read and the write, the
   *  same reasoning every other in-memory repository in this app
   *  relies on for its own "no real race condition possible" safety. */
  async incrementAndGet(organizationId: string, metric: UsageMetric, period: string, delta: number): Promise<UsageCounter> {
    const existing = store.find((u) => u.organizationId === organizationId && u.metric === metric && u.period === period);
    if (existing) {
      existing.count += delta;
      existing.updatedAt = nowIso();
      return existing;
    }
    const now = nowIso();
    const counter: UsageCounter = { id: randomUUID(), organizationId, metric, period, count: delta, createdAt: now, updatedAt: now };
    store.push(counter);
    return counter;
  },
};
