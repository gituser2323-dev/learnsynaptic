import { getMeetingRepository } from "@/lib/db";
import { integrationService } from "@/lib/services/integrations";
import { activityService } from "@/lib/services/crm/activities";
import { taskService } from "@/lib/services/crm/tasks";
import { auditLogService, AUDIT_ACTIONS } from "@/lib/services/auditLog";
import type { AuditContext } from "@/lib/services/auditLog";
import { getCalendarProvider } from "./registry";
import { createOAuthState, verifyOAuthState } from "./oauthState";
import { encryptToken, decryptToken } from "./tokenCrypto";
import { validateScheduleMeetingInput, type MeetingValidationError } from "./validation";
import { CalendarProviderNotConnectedError, CalendarProviderError, OAuthStateInvalidError } from "./errors";
import type { PaginatedResult } from "@/lib/pagination";
import type {
  BusyInterval,
  CalendarListEntry,
  CalendarProviderId,
  Meeting,
  MeetingListFilters,
  OAuthTokenSet,
} from "./types";

const TOKEN_REFRESH_BUFFER_MS = 2 * 60_000; // Refresh 2 minutes before real expiry, not exactly at it.

/**
 * Calendar & Meeting Connectors (Phase 6), Module 6.3 — the ONE place
 * every business module should call to schedule/read/update/cancel a
 * real meeting, regardless of which provider is active for it. Mirrors
 * fileStorageService.ts's own shape deliberately: validate → gate via
 * the Integrations Registry → call the concrete provider → persist →
 * audit.
 */

/** The same two-factor gate fileStorageService.ts's assertProviderReady()
 *  established for Module 6.2: STORAGE_PROVIDER (there) / a configured
 *  OAuth app (here) picks which adapter's code CAN run; the
 *  Integrations Registry additionally must show connected+enabled
 *  before it's actually allowed to. Unlike Storage, there is no
 *  no-account "local" exemption here — every calendar provider is a
 *  real OAuth vendor, so every one of them goes through this gate. */
async function assertProviderReady(providerId: CalendarProviderId): Promise<void> {
  const integration = await integrationService.getIntegration(providerId);
  if (!integration || integration.status !== "connected" || !integration.enabled) {
    throw new CalendarProviderNotConnectedError(providerId);
  }
}

/** Decrypts the connection's stored OAuth tokens, refreshing (and
 *  re-persisting, encrypted) proactively when they're expired or
 *  expiring soon — the module's own "Error Recovery" requirement for
 *  the single most common real failure mode (an access token going
 *  stale between requests) handled before it ever reaches a vendor
 *  call, not after. */
async function getValidTokens(providerId: CalendarProviderId): Promise<OAuthTokenSet> {
  const integration = await integrationService.getIntegration(providerId);
  if (!integration || integration.credentialRef.type !== "oauth") {
    throw new CalendarProviderNotConnectedError(providerId);
  }

  const { credentialRef } = integration;
  const tokens: OAuthTokenSet = {
    accessToken: decryptToken(credentialRef.accessToken),
    refreshToken: credentialRef.refreshToken ? decryptToken(credentialRef.refreshToken) : undefined,
    expiresAt: credentialRef.expiresAt,
    scope: credentialRef.scope,
  };

  const isExpiringSoon = new Date(tokens.expiresAt).getTime() - Date.now() < TOKEN_REFRESH_BUFFER_MS;
  if (!isExpiringSoon) return tokens;
  if (!tokens.refreshToken) return tokens; // Nothing to refresh with — let the vendor call itself surface the real failure.

  const provider = getCalendarProvider(providerId);
  const refreshed = await provider.refreshAccessToken(tokens.refreshToken);

  await integrationService.updateCredentialRef(providerId, {
    type: "oauth",
    provider: providerId,
    accessToken: encryptToken(refreshed.accessToken),
    refreshToken: refreshed.refreshToken ? encryptToken(refreshed.refreshToken) : credentialRef.refreshToken,
    expiresAt: refreshed.expiresAt,
    scope: refreshed.scope,
  });

  return refreshed;
}

export type ScheduleMeetingResult = { success: true; meeting: Meeting } | { success: false; errors: MeetingValidationError[] };

