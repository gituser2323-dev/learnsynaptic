import { getPhoneNumberRepository } from "@/lib/db";
import type { UpsertPhoneNumberHealthInput, WhatsAppPhoneNumberRecord } from "./types";

export const phoneNumberService = {
  async upsertHealth(input: UpsertPhoneNumberHealthInput): Promise<WhatsAppPhoneNumberRecord> {
    const repository = await getPhoneNumberRepository();
    return repository.upsertHealth(input);
  },

  async listPhoneNumbers(): Promise<WhatsAppPhoneNumberRecord[]> {
    const repository = await getPhoneNumberRepository();
    return repository.list();
  },

  /** Business OS Phase 8, Module 8.5 — the one call site
   *  app/api/webhooks/whatsapp/route.ts uses to resolve which
   *  organization an inbound webhook belongs to, before establishing
   *  tenant context for the rest of that webhook's processing. */
  async findByPhoneNumberId(phoneNumberId: string): Promise<WhatsAppPhoneNumberRecord | null> {
    const repository = await getPhoneNumberRepository();
    return repository.findByPhoneNumberId(phoneNumberId);
  },
};
