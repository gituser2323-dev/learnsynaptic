import { getConnection } from "@/lib/db/connection";
import { PhoneNumberModel, toPhoneNumberRecord } from "@/lib/db/models/phoneNumber.model";
import type {
  PhoneNumberRepository,
  UpsertPhoneNumberHealthInput,
  WhatsAppPhoneNumberRecord,
} from "@/lib/services/whatsapp/phoneNumbers/types";

export const mongodbPhoneNumberRepository: PhoneNumberRepository = {
  async upsertHealth(input: UpsertPhoneNumberHealthInput): Promise<WhatsAppPhoneNumberRecord> {
    await getConnection();
    const doc = await PhoneNumberModel.findOneAndUpdate(
      { phoneNumberId: input.phoneNumberId },
      { ...input, lastCheckedAt: new Date() },
      { new: true, upsert: true },
    ).exec();
    return toPhoneNumberRecord(doc);
  },

  async list(): Promise<WhatsAppPhoneNumberRecord[]> {
    await getConnection();
    const docs = await PhoneNumberModel.find({}).exec();
    return docs.map(toPhoneNumberRecord);
  },

  /** Business OS Phase 8, Module 8.5 — deliberately passes
   *  `skipTenantScope` so this resolves regardless of which (if any)
   *  tenant context is active, the same escape hatch authService's own
   *  cross-organization user lookup already established (see
   *  tenantScopePlugin.ts's own doc comment) — this is the one other
   *  genuine "discover the org, don't assume it" read path in the app. */
  async findByPhoneNumberId(phoneNumberId: string): Promise<WhatsAppPhoneNumberRecord | null> {
    await getConnection();
    const doc = await PhoneNumberModel.findOne({ phoneNumberId }).setOptions({ skipTenantScope: true }).exec();
    return doc ? toPhoneNumberRecord(doc) : null;
  },

  async clearOrganization(phoneNumberId: string): Promise<void> {
    await getConnection();
    await PhoneNumberModel.updateOne({ phoneNumberId }, { $unset: { organizationId: 1 } }).setOptions({ skipTenantScope: true }).exec();
  },
};
