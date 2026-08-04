import { getConnection } from "@/lib/db/connection";
import { MessageAttemptModel, toMessageAttempt } from "@/lib/db/models/messageAttempt.model";
import type { CreateMessageAttemptInput, MessageAttempt, MessageAttemptRepository } from "@/lib/services/whatsappCampaigns/types";

export const mongodbMessageAttemptRepository: MessageAttemptRepository = {
  async create(input: CreateMessageAttemptInput): Promise<MessageAttempt> {
    await getConnection();
    const doc = await MessageAttemptModel.create({ ...input, attemptedAt: new Date() });
    return toMessageAttempt(doc);
  },

  async findByMessage(messageId: string): Promise<MessageAttempt[]> {
    await getConnection();
    const docs = await MessageAttemptModel.find({ messageId }).sort({ attemptNumber: 1 }).exec();
    return docs.map(toMessageAttempt);
  },
};
