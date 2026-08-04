import { randomUUID } from "crypto";
import type { CreateMfaEmailOtpInput, MfaEmailOtp, MfaEmailOtpRepository } from "@/lib/services/auth/types";

const store: MfaEmailOtp[] = [];

function nowIso(): string {
  return new Date().toISOString();
}

export const inMemoryMfaEmailOtpRepository: MfaEmailOtpRepository = {
  async create(input: CreateMfaEmailOtpInput): Promise<MfaEmailOtp> {
    const otp: MfaEmailOtp = { ...input, id: randomUUID(), createdAt: nowIso() };
    store.push(otp);
    return otp;
  },

  async findLatestUnusedForUser(userId: string): Promise<MfaEmailOtp | null> {
    const matches = store.filter((o) => o.userId === userId && !o.usedAt).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return matches[0] ?? null;
  },

  async markUsed(id: string): Promise<void> {
    const otp = store.find((o) => o.id === id);
    if (otp) otp.usedAt = nowIso();
  },

  async invalidateOutstandingForUser(userId: string): Promise<void> {
    for (const otp of store) {
      if (otp.userId === userId && !otp.usedAt) otp.usedAt = nowIso();
    }
  },
};