export const calendarService = {
  // ─── OAuth connection lifecycle ─────────────────────────────────────

  /** Kicks off the 3-legged OAuth flow — the URL an admin's browser
   *  should be redirected to. Throws CalendarProviderNotConfiguredError
   *  if this provider's OAuth app env vars aren't set. */
  getAuthorizationUrl(providerId: CalendarProviderId): string {
    const provider = getCalendarProvider(providerId);
    const state = createOAuthState(providerId);
    return provider.getAuthorizationUrl(state);
  },

  /** The OAuth callback route's own call — verifies `state`, exchanges
   *  `code` for real tokens, encrypts them, and persists the
   *  connection via Module 6.1's own connect() (so a calendar
   *  connection shows up in the exact same Integrations Registry UI
   *  every other provider does — no second connection-lifecycle
   *  system built). Returns the verified providerId on success. */
  async completeOAuthConnection(state: string, code: string, context: AuditContext = {}): Promise<CalendarProviderId> {
    const providerId = verifyOAuthState(state);
    if (!providerId) throw new OAuthStateInvalidError();

    const provider = getCalendarProvider(providerId as CalendarProviderId);
    const tokens = await provider.exchangeCodeForTokens(code);

    const result = await integrationService.connect(
      providerId,
      {
        credentialRef: {
          type: "oauth",
          provider: providerId,
          accessToken: encryptToken(tokens.accessToken),
          refreshToken: tokens.refreshToken ? encryptToken(tokens.refreshToken) : undefined,
          expiresAt: tokens.expiresAt,
          scope: tokens.scope,
        },
      },
      context,
    );
    if (!result.success) throw new CalendarProviderError(providerId as CalendarProviderId, result.error.message);

    return providerId as CalendarProviderId;
  },

  // ─── Calendar Selection / Availability Lookup ───────────────────────

  async listCalendars(providerId: CalendarProviderId): Promise<CalendarListEntry[]> {
    await assertProviderReady(providerId);
    const tokens = await getValidTokens(providerId);
    const provider = getCalendarProvider(providerId);
    try {
      const calendars = await provider.listCalendars(tokens);
      await integrationService.recordSync(providerId, "success", `Listed ${calendars.length} calendar(s).`);
      return calendars;
    } catch (error) {
      await integrationService.recordSync(providerId, "failure", error instanceof Error ? error.message : "listCalendars failed");
      throw error;
    }
  },

  async getAvailability(providerId: CalendarProviderId, calendarId: string, rangeStart: string, rangeEnd: string): Promise<BusyInterval[]> {
    await assertProviderReady(providerId);
    const tokens = await getValidTokens(providerId);
    const provider = getCalendarProvider(providerId);
    return provider.getAvailability(tokens, calendarId, rangeStart, rangeEnd);
  },

  /** "Sync Now" — a real, cheap, read-only vendor call that both
   *  confirms the connection is still live and refreshes its health
   *  status, reusing the Integrations Registry's own sync-recording
   *  rather than a second health-check mechanism. */
  async syncNow(providerId: CalendarProviderId): Promise<void> {
    await assertProviderReady(providerId);
    const tokens = await getValidTokens(providerId);
    const provider = getCalendarProvider(providerId);
    try {
      const calendars = await provider.listCalendars(tokens);
      await integrationService.recordSync(providerId, "success", `Sync check ok — ${calendars.length} calendar(s) visible.`);
    } catch (error) {
      await integrationService.recordSync(providerId, "failure", error instanceof Error ? error.message : "sync check failed");
      throw error;
    }
  },

  // ─── Meeting Scheduling / Event CRUD ─────────────────────────────────

  async scheduleMeeting(input: unknown, context: AuditContext = {}): Promise<ScheduleMeetingResult> {
    const validation = validateScheduleMeetingInput(input);
    if (!validation.valid) return { success: false, errors: validation.errors };
    const data = validation.data;

    await assertProviderReady(data.provider);
    const tokens = await getValidTokens(data.provider);
    const provider = getCalendarProvider(data.provider);
    const repository = await getMeetingRepository();

    let externalEventId: string | undefined;
    let meetingLink: string | undefined;
    let syncStatus: "synced" | "failed" = "synced";
    let lastSyncError: string | undefined;

    try {
      const result = await provider.createEvent(tokens, {
        calendarId: data.calendarId,
        title: data.title,
        description: data.description,
        startAt: data.startAt,
        endAt: data.endAt,
        timezone: data.timezone,
        invitees: data.invitees,
        reminderMinutesBefore: data.reminderMinutesBefore,
      });
      externalEventId = result.externalEventId;
      meetingLink = result.meetingLink;
      await integrationService.recordSync(data.provider, "success", `Scheduled "${data.title}".`);
    } catch (error) {
      // Error Recovery: the Meeting row is still created — visible,
      // retriable (via updateMeeting) — rather than the whole
      // scheduling attempt vanishing with no trace.
      syncStatus = "failed";
      lastSyncError = error instanceof Error ? error.message : "createEvent failed";
      await integrationService.recordSync(data.provider, "failure", lastSyncError);
    }

    const meeting = await repository.create({
      provider: data.provider,
      externalEventId,
      calendarId: data.calendarId,
      title: data.title,
      description: data.description,
      startAt: data.startAt,
      endAt: data.endAt,
      timezone: data.timezone,
      meetingLink,
      status: "scheduled",
      invitees: data.invitees,
      reminderMinutesBefore: data.reminderMinutesBefore,
      syncStatus,
      lastSyncError,
      relatedEntityType: data.relatedEntityType,
      relatedEntityId: data.relatedEntityId,
      createdBy: context.actorId,
    });

    await auditLogService.record({
      action: AUDIT_ACTIONS.MEETING_SCHEDULED,
      entityType: "Meeting",
      entityId: meeting.id,
      actorId: context.actorId,
      requestId: context.requestId,
      metadata: { provider: meeting.provider, syncStatus: meeting.syncStatus },
    });

    // CRM Integration: "a scheduled meeting must automatically appear
    // inside the Lead Timeline" — reuses activityService.logSystemEvent
    // directly (Module 4.1's own function), the exact call shape
    // taskService.createTask already uses for the same purpose. Also
    // covers Opportunity — Activity's own entityType union already
    // supports it, and the mission names Opportunities alongside Leads
    // under CRM Integration.
    if ((data.relatedEntityType === "Lead" || data.relatedEntityType === "Opportunity") && data.relatedEntityId) {
      const when = new Date(data.startAt).toLocaleString("en-IN", { timeZone: data.timezone });
      await activityService.logSystemEvent(data.relatedEntityType, data.relatedEntityId, `Meeting scheduled: "${data.title}" at ${when} (${data.timezone})`);
    }

    // Tasks integration: reuses the existing taskService.createTask()
    // directly — no new automation logic, just an optional, real call
    // to an already-existing service, the same reuse posture 6.2 took
    // toward every other existing module it touched.
    if (data.createFollowUpTask && data.relatedEntityType === "Lead" && data.relatedEntityId && context.actorId) {
      await taskService.createTask(
        {
          title: `Follow up: ${data.title}`,
          dueAt: data.endAt,
          priority: "medium",
          assigneeId: context.actorId,
          entityType: "Lead",
          entityId: data.relatedEntityId,
        },
        context,
      );
    }

    return { success: true, meeting };
  },

  async getMeeting(id: string): Promise<Meeting | null> {
    const repository = await getMeetingRepository();
    return repository.findById(id);
  },

  async listMeetings(filters: MeetingListFilters, page = 1, limit = 20): Promise<PaginatedResult<Meeting>> {
    const repository = await getMeetingRepository();
    return repository.list(filters, page, limit);
  },

  async updateMeeting(id: string, input: unknown, context: AuditContext = {}): Promise<ScheduleMeetingResult> {
    const repository = await getMeetingRepository();
    const existing = await repository.findById(id);
    if (!existing || existing.deletedAt) return { success: false, errors: [{ field: "id", message: "Meeting not found." }] };

    // Reuses the same validator — a reschedule needs the same shape as
    // a fresh schedule, just applied as a patch (see the merge below).
    const validation = validateScheduleMeetingInput({ ...existing, ...(input && typeof input === "object" ? input : {}), provider: existing.provider });
    if (!validation.valid) return { success: false, errors: validation.errors };
    const data = validation.data;

    await assertProviderReady(existing.provider);
    let meetingLink = existing.meetingLink;
    let syncStatus: "synced" | "failed" = "synced";
    let lastSyncError: string | undefined;

    if (existing.externalEventId) {
      const tokens = await getValidTokens(existing.provider);
      const provider = getCalendarProvider(existing.provider);
      try {
        const result = await provider.updateEvent(tokens, existing.externalEventId, existing.calendarId, {
          title: data.title,
          description: data.description,
          startAt: data.startAt,
          endAt: data.endAt,
          timezone: data.timezone,
          invitees: data.invitees,
          reminderMinutesBefore: data.reminderMinutesBefore,
        });
        // Some vendors (Zoom's PATCH) don't return a fresh link — never overwrite a real link with nothing.
        meetingLink = result.meetingLink ?? existing.meetingLink;
        await integrationService.recordSync(existing.provider, "success", `Updated "${data.title}".`);
      } catch (error) {
        syncStatus = "failed";
        lastSyncError = error instanceof Error ? error.message : "updateEvent failed";
        await integrationService.recordSync(existing.provider, "failure", lastSyncError);
      }
    }

    const meeting = await repository.update(id, {
      title: data.title,
      description: data.description,
      startAt: data.startAt,
      endAt: data.endAt,
      timezone: data.timezone,
      meetingLink,
      invitees: data.invitees,
      reminderMinutesBefore: data.reminderMinutesBefore,
      syncStatus,
      lastSyncError,
    });

    await auditLogService.record({
      action: AUDIT_ACTIONS.MEETING_UPDATED,
      entityType: "Meeting",
      entityId: meeting.id,
      actorId: context.actorId,
      requestId: context.requestId,
      metadata: { provider: meeting.provider, syncStatus: meeting.syncStatus },
    });

    return { success: true, meeting };
  },

  async cancelMeeting(id: string, context: AuditContext = {}): Promise<Meeting | null> {
    const repository = await getMeetingRepository();
    const existing = await repository.findById(id);
    if (!existing || existing.deletedAt) return null;

    if (existing.externalEventId) {
      await assertProviderReady(existing.provider);
      const tokens = await getValidTokens(existing.provider);
      const provider = getCalendarProvider(existing.provider);
      try {
        await provider.cancelEvent(tokens, existing.externalEventId, existing.calendarId);
        await integrationService.recordSync(existing.provider, "success", `Cancelled "${existing.title}".`);
      } catch (error) {
        await integrationService.recordSync(existing.provider, "failure", error instanceof Error ? error.message : "cancelEvent failed");
        throw error;
      }
    }

    const meeting = await repository.update(id, { status: "cancelled" });

    await auditLogService.record({
      action: AUDIT_ACTIONS.MEETING_CANCELLED,
      entityType: "Meeting",
      entityId: id,
      actorId: context.actorId,
      requestId: context.requestId,
      metadata: { provider: existing.provider },
    });

    if ((existing.relatedEntityType === "Lead" || existing.relatedEntityType === "Opportunity") && existing.relatedEntityId) {
      await activityService.logSystemEvent(existing.relatedEntityType, existing.relatedEntityId, `Meeting cancelled: "${existing.title}"`);
    }

    return meeting;
  },

  // ─── Reminder Support (extension point, real but minimal — see the
  // module's own "do not implement new automation logic beyond the
  // required integration" instruction) ─────────────────────────────────

  /** Mirrors taskService.processPendingReminders()'s own precedent
   *  exactly: find meetings whose reminder is due and not yet sent,
   *  notify, mark reminderSentAt as a fire-once guard. Called from the
   *  same scheduler poller Task's reminders already use. */
  async processPendingReminders(): Promise<void> {
    const repository = await getMeetingRepository();
    const due = await repository.findPendingReminders(new Date());
    const { notificationService } = await import("@/lib/services/crm/notifications");

    for (const meeting of due) {
      if (meeting.createdBy) {
        const when = new Date(meeting.startAt).toLocaleString("en-IN", { timeZone: meeting.timezone });
        await notificationService.notify({
          userId: meeting.createdBy,
          type: "meeting_reminder",
          entityType: "Meeting",
          entityId: meeting.id,
          message: `Meeting reminder: "${meeting.title}" starts at ${when} (${meeting.timezone}).`,
        });
      }
      await repository.update(meeting.id, { reminderSentAt: new Date().toISOString() });
    }
  },
};
