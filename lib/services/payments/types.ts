import type { PaginatedResult } from "@/lib/pagination";

/**
 * Payments Integration (Phase 6), Module 6.4 — domain layer.
 *
 * Mirrors Module 6.3's own shape deliberately: a generic `PaymentProvider`
 * interface every vendor adapter implements, a central `Payment` model
 * (the "Meeting"/"FileAsset" of this module — one row every CRM entity
 * links into, not a bespoke per-module payments table), and the same
 * two-factor Integrations Registry gate (see paymentService.ts's own
 * assertProviderReady()). Unlike Calendar (OAuth) or Webhooks
 * (admin-pasted URL), a payment provider's real credential is a single
 * API key pair for the whole deployment — the same shape AWS S3/
 * Cloudinary already established in Module 6.2 — so `credentialRef`
 * stays `{type:"env"}` and no per-connection secret is ever stored.
 */

export type PaymentProviderId = "razorpay" | "stripe" | "cashfree" | "phonepe" | "paypal";

/** Amounts are always in the currency's own smallest unit (paise for
 *  INR, cents for USD) — the same convention Stripe's own API uses,
 *  applied uniformly across every provider here so nothing in this
 *  module ever has to guess whether a number means rupees or paise. */
export interface CreateCheckoutSessionInput {
  provider: PaymentProviderId;
  amountInSmallestUnit: number;
  currency: string;
  purpose: string;
  /** Where the customer's browser returns to after paying (hosted
   *  checkout flows only — Stripe/Cashfree redirect here regardless of
   *  outcome; Razorpay Payment Links do the same). */
  returnUrl: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  /** Arbitrary key/value pairs echoed back on the provider's own
   *  dashboard and, where the vendor API supports it, in webhook
   *  payloads — the "Invoice Metadata" requirement. Never used to hold
   *  anything security-relevant; this app's own linkage (leadId, etc.)
   *  lives on the persisted Payment row, not trusted from provider
   *  metadata round-tripped through a webhook. */
  metadata?: Record<string, string>;
}

/** What a provider hands back after creating a real order/checkout
 *  session — enough to persist onto the central Payment row and
 *  redirect the customer. */
export interface ProviderCheckoutResult {
  providerOrderId: string;
  checkoutUrl: string;
}

export type ProviderPaymentState = "pending" | "succeeded" | "failed";

export interface ProviderPaymentStatusResult {
  state: ProviderPaymentState;
  providerPaymentId?: string;
  amountInSmallestUnit?: number;
  currency?: string;
  failureReason?: string;
}

export interface ProviderRefundResult {
  providerRefundId: string;
  amountInSmallestUnit: number;
  state: "pending" | "succeeded" | "failed";
}

/** A provider webhook, normalized. Every vendor sends its own event
 *  shape (Razorpay: `payment.captured`/`payment.failed`/`refund.processed`;
 *  Stripe: `checkout.session.completed`/`payment_intent.payment_failed`/
 *  `charge.refunded`; Cashfree: `PAYMENT_SUCCESS_WEBHOOK`/etc.) — each
 *  adapter's own parseWebhookEvent() translates its vendor's real
 *  payload into this one shape so paymentService never branches on
 *  provider identity to interpret a webhook. */
export type PaymentWebhookEventType = "payment.succeeded" | "payment.failed" | "refund.succeeded" | "unrecognized";

export interface ParsedWebhookEvent {
  type: PaymentWebhookEventType;
  /** The vendor's own event id, when it provides one — used for
   *  idempotent processing (never act on the same webhook delivery
   *  twice, including a vendor's own real retried delivery). Providers
   *  that don't send a stable event id fall back to a deterministic
   *  hash of the raw body, computed by the caller, never here. */
  providerEventId?: string;
  providerOrderId?: string;
  providerPaymentId?: string;
  providerRefundId?: string;
  amountInSmallestUnit?: number;
  currency?: string;
  failureReason?: string;
}

/**
 * One implementation per vendor (providers/*.ts). Every method is a
 * real HTTP call against the vendor's own documented API — no SDK
 * dependency, the same "hand-rolled fetch unless the crypto itself is
 * genuinely complex" convention this codebase has followed since
 * Module 6.1 (AWS S3's SigV4 signing remains the one deliberate
 * exception, not this module's).
 */
export interface PaymentProvider {
  readonly id: PaymentProviderId;
  createCheckoutSession(input: CreateCheckoutSessionInput): Promise<ProviderCheckoutResult>;
  getPaymentStatus(providerOrderId: string): Promise<ProviderPaymentStatusResult>;
  createRefund(providerPaymentId: string, amountInSmallestUnit?: number, reason?: string): Promise<ProviderRefundResult>;
  /** Verifies the raw inbound webhook body against the vendor's own
   *  signature header(s) using this provider's own configured webhook
   *  secret — never trust an unverified payload, the same floor every
   *  inbound webhook in this app (WhatsApp/Email/2.4) already holds. */
  verifyWebhookSignature(rawBody: string, headers: Record<string, string | undefined>): boolean;
  parseWebhookEvent(rawBody: string): ParsedWebhookEvent;
}

export type PaymentStatus = "created" | "pending" | "succeeded" | "failed" | "refunded" | "partially_refunded";

/**
 * The central Payment row — one per checkout attempt, regardless of
 * provider. `relatedEntityType`/`relatedEntityId` mirror FileAsset/
 * Meeting's own deliberate plain-string-pair deviation (a Payment must
 * stay reusable by CRM entities that don't exist yet); `leadId`/
 * `registrationId`/`opportunityId`/`campaignId` are additionally named
 * explicitly since the mission calls out each of them by name for CRM
 * Integration/Campaign Attribution, and a single generic pointer can't
 * represent "this payment relates to a Lead AND a campaign AND
 * optionally a Registration" simultaneously the way these named fields
 * can.
 */
