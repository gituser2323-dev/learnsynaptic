import { getConnection } from "@/lib/db/connection";
import { RefreshTokenModel, toRefreshTokenRecord } from "@/lib/db/models/refreshToken.model";
import type { CreateRefreshTokenInput, RefreshTokenRepository } from "@/lib/services/auth/types";

export const mongodbRefreshTokenRepository: RefreshTokenRepository = {
  async create(input: CreateRefreshTokenInput) {
    await getConnection();
    const doc = await RefreshTokenModel.create(input);
    return toRefreshTokenRecord(doc);
  },

  async findByTokenHash(tokenHash: string) {
    await getConnection();
    const doc = await RefreshTokenModel.findOne({ tokenHash }).exec();
    return doc ? toRefreshTokenRecord(doc) : null;
  },

  async revoke(id: string): Promise<void> {
    await getConnection();
    await RefreshTokenModel.updateOne({ _id: id }, { revokedAt: new Date() }).exec();
  },

  async revokeFamily(familyId: string): Promise<void> {
    await getConnection();
    await RefreshTokenModel.updateMany(
      { familyId, revokedAt: { $exists: false } },
      { revokedAt: new Date() },
    ).exec();
  },

  async listByUserId(userId: string) {
    await getConnection();
    const docs = await RefreshTokenModel.find({ userId }).sort({ createdAt: -1 }).exec();
    return docs.map(toRefreshTokenRecord);
  },

  async revokeAllForUser(userId: string, exceptId?: string): Promise<void> {
    await getConnection();
    const filter: Record<string, unknown> = { userId, revokedAt: { $exists: false } };
    if (exceptId) filter._id = { $ne: exceptId };
    await RefreshTokenModel.updateMany(filter, { revokedAt: new Date() }).exec();
  },

  async touchLastUsed(id: string): Promise<void> {
    await getConnection();
    await RefreshTokenModel.updateOne({ _id: id }, { lastUsedAt: new Date() }).exec();
  },
};
