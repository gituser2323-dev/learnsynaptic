/**
 * Pure derived-metric calculations — CTR, CPC, CPA, ROAS. No I/O, no
 * providers; funnels.ts and campaignMetrics.ts supply the raw numbers.
 * Kept separate and pure so each ratio is independently testable and the
 * divide-by-zero policy lives in exactly one place.
 *
 * Every function returns null (never NaN/Infinity) when the denominator
 * is zero — "no clicks yet" is not "0% CTR", it's "CTR is undefined for
 * this range."
 */

export function safeDivide(numerator: number, denominator: number): number | null {
  if (!denominator) return null;
  return numerator / denominator;
}

/** clicks / impressions. */
export function calculateCtr(clicks: number, impressions: number): number | null {
  return safeDivide(clicks, impressions);
}

/** spend / clicks. */
export function calculateCpc(spend: number, clicks: number): number | null {
  return safeDivide(spend, clicks);
}

/** spend / conversions. */
export function calculateCpa(spend: number, conversions: number): number | null {
  return safeDivide(spend, conversions);
}

/** revenue / spend. */
export function calculateRoas(revenue: number, spend: number): number | null {
  return safeDivide(revenue, spend);
}
