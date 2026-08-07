import type { ClientSession } from "mongoose";
import type { PaginatedResult } from "@/lib/pagination";

/**
 * Organization domain layer — Business OS Phase 0 scaffolding, extended
 * by RC-6 (Platform Super Admin & SaaS Operations Console).
 *
 * Originally deliberately minimal (see RC-6's own audit finding: no
 * status/lifecycle field, no list()/update(), no CRUD API surface
 * existed anywhere before this pass — confirmed by reading this file's
 * own prior doc comment, which explicitly deferred all of that to
 * "Phase 6 / multi-tenant activation"). RC-6 is that first real
 * consumer: a platform operator needs to list, inspect, and change the
 * lifecycle state of organizations across the whole deployment.
 */

/** RC-6 — operator-controlled lifecycle state, a SEPARATE axis from
 *  Subscription.status (billing/trial/payment state — Module 8.3).
 *  Suspending an organization is a platform-operator action (abuse,
 *  non-payment escalation, a support decision) independent of whatever
 *  its subscription's own trialing/active/past_due/cancelled state is
 *  — an org can be suspended while its subscription is perfectly
 *  current, and vice versa. See DR-style docs in RC_6_AUDIT for the
 *  full write-blocking/job-skipping enforcement this field drives. */
export type OrganizationStatus = "active" | "suspended";

/** RC-7 — a coarse headcount band, not an exact number: onboarding's own
 *  "collect only useful initial information" instruction (mission §4) —
 *  a precise headcount isn't actionable for anything this app does
 *  today (no seat-based pricing tier keyed off it yet), a band is
 *  enough to eventually inform recommended plan/seat defaults. */
export type OrganizationTeamSize = "1-10" | "11-50" | "51-200" | "201-1000" | "1000+";

/** RC-7 — the handful of onboarding steps a wizard walks a new
 *  organization through, after the account/organization steps that are
 *  ALWAYS required by construction (you can't reach this state without
 *  them — there's no `OnboardingStepId` for either). Each entry here
 *  is genuinely skippable per the mission's own step list —
 *  required-ness (if any) lives in the wizard's own static step
 *  catalog (components/onboarding), never duplicated here; this type
 *  only tracks per-organization STATUS. `"plan"` included: skipping it
 *  is real and safe (the organization simply stays on the
 *  auto-provisioned `internal-unlimited` fallback — see
 *  `subscriptionService.getForOrganization()`'s own doc comment —
 *  until an admin explicitly assigns a real plan later from Settings),
 *  not a step that blocks progress the way account/organization
 *  creation do. */
export type OnboardingStepId = "plan" | "team" | "whatsapp" | "email" | "ai" | "calendar" | "crm" | "import";

/** RC-7 — mission's own explicit "clearly distinguish REQUIRED /
 *  OPTIONAL / SKIPPED / COMPLETED" instruction. "Required" isn't a
 *  status value here (every OnboardingStepId in this type is, by
 *  definition, optional — see its own doc comment); a step absent from
 *  `steps` is implicitly "pending," never conflated with "skipped." */
export type OnboardingStepStatus = "skipped" | "completed";

