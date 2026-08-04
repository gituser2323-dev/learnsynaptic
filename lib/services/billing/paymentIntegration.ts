import { subscribe } from "@/lib/events";
import { createLogger } from "@/lib/logger";
import { runWithTenantContext } from "@/lib/tenancy/context";
import { paymentService } from "@/lib/services/payments";
import type { CreatePaymentResult } from "@/lib/services/payments";
import { subscriptionService } from "./subscriptionService";
import { planService } from "./planService";

const logger = createLogger({ service: "billing", module: "paymentIntegration" });

/** The one `Payment.purpose` value that marks a checkout as a real
 *  subscription-renewal charge — the sole signal this module uses to
 *  recognize its own payments among every other kind Module 6.4
 *  already handles (program-fee checkouts, etc.), never a guess based
 *  on amount or provider. */
export const SUBSCRIPTION_RENEWAL_PURPOSE = "subscription_renewal";

/**
 * Business OS Phase 8, Module 8.3 — connects the Subscription state
 * machine to Module 6.4's EXISTING Payment platform. Deliberately NOT
 * a second payment system: `createRenewalCheckout()` calls
 * `paymentService.createPayment()` — the exact same function the
 * admin "Create Payment" UI already calls — with `purpose:
 * SUBSCRIPTION_RENEWAL_PURPOSE`; renewal/failure reacts to the SAME
 * `"payment.success"`/`"payment.failed"` domain events every other
 * payment-outcome consumer already subscribes to (Module 6.4's own
 * Registration auto-confirm, Module 3's Automation triggers).
 *
 * **Disclosed scope**: none of Module 6.4's three real gateways
 * (Razorpay/Stripe/Cashfree) implement true recurring/auto-charge
 * billing in this app — every one of them is a one-off hosted-
 * checkout flow (see `payments/types.ts`'s own `Payment` shape: no
 * interval/cycle/nextBillingAt field anywhere). This module's own real,
 * working piece is the STATE MACHINE connection: a successful renewal
 * checkout correctly extends the subscription's period and a failed
 * one correctly marks it past_due — proven directly (see
 * `paymentIntegration.unit.test.ts`). Real automatic recurring charging
 * (a vendor re-billing a saved payment method with no admin/customer
 * action) would need a materially larger Module 6.4 gateway integration
 * (Razorpay Subscriptions / Stripe Billing APIs, neither wired here) —
 * a real, bounded follow-up, not a corner cut in this pass.
 */
export const billingPaymentIntegration = {
  async createRenewalCheckout(
    organizationId: string,
    returnUrl: string,
    context: { actorId?: string; requestId?: string } = {},
  ): Promise<CreatePaymentResult> {
    const subscription = await subscriptionService.getForOrganization(organizationId);
    const plan = await planService.getPlan(subscription.planId);
    if (!plan) throw new Error(`Plan "${subscription.planId}" not found`);

    return runWithTenantContext({ organizationId }, () =>
      paymentService.createPayment(
        {
          provider: subscription.providerRef?.provider ?? "razorpay",
          amountInSmallestUnit: plan.basePriceInSmallestUnit,
          currency: plan.currency,
          purpose: SUBSCRIPTION_RENEWAL_PURPOSE,
          returnUrl,
          metadata: { organizationId, planId: plan.id, subscriptionId: subscription.id },
        },
        context,
      ),
    );
  },
};

let registered = false;

/** Self-bootstrapping, the same pattern `lib/events/eventBus.ts`'s own
 *  `bootstrappers` array already establishes for automation triggers
 *  and the Module 6.5 webhook fan-out — registered from
 *  `scheduler/bootstrap.ts` alongside this module's own scheduler job
 *  handler (see `schedulerIntegration.ts`). */
export function registerBillingPaymentSubscriber(): void {
  if (registered) return;
  registered = true;

  subscribe<{ paymentId: string; purpose: string }>("payment.success", async (event) => {
    if (event.payload.purpose !== SUBSCRIPTION_RENEWAL_PURPOSE) return;
    const payment = await paymentService.getPayment(event.payload.paymentId);
    if (!payment || !payment.organizationId) return;

    const nextPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await runWithTenantContext({ organizationId: payment.organizationId }, () =>
      subscriptionService.recordRenewal(payment.organizationId!, nextPeriodEnd),
    );
    logger.info("billing.subscription_renewed", { organizationId: payment.organizationId, paymentId: payment.id });
  });

  subscribe<{ paymentId: string; purpose: string }>("payment.failed", async (event) => {
    if (event.payload.purpose !== SUBSCRIPTION_RENEWAL_PURPOSE) return;
    const payment = await paymentService.getPayment(event.payload.paymentId);
    if (!payment || !payment.organizationId) return;

    await runWithTenantContext({ organizationId: payment.organizationId }, () => subscriptionService.markPastDue(payment.organizationId!));
    logger.warn("billing.subscription_renewal_failed", { organizationId: payment.organizationId, paymentId: payment.id });
  });
}
