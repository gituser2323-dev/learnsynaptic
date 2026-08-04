import { getConnection } from "@/lib/db/connection";
import { PasswordResetTokenModel, toPasswordResetToken } from "@/lib/db/models/passwordResetToken.model";
import type { CreatePasswordResetTokenInput, PasswordResetTokenRepository } from "@/lib/services/auth/types";

export const mongodbPasswordResetTokenRepository: PasswordResetTokenRepository = {
  async create(input: CreatePasswordResetTokenInput) {
    await getConnection();
    const doc = await PasswordResetTokenModel.create(input);
    return toPasswordResetToken(doc);
  },

  async findByTokenHash(tokenHash: string) {
    await getConnection();
    const doc = await PasswordResetTokenModel.findOne({ tokenHash }).exec();
    return doc ? toPasswordResetToken(doc) : null;
  },

  async markUsed(id: string): Promise<void> {
    await getConnection();
    await PasswordResetTokenModel.updateOne({ _id: id }, { usedAt: new Date() }).exec();
  },

  async invalidateOutstandingForUser(userId: string): Promise<void> {
    await getConnection();
    await PasswordResetTokenModel.updateMany({ userId, usedAt: { $exists: false } }, { usedAt: new Date() }).exec();
  },
};
