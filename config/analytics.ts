/**
 * Single source of truth for analytics provider IDs. Never read
 * process.env directly outside this file — import from here so rotating
 * or disabling a provider only requires one edit.
 *
 * Every value is optional by design: a provider whose ID isn't set is
 * simply never registered as ready (see lib/services/analytics/index.ts)
 * rather than throwing. This keeps local/dev environments working without
 * every analytics account being configured.
 */

export const GA4_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "";
export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || "";

export const IS_GA4_ENABLED = GA4_MEASUREMENT_ID.length > 0;
export const IS_META_PIXEL_ENABLED = META_PIXEL_ID.length > 0;