export interface OnboardingState {
  /** Absent entry = pending (not yet acted on). Never removed once set
   *  — skipping then later actually connecting an integration
   *  overwrites "skipped" with "completed," not the reverse. */
  steps: Partial<Record<OnboardingStepId, OnboardingStepStatus>>;
  /** Set once, the first time this organization meets the RC-7
   *  activation definition (see onboardingService's own doc comment) —
   *  never cleared afterward, even if every step were somehow later
   *  un-set; activation is a one-way milestone, not a live-recomputed
   *  status. */
  activatedAt?: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  status: OrganizationStatus;
  /** Set only while status is "suspended" — cleared (undefined) on
   *  reactivation, never left stale. */
  suspendedAt?: string;
  /** Required whenever an operator suspends (see organizationService's
   *  own suspend() — the mission's own "require a reason" instruction
   *  for dangerous platform actions). Cleared on reactivation. */
  suspendedReason?: string;
  /** RC-7 — collected once, at organization-creation time (mission's
   *  own "Business Setup" step, §4/§11) — never a giant questionnaire,
   *  just the fields with real downstream use (see each field's own
   *  doc comment below). All optional at the type level because a
   *  pre-RC-7 organization (the existing LearnSynaptic tenant itself,
   *  ensureDefaultOrganization()'s own bootstrap) genuinely has none of
   *  these set, and must keep working — see RC_7_AUDIT.md's own
   *  backward-compatibility section. */
  industry?: string;
  teamSize?: OrganizationTeamSize;
  website?: string;
  /** ISO 3166-1 alpha-2 (e.g. "IN", "US") — free-form country NAMES
   *  would fragment analytics/filtering for no benefit at this app's
   *  scale. */
  country?: string;
  /** IANA timezone (e.g. "Asia/Kolkata") — the mission's own explicit
   *  "use it for campaign scheduling/tasks/analytics/automation/
   *  calendar" instruction (§37). Defaults to a real guess derived from
   *  `country` at creation time (see onboardingService's own
   *  COUNTRY_DEFAULT_TIMEZONE), never silently assumed IST for every
   *  customer regardless of where they actually are. */
  timezone?: string;
  /** RC-7 — server-side onboarding progress (mission §8/§9): a brand
   *  new organization starts with an empty `steps` map (every optional
   *  step pending) and no `activatedAt`; absent entirely (`undefined`)
   *  for any organization created before RC-7 shipped, read as "fully
   *  onboarded" by onboardingService's own resolveOnboardingStatus()
   *  (see its own doc comment — the exact same "field absence = the
   *  sensible default for pre-existing rows" convention `status`
   *  above already established for RC-6). */
  onboarding?: OnboardingState;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrganizationInput {
  name: string;
  slug: string;
  industry?: string;
  teamSize?: OrganizationTeamSize;
  website?: string;
  country?: string;
  timezone?: string;
}

export interface UpdateOrganizationInput {
  name?: string;
  status?: OrganizationStatus;
  /** `null` explicitly clears — same "null clears, undefined leaves
   *  untouched" convention `UpdateUserInput` already established. */
  suspendedAt?: string | null;
  suspendedReason?: string | null;
  industry?: string;
  teamSize?: OrganizationTeamSize;
  website?: string;
  country?: string;
  timezone?: string;
  /** RC-7 — a full REPLACE of the onboarding state (never a partial
   *  merge at the repository layer — onboardingService's own
   *  read-modify-write callers are what merge, the same "read fresh,
   *  write the whole object back" contract Subscription's own
   *  capabilityOverrides/limitOverrides already established, chosen
   *  there for the identical reason: a partial-merge repository method
   *  can silently resurrect a field a caller meant to remove). */
  onboarding?: OnboardingState;
}

export interface OrganizationListFilters {
  status?: OrganizationStatus;
  /** Case-insensitive match against name or slug — the platform
   *  console's own org-search box (RC-6). */
  search?: string;
}

export interface OrganizationRepository {
  findById(id: string): Promise<Organization | null>;
  findBySlug(slug: string): Promise<Organization | null>;
  /** Throws DuplicateKeyError (lib/db/types.ts) if the slug already exists.
   *  RC-7 — `session` threads an optional real MongoDB transaction
   *  (lib/db/transaction.ts's `runInTransaction`) through, for
   *  onboardingService's own "create the organization and assign its
   *  creator" atomic pair — a no-op for the in-memory repository, which
   *  has no transaction concept (same disclosed trade-off
   *  registrationService.ts's own identical use of this pattern
   *  already accepts). */
  create(input: CreateOrganizationInput, session?: ClientSession): Promise<Organization>;
  /** RC-6 — the platform console's own org directory. Never called from
   *  any tenant-facing code path (an ordinary tenant admin has no
   *  legitimate reason to list every organization on the deployment —
   *  every route calling this must be `requiredPlatformRole`-gated). */
  list(filters: OrganizationListFilters, page: number, limit: number): Promise<PaginatedResult<Organization>>;
  /** RC-6 — throws if `id` doesn't resolve to a real organization
   *  (mirrors every other entity's own update() contract in this
   *  codebase). */
  update(id: string, patch: UpdateOrganizationInput): Promise<Organization>;
}
