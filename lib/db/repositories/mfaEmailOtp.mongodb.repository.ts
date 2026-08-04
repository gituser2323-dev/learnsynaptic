import { getConnection } from "@/lib/db/connection";
import { MfaEmailOtpModel, toMfaEmailOtp } from "@/lib/db/models/mfaEmailOtp.model";
import type { CreateMfaEmailOtpInput, MfaEmailOtpRepository } from "@/lib/services/auth/types";

export const mongodbMfaEmailOtpRepository: MfaEmailOtpRepository = {
  async create(input: CreateMfaEmailOtpInput) {
    await getConnection();
    const doc = await MfaEmailOtpModel.create(input);
    return toMfaEmailOtp(doc);
  },

  async findLatestUnusedForUser(userId: string) {
    await getConnection();
    const doc = await MfaEmailOtpModel.findOne({ userId, usedAt: { $exists: false } }).sort({ createdAt: -1 }).exec();
    return doc ? toMfaEmailOtp(doc) : null;
  },

  async markUsed(id: string): Promise<void> {
    await getConnection();
    await MfaEmailOtpModel.updateOne({ _id: id }, { usedAt: new Date() }).exec();
  },

  async invalidateOutstandingForUser(userId: string): Promise<void> {
    await getConnection();
    await MfaEmailOtpModel.updateMany({ userId, usedAt: { $exists: false } }, { usedAt: new Date() }).exec();
  },
};
