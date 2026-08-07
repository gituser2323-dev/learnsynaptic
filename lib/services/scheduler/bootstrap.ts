/**
 * Self-bootstrapping job-handler registration — same fix, same reason,
 * as lib/events/eventBus.ts's `ensureBootstrapped()`: Next.js bundles
 * different parts of the app into separate module graphs, so a
 * handler registered from one copy of registry.ts's module-level `Map`
 * can be invisible to runDueScheduledJobs() running from a different
 * copy, even within the same process. The fix there was for
 * `ensureBootstrapped()` to run from *inside* the module that owns the
 * shared state, via dynamic imports — this is that exact pattern,
 * applied to the scheduler's handler registry instead of the event
 * bus's subscriber map.
 *
 * Every consumer of the shared scheduler adds one entry here — this is
 * the one file that "knows about" every job-producing module
 * (Automation Engine, WhatsApp Campaign Manager, anything future), by
 * design: it's the single wiring point, not scattered self-registration
 * calls that would be easy to forget.
 */
const bootstrappers: (() => Promise<void>)[] = [
  async () => {
    const { registerAutomationTickHandler, ensureAutomationTickScheduled } = await import(
      "@/lib/services/automation"
    );
    registerAutomationTickHandler();
    await ensureAutomationTickScheduled();
  },
  async () => {
    const { registerWhatsAppCampaignJobHandlers } = await import("@/lib/services/whatsappCampaigns/jobHandlers");
    registerWhatsAppCampaignJobHandlers();
  },
  async () => {
    const { registerTaskReminderTickHandler, ensureTaskReminderTickScheduled } = await import(
      "@/lib/services/crm/tasks"
    );
    registerTaskReminderTickHandler();
    await ensureTaskReminderTickScheduled();
  },
  async () => {
    const { registerTemplateSyncHandler, registerPhoneHealthCheckHandler, ensureWhatsAppHealthTicksScheduled } =
      await import("@/lib/services/whatsapp");
    registerTemplateSyncHandler();
    registerPhoneHealthCheckHandler();
    await ensureWhatsAppHealthTicksScheduled();
  },
  // Generic Webhooks & Team Notifications (Phase 6), Module 6.5 — the
  // "webhook.deliver"/"notification.deliver" job types the dispatcher
  // (lib/services/webhooks/dispatcher.ts) enqueues.
  async () => {
    const { registerWebhookJobHandlers } = await import("@/lib/services/webhooks");
    registerWebhookJobHandlers();
  },
  // Payments Integration (Phase 6), Module 6.4 — the "payments.reconcile"
  // job type, real robustness against a missed or never-delivered
  // provider webhook (see schedulerIntegration.ts's own doc comment).
  async () => {
    const { registerPaymentReconcileHandler, ensurePaymentReconcileTickScheduled } = await import("@/lib/services/payments");
    registerPaymentReconcileHandler();
    await ensurePaymentReconcileTickScheduled();
  },
  // Billing, Plans & Feature Flags (Phase 8), Module 8.3 — the
  // "billing.period_check" job type: trial expiration, past-due grace
  // period expiration, and reaching a scheduled cancel-at date (see
  // schedulerIntegration.ts's own doc comment).
  async () => {
    const { registerBillingPeriodCheckHandler, ensureBillingPeriodCheckTickScheduled } = await import("@/lib/services/billing");
    registerBillingPeriodCheckHandler();
    await ensureBillingPeriodCheckTickScheduled();
  },
  // RC-5 — Backup, Restore & Disaster Recovery: the "tenant_export.generate"
  // job type (organization-level data export — lib/services/dataExport).
  async () => {
    const { registerTenantExportJobHandler } = await import("@/lib/services/dataExport");
    registerTenantExportJobHandler();
  },
  // RC-5 — the "backup.check_freshness" job type (lib/services/backupMonitoring).
  async () => {
    const { registerBackupFreshnessCheckHandler, ensureBackupFreshnessCheckScheduled } = await import(
      "@/lib/services/backupMonitoring"
    );
    registerBackupFreshnessCheckHandler();
    await ensureBackupFreshnessCheckScheduled();
  },
];

let bootstrapped = false;

export async function ensureSchedulerBootstrapped(): Promise<void> {
  if (bootstrapped) return;
  bootstrapped = true;
  await Promise.all(bootstrappers.map((bootstrap) => bootstrap()));
}
