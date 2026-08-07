import type { Lead, LeadListFilters, UtmBreakdownRow } from "@/lib/services/leads";
import type { Campaign, CampaignListFilters } from "@/lib/services/campaigns";
import type { Registration, RegistrationListFilters, RegistrationAnalytics } from "@/lib/services/registrations";
import type { Attendance, AttendanceListFilters, CreateAttendanceInput } from "@/lib/services/attendance";
import type { UserRole, PlatformRole } from "@/lib/services/auth";
import type { StudentStatusSummary } from "@/lib/services/adminAnalytics";
import type {
  DateRange,
  LeadFunnel,
  ConversionFunnel,
  RevenueFunnel,
  OverallMarketingMetrics,
  CampaignMarketingMetrics,
} from "@/lib/services/marketing";
import type { PaginatedResult } from "@/lib/pagination";
import type {
  WhatsAppCampaign,
  WhatsAppCampaignListFilters,
  CreateWhatsAppCampaignInput,
  CampaignTemplate,
  CampaignTemplateListFilters,
  CreateCampaignTemplateInput,
  Message,
  MessageListFilters,
  MessageStatusCounts,
  ResolveAudienceInput,
  AudienceResolutionResult,
  CsvImportResult,
  CampaignValidationError,
} from "@/lib/services/whatsappCampaigns";
import type {
  WorkflowRun,
  WorkflowRunListFilters,
  WorkflowDefinitionRecord,
  WorkflowValidationError,
  AutoReplyRule,
  AutoReplyRuleValidationError,
} from "@/lib/services/automation";
import type { AutomationAnalyticsSummary, WorkflowPerformanceResult } from "@/lib/services/automation/analytics";
import type {
  RevenueMetrics,
  RevenueGrowth,
  RevenueAttributionResult,
  CrmFunnelResult,
  CounsellorRevenueResult,
  CampaignRoiResult,
  WhatsAppRevenueResult,
  AutomationRoiSummary,
  DateRangePreset,
  ResolvedDateRange,
} from "@/lib/services/revenueAnalytics";
import type { ActionCenterResult, ExecutiveDashboardResult } from "@/lib/services/executiveDashboard";
import type { AuditLogEntry, AuditLogListFilters } from "@/lib/services/auditLog";
import type { WebhookDelivery, WebhookDeliveryListFilters } from "@/lib/services/webhookMonitoring";
import type { WhatsAppPhoneNumberRecord } from "@/lib/services/whatsapp/phoneNumbers";
import type { AdminSettingsSnapshot } from "@/lib/services/settings";
import type { Activity, ActivityEntityType, ActivityType } from "@/lib/services/crm/activities";
import type { Task, TaskListFilters, TaskPriority, TaskRecurrence } from "@/lib/services/crm/tasks";
import type { Tag } from "@/lib/services/crm/tags";
import type { CustomFieldDefinition, CustomFieldType } from "@/lib/services/crm/customFields";
import type { AssignmentRule, AssignmentStrategy } from "@/lib/services/crm/assignment";
import type { Opportunity, OpportunityListFilters, Pipeline } from "@/lib/services/crm/pipelines";
import type { DuplicateLeadGroup, UpdateLeadInput } from "@/lib/services/leads";
import type { Notification } from "@/lib/services/crm/notifications";
import type { LeaderboardResult } from "@/lib/services/crm/leaderboard";
import type { PipelineAnalyticsResult } from "@/lib/services/crm/pipelineAnalytics";
import type { Conversation, ConversationListFilters, SendReplyInput } from "@/lib/services/conversations";
import type { LeadInsight } from "@/lib/services/crm/leadInsights";
import type { ReplyTone, GenerateReplyResult } from "@/lib/services/conversations/aiReply";
import type { ConversationInsight } from "@/lib/services/conversations/insights";
import type { IntegrationSummary, IntegrationLog, IntegrationCredentialRef } from "@/lib/services/integrations";
import type { FileAsset, FileCategory } from "@/lib/services/storage";
import type { Meeting, MeetingStatus, CalendarProviderId, CalendarListEntry, BusyInterval } from "@/lib/services/calendar";
import type {
  WebhookEndpoint,
  WebhookEndpointStatus,
  WebhookDeliveryAttempt,
  WebhookDeliveryOutcome as OutboundWebhookDeliveryOutcome,
  NotificationProviderId,
} from "@/lib/services/webhooks";
import type { Payment, PaymentProviderId, PaymentStatus, PaymentWebhookEvent, PaymentWebhookOutcome } from "@/lib/services/payments";
import type { Organization, OrganizationStatus } from "@/lib/services/organizations";
import type { Subscription, Plan, PlanCapability, UsageMetric } from "@/lib/services/billing";
import type { PlatformDashboardSnapshot, PlatformSearchResult } from "@/lib/services/platformAdmin";

/**
 * Browser-side fetch layer for the CRM Dashboard (Module 11) — every
 * `import type` above is erased at compile time (zero runtime code), so
 * none of lib/services/*'s server-only internals (lib/db, mongoose,
 * node:crypto) ever reach the client bundle. Same reasoning as
 * lib/services/leads/client.ts, generalized to every admin endpoint
 * this dashboard consumes.
 *
 * All requests go through apiFetch(), which does two things no
 * individual page should have to repeat: dedupes and retries once on a
 * 401 (the access token is short-lived by design — Module 9 — so this
 * is the normal case for anyone who keeps a dashboard tab open longer
 * than the token's TTL, not an edge case), and hard-redirects to
 * /admin/login if the session turns out to be unrecoverable. A 403
 * (valid session, insufficient role) is never treated this way — it's
 * returned to the caller as a normal failure so the page can render
 * "you don't have permission," not yanked away from what they were
 * looking at.
 */

export interface ApiFieldError {
  field: string;
  message: string;
}

export type ApiClientResult<T> =
  | { success: true; data: T }
  | { success: false; status: number; errors: ApiFieldError[] };

export interface DashboardUser {
  id: string;
  email: string;
  role: UserRole;
  name?: string;
  /** RC-1 — present since /api/auth/me and /api/auth/login both now
   *  return the full PublicUser shape, not just the JWT's own claims
   *  (mfaEnabled/emailVerified can change mid-session). */
  emailVerified?: boolean;
  mfaEnabled?: boolean;
  /** RC-6 — undefined for every ordinary tenant user, forever. The
   *  client uses this ONLY to decide whether to render the Platform
   *  Console entry point — every /api/admin/platform/* route enforces
   *  its own server-side gate regardless of what this says (hiding UI
   *  is not security, see withApiRoute.ts's own requiredPlatformRole
   *  doc comment). */
  platformRole?: PlatformRole;
}

const GENERIC_ERROR: ApiFieldError[] = [{ field: "root", message: "Something went wrong. Please try again." }];

let refreshInFlight: Promise<boolean> | null = null;

function attemptRefresh(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch("/api/auth/refresh", { method: "POST", credentials: "include" })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

async function apiFetch<T>(path: string, init?: RequestInit, isRetry = false): Promise<ApiClientResult<T>> {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  if (response.status === 401 && !isRetry && path !== "/api/auth/login") {
    const refreshed = await attemptRefresh();
    if (refreshed) return apiFetch<T>(path, init, true);
    // Refresh also failed — the session is genuinely over. Every call on
    // the page would fail the same way, so redirect once, here, instead
    // of every caller separately deciding to.
    if (typeof window !== "undefined") {
      window.location.href = "/admin/login";
    }
    return { success: false, status: 401, errors: [{ field: "root", message: "Session expired." }] };
  }

  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) {
    return { success: false, status: response.status, errors: body?.errors ?? GENERIC_ERROR };
  }
  return { success: true, data: body as T };
}

function buildQuery(params: Record<string, string | number | boolean | string[] | undefined>): string {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    // Enterprise CRM (Phase 1) — array-valued filters (e.g. tags) join
    // as a single comma-separated query param; the matching API route
    // splits on "," when reading it back, same convention used nowhere
    // else in this codebase yet because no filter needed multiple
    // values before Phase 1's tag filter.
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      usp.set(key, value.join(","));
      continue;
    }
    usp.set(key, String(value));
  }
  return usp.toString();
}

// ─── Auth ────────────────────────────────────────────────────────────────

/** RC-1 — login's own response is a real 3-way union, not just success/
 *  failure: `mfaRequired`/`locked` are both still HTTP 200s (a real,
 *  expected next step for the login form, not an error) carrying no
 *  `user`/`tokens` at all — the caller must check which shape it got
 *  before assuming a session was issued. Passing `mfaCode`/`rememberMe`/
 *  `trustedDeviceToken` re-submits to this SAME endpoint (see
 *  authService.login()'s own doc comment for why there's no separate
 *  "step 2" route). */
export interface LoginSuccess {
  mfaRequired?: false;
  locked?: false;
  user: DashboardUser;
  newDevice: boolean;
}
export interface LoginMfaRequired {
  mfaRequired: true;
}
export interface LoginLocked {
  locked: true;
  lockedUntil: string;
}
export type LoginResponse = LoginSuccess | LoginMfaRequired | LoginLocked;

