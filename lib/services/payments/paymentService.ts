import { getPaymentRepository, getPaymentWebhookEventRepository, DuplicateKeyError } from "@/lib/db";
import { getTenantContext } from "@/lib/tenancy/context";
import { ensureDefaultOrganization } from "@/lib/services/organizations";
import { integrationService } from "@/lib/services/integrations";
import { activityService } from "@/lib/services/crm/activities";
import { registrationService } from "@/lib/services/registrations";
import { auditLogService, AUDIT_ACTIONS } from "@/lib/services/auditLog";
import { publish } from "@/lib/events";
import { getPaymentProvider } from "./registry";
import { validateCreatePaymentInput, type PaymentValidationError } from "./validation";
import { PaymentNotFoundError, PaymentProviderNotConnectedError, PaymentProviderError, PaymentWebhookSignatureInvalidError } from "./errors";
import type { AuditContext } from "@/lib/services/auditLog";
import type { PaginatedResult } from "@/lib/pagination";
import type {
  ParsedWebhookEvent,
  Payment,
  PaymentListFilters,
  PaymentProviderId,
  PaymentWebhookEvent,
} from "./types";

const STALE_PENDING_MINUTES = 30;

/**
 * Payments Integration (Phase 6), Module 6.4 — the ONE place every
 * caller (admin routes, the inbound webhook receivers, the
 * reconciliation job) goes through to create, verify, refund, or list
 * a real payment, regardless of which provider is behind it. Mirrors
 * calendarService.ts's own shape deliberately: validate → gate via the
 * Integrations Registry → call the concrete provider → persist →
 * audit → publish → CRM integration.
 */

/** The same two-factor gate calendarService/fileStorageService already
 *  established: real API keys configured (config/payments.ts) picks
 *  which adapter's code CAN run; the Integrations Registry additionally
 *  must show connected+enabled before it's actually allowed to. */
async function assertProviderReady(providerId: PaymentProviderId): Promise<void> {
  const integration = await integrationService.getIntegration(providerId);
  if (!integration || integration.status !== "connected" || !integration.enabled) {
    throw new PaymentProviderNotConnectedError(providerId);
  }
}

/** Logs to every CRM entity a Payment is actually linked to — a
 *  payment can relate to a Lead AND an Opportunity simultaneously
 *  (unlike Meeting/FileAsset's single relatedEntityType/Id pair), so
 *  both get their own Timeline entry when both are set, rather than
 *  picking one arbitrarily. */
async function logToTimeline(payment: Payment, body: string): Promise<void> {
  if (payment.leadId) await activityService.logSystemEvent("Lead", payment.leadId, body, payment.organizationId);
  if (payment.opportunityId) await activityService.logSystemEvent("Opportunity", payment.opportunityId, body, payment.organizationId);
}

/** Shared by both the inbound-webhook path and the reconciliation
 *  job's own polling path — the two real ways this app ever learns a
 *  payment's true state changed. Idempotent against being called twice
 *  for the same already-terminal status (a webhook arriving after the
 *  reconciler already caught the same transition, or a real vendor
 *  retry of the same webhook) — never double-applies CRM side effects
 *  or double-counts an audit entry for a Payment already in that
 *  state. */