export interface Payment {
  id: string;
  provider: PaymentProviderId;
  providerOrderId?: string;
  providerPaymentId?: string;
  amountInSmallestUnit: number;
  currency: string;
  status: PaymentStatus;
  purpose: string;
  checkoutUrl?: string;
  failureReason?: string;
  refundedAmountInSmallestUnit: number;
  /** Set only on a Payment created by "Retry Payment" — points back at
   *  the original failed attempt (see paymentService.retryPayment's own
   *  doc comment on why this is a new row, not an in-place resurrection
   *  of the failed one). */
  retryOfPaymentId?: string;
  leadId?: string;
  registrationId?: string;
  opportunityId?: string;
  campaignId?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  metadata?: Record<string, string>;
  relatedEntityType?: string;
  relatedEntityId?: string;
  createdBy?: string;
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePaymentRecordInput {
  provider: PaymentProviderId;
  providerOrderId?: string;
  amountInSmallestUnit: number;
  currency: string;
  status: PaymentStatus;
  purpose: string;
  checkoutUrl?: string;
  retryOfPaymentId?: string;
  leadId?: string;
  registrationId?: string;
  opportunityId?: string;
  campaignId?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  metadata?: Record<string, string>;
  relatedEntityType?: string;
  relatedEntityId?: string;
  createdBy?: string;
  organizationId?: string;
}

export interface UpdatePaymentRecordInput {
  providerOrderId?: string;
  providerPaymentId?: string;
  status?: PaymentStatus;
  failureReason?: string;
  refundedAmountInSmallestUnit?: number;
}

export interface PaymentListFilters {
  status?: PaymentStatus;
  provider?: PaymentProviderId;
  leadId?: string;
  registrationId?: string;
  opportunityId?: string;
  campaignId?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  /** Enterprise Analytics (Phase 7), module 7.2 — inclusive ISO bounds
   *  against createdAt. */
  createdAfter?: string;
  createdBefore?: string;
}

export interface PaymentRepository {
  findById(id: string): Promise<Payment | null>;
  findByProviderOrderId(provider: PaymentProviderId, providerOrderId: string): Promise<Payment | null>;
  create(input: CreatePaymentRecordInput): Promise<Payment>;
  update(id: string, input: UpdatePaymentRecordInput): Promise<Payment>;
  list(filters: PaymentListFilters, page: number, limit: number): Promise<PaginatedResult<Payment>>;
  /** The reconciliation job's own query — real vendor calls only for
   *  payments genuinely stuck "pending" past a minimum age, not every
   *  payment ever created. */
  findStalePending(olderThan: Date): Promise<Payment[]>;
}

// ─── Inbound webhook event log (idempotency + "Webhook Status") ────────

/** RC-3 — "processing" is new (Reliability, Queues & Observability):
 *  the transient claim state between "this exact providerEventId won
 *  the atomic idempotency insert" and "side effects finished" — see
 *  paymentService.handleProviderWebhook's own doc comment for why a
 *  real, updateable claim row (not just a read-then-insert check) is
 *  the actual fix for a genuine concurrent-duplicate-webhook race. */
export type PaymentWebhookOutcome = "processed" | "processing" | "duplicate" | "signature_invalid" | "unrecognized" | "error";

export interface PaymentWebhookEvent {
  id: string;
  provider: PaymentProviderId;
  providerEventId?: string;
  eventType: string;
  outcome: PaymentWebhookOutcome;
  paymentId?: string;
  detail?: string;
  organizationId?: string;
  receivedAt: string;
}

export interface CreatePaymentWebhookEventInput {
  provider: PaymentProviderId;
  providerEventId?: string;
  eventType: string;
  outcome: PaymentWebhookOutcome;
  paymentId?: string;
  detail?: string;
  organizationId?: string;
}

export interface PaymentWebhookEventListFilters {
  provider?: PaymentProviderId;
  outcome?: PaymentWebhookOutcome;
}

export interface PaymentWebhookEventRepository {
  /** RC-3 — throws DuplicateKeyError (lib/db/types.ts) when `provider` +
   *  `providerEventId` collides with an existing row — the real,
   *  DB-enforced idempotency gate (see the (provider, providerEventId)
   *  unique+sparse index in the mongodb model). Only enforced when
   *  providerEventId is present — a provider with no stable event id
   *  can create as many rows as it wants, matching
   *  findByProviderEventId's own "no id, no idempotency guarantee
   *  possible" honesty. */
  create(input: CreatePaymentWebhookEventInput): Promise<PaymentWebhookEvent>;
  /** Idempotency check — has this exact provider event already been
   *  recorded as processed? Providers that supply no stable event id
   *  (none of the three real adapters here fall into that — all of
   *  Razorpay/Stripe/Cashfree provide one) would always return null,
   *  degrading to "always process," the same honest behavior a missing
   *  idempotency key implies everywhere else in this app. */
  findByProviderEventId(provider: PaymentProviderId, providerEventId: string): Promise<PaymentWebhookEvent | null>;
  /** RC-3 — transitions a claimed row's own outcome (create()'s
   *  "processing" result) to its terminal state once side effects
   *  finish — see paymentService.handleProviderWebhook's own doc
   *  comment for the full claim → apply → finalize sequence this
   *  supports. */
  updateOutcome(id: string, patch: { outcome: PaymentWebhookOutcome; detail?: string }): Promise<PaymentWebhookEvent>;
  list(filters: PaymentWebhookEventListFilters, page: number, limit: number): Promise<PaginatedResult<PaymentWebhookEvent>>;
}
