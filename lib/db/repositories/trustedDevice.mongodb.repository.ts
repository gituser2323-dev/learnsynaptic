import { getConnection } from "@/lib/db/connection";
import { TrustedDeviceModel, toTrustedDevice } from "@/lib/db/models/trustedDevice.model";
import type { CreateTrustedDeviceInput, TrustedDeviceRepository } from "@/lib/services/auth/types";

export const mongodbTrustedDeviceRepository: TrustedDeviceRepository = {
  async create(input: CreateTrustedDeviceInput) {
    await getConnection();
    const doc = await TrustedDeviceModel.create(input);
    return toTrustedDevice(doc);
  },

  async findByTokenHash(tokenHash: string) {
    await getConnection();
    const doc = await TrustedDeviceModel.findOne({ deviceTokenHash: tokenHash }).exec();
    return doc ? toTrustedDevice(doc) : null;
  },

  async touchLastUsed(id: string): Promise<void> {
    await getConnection();
    await TrustedDeviceModel.updateOne({ _id: id }, { lastUsedAt: new Date() }).exec();
  },

  async listByUserId(userId: string) {
    await getConnection();
    const docs = await TrustedDeviceModel.find({ userId }).sort({ createdAt: -1 }).exec();
    return docs.map(toTrustedDevice);
  },

  async revoke(id: string): Promise<void> {
    await getConnection();
    await TrustedDeviceModel.deleteOne({ _id: id }).exec();
  },

  async revokeAllForUser(userId: string): Promise<void> {
    await getConnection();
    await TrustedDeviceModel.deleteMany({ userId }).exec();
  },
};
