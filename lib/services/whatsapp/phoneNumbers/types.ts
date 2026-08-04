/**
 * WhatsApp Platform (Phase 2), Module 2.3 — Business Account Health.
 * One row per phone number this app sends from — today that's always
 * exactly one (WHATSAPP_META_PHONE_NUMBER_ID is a single config value,
 * not a list), but the shape doesn't assume that: `phoneNumberId` is
 * the natural key, upserted on every health-check cycle rather than
 * keyed to a fixed single-row assumption.
 */
export interface WhatsAppPhoneNumberRecord {
  id: string;
  phoneNumberId: string;
  displayPhoneNumber?: string;
  qualityRating: "green" | "yellow" | "red" | "unknown";
  messagingLimit?: string;
  lastCheckedAt: string;
  /** Business OS Phase 8, Module 8.5 — the WhatsApp Business Account
   *  this phone number belongs to, discovered at Embedded Signup time.
   *  Optional because this app's own pre-8.5 default/env-configured
   *  phone number was never required to record one. */
  wabaId?: string;
  /** Meta's own `code_verification_status` on the phone number node,
   *  normalized to this app's three-value shape — "phone verification
   *  required" (mission's own named connection state) is exactly
   *  "not_verified" here. */
  verificationStatus?: "verified" | "not_verified" | "unknown";
  /** Business OS Phase 0 — tenant scaffolding, unset until multi-tenant
   *  activation (Phase 6). See lib/services/organizations/types.ts.
   *  Populated for real starting Module 8.1's backfill, and — as of
   *  Module 8.5 — the actual routing key inbound webhooks resolve
   *  organization identity from (see phoneNumberService.findByRouting
   *  below): `phoneNumberId` is globally unique (Meta's own real-world
   *  invariant — one phone number belongs to exactly one WABA/business),
   *  so a lookup by phoneNumberId alone, performed with NO tenant
   *  context active (the state a fresh inbound webhook always starts
   *  in), safely returns this record's own organizationId — never
   *  another organization's, since there is only ever one row per real
   *  phone number. */
  organizationId?: string;
}

export interface UpsertPhoneNumberHealthInput {
  phoneNumberId: string;
  displayPhoneNumber?: string;
  qualityRating: "green" | "yellow" | "red" | "unknown";
  messagingLimit?: string;
  wabaId?: string;
  verificationStatus?: "verified" | "not_verified" | "unknown";
  organizationId?: string;
}

export interface PhoneNumberRepository {
  upsertHealth(input: UpsertPhoneNumberHealthInput): Promise<WhatsAppPhoneNumberRecord>;
  list(): Promise<WhatsAppPhoneNumberRecord[]>;
  /** Business OS Phase 8, Module 8.5 — the webhook-routing lookup:
   *  "which organization owns this phoneNumberId," callable with no
   *  tenant context active (the state before routing has resolved
   *  anything). Deliberately NOT scoped to the ambient tenant context
   *  the way `list()` is — a query for another org's number should
   *  still resolve here (that's the entire point), unlike every other
   *  read path in this app. Returns `null` for an unrecognized number
   *  (this deployment's own pre-8.5 default number, or a number no
   *  organization has connected) — the caller falls back to
   *  default-organization routing, unchanged from Module 8.1's own
   *  disclosed posture for inbound webhooks. */
  findByPhoneNumberId(phoneNumberId: string): Promise<WhatsAppPhoneNumberRecord | null>;
  /** Business OS Phase 8, Module 8.5 — releases a number's organization
   *  ownership (a reconnect to a different number, or a disconnect)
   *  WITHOUT deleting the record's own health history. Deliberately a
   *  dedicated method rather than `upsertHealth({organizationId:
   *  undefined})`: Mongoose strips `undefined`-valued keys from an
   *  update document by default, so that would silently no-op against
   *  real MongoDB (while appearing to work against the in-memory
   *  store's plain `Object.assign`) — an explicit unset is the only
   *  correct way to actually clear the field in both backends. A no-op
   *  for an unknown phoneNumberId. */
  clearOrganization(phoneNumberId: string): Promise<void>;
}
