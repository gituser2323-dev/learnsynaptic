/**
 * Generic Webhooks & Team Notifications (Phase 6), Module 6.5 — real
 * input validation for registering a webhook endpoint, the same
 * discipline every other module's own create-input validator in this
 * app already applies.
 */

export interface WebhookValidationError {
  field: string;
  message: string;
}

export interface ValidatedRegisterEndpointInput {
  name: string;
  url: string;
  subscribedEventTypes: string[];
  secret?: string;
}

const MAX_RESPONSE_SNIPPET_LENGTH = 500;

/** Only http(s) — never a private/loopback/link-local-looking host, a
 *  minimal, real SSRF guard (an admin-registered endpoint is still a
 *  URL this server will make a real outbound request to on every
 *  matching event, so "any string" is not a safe validation bar).
 *  RC-2 — extended beyond the original loopback/metadata-IP set to
 *  also cover the three real RFC 1918 private ranges (10/8, 172.16/12,
 *  192.168/16): even though this route requires an already-privileged
 *  admin session, an admin account being phished/compromised is a
 *  realistic threat model this app's own tenant-isolation work already
 *  takes seriously elsewhere, and blocking a webhook target from
 *  reaching another internal service on a shared private network is a
 *  cheap, real closure of that path. Still not exhaustive DNS-
 *  rebinding protection (a hostname that resolves to a private IP only
 *  at request time, after this string-level check, is out of scope for
 *  this module) — a real, disclosed floor, not a claim of completeness. */
const BLOCKED_HOSTNAME_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^169\.254\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^\[?::1\]?$/,
  /^\[?fe80:/i,
  /^\[?fc[0-9a-f]{2}:/i,
  /^\[?fd[0-9a-f]{2}:/i,
];

export function validateRegisterEndpointInput(input: unknown): { valid: true; data: ValidatedRegisterEndpointInput } | { valid: false; errors: WebhookValidationError[] } {
  const errors: WebhookValidationError[] = [];
  const body = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) errors.push({ field: "name", message: "name is required." });

  const urlRaw = typeof body.url === "string" ? body.url.trim() : "";
  let parsedUrl: URL | null = null;
  if (!urlRaw) {
    errors.push({ field: "url", message: "url is required." });
  } else {
    try {
      parsedUrl = new URL(urlRaw);
      if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        errors.push({ field: "url", message: "url must be http or https." });
      } else if (BLOCKED_HOSTNAME_PATTERNS.some((p) => p.test(parsedUrl!.hostname))) {
        errors.push({ field: "url", message: "url may not target a local/loopback address." });
      }
    } catch {
      errors.push({ field: "url", message: "url must be a valid URL." });
    }
  }

  const subscribedEventTypesRaw = Array.isArray(body.subscribedEventTypes) ? body.subscribedEventTypes : [];
  const subscribedEventTypes = subscribedEventTypesRaw.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  if (subscribedEventTypes.length === 0) {
    errors.push({ field: "subscribedEventTypes", message: 'subscribedEventTypes must be a non-empty array of event type strings, or ["*"] for every event.' });
  }

  const secret = typeof body.secret === "string" && body.secret.trim() ? body.secret.trim() : undefined;
  if (secret !== undefined && secret.length < 16) {
    errors.push({ field: "secret", message: "secret must be at least 16 characters when supplied." });
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true, data: { name, url: urlRaw, subscribedEventTypes, secret } };
}

/** Truncates a third-party response body before it's ever persisted —
 *  Delivery History needs enough to debug a failure, never the whole
 *  arbitrary response a hostile or misbehaving endpoint could return. */
export function truncateResponseSnippet(body: string): string {
  return body.length > MAX_RESPONSE_SNIPPET_LENGTH ? `${body.slice(0, MAX_RESPONSE_SNIPPET_LENGTH)}…` : body;
}
