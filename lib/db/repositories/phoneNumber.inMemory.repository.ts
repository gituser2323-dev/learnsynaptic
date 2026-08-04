import { randomUUID } from "crypto";
import { scopeToTenant, findOwnedByTenant, stampTenant } from "@/lib/db/inMemoryTenantScope";
import type {
  PhoneNumberRepository,
  UpsertPhoneNumberHealthInput,
  WhatsAppPhoneNumberRecord,
} from "@/lib/services/whatsapp/phoneNumbers/types";

const store: WhatsAppPhoneNumberRecord[] = [];

export const inMemoryPhoneNumberRepository: PhoneNumberRepository = {
  async upsertHealth(input: UpsertPhoneNumberHealthInput): Promise<WhatsAppPhoneNumberRecord> {
    const existing = findOwnedByTenant(store, (p) => p.phoneNumberId === input.phoneNumberId);
    const lastCheckedAt = new Date().toISOString();
    if (existing) {
      Object.assign(existing, input, { lastCheckedAt });
      return existing;
    }
    const record: WhatsAppPhoneNumberRecord = stampTenant<WhatsAppPhoneNumberRecord>({ ...input, id: randomUUID(), lastCheckedAt });
    store.push(record);
    return record;
  },

  async list(): Promise<WhatsAppPhoneNumberRecord[]> {
    return scopeToTenant(store);
  },

  /** Business OS Phase 8, Module 8.5 — deliberately bypasses tenant
   *  scoping (a plain array search, not `scopeToTenant`/`findOwnedByTenant`)
   *  since this is the webhook-routing lookup, which must resolve
   *  regardless of ambient context — see the Mongo repo's own doc
   *  comment and the type's own doc comment for why this is safe. */
  async findByPhoneNumberId(phoneNumberId: string): Promise<WhatsAppPhoneNumberRecord | null> {
    return store.find((p) => p.phoneNumberId === phoneNumberId) ?? null;
  },

  async clearOrganization(phoneNumberId: string): Promise<void> {
    const existing = store.find((p) => p.phoneNumberId === phoneNumberId);
    if (existing) delete existing.organizationId;
  },
};