export function login(
  email: string,
  password: string,
  options?: { rememberMe?: boolean; mfaCode?: string; trustedDeviceToken?: string },
): Promise<ApiClientResult<LoginResponse>> {
  return apiFetch("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password, ...options }) });
}

export function logout(): Promise<ApiClientResult<Record<string, never>>> {
  return apiFetch("/api/auth/logout", { method: "POST" });
}

export function getMe(): Promise<ApiClientResult<{ user: DashboardUser }>> {
  return apiFetch("/api/auth/me");
}

// ─── Auth — RC-1 Password lifecycle ──────────────────────────────────────

export function forgotPassword(email: string): Promise<ApiClientResult<{ message: string }>> {
  return apiFetch("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
}

export function resetPassword(token: string, newPassword: string): Promise<ApiClientResult<{ message: string }>> {
  return apiFetch("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ token, newPassword }) });
}

export function changePassword(currentPassword: string, newPassword: string): Promise<ApiClientResult<{ message: string }>> {
  return apiFetch("/api/auth/change-password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) });
}

export function resendVerificationEmail(): Promise<ApiClientResult<{ status: "sent" | "already_verified" | "not_found" }>> {
  return apiFetch("/api/auth/resend-verification", { method: "POST" });
}

/** Only ever resolves `success: true` for status "verified" — the route
 *  reports invalid/expired/already-used as a normal `apiError` (400),
 *  so those three arrive as `result.success === false` with a
 *  human-readable message in `result.errors[0].message`, not as a
 *  status enum on a success payload. */
export function verifyEmail(token: string): Promise<ApiClientResult<{ status: "verified"; message: string }>> {
  return apiFetch("/api/auth/verify-email", { method: "POST", body: JSON.stringify({ token }) });
}

// ─── Auth — RC-7 Self-service registration & team invitations ───────────

export function registerAccount(input: {
  email: string;
  name: string;
  password: string;
  termsAccepted: boolean;
}): Promise<ApiClientResult<{ user: DashboardUser }>> {
  return apiFetch("/api/auth/register", { method: "POST", body: JSON.stringify(input) });
}

export function acceptTeamInvitation(input: { token: string; name: string; password: string }): Promise<ApiClientResult<{ user: DashboardUser }>> {
  return apiFetch("/api/auth/invitations/accept", { method: "POST", body: JSON.stringify(input) });
}

// ─── RC-7 Onboarding ──────────────────────────────────────────────────────

export type OnboardingStepId = "plan" | "team" | "whatsapp" | "email" | "ai" | "calendar" | "crm" | "import";
export type OnboardingStepStatus = "skipped" | "completed";

export interface OnboardingOrganization {
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended";
  industry?: string;
  teamSize?: "1-10" | "11-50" | "51-200" | "201-1000" | "1000+";
  website?: string;
  country?: string;
  timezone?: string;
  createdAt: string;
}

export interface OnboardingStatusResponse {
  emailVerified: boolean;
  organization: OnboardingOrganization | null;
  resumeStep: "verify_email" | "create_organization" | "wizard" | "done";
  steps: Partial<Record<OnboardingStepId, OnboardingStepStatus>>;
  activatedAt?: string;
}

export function getOnboardingStatus(): Promise<ApiClientResult<{ status: OnboardingStatusResponse }>> {
  return apiFetch("/api/onboarding/status");
}

export function createOnboardingOrganization(input: {
  name: string;
  industry?: string;
  teamSize?: OnboardingOrganization["teamSize"];
  website?: string;
  country?: string;
  timezone?: string;
}): Promise<ApiClientResult<{ organization: OnboardingOrganization; alreadyExisted: boolean }>> {
  return apiFetch("/api/onboarding/organization", { method: "POST", body: JSON.stringify(input) });
}

export interface OnboardingSelectablePlan {
  id: string;
  name: string;
  description: string;
  trialDays: number;
  basePriceInSmallestUnit: number;
  currency: string;
}

export function listOnboardingPlans(): Promise<ApiClientResult<{ plans: OnboardingSelectablePlan[] }>> {
  return apiFetch("/api/onboarding/plans");
}

export function markOnboardingStep(step: OnboardingStepId, status: OnboardingStepStatus): Promise<ApiClientResult<{ organization: OnboardingOrganization }>> {
  return apiFetch(`/api/onboarding/steps/${step}`, { method: "POST", body: JSON.stringify({ status }) });
}

export interface TeamInvitation {
  id: string;
  organizationId: string;
  email: string;
  role: UserRole;
  status: "pending" | "accepted" | "revoked" | "expired";
  invitedByUserId: string;
  expiresAt: string;
  acceptedAt?: string;
  revokedAt?: string;
  createdAt: string;
}

export function listTeamInvitations(page = 1, limit = 20): Promise<ApiClientResult<PaginatedResult<TeamInvitation>>> {
  return apiFetch(`/api/admin/team/invitations?${buildQuery({ page, limit })}`);
}

export function sendTeamInvitation(email: string, role: UserRole): Promise<ApiClientResult<{ invitation: TeamInvitation }>> {
  return apiFetch("/api/admin/team/invitations", { method: "POST", body: JSON.stringify({ email, role }) });
}

export function resendTeamInvitation(id: string): Promise<ApiClientResult<{ invitation: TeamInvitation }>> {
  return apiFetch(`/api/admin/team/invitations/${id}/resend`, { method: "POST" });
}

export function revokeTeamInvitation(id: string): Promise<ApiClientResult<{ invitation: TeamInvitation }>> {
  return apiFetch(`/api/admin/team/invitations/${id}/revoke`, { method: "POST" });
}

// ─── Auth — RC-1 Session management ──────────────────────────────────────

export interface SessionSummary {
  id: string;
  deviceName?: string;
  browser?: string;
  os?: string;
  ipAddress?: string;
  rememberMe: boolean;
  createdAt: string;
  lastUsedAt?: string;
  isCurrent: boolean;
}

export function listSessions(): Promise<ApiClientResult<{ sessions: SessionSummary[] }>> {
  return apiFetch("/api/auth/sessions");
}

export function revokeSession(id: string): Promise<ApiClientResult<Record<string, never>>> {
  return apiFetch(`/api/auth/sessions/${id}`, { method: "DELETE" });
}

export function revokeOtherSessions(): Promise<ApiClientResult<Record<string, never>>> {
  return apiFetch("/api/auth/sessions/revoke-others", { method: "POST" });
}

export interface LoginHistoryEntry {
  id: string;
  action: string;
  createdAt: string;
  ipAddress?: string;
  userAgent?: string;
  deviceName?: string;
  reason?: string;
}

export function listLoginHistory(): Promise<ApiClientResult<{ history: LoginHistoryEntry[] }>> {
  return apiFetch("/api/auth/login-history");
}

// ─── Auth — RC-1 MFA ──────────────────────────────────────────────────────

export function mfaBeginSetup(): Promise<ApiClientResult<{ secret: string; qrCodeDataUrl: string }>> {
  return apiFetch("/api/auth/mfa/setup", { method: "POST" });
}

export function mfaConfirmSetup(code: string): Promise<ApiClientResult<{ recoveryCodes: string[] }>> {
  return apiFetch("/api/auth/mfa/confirm", { method: "POST", body: JSON.stringify({ code }) });
}

export function mfaDisable(currentPassword: string): Promise<ApiClientResult<Record<string, never>>> {
  return apiFetch("/api/auth/mfa/disable", { method: "POST", body: JSON.stringify({ currentPassword }) });
}

export function mfaRegenerateRecoveryCodes(): Promise<ApiClientResult<{ recoveryCodes: string[] }>> {
  return apiFetch("/api/auth/mfa/recovery-codes", { method: "POST" });
}

/** Pre-login — deliberately NOT routed through apiFetch's normal
 *  401-retry/redirect flow the same way login() itself isn't; called
 *  from the login form's own MFA step, before any session exists. */
export function mfaRequestEmailOtp(email: string, password: string): Promise<ApiClientResult<{ message: string }>> {
  return apiFetch("/api/auth/mfa/request-email-otp", { method: "POST", body: JSON.stringify({ email, password }) });
}

export interface TrustedDeviceSummary {
  id: string;
  deviceName?: string;
  createdAt: string;
  lastUsedAt?: string;
  expiresAt: string;
}

export function listTrustedDevices(): Promise<ApiClientResult<{ devices: TrustedDeviceSummary[] }>> {
  return apiFetch("/api/auth/mfa/trusted-devices");
}

export function revokeTrustedDevice(id: string): Promise<ApiClientResult<Record<string, never>>> {
  return apiFetch(`/api/auth/mfa/trusted-devices/${id}`, { method: "DELETE" });
}

// ─── Auth — RC-1 Social Login (OAuth) ────────────────────────────────────

export interface OAuthProviderSummary {
  id: "google" | "microsoft" | "github";
  name: string;
}

/** Public, no session required — the login page's own "Sign in with X"
 *  buttons need this before anyone is authenticated. */
export function listOAuthProviders(): Promise<ApiClientResult<{ providers: OAuthProviderSummary[] }>> {
  return apiFetch("/api/auth/oauth/providers");
}

/** Not a fetch — a real, full-page browser navigation (the vendor's own
 *  consent screen), so callers set `window.location.href` to this
 *  directly rather than awaiting a response. */
export function oauthAuthorizeHref(providerId: string): string {
  return `/api/auth/oauth/${providerId}/authorize`;
}

export interface ConnectedOAuthAccount {
  id: string;
  provider: "google" | "microsoft" | "github";
  email?: string;
  createdAt: string;
}

export function listOAuthAccounts(): Promise<ApiClientResult<{ accounts: ConnectedOAuthAccount[] }>> {
  return apiFetch("/api/auth/oauth/accounts");
}

export function unlinkOAuthAccount(id: string): Promise<ApiClientResult<Record<string, never>>> {
  return apiFetch(`/api/auth/oauth/accounts/${id}`, { method: "DELETE" });
}

/** Redeems the OAuth-login MFA pending token (see oauth/mfaPending.ts's
 *  own doc comment) — the login page's OAuth-flow MFA step calls this
 *  instead of login()'s own mfaCode resubmission, since there's no
 *  password to resubmit alongside it in this flow. */
export function oauthMfaVerify(
  pendingToken: string,
  mfaCode: string,
  provider: string,
): Promise<ApiClientResult<{ user: DashboardUser; newDevice: boolean }>> {
  return apiFetch("/api/auth/oauth/mfa/verify", { method: "POST", body: JSON.stringify({ pendingToken, mfaCode, provider }) });
}

// ─── Admin Dashboard Backend ────────────────────────────────────────────

export function listLeads(
  filters: LeadListFilters,
  page: number,
  limit: number,
): Promise<ApiClientResult<PaginatedResult<Lead>>> {
  return apiFetch(`/api/admin/leads?${buildQuery({ ...filters, page, limit })}`);
}

export function leadsCsvHref(filters: LeadListFilters): string {
  return `/api/admin/leads?${buildQuery({ ...filters, format: "csv" })}`;
}

export function listCampaigns(
  filters: CampaignListFilters,
  page: number,
  limit: number,
): Promise<ApiClientResult<PaginatedResult<Campaign>>> {
  return apiFetch(`/api/admin/campaigns?${buildQuery({ ...filters, page, limit })}`);
}

export function campaignsCsvHref(filters: CampaignListFilters): string {
  return `/api/admin/campaigns?${buildQuery({ ...filters, format: "csv" })}`;
}

export function listRegistrations(
  filters: RegistrationListFilters,
  page: number,
  limit: number,
): Promise<ApiClientResult<PaginatedResult<Registration>>> {
  return apiFetch(`/api/admin/registrations?${buildQuery({ ...filters, page, limit })}`);
}

export function registrationsCsvHref(filters: RegistrationListFilters): string {
  return `/api/admin/registrations?${buildQuery({ ...filters, format: "csv" })}`;
}

export function listAttendance(
  filters: AttendanceListFilters,
  page: number,
  limit: number,
): Promise<ApiClientResult<PaginatedResult<Attendance>>> {
  return apiFetch(`/api/admin/attendance?${buildQuery({ ...filters, page, limit })}`);
}

export function markAttendance(input: CreateAttendanceInput): Promise<ApiClientResult<{ attendance: Attendance }>> {
  return apiFetch("/api/admin/attendance", { method: "POST", body: JSON.stringify(input) });
}

export function attendanceCsvHref(filters: AttendanceListFilters): string {
  return `/api/admin/attendance?${buildQuery({ ...filters, format: "csv" })}`;
}

export interface AdminAnalyticsResponse {
  registrations: RegistrationAnalytics;
  utm: UtmBreakdownRow[];
  studentStatus: StudentStatusSummary;
}

export function getAnalytics(): Promise<ApiClientResult<AdminAnalyticsResponse>> {
  return apiFetch("/api/admin/analytics");
}

export interface AdminMarketingResponse {
  range: DateRange;
  leadFunnel: LeadFunnel;
  conversionFunnel: ConversionFunnel;
  revenueFunnel: RevenueFunnel;
  overall: OverallMarketingMetrics;
  campaigns: CampaignMarketingMetrics[];
}

export function getMarketing(range?: Partial<DateRange>): Promise<ApiClientResult<AdminMarketingResponse>> {
  return apiFetch(`/api/admin/marketing?${buildQuery({ from: range?.from, to: range?.to })}`);
}

// ─── WhatsApp Campaign Manager ──────────────────────────────────────────

export function listWhatsAppCampaigns(
  filters: WhatsAppCampaignListFilters,
  page: number,
  limit: number,
): Promise<ApiClientResult<PaginatedResult<WhatsAppCampaign>>> {
  return apiFetch(`/api/admin/whatsapp-campaigns?${buildQuery({ ...filters, page, limit })}`);
}

export function createWhatsAppCampaign(
  input: CreateWhatsAppCampaignInput,
): Promise<ApiClientResult<{ campaign: WhatsAppCampaign }>> {
  return apiFetch("/api/admin/whatsapp-campaigns", { method: "POST", body: JSON.stringify(input) });
}

export function getWhatsAppCampaign(
  id: string,
): Promise<ApiClientResult<{ campaign: WhatsAppCampaign; messageCounts: MessageStatusCounts }>> {
  return apiFetch(`/api/admin/whatsapp-campaigns/${id}`);
}

export function resolveWhatsAppCampaignAudience(
  id: string,
  input: ResolveAudienceInput,
): Promise<ApiClientResult<{ campaign: WhatsAppCampaign; resolution: AudienceResolutionResult }>> {
  return apiFetch(`/api/admin/whatsapp-campaigns/${id}/audience`, { method: "POST", body: JSON.stringify(input) });
}

export async function importWhatsAppCampaignCsv(
  id: string,
  file: File,
): Promise<ApiClientResult<{ campaign: WhatsAppCampaign; importResult: CsvImportResult }>> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`/api/admin/whatsapp-campaigns/${id}/import`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) {
    return { success: false, status: response.status, errors: body?.errors ?? GENERIC_ERROR };
  }
  return { success: true, data: body };
}

export function sendWhatsAppCampaignNow(id: string): Promise<ApiClientResult<{ campaign: WhatsAppCampaign }>> {
  return apiFetch(`/api/admin/whatsapp-campaigns/${id}/send`, { method: "POST" });
}

export function scheduleWhatsAppCampaign(
  id: string,
  scheduledFor: string,
): Promise<ApiClientResult<{ campaign: WhatsAppCampaign }>> {
  return apiFetch(`/api/admin/whatsapp-campaigns/${id}/schedule`, {
    method: "POST",
    body: JSON.stringify({ scheduledFor }),
  });
}

export function cancelWhatsAppCampaign(id: string): Promise<ApiClientResult<{ campaign: WhatsAppCampaign }>> {
  return apiFetch(`/api/admin/whatsapp-campaigns/${id}/cancel`, { method: "POST" });
}

// ─── Module 2.5: Archive / Duplicate ───────────────────────────────────────

export function archiveWhatsAppCampaign(id: string): Promise<ApiClientResult<{ campaign: WhatsAppCampaign }>> {
  return apiFetch(`/api/admin/whatsapp-campaigns/${id}/archive`, { method: "POST" });
}

export function unarchiveWhatsAppCampaign(id: string): Promise<ApiClientResult<{ campaign: WhatsAppCampaign }>> {
  return apiFetch(`/api/admin/whatsapp-campaigns/${id}/unarchive`, { method: "POST" });
}

export function cloneWhatsAppCampaign(id: string): Promise<ApiClientResult<{ campaign: WhatsAppCampaign }>> {
  return apiFetch(`/api/admin/whatsapp-campaigns/${id}/clone`, { method: "POST" });
}

export function retryFailedWhatsAppMessages(
  id: string,
): Promise<ApiClientResult<{ retriedCount: number }>> {
  return apiFetch(`/api/admin/whatsapp-campaigns/${id}/retry-failed`, { method: "POST" });
}

export function listWhatsAppCampaignMessages(
  campaignId: string,
  filters: Omit<MessageListFilters, "campaignId">,
  page: number,
  limit: number,
): Promise<ApiClientResult<PaginatedResult<Message>>> {
  return apiFetch(
    `/api/admin/whatsapp-campaigns/${campaignId}/messages?${buildQuery({ ...filters, page, limit })}`,
  );
}

export function listCampaignTemplates(
  filters: CampaignTemplateListFilters,
  page: number,
  limit: number,
): Promise<ApiClientResult<PaginatedResult<CampaignTemplate>>> {
  return apiFetch(`/api/admin/whatsapp-campaigns/templates?${buildQuery({ ...filters, page, limit })}`);
}

export function createCampaignTemplate(
  input: CreateCampaignTemplateInput,
): Promise<ApiClientResult<{ template: CampaignTemplate }>> {
  return apiFetch("/api/admin/whatsapp-campaigns/templates", { method: "POST", body: JSON.stringify(input) });
}

/** RC-1 — app-wide WhatsApp delivery performance, for the Analytics page. */
export function getWhatsAppMessageStats(): Promise<ApiClientResult<{ messageCounts: MessageStatusCounts }>> {
  return apiFetch("/api/admin/whatsapp-campaigns/stats");
}

export type { CampaignValidationError };

// ─── Automation ──────────────────────────────────────────────────────────

export function listWorkflowRuns(
  filters: WorkflowRunListFilters,
  page: number,
  limit: number,
): Promise<ApiClientResult<PaginatedResult<WorkflowRun>>> {
  return apiFetch(`/api/admin/automation/runs?${buildQuery({ ...filters, page, limit })}`);
}

export function listWorkflowDefinitions(): Promise<ApiClientResult<{ items: WorkflowDefinitionRecord[] }>> {
  return apiFetch("/api/admin/automation/definitions");
}

export interface CreateWorkflowDefinitionRequest {
  id: string;
  name: string;
  triggerEventType: string;
  active?: boolean;
  steps: WorkflowDefinitionRecord["steps"];
}

export function createWorkflowDefinition(
  input: CreateWorkflowDefinitionRequest,
): Promise<ApiClientResult<{ definition: WorkflowDefinitionRecord }>> {
  return apiFetch("/api/admin/automation/definitions", { method: "POST", body: JSON.stringify(input) });
}

export function updateWorkflowDefinition(
  id: string,
  patch: { name?: string; active?: boolean; steps?: WorkflowDefinitionRecord["steps"] },
): Promise<ApiClientResult<{ definition: WorkflowDefinitionRecord }>> {
  return apiFetch(`/api/admin/automation/definitions/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export function deleteWorkflowDefinition(id: string): Promise<ApiClientResult<{ deleted: boolean }>> {
  return apiFetch(`/api/admin/automation/definitions/${id}`, { method: "DELETE" });
}

export type { WorkflowValidationError };

// ─── Auto-Reply Rules (Module 3.3) ─────────────────────────────────────────

export function listAutoReplyRules(): Promise<ApiClientResult<{ rules: AutoReplyRule[] }>> {
  return apiFetch("/api/admin/automation/auto-reply-rules");
}

export interface CreateAutoReplyRuleRequest {
  keywords: string[];
  replyText: string;
  isFallback?: boolean;
  active?: boolean;
}

export function createAutoReplyRule(
  input: CreateAutoReplyRuleRequest,
): Promise<ApiClientResult<{ rule: AutoReplyRule }>> {
  return apiFetch("/api/admin/automation/auto-reply-rules", { method: "POST", body: JSON.stringify(input) });
}

export function updateAutoReplyRule(
  id: string,
  patch: { keywords?: string[]; replyText?: string; isFallback?: boolean; active?: boolean },
): Promise<ApiClientResult<{ rule: AutoReplyRule }>> {
  return apiFetch(`/api/admin/automation/auto-reply-rules/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export function deleteAutoReplyRule(id: string): Promise<ApiClientResult<{ deleted: boolean }>> {
  return apiFetch(`/api/admin/automation/auto-reply-rules/${id}`, { method: "DELETE" });
}

export type { AutoReplyRule, AutoReplyRuleValidationError };

export function runDueScheduledJobs(): Promise<ApiClientResult<{ processed: number }>> {
  return apiFetch("/api/admin/scheduler/run-due-jobs", { method: "POST" });
}

// ─── Audit Logs ──────────────────────────────────────────────────────────

export function listAuditLogs(
  filters: AuditLogListFilters,
  page: number,
  limit: number,
): Promise<ApiClientResult<PaginatedResult<AuditLogEntry>>> {
  return apiFetch(`/api/admin/audit-logs?${buildQuery({ ...filters, page, limit })}`);
}

// ─── Webhook Deliveries (WhatsApp Platform, Module 2.4) ────────────────────

export function listWebhookDeliveries(
  filters: WebhookDeliveryListFilters,
  page: number,
  limit: number,
): Promise<ApiClientResult<PaginatedResult<WebhookDelivery>>> {
  return apiFetch(`/api/admin/webhook-deliveries?${buildQuery({ ...filters, page, limit })}`);
}

// ─── WhatsApp Business Account Health (Module 2.3) ─────────────────────────

export function getWhatsAppPhoneHealth(): Promise<ApiClientResult<{ phoneNumbers: WhatsAppPhoneNumberRecord[] }>> {
  return apiFetch("/api/admin/whatsapp/phone-health");
}

// ─── Integrations Hub (Phase 6, Module 6.1) ────────────────────────────────

export function listIntegrations(): Promise<ApiClientResult<{ integrations: IntegrationSummary[] }>> {
  return apiFetch("/api/admin/integrations");
}

export function getIntegration(providerId: string): Promise<ApiClientResult<{ integration: IntegrationSummary }>> {
  return apiFetch(`/api/admin/integrations/${providerId}`);
}

export function connectIntegration(
  providerId: string,
  input: { config?: Record<string, unknown>; credentialRef?: IntegrationCredentialRef },
): Promise<ApiClientResult<{ integration: IntegrationSummary }>> {
  return apiFetch(`/api/admin/integrations/${providerId}/connect`, { method: "POST", body: JSON.stringify(input) });
}

export function disconnectIntegration(providerId: string): Promise<ApiClientResult<{ integration: IntegrationSummary }>> {
  return apiFetch(`/api/admin/integrations/${providerId}/disconnect`, { method: "POST" });
}

export function setIntegrationEnabled(providerId: string, enabled: boolean): Promise<ApiClientResult<{ integration: IntegrationSummary }>> {
  return apiFetch(`/api/admin/integrations/${providerId}/enabled`, { method: "PATCH", body: JSON.stringify({ enabled }) });
}

export function updateIntegrationConfig(
  providerId: string,
  config: Record<string, unknown>,
): Promise<ApiClientResult<{ integration: IntegrationSummary }>> {
  return apiFetch(`/api/admin/integrations/${providerId}/config`, { method: "PUT", body: JSON.stringify({ config }) });
}

export function listIntegrationLogs(
  providerId: string,
  page = 1,
  limit = 20,
): Promise<ApiClientResult<PaginatedResult<IntegrationLog>>> {
  return apiFetch(`/api/admin/integrations/${providerId}/logs?${buildQuery({ page, limit })}`);
}

// Business OS Phase 8, Module 8.2 — Tenant Context & Credentials.
export function setIntegrationCredentials(
  providerId: string,
  values: Record<string, string>,
): Promise<ApiClientResult<{ integration: IntegrationSummary }>> {
  return apiFetch(`/api/admin/integrations/${providerId}/credentials`, { method: "PUT", body: JSON.stringify({ values }) });
}

export function clearIntegrationCredentials(providerId: string): Promise<ApiClientResult<{ integration: IntegrationSummary }>> {
  return apiFetch(`/api/admin/integrations/${providerId}/credentials`, { method: "DELETE" });
}

// Business OS Phase 8, Module 8.5 — WhatsApp Embedded Signup.
export interface WhatsAppEmbeddedSignupConfig {
  configured: boolean;
  entitled: boolean;
  appId?: string;
  configId?: string;
}

export interface WhatsAppConnectionSummary {
  state:
    | "not_connected"
    | "connecting"
    | "connected"
    | "healthy"
    | "action_required"
    | "token_expired"
    | "webhook_error"
    | "phone_verification_required"
    | "disconnected";
  displayPhoneNumber?: string;
  phoneNumberId?: string;
  wabaId?: string;
  qualityRating?: "green" | "yellow" | "red" | "unknown";
  verificationStatus?: "verified" | "not_verified" | "unknown";
  lastCheckedAt?: string;
  lastError?: string;
  connectedAt?: string;
}

export function getWhatsAppEmbeddedSignupConfig(): Promise<ApiClientResult<WhatsAppEmbeddedSignupConfig>> {
  return apiFetch("/api/admin/integrations/whatsapp/embedded-signup/config");
}

export function getWhatsAppConnectionStatus(): Promise<ApiClientResult<{ connection: WhatsAppConnectionSummary }>> {
  return apiFetch("/api/admin/integrations/whatsapp/embedded-signup/status");
}

export function completeWhatsAppEmbeddedSignup(input: {
  code: string;
  wabaId?: string;
  phoneNumberId?: string;
}): Promise<ApiClientResult<{ connection: WhatsAppConnectionSummary }>> {
  return apiFetch("/api/admin/integrations/whatsapp/embedded-signup/complete", { method: "POST", body: JSON.stringify(input) });
}

export function disconnectWhatsAppEmbeddedSignup(): Promise<ApiClientResult<{ connection: WhatsAppConnectionSummary }>> {
  return apiFetch("/api/admin/integrations/whatsapp/embedded-signup/disconnect", { method: "POST" });
}

// ─── File Storage (Phase 6, Module 6.2) ────────────────────────────────────

export interface UploadFileOptions {
  category: FileCategory;
  visibility?: "public" | "private";
  relatedEntityType?: string;
  relatedEntityId?: string;
}

export function uploadFile(file: File, options: UploadFileOptions): Promise<ApiClientResult<{ file: FileAsset }>> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("category", options.category);
  if (options.visibility) formData.append("visibility", options.visibility);
  if (options.relatedEntityType) formData.append("relatedEntityType", options.relatedEntityType);
  if (options.relatedEntityId) formData.append("relatedEntityId", options.relatedEntityId);

  // Deliberately bypasses apiFetch() — same reason lib/services/leads'
  // own CSV-import client code does its own fetch(): apiFetch() always
  // sets Content-Type: application/json, which would break a multipart
  // body (the browser must set its own boundary-bearing Content-Type
  // for FormData).
  return fetch("/api/admin/files", { method: "POST", credentials: "include", body: formData }).then(async (response) => {
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.success) {
      return { success: false, status: response.status, errors: body?.errors ?? [{ field: "root", message: "Upload failed." }] };
    }
    return { success: true, data: body as { file: FileAsset } };
  });
}

export function listFiles(
  filters: { relatedEntityType?: string; relatedEntityId?: string; category?: FileCategory },
  page = 1,
  limit = 20,
): Promise<ApiClientResult<PaginatedResult<FileAsset>>> {
  return apiFetch(`/api/admin/files?${buildQuery({ ...filters, page, limit })}`);
}

export function deleteFile(id: string): Promise<ApiClientResult<{ file: FileAsset }>> {
  return apiFetch(`/api/admin/files/${id}`, { method: "DELETE" });
}

/** Not a JSON call — the download route itself 302-redirects to the
 *  real file location. Callers just navigate/open this path directly
 *  (e.g. `window.open(fileDownloadPath(id))`), same-origin credentials
 *  cover the auth automatically, matching conversationMediaUrl's own
 *  "not a fetch wrapper" precedent. */
export function fileDownloadPath(id: string): string {
  return `/api/admin/files/${id}/download`;
}

// ─── Calendar & Meeting Connectors (Phase 6, Module 6.3) ───────────────────

/** Not a fetch wrapper — the browser navigates here directly
 *  (`window.location.href = calendarOAuthAuthorizePath(id)`), same
 *  "not a JSON call" precedent as fileDownloadPath: the vendor's own
 *  consent screen is what the browser actually needs to land on. */
export function calendarOAuthAuthorizePath(providerId: CalendarProviderId): string {
  return `/api/admin/integrations/${providerId}/oauth/authorize`;
}

export function listProviderCalendars(providerId: CalendarProviderId): Promise<ApiClientResult<{ calendars: CalendarListEntry[] }>> {
  return apiFetch(`/api/admin/integrations/${providerId}/calendars`);
}

export function getProviderAvailability(
  providerId: CalendarProviderId,
  calendarId: string,
  start: string,
  end: string,
): Promise<ApiClientResult<{ busy: BusyInterval[] }>> {
  return apiFetch(`/api/admin/integrations/${providerId}/availability?${buildQuery({ calendarId, start, end })}`);
}

export function syncCalendarProvider(providerId: CalendarProviderId): Promise<ApiClientResult<{ integration: IntegrationSummary }>> {
  return apiFetch(`/api/admin/integrations/${providerId}/calendar-sync`, { method: "POST" });
}

export interface ScheduleMeetingInput {
  provider: CalendarProviderId;
  calendarId?: string;
  title: string;
  description?: string;
  startAt: string;
  endAt: string;
  timezone: string;
  invitees: { email: string; name?: string }[];
  reminderMinutesBefore?: number;
  relatedEntityType?: string;
  relatedEntityId?: string;
  createFollowUpTask?: boolean;
}

export function scheduleMeeting(input: ScheduleMeetingInput): Promise<ApiClientResult<{ meeting: Meeting }>> {
  return apiFetch("/api/admin/meetings", { method: "POST", body: JSON.stringify(input) });
}

export function listMeetings(
  filters: { relatedEntityType?: string; relatedEntityId?: string; status?: MeetingStatus },
  page = 1,
  limit = 20,
): Promise<ApiClientResult<PaginatedResult<Meeting>>> {
  return apiFetch(`/api/admin/meetings?${buildQuery({ ...filters, page, limit })}`);
}

export function getMeeting(id: string): Promise<ApiClientResult<{ meeting: Meeting }>> {
  return apiFetch(`/api/admin/meetings/${id}`);
}

export function updateMeeting(id: string, input: Partial<ScheduleMeetingInput>): Promise<ApiClientResult<{ meeting: Meeting }>> {
  return apiFetch(`/api/admin/meetings/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function cancelMeeting(id: string): Promise<ApiClientResult<{ meeting: Meeting }>> {
  return apiFetch(`/api/admin/meetings/${id}`, { method: "DELETE" });
}

// ─── Generic Webhooks & Team Notifications (Phase 6, Module 6.5) ──────────

export interface RegisterWebhookEndpointInput {
  name: string;
  url: string;
  subscribedEventTypes: string[];
  secret?: string;
}

export function registerWebhookEndpoint(
  input: RegisterWebhookEndpointInput,
): Promise<ApiClientResult<{ endpoint: WebhookEndpoint; secret: string }>> {
  return apiFetch("/api/admin/webhook-endpoints", { method: "POST", body: JSON.stringify(input) });
}

export function listWebhookEndpoints(
  filters: { status?: WebhookEndpointStatus },
  page = 1,
  limit = 20,
): Promise<ApiClientResult<PaginatedResult<WebhookEndpoint>>> {
  return apiFetch(`/api/admin/webhook-endpoints?${buildQuery({ ...filters, page, limit })}`);
}

export function getWebhookEndpoint(id: string): Promise<ApiClientResult<{ endpoint: WebhookEndpoint }>> {
  return apiFetch(`/api/admin/webhook-endpoints/${id}`);
}

export function updateWebhookEndpoint(
  id: string,
  input: { name?: string; url?: string; subscribedEventTypes?: string[] },
): Promise<ApiClientResult<{ endpoint: WebhookEndpoint }>> {
  return apiFetch(`/api/admin/webhook-endpoints/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function setWebhookEndpointEnabled(id: string, enabled: boolean): Promise<ApiClientResult<{ endpoint: WebhookEndpoint }>> {
  return apiFetch(`/api/admin/webhook-endpoints/${id}/enabled`, { method: "PATCH", body: JSON.stringify({ enabled }) });
}

export function deleteWebhookEndpoint(id: string): Promise<ApiClientResult<{ deleted: boolean }>> {
  return apiFetch(`/api/admin/webhook-endpoints/${id}`, { method: "DELETE" });
}

export function rotateWebhookSecret(id: string): Promise<ApiClientResult<{ endpoint: WebhookEndpoint; secret: string }>> {
  return apiFetch(`/api/admin/webhook-endpoints/${id}/rotate-secret`, { method: "POST" });
}

export function testWebhookEndpoint(
  id: string,
): Promise<ApiClientResult<{ result: { success: boolean; httpStatusCode?: number; responseSnippet?: string; error?: string } }>> {
  return apiFetch(`/api/admin/webhook-endpoints/${id}/test`, { method: "POST" });
}

export function listOutboundWebhookDeliveries(
  endpointId: string,
  filters: { outcome?: OutboundWebhookDeliveryOutcome },
  page = 1,
  limit = 20,
): Promise<ApiClientResult<PaginatedResult<WebhookDeliveryAttempt>>> {
  return apiFetch(`/api/admin/webhook-endpoints/${endpointId}/deliveries?${buildQuery({ ...filters, page, limit })}`);
}

export function replayWebhookDelivery(
  endpointId: string,
  attemptId: string,
): Promise<ApiClientResult<{ attempt: WebhookDeliveryAttempt }>> {
  return apiFetch(`/api/admin/webhook-endpoints/${endpointId}/deliveries/${attemptId}/replay`, { method: "POST" });
}

export function connectNotificationWebhookUrl(
  providerId: NotificationProviderId,
  webhookUrl: string,
): Promise<ApiClientResult<{ integration: IntegrationSummary }>> {
  return apiFetch(`/api/admin/integrations/${providerId}/webhook-url`, { method: "POST", body: JSON.stringify({ webhookUrl }) });
}

export function testNotification(
  providerId: NotificationProviderId,
): Promise<ApiClientResult<{ result: { success: boolean; error?: string } }>> {
  return apiFetch(`/api/admin/integrations/${providerId}/notification-test`, { method: "POST" });
}

/** Configuration & Integration Verification — the generic "Test
 *  Connection" action for AI/Storage/Payments/Email/WhatsApp
 *  providers (calendar keeps using syncCalendarProvider() above,
 *  notification webhooks keep using testNotification() above). */
export function testIntegrationConnection(
  providerId: string,
): Promise<ApiClientResult<{ result: { success: boolean; message: string } }>> {
  return apiFetch(`/api/admin/integrations/${providerId}/test-connection`, { method: "POST" });
}

// ─── Settings ────────────────────────────────────────────────────────────

export function getSettings(): Promise<ApiClientResult<{ settings: AdminSettingsSnapshot }>> {
  return apiFetch("/api/admin/settings");
}

// ─── Enterprise CRM (Phase 1) ──────────────────────────────────────────

export function listStaff(): Promise<ApiClientResult<{ users: DashboardUser[] }>> {
  return apiFetch("/api/admin/users");
}

export function getLead(id: string): Promise<ApiClientResult<{ lead: Lead }>> {
  return apiFetch(`/api/admin/leads/${id}`);
}

export function updateLead(id: string, input: UpdateLeadInput): Promise<ApiClientResult<{ lead: Lead }>> {
  return apiFetch(`/api/admin/leads/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function setLeadTags(id: string, tagIds: string[]): Promise<ApiClientResult<{ lead: Lead }>> {
  return apiFetch(`/api/admin/leads/${id}/tags`, { method: "PUT", body: JSON.stringify({ tagIds }) });
}

export function assignLead(id: string, counsellorId: string): Promise<ApiClientResult<{ lead: Lead }>> {
  return apiFetch(`/api/admin/leads/${id}/assign`, { method: "POST", body: JSON.stringify({ counsellorId }) });
}

export interface BulkLeadRequest {
  action: "update" | "delete" | "archive" | "unarchive" | "assign" | "tag";
  ids?: string[];
  filters?: LeadListFilters;
  update?: UpdateLeadInput;
  counsellorId?: string;
  tagId?: string;
}

export function bulkLeadAction(
  request: BulkLeadRequest,
): Promise<ApiClientResult<{ result: { matchedCount: number; matchedIds: string[] } }>> {
  return apiFetch("/api/admin/leads/bulk", { method: "POST", body: JSON.stringify(request) });
}

// ─── AI Lead Insights (Phase 5, Module 5.1) ────────────────────────────────

export function listLeadInsights(
  leadId: string,
  page = 1,
  limit = 20,
): Promise<ApiClientResult<PaginatedResult<LeadInsight>>> {
  return apiFetch(`/api/admin/leads/${leadId}/insights?${buildQuery({ page, limit })}`);
}

export function analyzeLeadWithAi(leadId: string): Promise<ApiClientResult<{ insight: LeadInsight }>> {
  return apiFetch(`/api/admin/leads/${leadId}/insights`, { method: "POST" });
}

// ─── Activities (Lead Timeline) ──────────────────────────────────────────

export function listActivities(
  entityType: ActivityEntityType,
  entityId: string,
  page = 1,
  limit = 50,
): Promise<ApiClientResult<PaginatedResult<Activity>>> {
  return apiFetch(`/api/admin/crm/activities?${buildQuery({ entityType, entityId, page, limit })}`);
}

export interface CreateActivityRequest {
  entityType: ActivityEntityType;
  entityId: string;
  type: ActivityType;
  body: string;
  durationMinutes?: number;
}

export function createActivity(input: CreateActivityRequest): Promise<ApiClientResult<{ activity: Activity }>> {
  return apiFetch("/api/admin/crm/activities", { method: "POST", body: JSON.stringify(input) });
}

// ─── Tasks ────────────────────────────────────────────────────────────────

export function listTasks(
  filters: TaskListFilters,
  page: number,
  limit: number,
): Promise<ApiClientResult<PaginatedResult<Task>>> {
  return apiFetch(`/api/admin/crm/tasks?${buildQuery({ ...filters, page, limit })}`);
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  dueAt: string;
  priority?: TaskPriority;
  assigneeId: string;
  entityType?: "Lead";
  entityId?: string;
  recurrence?: TaskRecurrence;
  reminderAt?: string;
}

export function createTask(input: CreateTaskRequest): Promise<ApiClientResult<{ task: Task }>> {
  return apiFetch("/api/admin/crm/tasks", { method: "POST", body: JSON.stringify(input) });
}

export function completeTask(id: string): Promise<ApiClientResult<{ task: Task }>> {
  return apiFetch(`/api/admin/crm/tasks/${id}/complete`, { method: "POST" });
}

export function reassignTask(id: string, assigneeId: string): Promise<ApiClientResult<{ task: Task }>> {
  return apiFetch(`/api/admin/crm/tasks/${id}/reassign`, { method: "POST", body: JSON.stringify({ assigneeId }) });
}

// ─── Tags ─────────────────────────────────────────────────────────────────

export function listTags(): Promise<ApiClientResult<{ tags: Tag[] }>> {
  return apiFetch("/api/admin/crm/tags");
}

export function createTag(label: string, color: string): Promise<ApiClientResult<{ tag: Tag }>> {
  return apiFetch("/api/admin/crm/tags", { method: "POST", body: JSON.stringify({ label, color }) });
}

export function deleteTag(id: string): Promise<ApiClientResult<{ deleted: boolean }>> {
  return apiFetch(`/api/admin/crm/tags/${id}`, { method: "DELETE" });
}

// ─── Custom Fields ────────────────────────────────────────────────────────

export function listCustomFieldDefinitions(): Promise<ApiClientResult<{ definitions: CustomFieldDefinition[] }>> {
  return apiFetch("/api/admin/crm/custom-fields");
}

export interface CreateCustomFieldDefinitionRequest {
  key: string;
  label: string;
  fieldType: CustomFieldType;
  options?: string[];
  required?: boolean;
}

export function createCustomFieldDefinition(
  input: CreateCustomFieldDefinitionRequest,
): Promise<ApiClientResult<{ definition: CustomFieldDefinition }>> {
  return apiFetch("/api/admin/crm/custom-fields", { method: "POST", body: JSON.stringify(input) });
}

export function deleteCustomFieldDefinition(id: string): Promise<ApiClientResult<{ deleted: boolean }>> {
  return apiFetch(`/api/admin/crm/custom-fields/${id}`, { method: "DELETE" });
}

// ─── Assignment Rules ─────────────────────────────────────────────────────

export function getActiveAssignmentRule(): Promise<ApiClientResult<{ rule: AssignmentRule | null }>> {
  return apiFetch("/api/admin/crm/assignment-rules");
}

export function setAssignmentRule(
  strategy: AssignmentStrategy,
  counsellorIds: string[],
): Promise<ApiClientResult<{ rule: AssignmentRule }>> {
  return apiFetch("/api/admin/crm/assignment-rules", {
    method: "POST",
    body: JSON.stringify({ strategy, counsellorIds }),
  });
}

// ─── Pipelines & Opportunities ────────────────────────────────────────────

export function listPipelines(): Promise<ApiClientResult<{ pipelines: Pipeline[] }>> {
  return apiFetch("/api/admin/crm/pipelines");
}

export interface CreatePipelineRequest {
  name: string;
  program?: string;
  stages: { name: string; isWon?: boolean; isLost?: boolean }[];
}

export function createPipeline(input: CreatePipelineRequest): Promise<ApiClientResult<{ pipeline: Pipeline }>> {
  return apiFetch("/api/admin/crm/pipelines", { method: "POST", body: JSON.stringify(input) });
}

export function deletePipeline(id: string): Promise<ApiClientResult<{ deleted: boolean }>> {
  return apiFetch(`/api/admin/crm/pipelines/${id}`, { method: "DELETE" });
}

export function listOpportunities(
  filters: OpportunityListFilters,
): Promise<ApiClientResult<{ opportunities: Opportunity[] }>> {
  return apiFetch(`/api/admin/crm/opportunities?${buildQuery({ ...filters })}`);
}

export interface CreateOpportunityRequest {
  leadId: string;
  pipelineId: string;
  stageId: string;
  expectedRevenueInr?: number;
  probability?: number;
  ownerId?: string;
}

export function createOpportunity(
  input: CreateOpportunityRequest,
): Promise<ApiClientResult<{ opportunity: Opportunity }>> {
  return apiFetch("/api/admin/crm/opportunities", { method: "POST", body: JSON.stringify(input) });
}

export function moveOpportunityStage(
  id: string,
  stageId: string,
  lostReason?: string,
): Promise<ApiClientResult<{ opportunity: Opportunity }>> {
  return apiFetch(`/api/admin/crm/opportunities/${id}/move`, {
    method: "POST",
    body: JSON.stringify({ stageId, lostReason }),
  });
}

// ─── Duplicate Detection & Merge ──────────────────────────────────────────

export function listDuplicates(): Promise<ApiClientResult<{ groups: DuplicateLeadGroup[] }>> {
  return apiFetch("/api/admin/crm/duplicates");
}

export function mergeLeads(
  targetId: string,
  sourceId: string,
  fieldsFromSource: string[] = [],
): Promise<ApiClientResult<{ lead: Lead }>> {
  return apiFetch("/api/admin/crm/merge", { method: "POST", body: JSON.stringify({ targetId, sourceId, fieldsFromSource }) });
}

// ─── Import ────────────────────────────────────────────────────────────────

export interface LeadImportPreviewResponse {
  mode: "preview";
  validRowCount: number;
  rejected: { rowNumber: number; raw: Record<string, string>; reason: string }[];
  truncated: boolean;
}

export interface LeadImportCommitResponse {
  mode: "commit";
  imported: number;
  duplicates: number;
  rejected: { rowNumber: number; raw: Record<string, string>; reason: string }[];
  truncated: boolean;
}

async function importLeadsRequest<T>(file: File, mode: "preview" | "commit"): Promise<ApiClientResult<T>> {
  const formData = new FormData();
  formData.append("file", file);
  // Deliberately bypasses apiFetch() — that helper always sets
  // Content-Type: application/json, which would break a multipart body
  // (the browser needs to set its own boundary-bearing Content-Type for
  // FormData). Same reason lib/services/leads/client.ts's sibling
  // WhatsApp-campaign CSV import client code does its own fetch() too.
  const response = await fetch(`/api/admin/crm/import?mode=${mode}`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) {
    return { success: false, status: response.status, errors: body?.errors ?? GENERIC_ERROR };
  }
  return { success: true, data: body as T };
}

export function previewLeadImport(file: File): Promise<ApiClientResult<LeadImportPreviewResponse>> {
  return importLeadsRequest(file, "preview");
}

export function commitLeadImport(file: File): Promise<ApiClientResult<LeadImportCommitResponse>> {
  return importLeadsRequest(file, "commit");
}

// ─── Counsellor Leaderboard ─────────────────────────────────────────────

export function getLeaderboard(): Promise<ApiClientResult<LeaderboardResult>> {
  return apiFetch("/api/admin/crm/leaderboard");
}

// ─── Counsellor & Pipeline Analytics (module 7.1) ──────────────────────

export function getPipelineAnalytics(): Promise<ApiClientResult<PipelineAnalyticsResult>> {
  return apiFetch("/api/admin/crm/pipeline-analytics");
}

// ─── Notifications ────────────────────────────────────────────────────────

export function listNotifications(
  unreadOnly = false,
  limit = 20,
): Promise<ApiClientResult<{ notifications: Notification[]; unreadCount: number }>> {
  return apiFetch(`/api/admin/notifications?${buildQuery({ unreadOnly, limit })}`);
}

export function markNotificationRead(id: string): Promise<ApiClientResult<{ read: boolean }>> {
  return apiFetch(`/api/admin/notifications/${id}/read`, { method: "POST" });
}

// ─── Conversations (WhatsApp Platform, Phase 2) ─────────────────────────

export function listConversations(
  filters: ConversationListFilters,
  page: number,
  limit: number,
): Promise<ApiClientResult<PaginatedResult<Conversation>>> {
  return apiFetch(`/api/admin/conversations?${buildQuery({ ...filters, page, limit })}`);
}

export function getConversationThread(
  id: string,
): Promise<ApiClientResult<{ conversation: Conversation; messages: Message[]; activities: Activity[] }>> {
  return apiFetch(`/api/admin/conversations/${id}`);
}

export function assignConversation(id: string, userId: string): Promise<ApiClientResult<{ conversation: Conversation }>> {
  return apiFetch(`/api/admin/conversations/${id}/assign`, { method: "POST", body: JSON.stringify({ userId }) });
}

export function setConversationLabels(
  id: string,
  labels: string[],
): Promise<ApiClientResult<{ conversation: Conversation }>> {
  return apiFetch(`/api/admin/conversations/${id}/labels`, { method: "PUT", body: JSON.stringify({ labels }) });
}

export function addConversationNote(id: string, body: string): Promise<ApiClientResult<{ activity: Activity }>> {
  return apiFetch(`/api/admin/conversations/${id}/notes`, { method: "POST", body: JSON.stringify({ body }) });
}

export function setConversationStatus(
  id: string,
  status: Conversation["status"],
): Promise<ApiClientResult<{ conversation: Conversation }>> {
  return apiFetch(`/api/admin/conversations/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
}

/** Module 2.2 (Rich Messaging) — sends a reply (text/buttons/list/
 *  media) from the thread view. */
export function sendConversationReply(id: string, input: SendReplyInput): Promise<ApiClientResult<{ message: Message }>> {
  return apiFetch(`/api/admin/conversations/${id}/messages`, { method: "POST", body: JSON.stringify(input) });
}

/** AI CRM (Phase 5), Module 5.2 — generates (or regenerates, same call)
 *  a suggested reply for this conversation. Always resolves to a
 *  `GenerateReplyResult` in `.data.result` — `success: false` for a
 *  graceful "unavailable"/"error" outcome, never a thrown/rejected
 *  ApiClientResult for those cases. */
export function generateConversationReply(id: string, tone: ReplyTone): Promise<ApiClientResult<{ result: GenerateReplyResult }>> {
  return apiFetch(`/api/admin/conversations/${id}/ai-reply`, { method: "POST", body: JSON.stringify({ tone }) });
}

/** AI CRM (Phase 5), Module 5.3 — Conversational Analytics. */
export function listConversationInsights(
  id: string,
  page = 1,
  limit = 20,
): Promise<ApiClientResult<PaginatedResult<ConversationInsight>>> {
  return apiFetch(`/api/admin/conversations/${id}/insights?${buildQuery({ page, limit })}`);
}

export function analyzeConversationAi(id: string): Promise<ApiClientResult<{ insight: ConversationInsight }>> {
  return apiFetch(`/api/admin/conversations/${id}/insights`, { method: "POST" });
}

/** Module 2.2 — path for the inbound-media proxy route. Not a
 *  fetch wrapper: the browser hits this directly as an <img>/<video>/
 *  <a> src, same-origin credentials cover the auth automatically, no
 *  JS fetch needed. */
export function conversationMediaUrl(messageId: string): string {
  return `/api/admin/conversations/media/${messageId}`;
}

// ─── Payments Integration (Phase 6, Module 6.4) ─────────────────────────

export interface CreatePaymentInput {
  provider: PaymentProviderId;
  amountInSmallestUnit: number;
  currency: string;
  purpose: string;
  returnUrl: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  leadId?: string;
  registrationId?: string;
  opportunityId?: string;
  campaignId?: string;
}

export function createPayment(input: CreatePaymentInput): Promise<ApiClientResult<{ payment: Payment }>> {
  return apiFetch("/api/admin/payments", { method: "POST", body: JSON.stringify(input) });
}

export function listPayments(
  filters: { status?: PaymentStatus; provider?: PaymentProviderId; leadId?: string; registrationId?: string; opportunityId?: string; campaignId?: string },
  page = 1,
  limit = 20,
): Promise<ApiClientResult<PaginatedResult<Payment>>> {
  return apiFetch(`/api/admin/payments?${buildQuery({ ...filters, page, limit })}`);
}

export function getPayment(id: string): Promise<ApiClientResult<{ payment: Payment }>> {
  return apiFetch(`/api/admin/payments/${id}`);
}

export function refundPayment(id: string, amountInSmallestUnit?: number, reason?: string): Promise<ApiClientResult<{ payment: Payment }>> {
  return apiFetch(`/api/admin/payments/${id}/refund`, { method: "POST", body: JSON.stringify({ amountInSmallestUnit, reason }) });
}

export function retryPayment(id: string, returnUrl: string): Promise<ApiClientResult<{ payment: Payment }>> {
  return apiFetch(`/api/admin/payments/${id}/retry`, { method: "POST", body: JSON.stringify({ returnUrl }) });
}

export function checkPaymentStatus(id: string): Promise<ApiClientResult<{ payment: Payment }>> {
  return apiFetch(`/api/admin/payments/${id}/check-status`, { method: "POST" });
}

export function listPaymentWebhookEvents(
  filters: { provider?: PaymentProviderId; outcome?: PaymentWebhookOutcome },
  page = 1,
  limit = 20,
): Promise<ApiClientResult<PaginatedResult<PaymentWebhookEvent>>> {
  return apiFetch(`/api/admin/payments/webhook-events?${buildQuery({ ...filters, page, limit })}`);
}

export interface PaymentAnalytics {
  byStatus: Record<PaymentStatus, number>;
  byProvider: Record<PaymentProviderId, number>;
  succeededByCurrency: Record<string, number>;
  refundedByCurrency: Record<string, number>;
  totalTransactions: number;
}

export function getPaymentAnalytics(): Promise<ApiClientResult<PaymentAnalytics>> {
  return apiFetch("/api/admin/payments/analytics");
}

// ─── Automation & Revenue Analytics (Phase 7, Module 7.2) ───────────────

export interface RevenueAnalyticsQuery {
  preset?: DateRangePreset;
  from?: string;
  to?: string;
}

export interface AdminRevenueAnalyticsResponse {
  range: ResolvedDateRange;
  automation: AutomationAnalyticsSummary;
  workflowPerformance: WorkflowPerformanceResult;
  automationRoi: AutomationRoiSummary;
  revenue: RevenueMetrics;
  revenueGrowth: RevenueGrowth;
  attribution: RevenueAttributionResult;
  funnel: CrmFunnelResult;
  counsellors: CounsellorRevenueResult;
  campaignRoi: CampaignRoiResult;
  whatsapp: WhatsAppRevenueResult;
}

export function getRevenueAnalytics(query: RevenueAnalyticsQuery): Promise<ApiClientResult<AdminRevenueAnalyticsResponse>> {
  return apiFetch(`/api/admin/analytics/revenue?${buildQuery({ preset: query.preset, from: query.from, to: query.to })}`);
}

export type RevenueAnalyticsCsvSection = "workflows" | "attribution" | "campaigns" | "whatsapp" | "counsellors";

/** Triggers a real file download via the browser's own navigation, the
 *  same pattern every other `?format=csv` export in this admin dashboard
 *  already uses (no client-side blob assembly needed — the route sets
 *  Content-Disposition itself). */
export function exportRevenueAnalyticsCsv(section: RevenueAnalyticsCsvSection, query: RevenueAnalyticsQuery): void {
  const qs = buildQuery({ format: "csv", section, preset: query.preset, from: query.from, to: query.to });
  window.location.href = `/api/admin/analytics/revenue?${qs}`;
}

// ─── Executive Dashboard (Phase 7, Module 7.3) ───────────────────────────

export function getActionCenter(query: RevenueAnalyticsQuery): Promise<ApiClientResult<ActionCenterResult>> {
  return apiFetch(`/api/admin/executive/action-center?${buildQuery({ preset: query.preset, from: query.from, to: query.to })}`);
}

export function getExecutiveDashboard(query: RevenueAnalyticsQuery): Promise<ApiClientResult<ExecutiveDashboardResult>> {
  return apiFetch(`/api/admin/executive/dashboard?${buildQuery({ preset: query.preset, from: query.from, to: query.to })}`);
}

// ─── Billing, Plans & Feature Flags (Phase 8, Module 8.3) ────────────────

export interface BillingPlan {
  id: string;
  name: string;
  description: string;
  status: "active" | "archived" | "draft";
  billingInterval: "monthly" | "yearly" | "one_time" | "internal";
  currency: string;
  basePriceInSmallestUnit: number;
  capabilities: string[];
  limits: Record<string, number | null>;
  trialDays: number;
  version: number;
}

export interface BillingSubscription {
  id: string;
  organizationId: string;
  planId: string;
  status: "trialing" | "active" | "past_due" | "cancelled" | "suspended" | "expired";
  startedAt: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEndsAt?: string;
  cancelAt?: string;
  cancelledAt?: string;
}

export interface BillingUsageRow {
  metric: string;
  current: number;
  limit: number | null;
  period: string;
}

export function listPlans(): Promise<ApiClientResult<{ plans: BillingPlan[] }>> {
  return apiFetch("/api/admin/billing/plans");
}

export function getSubscription(): Promise<ApiClientResult<{ subscription: BillingSubscription; plan: BillingPlan; capabilities: string[] }>> {
  return apiFetch("/api/admin/billing/subscription");
}

export function getBillingUsage(): Promise<ApiClientResult<{ usage: BillingUsageRow[] }>> {
  return apiFetch("/api/admin/billing/usage");
}

export function assignPlan(planId: string): Promise<ApiClientResult<{ subscription: BillingSubscription }>> {
  return apiFetch("/api/admin/billing/subscription/assign-plan", { method: "POST", body: JSON.stringify({ planId }) });
}

export function cancelSubscription(immediate: boolean): Promise<ApiClientResult<{ subscription: BillingSubscription }>> {
  return apiFetch("/api/admin/billing/subscription/cancel", { method: "POST", body: JSON.stringify({ immediate }) });
}

// ─── White Label & Branding (Phase 8, Module 8.4) ────────────────────────

export interface ResolvedBrandingResponse {
  isCustom: boolean;
  displayName: string;
  logoUrl: string | null;
  compactLogoUrl: string | null;
  faviconUrl: string | null;
  cssVariables: Record<string, string>;
  supportEmail: string | null;
  supportUrl: string | null;
  websiteUrl: string | null;
  footerText: string | null;
}

export interface BrandConfigurationResponse {
  id: string;
  organizationId: string;
  displayName?: string;
  logoFileId?: string;
  compactLogoFileId?: string;
  faviconFileId?: string;
  primaryColor?: string;
  accentColor?: string;
  supportEmail?: string;
  supportUrl?: string;
  websiteUrl?: string;
  footerText?: string;
}

export function getBranding(): Promise<ApiClientResult<{ branding: ResolvedBrandingResponse }>> {
  return apiFetch("/api/admin/branding");
}

export function getBrandConfiguration(): Promise<ApiClientResult<{ config: BrandConfigurationResponse | null }>> {
  return apiFetch("/api/admin/branding/config");
}

export function updateBrandConfiguration(input: Record<string, unknown>): Promise<ApiClientResult<{ config: BrandConfigurationResponse }>> {
  return apiFetch("/api/admin/branding/config", { method: "PUT", body: JSON.stringify(input) });
}

export function resetBrandConfiguration(): Promise<ApiClientResult<{ reset: boolean }>> {
  return apiFetch("/api/admin/branding/config", { method: "DELETE" });
}

// ─── Reliability / Background Jobs (RC-3) ──────────────────────────────────

/** The redacted shape GET /api/admin/jobs actually returns — never a
 *  raw `payload` (see that route's own doc comment on why), just the
 *  top-level key names for entity identification. */
export interface AdminScheduledJob {
  id: string;
  jobType: string;
  status: "pending" | "processing" | "completed" | "failed" | "dead_lettered" | "cancelled";
  runAt: string;
  attempts: number;
  lastError?: string;
  organizationId?: string;
  createdAt: string;
  updatedAt: string;
  payloadKeys: string[];
}

export interface AdminScheduledJobListFilters {
  status?: AdminScheduledJob["status"];
  jobType?: string;
}

export interface AdminQueueMetrics {
  countsByStatus: Record<AdminScheduledJob["status"], number>;
  oldestPendingJobAgeSeconds: number | null;
  retriedFailureCount: number;
  failuresByJobType: { jobType: string; count: number }[];
}

export function listJobs(
  filters: AdminScheduledJobListFilters,
  page: number,
  limit: number,
): Promise<ApiClientResult<PaginatedResult<AdminScheduledJob>>> {
  return apiFetch(`/api/admin/jobs?${buildQuery({ ...filters, page, limit })}`);
}

export function getJobMetrics(): Promise<ApiClientResult<{ metrics: AdminQueueMetrics }>> {
  return apiFetch("/api/admin/jobs/metrics");
}

export function retryJob(id: string): Promise<ApiClientResult<{ job: AdminScheduledJob }>> {
  return apiFetch(`/api/admin/jobs/${id}/retry`, { method: "POST" });
}

export function cancelJob(id: string): Promise<ApiClientResult<{ job: AdminScheduledJob }>> {
  return apiFetch(`/api/admin/jobs/${id}/cancel`, { method: "POST" });
}

// ─── Platform Super Admin & SaaS Operations Console (RC-6) ─────────────────
//
// Every function below hits an /api/admin/platform/* route — every one of
// those routes is gated on `requiredPlatformRole: "super_admin"`, never
// `requiredRole` (see withApiRoute.ts's own doc comment on why the two are
// separate, never-compared dimensions). An ordinary tenant admin's session
// gets a real 403 from the server regardless of what this client code does
// — nothing here is itself a security boundary, only a convenience layer
// over routes that already enforce their own.

export function getPlatformDashboard(): Promise<ApiClientResult<{ snapshot: PlatformDashboardSnapshot }>> {
  return apiFetch("/api/admin/platform/dashboard");
}

// RC-7 — Customer Onboarding & SaaS Activation, Platform Console view.
export interface OnboardingFunnelSnapshot {
  generatedAt: string;
  stages: Record<"registered" | "verified" | "organizationCreated" | "trialStarted" | "integrationConnected" | "activated", number>;
}

export interface OrganizationOnboardingSummary {
  organizationId: string;
  name: string;
  status: "not_started" | "in_progress" | "activated";
  stepsCompleted: number;
  stepsSkipped: number;
  activatedAt?: string;
  createdAt: string;
}

export function getPlatformOnboardingFunnel(
  page = 1,
  limit = 20,
): Promise<ApiClientResult<{ funnel: OnboardingFunnelSnapshot; organizations: { items: OrganizationOnboardingSummary[]; total: number } }>> {
  return apiFetch(`/api/admin/platform/onboarding?${buildQuery({ page, limit })}`);
}

export function listPlatformOrganizations(
  filters: { status?: OrganizationStatus; search?: string },
  page: number,
  limit: number,
): Promise<ApiClientResult<{ result: PaginatedResult<Organization> }>> {
  return apiFetch(`/api/admin/platform/organizations?${buildQuery({ ...filters, page, limit })}`);
}

export interface PlatformOrganizationDetail {
  organization: Organization;
  subscription: Subscription;
  plan: Plan | null;
  userCount: number;
  entitlements: { capabilities: PlanCapability[]; limits: Partial<Record<UsageMetric, number | null>> } | null;
}

export function getPlatformOrganization(id: string): Promise<ApiClientResult<PlatformOrganizationDetail>> {
  return apiFetch(`/api/admin/platform/organizations/${id}`);
}

export function suspendPlatformOrganization(id: string, reason: string): Promise<ApiClientResult<{ organization: Organization }>> {
  return apiFetch(`/api/admin/platform/organizations/${id}/suspend`, { method: "POST", body: JSON.stringify({ reason }) });
}

export function reactivatePlatformOrganization(id: string): Promise<ApiClientResult<{ organization: Organization }>> {
  return apiFetch(`/api/admin/platform/organizations/${id}/reactivate`, { method: "POST" });
}

export function extendPlatformOrganizationTrial(id: string, days: number): Promise<ApiClientResult<{ subscription: Subscription }>> {
  return apiFetch(`/api/admin/platform/organizations/${id}/extend-trial`, { method: "POST", body: JSON.stringify({ days }) });
}

export function assignPlatformOrganizationPlan(id: string, planId: string): Promise<ApiClientResult<{ subscription: Subscription }>> {
  return apiFetch(`/api/admin/platform/organizations/${id}/assign-plan`, { method: "POST", body: JSON.stringify({ planId }) });
}

export function overridePlatformOrganizationCapability(
  id: string,
  capability: PlanCapability,
  granted: boolean | null,
): Promise<ApiClientResult<{ subscription: Subscription }>> {
  return apiFetch(`/api/admin/platform/organizations/${id}/override-capability`, {
    method: "POST",
    body: JSON.stringify({ capability, granted }),
  });
}

export function overridePlatformOrganizationLimit(
  id: string,
  metric: UsageMetric,
  value: number | null,
  clear = false,
): Promise<ApiClientResult<{ subscription: Subscription }>> {
  return apiFetch(`/api/admin/platform/organizations/${id}/override-limit`, {
    method: "POST",
    body: JSON.stringify({ metric, value, clear }),
  });
}

export function listPlatformJobs(
  filters: { status?: AdminScheduledJob["status"]; jobType?: string; organizationId?: string },
  page: number,
  limit: number,
): Promise<ApiClientResult<{ result: PaginatedResult<AdminScheduledJob> }>> {
  return apiFetch(`/api/admin/platform/jobs?${buildQuery({ ...filters, page, limit })}`);
}

/** The route surfaces a replay-safety refusal (RC-5's own classification
 *  — a job type with a real external side effect and no idempotency
 *  guard) as a real 403 with the reason as the error message, not a
 *  `success: true` payload with a refused flag — so the success shape
 *  here is just the job, same as the tenant-scoped `retryJob` above. */
export function retryPlatformJob(id: string): Promise<ApiClientResult<{ job: AdminScheduledJob }>> {
  return apiFetch(`/api/admin/platform/jobs/${id}/retry`, { method: "POST" });
}

export function cancelPlatformJob(id: string): Promise<ApiClientResult<{ job: AdminScheduledJob }>> {
  return apiFetch(`/api/admin/platform/jobs/${id}/cancel`, { method: "POST" });
}

export function getPlatformHealth(): Promise<ApiClientResult<{ report: unknown }>> {
  return apiFetch("/api/admin/platform/health");
}

export function listPlatformSecurityEvents(
  filters: { action?: string; search?: string },
  page: number,
  limit: number,
): Promise<ApiClientResult<{ result: PaginatedResult<AuditLogEntry> }>> {
  return apiFetch(`/api/admin/platform/security-events?${buildQuery({ ...filters, page, limit })}`);
}

export function listPlatformAuditLog(page: number, limit: number): Promise<ApiClientResult<{ result: PaginatedResult<AuditLogEntry> }>> {
  return apiFetch(`/api/admin/platform/audit-log?${buildQuery({ page, limit })}`);
}

export function searchPlatform(q: string): Promise<ApiClientResult<{ result: PlatformSearchResult }>> {
  return apiFetch(`/api/admin/platform/search?${buildQuery({ q })}`);
}
