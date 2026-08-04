import type { PaginatedResult } from "@/lib/pagination";

/**
 * Calendar & Meeting Connectors (Phase 6), Module 6.3 — domain layer.
 *
 * Mirrors Module 6.2's shape deliberately: a generic `CalendarProvider`
 * interface every vendor adapter implements, a central `Meeting` model
 * (the "FileAsset" of this module — one polymorphic table every CRM
 * entity links into, not a bespoke per-module scheduling table), and
 * the same two-factor Integrations Registry gate (see
 * calendarService.ts's assertProviderReady()). The one real structural
 * difference from Storage: every provider here is OAuth-based (no
 * "local" no-account fallback exists for a calendar), so every method
 * on `CalendarProvider` takes the connection's own OAuth tokens
 * explicitly rather than reading a single global config.
 */

export type CalendarProviderId =
  | "google_calendar"
  | "google_meet"
  | "microsoft_outlook_calendar"
  | "microsoft_teams_meetings"
  | "zoom";

/** A live (already-decrypted, for the duration of one request only —
 *  never persisted in this shape) OAuth token pair. `expiresAt` is an
 *  ISO timestamp; calendarService refreshes proactively before it
 *  passes an expired-or-expiring token to a provider method. */
export interface OAuthTokenSet {
  accessToken: string;
  refreshToken?: string;
  expiresAt: string;
  scope?: string;
}

export interface CalendarListEntry {
  id: string;
  name: string;
  isPrimary: boolean;
}

/** A busy interval on a calendar — the raw material for "Availability
 *  Lookup." Deliberately just start/end, not full event detail: a
 *  counsellor checking free/busy time before scheduling doesn't need
 *  (and shouldn't see) the vendor's other event titles/attendees. */
export interface BusyInterval {
  start: string;
  end: string;
}

export interface CreateMeetingInput {
  calendarId?: string;
  title: string;
  description?: string;
  startAt: string;
  endAt: string;
  /** IANA timezone, e.g. "Asia/Kolkata" — every vendor API below is
   *  told this explicitly rather than assuming UTC or server-local
   *  time, the "Timezone Handling" requirement satisfied at the
   *  provider boundary, not left to each caller to get right. */
  timezone: string;
  invitees: { email: string; name?: string }[];
  reminderMinutesBefore?: number;
}

export type UpdateMeetingInput = Partial<CreateMeetingInput>;

/** What a provider hands back after create/update — enough to persist
 *  onto the central Meeting row. `meetingLink` is the real, vendor-
 *  hosted join URL (a Meet/Teams/Zoom link) — the "Meeting Link
 *  Generation" requirement. */
export interface ProviderMeetingResult {
  externalEventId: string;
  meetingLink?: string;
}

/**
 * One implementation per vendor (providers/*.ts). OAuth methods
 * (getAuthorizationUrl/exchangeCodeForTokens/refreshAccessToken) need
 * no live connection yet — they're how one gets established. Every
 * other method takes an already-valid OAuthTokenSet, supplied by
 * calendarService after it's confirmed/refreshed the stored tokens.
 */
export interface CalendarProvider {
  readonly id: CalendarProviderId;
  /** Builds the real, vendor-documented authorization-code-grant URL a
   *  browser should be redirected to. `state` is this app's own signed
   *  CSRF token (oauthState.ts) — the provider never sees or
   *  interprets it, just round-trips it per the OAuth 2.0 spec. */
  getAuthorizationUrl(state: string): string;
  exchangeCodeForTokens(code: string): Promise<OAuthTokenSet>;
  refreshAccessToken(refreshToken: string): Promise<OAuthTokenSet>;
  listCalendars(tokens: OAuthTokenSet): Promise<CalendarListEntry[]>;
  getAvailability(tokens: OAuthTokenSet, calendarId: string, rangeStart: string, rangeEnd: string): Promise<BusyInterval[]>;
  createEvent(tokens: OAuthTokenSet, input: CreateMeetingInput): Promise<ProviderMeetingResult>;
  updateEvent(tokens: OAuthTokenSet, externalEventId: string, calendarId: string | undefined, input: UpdateMeetingInput): Promise<ProviderMeetingResult>;
  cancelEvent(tokens: OAuthTokenSet, externalEventId: string, calendarId?: string): Promise<void>;
}

export type MeetingStatus = "scheduled" | "confirmed" | "cancelled" | "completed";
export type MeetingSyncStatus = "synced" | "pending" | "failed";

export interface MeetingInvitee {
  email: string;
  name?: string;
  responseStatus?: "needsAction" | "accepted" | "declined" | "tentative";
}

/**
 * The central Meeting row — one per scheduled meeting, regardless of
 * provider. `relatedEntityType`/`relatedEntityId` are a plain string
 * pair, not a closed union — the exact same deliberate deviation
 * FileAsset (Module 6.2) already made, for the identical reason: a
 * Meeting must stay reusable by CRM entities that don't exist yet
 * (a future Student Portal session booking, for instance), and a
 * closed union would need editing per future caller.
 */
export interface Meeting {
  id: string;
  provider: CalendarProviderId;
  /** The vendor's own event/meeting id — absent only for a meeting
   *  whose provider-side create call failed (syncStatus "failed", see
   *  below); the Meeting row itself still persists so the failure is
   *  visible and retriable, the same "Error Recovery" posture
   *  fileStorageService established for a failed provider call. */
  externalEventId?: string;
  calendarId?: string;
  title: string;
  description?: string;
  startAt: string;
  endAt: string;
  timezone: string;
  meetingLink?: string;
  status: MeetingStatus;
  invitees: MeetingInvitee[];
  reminderMinutesBefore?: number;
  reminderSentAt?: string;
  syncStatus: MeetingSyncStatus;
  lastSyncError?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  createdBy?: string;
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface CreateMeetingRecordInput {
  provider: CalendarProviderId;
  externalEventId?: string;
  calendarId?: string;
  title: string;
  description?: string;
  startAt: string;
  endAt: string;
  timezone: string;
  meetingLink?: string;
  status: MeetingStatus;
  invitees: MeetingInvitee[];
  reminderMinutesBefore?: number;
  syncStatus: MeetingSyncStatus;
  lastSyncError?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  createdBy?: string;
  organizationId?: string;
}

export interface UpdateMeetingRecordInput {
  externalEventId?: string;
  title?: string;
  description?: string;
  startAt?: string;
  endAt?: string;
  timezone?: string;
  meetingLink?: string;
  status?: MeetingStatus;
  invitees?: MeetingInvitee[];
  reminderMinutesBefore?: number;
  reminderSentAt?: string;
  syncStatus?: MeetingSyncStatus;
  lastSyncError?: string;
  deletedAt?: string;
}

export interface MeetingListFilters {
  relatedEntityType?: string;
  relatedEntityId?: string;
  provider?: CalendarProviderId;
  status?: MeetingStatus;
  includeDeleted?: boolean;
}

export interface MeetingRepository {
  findById(id: string): Promise<Meeting | null>;
  create(input: CreateMeetingRecordInput): Promise<Meeting>;
  update(id: string, input: UpdateMeetingRecordInput): Promise<Meeting>;
  list(filters: MeetingListFilters, page: number, limit: number): Promise<PaginatedResult<Meeting>>;
  /** The reminder poller's own query — mirrors Task's
   *  findPendingReminders() precedent exactly. */
  findPendingReminders(before: Date): Promise<Meeting[]>;
}