async function applyPaymentOutcome(
  payment: Payment,
  outcome: { status: "succeeded" | "failed"; providerPaymentId?: string; amountInSmallestUnit?: number; failureReason?: string },
): Promise<Payment> {
  if (payment.status === outcome.status) return payment; // Already applied — idempotent.

  const repository = await getPaymentRepository();
  const updated = await repository.update(payment.id, {
    status: outcome.status,
    providerPaymentId: outcome.providerPaymentId ?? payment.providerPaymentId,
    failureReason: outcome.status === "failed" ? outcome.failureReason : undefined,
  });

  await auditLogService.record({
    action: outcome.status === "succeeded" ? AUDIT_ACTIONS.PAYMENT_SUCCEEDED : AUDIT_ACTIONS.PAYMENT_FAILED,
    entityType: "Payment",
    entityId: updated.id,
    metadata: { provider: updated.provider, amountInSmallestUnit: updated.amountInSmallestUnit, currency: updated.currency },
  });

  if (outcome.status === "succeeded") {
    // Event Bus / Automation trigger — "successful payments should be
    // available as Automation triggers," the mission's own words. The
    // event type matches the reserved "payment.success" name Module
    // 6.5's own event picker already catalogued in advance of this
    // module existing.
    await publish("payment.success", {
      paymentId: updated.id,
      leadId: updated.leadId,
      registrationId: updated.registrationId,
      opportunityId: updated.opportunityId,
      campaignId: updated.campaignId,
      amountInSmallestUnit: updated.amountInSmallestUnit,
      currency: updated.currency,
      purpose: updated.purpose,
    });
    await logToTimeline(updated, `Payment succeeded: ${(updated.amountInSmallestUnit / 100).toFixed(2)} ${updated.currency} — ${updated.purpose}`);
    if (updated.registrationId) await registrationService.confirmRegistration(updated.registrationId);
  } else {
    await publish("payment.failed", {
      paymentId: updated.id,
      leadId: updated.leadId,
      registrationId: updated.registrationId,
      opportunityId: updated.opportunityId,
      campaignId: updated.campaignId,
      amountInSmallestUnit: updated.amountInSmallestUnit,
      currency: updated.currency,
      purpose: updated.purpose,
      failureReason: outcome.failureReason,
    });
    await logToTimeline(updated, `Payment failed: ${(updated.amountInSmallestUnit / 100).toFixed(2)} ${updated.currency} — ${updated.purpose}${outcome.failureReason ? ` (${outcome.failureReason})` : ""}`);
  }

  return updated;
}

export type CreatePaymentResult = { success: true; payment: Payment } | { success: false; errors: PaymentValidationError[] };

