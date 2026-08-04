import type { AttributionRecord, AttributionTouch, UtmParams } from "./types";

const COOKIE_NAME = "ls_attribution";
const COOKIE_MAX_AGE_DAYS = 30;

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "fbclid",
  "gclid",
] as const;

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string, maxAgeDays: number): void {
  if (typeof document === "undefined") return;
  const maxAgeSeconds = maxAgeDays * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax`;
}

function extractUtmParams(searchParams: URLSearchParams): UtmParams {
  const params: UtmParams = {};
  for (const key of UTM_KEYS) {
    const value = searchParams.get(key);
    if (value) params[key] = value;
  }
  return params;
}

function hasAnyUtmParam(params: UtmParams): boolean {
  return Object.keys(params).length > 0;
}

function readAttribution(): AttributionRecord | null {
  const raw = readCookie(COOKIE_NAME);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AttributionRecord;
  } catch {
    return null;
  }
}

function writeAttribution(record: AttributionRecord): void {
  writeCookie(COOKIE_NAME, JSON.stringify(record), COOKIE_MAX_AGE_DAYS);
}

/**
 * Captures UTM/click-id params from the current URL and persists them as a
 * first-touch (set once) + last-touch (overwritten whenever the URL carries
 * new tracking params) attribution record. Safe to call on every page view:
 * it's a no-op whenever the URL carries no tracking params, regardless of
 * whether a record already exists.
 */
export function captureUtmParams(searchParams: URLSearchParams, path: string): void {
  const utmParams = extractUtmParams(searchParams);
  if (!hasAnyUtmParam(utmParams)) return;

  const existing = readAttribution();

  const touch: AttributionTouch = {
    ...utmParams,
    landingPath: path,
    referrer: typeof document !== "undefined" ? document.referrer : "",
    capturedAt: new Date().toISOString(),
  };

  const record: AttributionRecord = {
    first: existing?.first ?? touch,
    last: touch,
  };

  writeAttribution(record);
}

/** Returns the persisted attribution record, or null if none has been captured yet. */
export function getAttribution(): AttributionRecord | null {
  return readAttribution();
}
