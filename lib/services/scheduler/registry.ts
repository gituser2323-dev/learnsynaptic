import type { JobHandler } from "./types";

/**
 * The seam where a job type (a string, e.g. "whatsapp_campaign.send_message")
 * becomes a concrete handler function — same dependency-inversion shape
 * as lib/services/whatsapp/registry.ts for providers. Handlers register
 * themselves via bootstrap.ts's dynamic imports; nothing calls
 * registerJobHandler() at module-load time directly (see bootstrap.ts
 * for why — the same Next.js module-graph-splitting bug lib/events/
 * eventBus.ts already found and fixed once).
 */
const handlers = new Map<string, JobHandler>();

export function registerJobHandler(jobType: string, handler: JobHandler): void {
  handlers.set(jobType, handler);
}

export function getJobHandler(jobType: string): JobHandler | undefined {
  return handlers.get(jobType);
}
