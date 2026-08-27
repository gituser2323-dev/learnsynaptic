import type { SchedulerRetryPolicy } from "@/lib/services/scheduler";

/**
 * WhatsApp Campaign Manager configuration — approved decisions 2 and 4
 * from the Campaign Architecture review.
 */

/** Approved decision 2: 5,000 contacts per CSV import for now. See
 *  lib/services/whatsappCampaigns/csvImportService.ts's own doc comment
 *  for how the import pipeline stays streaming-friendly despite this
 *  cap being a simple in-memory buffer today. */
export const CSV_IMPORT_MAX_ROWS = Number(process.env.CAMPAIGN_CSV_IMPORT_MAX_ROWS) || 5000;

/** Phase 2B — stagger ScheduledJob.runAt when enqueueing campaign sends
 *  (ms between recipients). Not a full Meta TPS controller; reduces
 *  burst pressure under serverless without Redis. Default 750ms. */
export const CAMPAIGN_SEND_STAGGER_MS = Math.max(
  0,
  Number(process.env.CAMPAIGN_SEND_STAGGER_MS) || 750,
);

/** Page size when paginating filter audiences up to CSV_IMPORT_MAX_ROWS. */
export const AUDIENCE_FILTER_PAGE_SIZE = 500;

/** Approved decision 4: max 3 attempts, exponential backoff at 1/5/15
 *  minutes, then permanently failed. Applied to every WhatsApp
 *  campaign message-send job via the shared scheduler
 *  (lib/services/scheduler) — see jobHandlers.ts. */
export const MESSAGE_RETRY_POLICY: SchedulerRetryPolicy = {
  maxAttempts: 3,
  backoffMinutes: [1, 5, 15],
};
