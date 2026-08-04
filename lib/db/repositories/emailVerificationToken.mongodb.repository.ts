import { getConnection } from "@/lib/db/connection";
import { EmailVerificationTokenModel, toEmailVerificationToken } from "@/lib/db/models/emailVerificationToken.model";
import type { CreateEmailVerificationTokenInput, EmailVerificationTokenRepository } from "@/lib/services/auth/types";

export const mongodbEmailVerificationTokenRepository: EmailVerificationTokenRepository = {
  async create(input: CreateEmailVerificationTokenInput) {
    await getConnection();
    const doc = await EmailVerificationTokenModel.create(input);
    return toEmailVerificationToken(doc);
  },

  async findByTokenHash(tokenHash: string) {
    await getConnection();
    const doc = await EmailVerificationTokenModel.findOne({ tokenHash }).exec();
    return doc ? toEmailVerificationToken(doc) : null;
  },

  async markUsed(id: string): Promise<void> {
    await getConnection();
    await EmailVerificationTokenModel.updateOne({ _id: id }, { usedAt: new Date() }).exec();
  },

  async invalidateOutstandingForUser(userId: string): Promise<void> {
    await getConnection();
    await EmailVerificationTokenModel.updateMany({ userId, usedAt: { $exists: false } }, { usedAt: new Date() }).exec();
  },
};
