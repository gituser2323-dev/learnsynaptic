import { getConnection } from "@/lib/db/connection";
import { AutoReplyRuleModel, toAutoReplyRule } from "@/lib/db/models/autoReplyRule.model";
import type {
  AutoReplyRule,
  AutoReplyRuleRepository,
  CreateAutoReplyRuleInput,
  UpdateAutoReplyRuleInput,
} from "@/lib/services/automation/autoReply/types";

export const mongodbAutoReplyRuleRepository: AutoReplyRuleRepository = {
  async create(input: CreateAutoReplyRuleInput): Promise<AutoReplyRule> {
    await getConnection();
    const doc = await AutoReplyRuleModel.create({
      keywords: input.keywords,
      replyText: input.replyText,
      isFallback: input.isFallback ?? false,
      active: input.active ?? true,
      organizationId: input.organizationId,
    });
    return toAutoReplyRule(doc);
  },

  async findById(id: string): Promise<AutoReplyRule | null> {
    await getConnection();
    const doc = await AutoReplyRuleModel.findById(id).exec();
    return doc ? toAutoReplyRule(doc) : null;
  },

  async list(): Promise<AutoReplyRule[]> {
    await getConnection();
    const docs = await AutoReplyRuleModel.find({}).sort({ createdAt: 1 }).exec();
    return docs.map(toAutoReplyRule);
  },

  async listActive(): Promise<AutoReplyRule[]> {
    await getConnection();
    const docs = await AutoReplyRuleModel.find({ active: true }).sort({ createdAt: 1 }).exec();
    return docs.map(toAutoReplyRule);
  },

  async update(id: string, patch: UpdateAutoReplyRuleInput): Promise<AutoReplyRule> {
    await getConnection();
    const doc = await AutoReplyRuleModel.findByIdAndUpdate(id, patch, { new: true }).exec();
    if (!doc) throw new Error(`AutoReplyRule ${id} not found`);
    return toAutoReplyRule(doc);
  },

  async delete(id: string): Promise<void> {
    await getConnection();
    await AutoReplyRuleModel.findByIdAndDelete(id).exec();
  },
};
