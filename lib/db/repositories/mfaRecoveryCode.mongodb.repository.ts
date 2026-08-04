import { getConnection } from "@/lib/db/connection";
import { MfaRecoveryCodeModel, toMfaRecoveryCode } from "@/lib/db/models/mfaRecoveryCode.model";
import type { CreateMfaRecoveryCodeInput, MfaRecoveryCodeRepository } from "@/lib/services/auth/types";

export const mongodbMfaRecoveryCodeRepository: MfaRecoveryCodeRepository = {
  async createMany(inputs: CreateMfaRecoveryCodeInput[]) {
    await getConnection();
    // .create() (not insertMany) — returns properly-typed hydrated
    // documents matching MfaRecoveryCodeDocument directly, avoiding a
    // real Mongoose generic-inference mismatch insertMany's own typings
    // produce here (its return type intersects with the plain input
    // shape, which disagrees with MfaRecoveryCodeDocument's own
    // ObjectId-typed userId).
    const docs = await MfaRecoveryCodeModel.create(inputs);
    return docs.map(toMfaRecoveryCode);
  },

  async findUnusedByUserId(userId: string) {
    await getConnection();
    const docs = await MfaRecoveryCodeModel.find({ userId, usedAt: { $exists: false } }).exec();
    return docs.map(toMfaRecoveryCode);
  },

  async markUsed(id: string): Promise<void> {
    await getConnection();
    await MfaRecoveryCodeModel.updateOne({ _id: id }, { usedAt: new Date() }).exec();
  },

  async deleteAllForUser(userId: string): Promise<void> {
    await getConnection();
    await MfaRecoveryCodeModel.deleteMany({ userId }).exec();
  },
};
