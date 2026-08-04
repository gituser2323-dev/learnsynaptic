import { randomUUID } from "crypto";
import { DuplicateKeyError } from "@/lib/db/types";
import type { CreateSubscriptionInput, Subscription, SubscriptionRepository, UpdateSubscriptionInput } from "@/lib/services/billing/types";

const store: Subscription[] = [];

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Business OS Phase 8, Module 8.3 — every method here takes
 * `organizationId` as an explicit argument and matches on it directly,
 * the same "safe to call from anywhere, trust the argument, don't
 * depend on ambient AsyncLocalStorage state" pattern
 * `credentialResolver.ts` (Module 8.2) established: `subscriptionService`
 * always resolves a real organizationId (from tenant context or an
 * explicit background-job value) before calling here, so isolation
 * comes from that trusted argument, not from re-deriving ambient
 * context inside the repository.
 */
export const inMemorySubscriptionRepository: SubscriptionRepository = {
  async findByOrganizationId(organizationId: string): Promise<Subscription | null> {
    return store.find((s) => s.organizationId === organizationId) ?? null;
  },

  async create(input: CreateSubscriptionInput): Promise<Subscription> {
    if (store.some((s) => s.organizationId === input.organizationId)) {
      throw new DuplicateKeyError("Subscription", { organizationId: input.organizationId });
    }
    const now = nowIso();
    const subscription: Subscription = {
      id: randomUUID(),
      organizationId: input.organizationId,
      planId: input.planId,
      status: input.status,
      startedAt: input.startedAt,
      currentPeriodStart: input.currentPeriodStart,
      currentPeriodEnd: input.currentPeriodEnd,
      trialEndsAt: input.trialEndsAt,
      providerRef: input.providerRef,
      metadata: input.metadata,
      createdAt: now,
      updatedAt: now,
    };
    store.push(subscription);
    return subscription;
  },

  async update(organizationId: string, input: UpdateSubscriptionInput): Promise<Subscription> {
    const subscription = store.find((s) => s.organizationId === organizationId);
    if (!subscription) throw new Error(`Subscription for organization "${organizationId}" not found`);
    if (input.cancelAt === null) delete subscription.cancelAt;
    const { cancelAt, ...rest } = input;
    Object.assign(subscription, rest, cancelAt !== undefined && cancelAt !== null ? { cancelAt } : {}, { updatedAt: nowIso() });
    return subscription;
  },

  async findAll(): Promise<Subscription[]> {
    return [...store];
  },
};