export const paymentService = {
  // ─── Checkout / Orders ────────────────────────────────────────────

  async createPayment(input: unknown, context: AuditContext = {}, retryOfPaymentId?: string): Promise<CreatePaymentResult> {
    const validation = validateCreatePaymentInput(input);
    if (!validation.valid) return { success: false, errors: validation.errors };
    const { checkout, ...linkage } = validation.data;

    await assertProviderReady(checkout.provider);
    const provider = getPaymentProvider(checkout.provider);
    const repository = await getPaymentRepository();

    let providerOrderId: string | undefined;
    let checkoutUrl: string | undefined;
    let status: "created" | "failed" = "created";
    let failureReason: string | undefined;

    try {
      const result = await provider.createCheckoutSession(checkout);
      providerOrderId = result.providerOrderId;
      checkoutUrl = result.checkoutUrl;
      await integrationService.recordSync(checkout.provider, "success", `Created checkout for "${checkout.purpose}".`);
    } catch (error) {
      // Error Recovery — the same posture calendarService.scheduleMeeting
      // takes on a failed vendor call: the Payment row is still created
      // (status "failed"), visible and retriable, rather than the
      // attempt vanishing with no trace. This is also what "Failed
      // Payments" means for a checkout that couldn't even be created,
      // not just one that was created and later declined.
      status = "failed";
      failureReason = error instanceof Error ? error.message : "createCheckoutSession failed";
      await integrationService.recordSync(checkout.provider, "failure", failureReason);
    }

    const payment = await repository.create({
      provider: checkout.provider,
      providerOrderId,
      amountInSmallestUnit: checkout.amountInSmallestUnit,
      currency: checkout.currency,
      status,
      purpose: checkout.purpose,
      checkoutUrl,
      retryOfPaymentId,
      leadId: linkage.leadId,
      registrationId: linkage.registrationId,
      opportunityId: linkage.opportunityId,
      campaignId: linkage.campaignId,
      customerName: checkout.customerName,
      customerEmail: checkout.customerEmail,
      customerPhone: checkout.customerPhone,
      metadata: checkout.metadata,
      relatedEntityType: linkage.relatedEntityType,
      relatedEntityId: linkage.relatedEntityId,
      createdBy: context.actorId,
    });

    await auditLogService.record({
      action: AUDIT_ACTIONS.PAYMENT_CREATED,
      entityType: "Payment",
      entityId: payment.id,
      actorId: context.actorId,
      requestId: context.requestId,
      metadata: { provider: payment.provider, amountInSmallestUnit: payment.amountInSmallestUnit, currency: payment.currency, status: payment.status },
    });

    if (status === "created") {
      await logToTimeline(payment, `Payment initiated: ${(payment.amountInSmallestUnit / 100).toFixed(2)} ${payment.currency} — ${payment.purpose}`);
    }

    return { success: true, payment };
  },

  async getPayment(id: string): Promise<Payment | null> {
    const repository = await getPaymentRepository();
    return repository.findById(id);
  },

  async listPayments(filters: PaymentListFilters, page = 1, limit = 20): Promise<PaginatedResult<Payment>> {
    const repository = await getPaymentRepository();
    return repository.list(filters, page, limit);
  },

  /** "Payment Analytics" — the Admin UI's own summary cards. Mirrors
   *  registrationService.getAnalytics()'s own shape (counts by status,
   *  computed together since both are cheap over the same page-1
   *  sweep) rather than a real aggregation pipeline — the same
   *  "good enough, not a real scale concern yet" judgment
   *  payments.revenue.provider.ts already makes for the identical
   *  reason. `byCurrency` — since a real deployment can run multiple
   *  providers in different currencies simultaneously, one flat total
   *  would silently sum incompatible units. */
  async getAnalytics(): Promise<{
    byStatus: Record<Payment["status"], number>;
    byProvider: Record<PaymentProviderId, number>;
    succeededByCurrency: Record<string, number>;
    refundedByCurrency: Record<string, number>;
    totalTransactions: number;
  }> {
    const repository = await getPaymentRepository();
    const { items } = await repository.list({}, 1, 10_000);

    const byStatus: Record<Payment["status"], number> = { created: 0, pending: 0, succeeded: 0, failed: 0, refunded: 0, partially_refunded: 0 };
    const byProvider: Record<PaymentProviderId, number> = { razorpay: 0, stripe: 0, cashfree: 0, phonepe: 0, paypal: 0 };
    const succeededByCurrency: Record<string, number> = {};
    const refundedByCurrency: Record<string, number> = {};

    for (const payment of items) {
      byStatus[payment.status]++;
      byProvider[payment.provider]++;
      if (payment.status === "succeeded" || payment.status === "partially_refunded" || payment.status === "refunded") {
        succeededByCurrency[payment.currency] = (succeededByCurrency[payment.currency] ?? 0) + payment.amountInSmallestUnit / 100;
      }
      if (payment.refundedAmountInSmallestUnit > 0) {
        refundedByCurrency[payment.currency] = (refundedByCurrency[payment.currency] ?? 0) + payment.refundedAmountInSmallestUnit / 100;
      }
    }

    return { byStatus, byProvider, succeededByCurrency, refundedByCurrency, totalTransactions: items.length };
  },

  // ─── Payment Verification / Payment Status ──────────────────────────

  /** "Check Status" — a real, immediate, synchronous vendor status
   *  query, the same "prove it actually works right now" posture
   *  webhook-endpoints' own Test Endpoint (Module 6.5) established.
   *  Never trusts a client-supplied status — always re-derives it from
   *  the provider's own API, the real "Payment Verification"
   *  requirement. */
  async checkStatus(id: string): Promise<Payment> {
    const repository = await getPaymentRepository();
    const payment = await repository.findById(id);
    if (!payment) throw new PaymentNotFoundError(id);
    if (!payment.providerOrderId || (payment.status !== "created" && payment.status !== "pending")) return payment;

    await assertProviderReady(payment.provider);
    const provider = getPaymentProvider(payment.provider);
    const result = await provider.getPaymentStatus(payment.providerOrderId);

    if (result.state === "succeeded") {
      return applyPaymentOutcome(payment, { status: "succeeded", providerPaymentId: result.providerPaymentId, amountInSmallestUnit: result.amountInSmallestUnit });
    }
    if (result.state === "failed") {
      return applyPaymentOutcome(payment, { status: "failed", failureReason: result.failureReason });
    }
    return payment;
  },

  /** The scheduler's own poller (see jobHandlers.ts) — real robustness
   *  for a missed or never-delivered webhook, not a replacement for
   *  webhook processing. Only ever queries payments genuinely stuck
   *  "pending" past STALE_PENDING_MINUTES, never every payment. */
  async reconcilePendingPayments(): Promise<{ checked: number; resolved: number }> {
    const repository = await getPaymentRepository();
    const stale = await repository.findStalePending(new Date(Date.now() - STALE_PENDING_MINUTES * 60_000));

    let resolved = 0;
    for (const payment of stale) {
      try {
        const before = payment.status;
        const after = await this.checkStatus(payment.id);
        if (after.status !== before) resolved++;
      } catch {
        // A single provider hiccup during reconciliation never aborts
        // the batch — the same "one bad record doesn't stop the sweep"
        // posture 2.3's own scheduler jobs already established.
      }
    }
    return { checked: stale.length, resolved };
  },

  // ─── Webhook Processing ─────────────────────────────────────────────

  /** The inbound webhook receiver's own call — verifies the vendor's
   *  real signature first (never trusts an unverified payload), then
   *  processes idempotently. Every inbound webhook is recorded as its
   *  own PaymentWebhookEvent row regardless of outcome — "Webhook
   *  Status" visibility for a signature failure or an unrecognized
   *  event type, not just a successfully processed one.
   *
   *  RC-3 pentest fix — real concurrency, not just sequential
   *  idempotency: the early `findByProviderEventId` read below is a
   *  fast path for the common case (a vendor's own retried delivery,
   *  arriving well after the first was already fully processed), but a
   *  read-then-insert-at-the-end design leaves a real window open for
   *  two GENUINELY CONCURRENT deliveries of the same event — both could
   *  pass that read before either finishes, and both would then call
   *  applyPaymentOutcome/applyRefundWebhookOutcome, double-firing
   *  non-idempotent side effects (publish("payment.success", ...)
   *  triggering Automation twice, registrationService.confirmRegistration
   *  running twice, duplicate audit entries) even though the underlying
   *  Payment row itself only ends up in one state. Found live via
   *  concurrency testing (see paymentService.unit.test.ts's own "RC-3 —
   *  pentest: concurrent webhook delivery" suite), matching the
   *  mission's own explicit "concurrent... payment webhook processing —
   *  verify no duplicate side effects" requirement.
   *
   *  The real, closed fix: for any event carrying a providerEventId
   *  (all three real adapters here do), the ONLY thing standing between
   *  "verified + payment matched" and "side effects run" is an INSERT
   *  against the (provider, providerEventId) unique+sparse index (see
   *  paymentWebhookEvent.model.ts) — claiming outcome:"processing" first.
   *  A concurrent racer's own insert hits that same unique key and
   *  throws DuplicateKeyError; the loser records "duplicate" and
   *  returns, exactly like the read-based fast path already does for
   *  the non-concurrent case — no financial side effect ever fires
   *  twice just because two deliveries happened to race. The claimed
   *  row is then updated in place (never a second insert, which the
   *  unique index would itself reject) to "processed" or "error" once
   *  side effects finish — and a PRIOR "error" outcome is deliberately
   *  treated as reclaimable (a genuine vendor retry after this app's own
   *  earlier failure, not a duplicate), so a transient failure can never
   *  permanently wedge a payment. A narrow, disclosed residual gap: two
   *  simultaneous retries racing the SAME already-errored row could
   *  still both reprocess (this claim-reuse step itself isn't further
   *  compare-and-swap-guarded) — extremely unlikely in practice (it
   *  requires both a genuine prior failure AND two simultaneous retries
   *  of it) and a smaller blast radius than the primary race this fix
   *  closes, in the same spirit as this codebase's other disclosed v1
   *  boundaries (see e.g. cloudinary.provider.ts's own doc comment). */
  async handleProviderWebhook(providerId: PaymentProviderId, rawBody: string, headers: Record<string, string | undefined>): Promise<void> {
    const provider = getPaymentProvider(providerId);
    const webhookEventRepository = await getPaymentWebhookEventRepository();
    // Business OS Phase 8, Module 8.1 — same posture as
    // webhookMonitoringService.logDelivery(): an inbound payment
    // webhook is unauthenticated by design, so there's no tenant
    // context to stamp this from automatically. Resolved once, reused
    // across every outcome branch below, so "Webhook Status" stays
    // visible under an admin's own now-tenant-scoped Payments page
    // instead of silently vanishing.
    const organizationId = getTenantContext()?.organizationId ?? (await ensureDefaultOrganization()).id;

    if (!provider.verifyWebhookSignature(rawBody, headers)) {
      await webhookEventRepository.create({ provider: providerId, eventType: "unknown", outcome: "signature_invalid", organizationId });
      throw new PaymentWebhookSignatureInvalidError(providerId);
    }

    const event: ParsedWebhookEvent = provider.parseWebhookEvent(rawBody);

    if (event.providerEventId) {
      const existing = await webhookEventRepository.findByProviderEventId(providerId, event.providerEventId);
      if (existing && existing.outcome !== "error") {
        await webhookEventRepository.create({ provider: providerId, providerEventId: event.providerEventId, eventType: event.type, outcome: "duplicate", paymentId: existing.paymentId, organizationId });
        return;
      }
    }

    if (event.type === "unrecognized") {
      await webhookEventRepository.create({ provider: providerId, providerEventId: event.providerEventId, eventType: event.type, outcome: "unrecognized", organizationId });
      return;
    }

    const paymentRepository = await getPaymentRepository();
    const payment = event.providerOrderId ? await paymentRepository.findByProviderOrderId(providerId, event.providerOrderId) : null;
    if (!payment) {
      await webhookEventRepository.create({ provider: providerId, providerEventId: event.providerEventId, eventType: event.type, outcome: "error", detail: "No matching Payment for providerOrderId.", organizationId });
      return;
    }

    // The real atomic gate — see this method's own doc comment above.
    let claim: PaymentWebhookEvent;
    if (event.providerEventId) {
      try {
        claim = await webhookEventRepository.create({ provider: providerId, providerEventId: event.providerEventId, eventType: event.type, outcome: "processing", paymentId: payment.id, organizationId });
      } catch (error) {
        if (!(error instanceof DuplicateKeyError)) throw error;
        const existing = await webhookEventRepository.findByProviderEventId(providerId, event.providerEventId);
        if (existing && existing.outcome === "error") {
          // A prior attempt errored out before completing — a genuine
          // retry, not a duplicate. Reuse that same claimed row; the
          // unique index already guarantees no one else holds it.
          claim = existing;
        } else {
          await webhookEventRepository.create({ provider: providerId, providerEventId: event.providerEventId, eventType: event.type, outcome: "duplicate", paymentId: payment.id, organizationId });
          return;
        }
      }
    } else {
      // No stable event id from this provider — no idempotency
      // guarantee possible (see findByProviderEventId's own doc
      // comment), so there's nothing for a unique index to claim.
      claim = await webhookEventRepository.create({ provider: providerId, eventType: event.type, outcome: "processing", paymentId: payment.id, organizationId });
    }

    try {
      if (event.type === "payment.succeeded") {
        await applyPaymentOutcome(payment, { status: "succeeded", providerPaymentId: event.providerPaymentId, amountInSmallestUnit: event.amountInSmallestUnit });
      } else if (event.type === "payment.failed") {
        await applyPaymentOutcome(payment, { status: "failed", failureReason: event.failureReason });
      } else if (event.type === "refund.succeeded") {
        await applyRefundWebhookOutcome(payment, event.amountInSmallestUnit);
      }
      await webhookEventRepository.updateOutcome(claim.id, { outcome: "processed" });
    } catch (error) {
      await webhookEventRepository.updateOutcome(claim.id, {
        outcome: "error",
        detail: error instanceof Error ? error.message : "Webhook processing failed.",
      });
      throw error;
    }
  },

  async listWebhookEvents(filters: { provider?: PaymentProviderId; outcome?: PaymentWebhookEvent["outcome"] }, page = 1, limit = 20) {
    const repository = await getPaymentWebhookEventRepository();
    return repository.list(filters, page, limit);
  },

  // ─── Refund Support ───────────────────────────────────────────────

  /** Admin-initiated refund — the one payment-mutating action with no
   *  webhook-driven equivalent path (unlike succeeded/failed, which
   *  can arrive from either an admin's own "Check Status" click or a
   *  real vendor webhook), so this always runs the full audit+publish
   *  +CRM sequence itself rather than delegating to
   *  applyPaymentOutcome. */
  async refundPayment(id: string, amountInSmallestUnit: number | undefined, reason: string | undefined, context: AuditContext = {}): Promise<Payment> {
    const repository = await getPaymentRepository();
    const payment = await repository.findById(id);
    if (!payment) throw new PaymentNotFoundError(id);
    if (payment.status !== "succeeded" && payment.status !== "partially_refunded") {
      throw new PaymentProviderError(payment.provider, "Only a succeeded payment can be refunded.");
    }

    await assertProviderReady(payment.provider);
    const provider = getPaymentProvider(payment.provider);
    // Cashfree's own Refunds API operates on the Order id, not a
    // separate payment id (see cashfree.provider.ts's own doc comment)
    // — every other provider here refunds against providerPaymentId.
    const refundTargetId = payment.provider === "cashfree" ? payment.providerOrderId! : payment.providerPaymentId!;
    const result = await provider.createRefund(refundTargetId, amountInSmallestUnit, reason);

    const newRefundedTotal = payment.refundedAmountInSmallestUnit + result.amountInSmallestUnit;
    const updated = await repository.update(id, {
      refundedAmountInSmallestUnit: newRefundedTotal,
      status: newRefundedTotal >= payment.amountInSmallestUnit ? "refunded" : "partially_refunded",
    });

    await auditLogService.record({
      action: AUDIT_ACTIONS.PAYMENT_REFUNDED,
      entityType: "Payment",
      entityId: updated.id,
      actorId: context.actorId,
      requestId: context.requestId,
      metadata: { amountInSmallestUnit: result.amountInSmallestUnit, reason, providerRefundId: result.providerRefundId },
    });

    await publish("payment.refund", {
      paymentId: updated.id,
      leadId: updated.leadId,
      opportunityId: updated.opportunityId,
      campaignId: updated.campaignId,
      amountInSmallestUnit: result.amountInSmallestUnit,
      currency: updated.currency,
    });
    await logToTimeline(updated, `Payment refunded: ${(result.amountInSmallestUnit / 100).toFixed(2)} ${updated.currency}${reason ? ` — ${reason}` : ""}`);

    return updated;
  },

  // ─── Retry Handling ─────────────────────────────────────────────────

  /** "Retry Payment" for a failed attempt — creates a genuinely NEW
   *  Payment row with a fresh checkout session, rather than resurrecting
   *  the failed one in place: a real payment gateway has no "retry this
   *  exact order" operation once it's dead (expired/cancelled/declined),
   *  so a retry is always a new order under the hood regardless of
   *  provider — `retryOfPaymentId` links the two for "Retry Handling"
   *  visibility without pretending the old attempt un-failed. */
  async retryPayment(id: string, returnUrl: string, context: AuditContext = {}): Promise<CreatePaymentResult> {
    const repository = await getPaymentRepository();
    const original = await repository.findById(id);
    if (!original) throw new PaymentNotFoundError(id);
    if (original.status !== "failed") throw new PaymentProviderError(original.provider, "Only a failed payment can be retried.");

    const result = await this.createPayment(
      {
        provider: original.provider,
        amountInSmallestUnit: original.amountInSmallestUnit,
        currency: original.currency,
        purpose: original.purpose,
        returnUrl,
        customerName: original.customerName,
        customerEmail: original.customerEmail,
        customerPhone: original.customerPhone,
        metadata: original.metadata,
        leadId: original.leadId,
        registrationId: original.registrationId,
        opportunityId: original.opportunityId,
        campaignId: original.campaignId,
        relatedEntityType: original.relatedEntityType,
        relatedEntityId: original.relatedEntityId,
      },
      context,
      original.id,
    );

    if (result.success) {
      await auditLogService.record({
        action: AUDIT_ACTIONS.PAYMENT_RETRIED,
        entityType: "Payment",
        entityId: result.payment.id,
        actorId: context.actorId,
        requestId: context.requestId,
        metadata: { retryOfPaymentId: original.id },
      });
    }
    return result;
  },
};

