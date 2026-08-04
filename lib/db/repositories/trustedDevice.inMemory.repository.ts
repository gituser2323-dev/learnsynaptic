import { randomUUID } from "crypto";
import type { CreateTrustedDeviceInput, TrustedDevice, TrustedDeviceRepository } from "@/lib/services/auth/types";

const store: TrustedDevice[] = [];

function nowIso(): string {
  return new Date().toISOString();
}

export const inMemoryTrustedDeviceRepository: TrustedDeviceRepository = {
  async create(input: CreateTrustedDeviceInput): Promise<TrustedDevice> {
    const device: TrustedDevice = { ...input, id: randomUUID(), createdAt: nowIso() };
    store.push(device);
    return device;
  },

  async findByTokenHash(tokenHash: string): Promise<TrustedDevice | null> {
    return store.find((d) => d.deviceTokenHash === tokenHash) ?? null;
  },

  async touchLastUsed(id: string): Promise<void> {
    const device = store.find((d) => d.id === id);
    if (device) device.lastUsedAt = nowIso();
  },

  async listByUserId(userId: string): Promise<TrustedDevice[]> {
    return store.filter((d) => d.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async revoke(id: string): Promise<void> {
    const index = store.findIndex((d) => d.id === id);
    if (index !== -1) store.splice(index, 1);
  },

  async revokeAllForUser(userId: string): Promise<void> {
    for (let i = store.length - 1; i >= 0; i--) {
      if (store[i]!.userId === userId) store.splice(i, 1);
    }
  },
};
