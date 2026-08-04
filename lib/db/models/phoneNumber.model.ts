import { Schema, model, models, Types, type Document, type Model } from "mongoose";
import type { WhatsAppPhoneNumberRecord } from "@/lib/services/whatsapp/phoneNumbers/types";
import { tenantScopePlugin } from "@/lib/db/tenantScopePlugin";

export interface PhoneNumberDocument extends Document {
  phoneNumberId: string;
  displayPhoneNumber?: string;
  qualityRating: string;
  messagingLimit?: string;
  lastCheckedAt: Date;
  /** Business OS Phase 8, Module 8.5 — WABA + verification status,
   *  discovered at Embedded Signup time (or left unset for this
   *  deployment's own pre-8.5 default/env-configured number). */
  wabaId?: string;
  verificationStatus?: string;
  /** Business OS Phase 8, Module 8.1 — added retroactively; this model
   *  predates every other model's own Phase 0 organizationId
   *  scaffolding. As of Module 8.5, this is the real per-tenant
   *  ownership field for a self-service-connected number — see
   *  phoneNumberService's own doc comment on the routing lookup this
   *  enables. */
  organizationId?: Types.ObjectId;
}

const phoneNumberSchema = new Schema<PhoneNumberDocument>({
  phoneNumberId: { type: String, required: true, unique: true },
  displayPhoneNumber: { type: String },
  qualityRating: { type: String, enum: ["green", "yellow", "red", "unknown"], default: "unknown" },
  messagingLimit: { type: String },
  lastCheckedAt: { type: Date, required: true },
  wabaId: { type: String },
  verificationStatus: { type: String, enum: ["verified", "not_verified", "unknown"] },
  organizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
});

phoneNumberSchema.plugin(tenantScopePlugin);

export function toPhoneNumberRecord(doc: PhoneNumberDocument): WhatsAppPhoneNumberRecord {
  return {
    id: doc._id.toString(),
    phoneNumberId: doc.phoneNumberId,
    displayPhoneNumber: doc.displayPhoneNumber,
    qualityRating: doc.qualityRating as WhatsAppPhoneNumberRecord["qualityRating"],
    messagingLimit: doc.messagingLimit,
    lastCheckedAt: doc.lastCheckedAt.toISOString(),
    wabaId: doc.wabaId,
    verificationStatus: doc.verificationStatus as WhatsAppPhoneNumberRecord["verificationStatus"],
    organizationId: doc.organizationId?.toString(),
  };
}

export const PhoneNumberModel: Model<PhoneNumberDocument> =
  (models.PhoneNumber as Model<PhoneNumberDocument>) || model<PhoneNumberDocument>("PhoneNumber", phoneNumberSchema);