/** Split out only because refund webhooks don't carry a
 *  "failureReason"-shaped outcome the way payment success/failure do —
 *  kept next to applyPaymentOutcome rather than folded into it so that
 *  function's own signature stays a clean two-state (succeeded/failed)
 *  union matching its two real callers (checkStatus, the payment
 *  webhook branches). */
async function applyRefundWebhookOutcome(payment: Payment, amountInSmallestUnit: number | undefined): Promise<void> {
  if (!amountInSmallestUnit) return;
  const repository = await getPaymentRepository();
  const newRefundedTotal = payment.refundedAmountInSmallestUnit + amountInSmallestUnit;
  const updated = await repository.update(payment.id, {
    refundedAmountInSmallestUnit: newRefundedTotal,
    status: newRefundedTotal >= payment.amountInSmallestUnit ? "refunded" : "partially_refunded",
  });

  await auditLogService.record({
    action: AUDIT_ACTIONS.PAYMENT_REFUNDED,
    entityType: "Payment",
    entityId: updated.id,
    metadata: { amountInSmallestUnit, source: "webhook" },
  });
  await publish("payment.refund", { paymentId: updated.id, leadId: updated.leadId, opportunityId: updated.opportunityId, campaignId: updated.campaignId, amountInSmallestUnit, currency: updated.currency });
}
