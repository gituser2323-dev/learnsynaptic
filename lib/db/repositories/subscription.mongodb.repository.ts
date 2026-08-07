import { getConnection } from "@/lib/db/connection";
import { SubscriptionModel, toSubscription } from "@/lib/db/models/subscription.model";
import { DuplicateKeyError, isDuplicateKeyError } from "@/lib/db/types";
import type { CreateSubscriptionInput, Subscription, SubscriptionRepository, UpdateSubscriptionInput } from "@/lib/services/billing/types";

export const mongodbSubscriptionRepository: SubscriptionRepository = {
  async findByOrganizationId(organizationId: string): Promise<Subscription | null> {
    await getConnection();
    const doc = await SubscriptionModel.findOne({ organizationId }).exec();
    return doc ? toSubscription(doc) : null;
  },

  async create(input: CreateSubscriptionInput): Promise<Subscription> {
    await getConnection();
    try {
      const doc = await SubscriptionModel.create({
        organizationId: input.organizationId,
        planId: input.planId,
        status: input.status,
        startedAt: new Date(input.startedAt),
        currentPeriodStart: new Date(input.currentPeriodStart),
        currentPeriodEnd: new Date(input.currentPeriodEnd),
        trialEndsAt: input.trialEndsAt ? new Date(input.trialEndsAt) : undefined,
        providerRef: input.providerRef,
        metadata: input.metadata,
      });
      return toSubscription(doc);
    } catch (error) {
      if (isDuplicateKeyError(error)) throw new DuplicateKeyError("Subscription", { organizationId: input.organizationId });
      throw error;
    }
  },

  async update(organizationId: string, input: UpdateSubscriptionInput): Promise<Subscription> {
    await getConnection();
    const set: Record<string, unknown> = {};
    const unset: Record<string, unknown> = {};
    if (input.planId !== undefined) set.planId = input.planId;
    if (input.status !== undefined) set.status = input.status;
    if (input.currentPeriodStart !== undefined) set.currentPeriodStart = new Date(input.currentPeriodStart);
    if (input.currentPeriodEnd !== undefined) set.currentPeriodEnd = new Date(input.currentPeriodEnd);
    if (input.trialEndsAt !== undefined) set.trialEndsAt = new Date(input.trialEndsAt);
    if (input.cancelledAt !== undefined) set.cancelledAt = new Date(input.cancelledAt);
    if (input.providerRef !== undefined) set.providerRef = input.providerRef;
    if (input.metadata !== undefined) set.metadata = input.metadata;
    if (input.cancelAt === null) unset.cancelAt = "";
    else if (input.cancelAt !== undefined) set.cancelAt = new Date(input.cancelAt);
    if (input.capabilityOverrides === null) unset.capabilityOverrides = "";
    else if (input.capabilityOverrides !== undefined) set.capabilityOverrides = input.capabilityOverrides;
    if (input.limitOverrides === null) unset.limitOverrides = "";
    else if (input.limitOverrides !== undefined) set.limitOverrides = input.limitOverrides;

    const update: Record<string, unknown> = {};
    if (Object.keys(set).length > 0) update.$set = set;
    if (Object.keys(unset).length > 0) update.$unset = unset;

    const doc = await SubscriptionModel.findOneAndUpdate({ organizationId }, update, { new: true }).exec();
    if (!doc) throw new Error(`Subscription for organization "${organizationId}" not found`);
    return toSubscription(doc);
  },

  async findAll(): Promise<Subscription[]> {
    await getConnection();
    const docs = await SubscriptionModel.find({}).exec();
    return docs.map(toSubscription);
  },
};
