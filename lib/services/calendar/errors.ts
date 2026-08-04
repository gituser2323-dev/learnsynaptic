import type { CalendarProviderId } from "./types";

/** The active provider has no real OAuth app credentials configured
 *  (config/calendar.ts) — mirrors StorageProviderNotConfiguredError's
 *  own "fail gracefully, this is the expected common case" posture. */
export class CalendarProviderNotConfiguredError extends Error {
  constructor(providerId: CalendarProviderId, reason: string) {
    super(`Calendar provider "${providerId}" is not configured: ${reason}.`);
    this.name = "CalendarProviderNotConfiguredError";
  }
}

/** The provider is configured (a real OAuth app exists) but hasn't
 *  been connected+enabled through the Integrations Registry (Module
 *  6.1) yet — the same two-factor gate fileStorageService enforces for
 *  every non-local storage provider. */
export class CalendarProviderNotConnectedError extends Error {
  constructor(providerId: CalendarProviderId) {
    super(`Calendar provider "${providerId}" is not connected and enabled — connect it in Settings → Integrations first.`);
    this.name = "CalendarProviderNotConnectedError";
  }
}

/** A real vendor API call failed — distinct from "not configured"/
 *  "not connected", which are both known, expected states this app
 *  must degrade from gracefully. */
export class CalendarProviderError extends Error {
  constructor(providerId: CalendarProviderId, message: string) {
    super(`Calendar provider "${providerId}" error: ${message}`);
    this.name = "CalendarProviderError";
  }
}

/** The OAuth `state` param on a callback request didn't verify — either
 *  tampered, expired, or a replayed/forged request. Never leaks which
 *  specific check failed (matches signedUrl.ts's own callback route
 *  precedent from Module 6.2). */
export class OAuthStateInvalidError extends Error {
  constructor() {
    super("Invalid or expired OAuth state.");
    this.name = "OAuthStateInvalidError";
  }
}

export class MeetingNotFoundError extends Error {
  constructor(id: string) {
    super(`Meeting ${id} not found.`);
    this.name = "MeetingNotFoundError";
  }
}
