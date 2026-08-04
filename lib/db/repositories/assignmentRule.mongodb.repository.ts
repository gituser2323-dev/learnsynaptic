import { getConnection } from "@/lib/db/connection";
import { AssignmentRuleModel, toAssignmentRule } from "@/lib/db/models/assignmentRule.model";
import type { AssignmentRule, AssignmentRuleRepository, CreateAssignmentRuleInput } from "@/lib/services/crm/assignment/types";

export const mongodbAssignmentRuleRepository: AssignmentRuleRepository = {
  async getActive(): Promise<AssignmentRule | null> {
    await getConnection();
    const doc = await AssignmentRuleModel.findOne({ active: true }).sort({ createdAt: -1 }).exec();
    return doc ? toAssignmentRule(doc) : null;
  },

  async create(input: CreateAssignmentRuleInput): Promise<AssignmentRule> {
    await getConnection();
    // Only one active rule at a time — deactivate any existing one first,
    // same "single active configuration" shape as the WhatsApp provider
    // registry's own "one selected provider" model.
    await AssignmentRuleModel.updateMany({ active: true }, { $set: { active: false } }).exec();
    const doc = await AssignmentRuleModel.create({ ...input, active: true });
    return toAssignmentRule(doc);
  },

  async takeNextRoundRobinCounsellor(ruleId: string): Promise<string | null> {
    await getConnection();
    // findOneAndUpdate with $inc, default new:false, is one atomic
    // read-and-advance — the document returned is the PRE-increment
    // state, so this never has the race window a separate
    // findById()-then-updateOne() pair would (two concurrent lead
    // creations could otherwise both read the same nextIndex before
    // either write lands, handing out the same counsellor twice).
    const rule = await AssignmentRuleModel.findOneAndUpdate(
      { _id: ruleId },
      { $inc: { nextIndex: 1 } },
    ).exec();
    if (!rule || rule.counsellorIds.length === 0) return null;

    const currentIndex = rule.nextIndex % rule.counsellorIds.length;
    return rule.counsellorIds[currentIndex].toString();
  },
};
