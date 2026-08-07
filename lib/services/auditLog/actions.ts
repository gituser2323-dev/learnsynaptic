/**
 * Central registry of business-audit action names — one place to see
 * every event this system currently considers audit-worthy, and avoids
 * magic strings scattered across leadService/campaignService/
 * registrationService.
 *
 * Deliberately excludes duplicate/repeat-touch events
 * (lead.duplicate_touched, registration.duplicate_returned) and rejected
 * attempts (campaign.code_collision, etc.) — see AUDIT_ARCHITECTURE.md
 * §2: those are either low business value at high volume, or not
 * attributable to anyone until authentication exists. Add entries here
 * only for genuine, deliberate state changes.
 */
export const AUDIT_ACTIONS = {
  LEAD_CREATED: "lead.created",
  CAMPAIGN_CREATED: "campaign.created",
  REGISTRATION_CREATED: "registration.created",
  /** The one business-category action Authentication (Module 9) adds —
   *  a new User account is a genuine business-record creation, same tier
   *  as the three above. Everything else auth produces (login, logout,
   *  refresh, forbidden access) is a security event — see
   *  SECURITY_AUDIT_ACTIONS below, a deliberately separate registry
   *  written by securityAuditLogService, never this one. */
  USER_CREATED: "user.created",
  /** WhatsApp Campaign Manager — creating a campaign, starting a send,
   *  scheduling one, or requesting a retry are all deliberate business
   *  actions (someone decided to message a few hundred/thousand
   *  people), the same threshold already applied to the three actions
   *  above. Individual message send/deliver/read/fail events are
   *  high-frequency and routine — those stay operational logs only
   *  (lib/logger.ts), never here. */
  WHATSAPP_CAMPAIGN_CREATED: "whatsapp_campaign.created",
  WHATSAPP_CAMPAIGN_SEND_STARTED: "whatsapp_campaign.send_started",
  WHATSAPP_CAMPAIGN_SCHEDULED: "whatsapp_campaign.scheduled",
  WHATSAPP_CAMPAIGN_RETRY_REQUESTED: "whatsapp_campaign.retry_requested",
  /** Module 2.5 — Campaign Enhancements. */
  WHATSAPP_CAMPAIGN_ARCHIVED: "whatsapp_campaign.archived",
  WHATSAPP_CAMPAIGN_CLONED: "whatsapp_campaign.cloned",
  /** Enterprise CRM (Phase 1) — same threshold as everything above: a
   *  deliberate state change a person initiated, not a routine/high-
   *  frequency event. Note/call/meeting logging (Activity) is the one
   *  exception at genuinely high volume — deliberately NOT audited here,
   *  same reasoning as lead.duplicate_touched (AUDIT_ARCHITECTURE.md
   *  §2): the Activity row itself already *is* the durable record of
   *  what happened, a second audit-log entry describing "an activity was
   *  logged" would be pure duplication. */
  TASK_CREATED: "task.created",
  TASK_COMPLETED: "task.completed",
  TASK_REASSIGNED: "task.reassigned",
  TAG_CREATED: "tag.created",
  TAG_DELETED: "tag.deleted",
  LEAD_UPDATED: "lead.updated",
  LEAD_TAGGED: "lead.tagged",
  LEAD_UNTAGGED: "lead.untagged",
  CUSTOM_FIELD_DEFINED: "custom_field.defined",
  CUSTOM_FIELD_DELETED: "custom_field.deleted",
  LEAD_ASSIGNED: "lead.assigned",
  LEAD_REASSIGNED: "lead.reassigned",
  LEAD_MERGED: "lead.merged",
  LEAD_IMPORTED: "lead.imported",
  LEAD_BULK_UPDATED: "lead.bulk_updated",
  LEAD_BULK_DELETED: "lead.bulk_deleted",
  LEAD_BULK_ASSIGNED: "lead.bulk_assigned",
  LEAD_BULK_TAGGED: "lead.bulk_tagged",
  LEAD_BULK_ARCHIVED: "lead.bulk_archived",
  /** RC-5 — Backup, Restore & Disaster Recovery: the undo path for
   *  lead.bulk_deleted (which is a soft-delete, not a real deletion). */
  LEAD_BULK_RESTORED: "lead.bulk_restored",
  /** RC-5 — organization-level data export (lib/services/dataExport). */
  DATA_EXPORT_REQUESTED: "data_export.requested",
  DATA_EXPORT_COMPLETED: "data_export.completed",
  /** RC-5 — operator-triggered tenant restore
   *  (scripts/db/restoreTenantLeadsFromExport.ts) — never a self-service
   *  admin action, so this is written directly by the script itself,
   *  not through a route's own ApiRouteContext. */
  TENANT_RESTORE_APPLIED: "tenant_restore.applied",
  // RC-6 — Platform Super Admin & SaaS Operations Console. Every
  // sensitive platform-operator action, all written with
  // entityType:"Organization" (target org) except the bootstrap pair
  // (entityType:"User" — no organization is the target, a platform
  // grant/revoke is about the OPERATOR account itself).
  /** scripts/bootstrapPlatformSuperAdmin.ts only — never a route. */
  PLATFORM_SUPER_ADMIN_GRANTED: "platform.super_admin_granted",
  PLATFORM_SUPER_ADMIN_REVOKED: "platform.super_admin_revoked",
  PLATFORM_ORG_SUSPENDED: "platform.org_suspended",
  PLATFORM_ORG_REACTIVATED: "platform.org_reactivated",
  PLATFORM_ORG_TRIAL_EXTENDED: "platform.org_trial_extended",
  /** Plan assignment itself reuses subscriptionService.assignPlan's own
   *  existing subscription.plan_assigned/subscription.plan_changed
   *  audit actions (entityType:"Subscription") — no separate platform-
   *  specific action needed there, the reused method already records
   *  who/what/when accurately. */
  PLATFORM_ORG_FEATURE_OVERRIDDEN: "platform.org_feature_overridden",
  PLATFORM_ORG_LIMIT_OVERRIDDEN: "platform.org_limit_overridden",
  PLATFORM_JOB_RETRIED: "platform.job_retried",
  PLATFORM_ANNOUNCEMENT_PUBLISHED: "platform.announcement_published",
  PLATFORM_CONFIG_CHANGED: "platform.config_changed",
  /** AI CRM (Phase 5), Module 5.1 — only ever recorded for a manual
   *  "Analyze Again" click (a deliberate, person-initiated action, the
   *  same threshold as lead.tagged above). An automation-triggered
   *  analysis is NOT separately audited here, the same reasoning
   *  already applied to Activity logging (§2 above): the LeadInsight
   *  row itself is the durable record of what happened. */
  LEAD_AI_INSIGHT_ANALYZED: "lead.ai_insight_analyzed",
  /** AI CRM (Phase 5), Module 5.3 — same threshold as
   *  lead.ai_insight_analyzed above: only a manual "Analyze Again"
   *  click is recorded, never an automation-triggered run. */
  CONVERSATION_AI_ANALYZED: "conversation.ai_analyzed",
  /** Integrations Hub (Phase 6), Module 6.1 — every lifecycle action a
   *  human takes on an integration is a deliberate state change, the
   *  same threshold every other business-audit action here already
   *  applies (unlike Activity/regenerate-suggestion logging, none of
   *  these happen at high, routine frequency). */
  INTEGRATION_CONNECTED: "integration.connected",
  INTEGRATION_DISCONNECTED: "integration.disconnected",
  INTEGRATION_ENABLED: "integration.enabled",
  INTEGRATION_DISABLED: "integration.disabled",
  INTEGRATION_CONFIG_UPDATED: "integration.config_updated",
  /** Business OS Phase 8, Module 8.5 — WhatsApp Embedded Signup. Each
   *  a deliberate, tenant-initiated lifecycle event on the organization's
   *  own WhatsApp connection, the same threshold as INTEGRATION_CONNECTED
   *  above — never logs the access token or any other credential value,
   *  only provider-agnostic metadata (waba id, phone number id, outcome). */
  WHATSAPP_SIGNUP_INITIATED: "whatsapp_signup.initiated",
  WHATSAPP_SIGNUP_CONNECTED: "whatsapp_signup.connected",
  WHATSAPP_SIGNUP_FAILED: "whatsapp_signup.failed",
  WHATSAPP_SIGNUP_REAUTHORIZED: "whatsapp_signup.reauthorized",
  WHATSAPP_SIGNUP_PHONE_CONNECTED: "whatsapp_signup.phone_connected",
  WHATSAPP_SIGNUP_WEBHOOK_CONFIGURED: "whatsapp_signup.webhook_configured",
  WHATSAPP_SIGNUP_DISCONNECTED: "whatsapp_signup.disconnected",
  /** File Storage (Phase 6), Module 6.2 — a real upload/delete a
   *  person initiated, the same threshold every other manual action
   *  here already clears. Never logs file contents or credentials —
   *  metadata only (id, category, provider). */
  FILE_UPLOADED: "file.uploaded",
  FILE_DELETED: "file.deleted",
  /** Calendar & Meeting Connectors (Phase 6), Module 6.3 — scheduling,
   *  rescheduling, or cancelling a real meeting is a deliberate,
   *  person- or workflow-initiated state change with a real vendor
   *  side effect, the same threshold FILE_UPLOADED/FILE_DELETED above
   *  already clears. Never logs OAuth tokens or other credentials —
   *  metadata only (provider, title, related entity). */
  MEETING_SCHEDULED: "meeting.scheduled",
  MEETING_UPDATED: "meeting.updated",
  MEETING_CANCELLED: "meeting.cancelled",
  PIPELINE_CREATED: "pipeline.created",
  PIPELINE_DELETED: "pipeline.deleted",
  OPPORTUNITY_CREATED: "opportunity.created",
  OPPORTUNITY_STAGE_CHANGED: "opportunity.stage_changed",
  OPPORTUNITY_LOST: "opportunity.lost",
  OPPORTUNITY_WON: "opportunity.won",
  /** WhatsApp Platform (Phase 2) — module 2.1. Message send/receive
   *  events stay operational-log-only (same threshold as WhatsApp
   *  Campaign Manager's individual message events) — assigning or
   *  labeling a conversation is the deliberate business action here. */
  CONVERSATION_ASSIGNED: "conversation.assigned",
  CONVERSATION_LABELED: "conversation.labeled",
  /** Automation Platform (Phase 3), Module 3.1 — creating, editing, or
   *  removing a persisted WorkflowDefinition is a deliberate change to
   *  what real WhatsApp sends/assignments/tasks happen automatically to
   *  real leads, the same "someone decided to do this" threshold as the
   *  WhatsApp Campaign actions above — not a routine/high-frequency
   *  event like an individual WorkflowRun step advancing. */
  WORKFLOW_DEFINITION_CREATED: "workflow_definition.created",
  WORKFLOW_DEFINITION_UPDATED: "workflow_definition.updated",
  WORKFLOW_DEFINITION_DELETED: "workflow_definition.deleted",
  /** Module 3.3 — an auto-reply rule change affects what real inbound
   *  WhatsApp conversations receive automatically, the same threshold
   *  as the WorkflowDefinition actions above. */
  AUTO_REPLY_RULE_CREATED: "auto_reply_rule.created",
  AUTO_REPLY_RULE_UPDATED: "auto_reply_rule.updated",
  AUTO_REPLY_RULE_DELETED: "auto_reply_rule.deleted",
  /** Generic Webhooks & Team Notifications (Phase 6), Module 6.5 —
   *  registering, editing, disabling, deleting, or rotating the secret
   *  of a webhook endpoint each changes what real outbound requests
   *  this app makes and to whom — the same "a deliberate state change
   *  a person initiated" threshold every other action here already
   *  clears. Individual delivery attempts/retries stay operational-log-
   *  only (same threshold as WhatsApp Campaign Manager's own per-
   *  message events) — WebhookDeliveryAttempt rows are themselves the
   *  durable record, a second audit-log entry per attempt would be
   *  pure duplication at real volume. A manual "Replay" click IS
   *  audited (a deliberate person-initiated action), an automatic
   *  retry is not. */
  WEBHOOK_ENDPOINT_CREATED: "webhook_endpoint.created",
  WEBHOOK_ENDPOINT_UPDATED: "webhook_endpoint.updated",
  WEBHOOK_ENDPOINT_DELETED: "webhook_endpoint.deleted",
  WEBHOOK_ENDPOINT_SECRET_ROTATED: "webhook_endpoint.secret_rotated",
  WEBHOOK_DELIVERY_REPLAYED: "webhook_delivery.replayed",

  /** Payments Integration (Phase 6), Module 6.4 — "Payment Audit Logs."
   *  Every real money-state transition a Payment row goes through,
   *  regardless of whether a person or a webhook triggered it — unlike
   *  WebhookDeliveryAttempt above, a Payment's own status history IS
   *  the kind of event this audit trail exists for (real financial
   *  state, not a delivery-mechanics detail), so webhook-driven
   *  transitions (succeeded/failed) are audited here too, not just
   *  admin-initiated ones (created/refunded/retried). */
  PAYMENT_CREATED: "payment.created",
  PAYMENT_SUCCEEDED: "payment.succeeded",
  PAYMENT_FAILED: "payment.failed",
  PAYMENT_REFUNDED: "payment.refunded",
  PAYMENT_RETRIED: "payment.retried",

  /** Business OS Phase 8, Module 8.2 — Tenant Context & Credentials.
   *  Configuring/updating/removing a tenant's own provider credentials
   *  is the same "deliberate state change a person initiated" threshold
   *  as INTEGRATION_CONNECTED above, kept as its own action group
   *  (rather than reusing INTEGRATION_CONFIG_UPDATED) because a
   *  credential change is security-sensitive in a way ordinary
   *  non-secret config isn't — worth being able to filter/alert on
   *  separately. `metadata` on these entries carries only the
   *  configured KEY NAMES (e.g. "apiKey", "accountId"), never values —
   *  see integrationService.setTenantCredentials()'s own doc comment. */
  INTEGRATION_CREDENTIALS_CONFIGURED: "integration.credentials_configured",
  INTEGRATION_CREDENTIALS_UPDATED: "integration.credentials_updated",
  INTEGRATION_CREDENTIALS_REMOVED: "integration.credentials_removed",

  /** Business OS Phase 8, Module 8.3 — Billing, Plans & Feature Flags.
   *  Every state change to the global Plan catalog or a tenant's own
   *  Subscription is a deliberate, business-significant event by the
   *  same threshold every other action here already applies — never
   *  including the plan's own price/limits verbatim in metadata (that
   *  belongs to the Plan row itself, not a repeated audit copy), and
   *  NEVER a payment secret or provider credential (see
   *  PAYMENT_* above for the identical existing discipline). */
  PLAN_CREATED: "plan.created",
  PLAN_UPDATED: "plan.updated",
  SUBSCRIPTION_PLAN_ASSIGNED: "subscription.plan_assigned",
  SUBSCRIPTION_PLAN_CHANGED: "subscription.plan_changed",
  SUBSCRIPTION_TRIAL_STARTED: "subscription.trial_started",
  SUBSCRIPTION_TRIAL_EXPIRED: "subscription.trial_expired",
  SUBSCRIPTION_ACTIVATED: "subscription.activated",
  SUBSCRIPTION_CANCELLED: "subscription.cancelled",
  SUBSCRIPTION_SUSPENDED: "subscription.suspended",
  SUBSCRIPTION_EXPIRED: "subscription.expired",
  SUBSCRIPTION_RENEWED: "subscription.renewed",
  /** A manual, admin-triggered override of an entitlement/limit outside
   *  the normal plan-assignment flow (e.g. a support-granted temporary
   *  exception) — deliberately its own action so it's easy to audit
   *  separately from a real plan change. Not used by any UI yet in this
   *  pass (disclosed as a real extension point, not built speculatively). */
  ENTITLEMENT_ADMIN_OVERRIDE: "entitlement.admin_override",
  FEATURE_FLAG_CREATED: "feature_flag.created",
  FEATURE_FLAG_UPDATED: "feature_flag.updated",

  /** Business OS Phase 8, Module 8.4 — White Label & Branding. A
   *  deliberate identity change for the whole organization's admin
   *  experience, the same threshold every other Settings-level
   *  mutation in this app already applies. Metadata never includes
   *  color hex values or asset URLs verbatim (low sensitivity, but no
   *  reason to bloat the audit row) — just which fields changed. */
  BRAND_CONFIGURATION_UPDATED: "brand_configuration.updated",
  BRAND_CONFIGURATION_RESET: "brand_configuration.reset",

  /** RC-7 — Customer Onboarding & SaaS Activation. Reuses this same
   *  registry (never a second, parallel event/analytics service — see
   *  onboardingAnalytics.ts's own doc comment for why) for the
   *  mission's own "registration_completed, organization_created,
   *  trial_started, team_invited, whatsapp_connected, leads_imported,
   *  onboarding_completed" funnel. Several of those are deliberately
   *  NOT new entries here: registration is USER_CREATED (with
   *  `metadata.source: "self_registration"` distinguishing it from a
   *  CLI-provisioned account), trial start is the existing
   *  SUBSCRIPTION_TRIAL_STARTED, a WhatsApp connection is the existing
   *  WHATSAPP_SIGNUP_CONNECTED, and a lead import is the existing
   *  LEAD_IMPORTED — reusing the real event each already represents
   *  rather than duplicating it under an onboarding-specific name. */
  ORGANIZATION_CREATED: "organization.created",
  TEAM_INVITATION_SENT: "team_invitation.sent",
  TEAM_INVITATION_RESENT: "team_invitation.resent",
  TEAM_INVITATION_REVOKED: "team_invitation.revoked",
  TEAM_INVITATION_ACCEPTED: "team_invitation.accepted",
  /** `metadata.step` carries which onboarding step was completed —
   *  one flexible action rather than one constant per step, since the
   *  mission's own step list is itself described as adaptable ("adapt
   *  naming to existing architecture"). */
  ONBOARDING_STEP_COMPLETED: "onboarding.step_completed",
  ONBOARDING_ACTIVATED: "onboarding.activated",
} as const;

/**
 * Security Audit Events — the category AUDIT_ARCHITECTURE.md planned for
 * ("Future Security Audit Events") but had no producer for until
 * Authentication (Module 9) existed. Written exclusively by
 * securityAuditLogService, never auditLogService — see that module's own
 * doc comment, written before this one existed, anticipating exactly
 * this split.
 *
 * Deliberately excludes routine, high-frequency events: a successful
 * token refresh is not recorded here (it's bookended by the login that
 * started the session and the logout/reuse-detection that ends it, and
 * would otherwise be one row every ~15 minutes per active session) — an
 * operational log line (lib/logger.ts) is enough for that. Same judgment
 * AUDIT_ARCHITECTURE.md's approved decisions already applied to
 * lead.duplicate_touched: routine and expected isn't audit-worthy on its
 * own.
 */
export const SECURITY_AUDIT_ACTIONS = {
  USER_LOGIN_SUCCEEDED: "user.login_succeeded",
  USER_LOGIN_FAILED: "user.login_failed",
  USER_LOGGED_OUT: "user.logged_out",
  /** A refresh token already marked revoked (i.e. already rotated or
   *  explicitly logged out) was presented again — the standard signal
   *  that a refresh token was copied/stolen. authService responds by
   *  revoking the entire token family, not just this one record. */
  REFRESH_TOKEN_REUSE_DETECTED: "user.refresh_token_reuse_detected",
  /** RC-1 — scripts/resetAdminPassword.ts's only producer. A password
   *  change is a security event by the same logic as login/logout, not
   *  a business-record creation (AUDIT_ACTIONS above). */
  USER_PASSWORD_RESET: "user.password_reset",
  /** A request carried a valid session but an insufficient role for the
   *  route's requiredRole — written from withApiRoute.ts, the one place
   *  this check happens for every gated route. */
  ACCESS_FORBIDDEN: "access.forbidden",
  /** RC-1 — Production Hardening: Authentication & Identity. Every one
   *  of these is a real security-relevant state change — the same
   *  threshold login/logout/password-reset above already established —
   *  never logs a token/secret/code value, only metadata (see each
   *  producer's own call site). */
  USER_PASSWORD_CHANGED: "user.password_changed",
  PASSWORD_RESET_REQUESTED: "user.password_reset_requested",
  PASSWORD_RESET_COMPLETED: "user.password_reset_completed",
  EMAIL_VERIFICATION_REQUESTED: "user.email_verification_requested",
  EMAIL_VERIFIED: "user.email_verified",
  ACCOUNT_LOCKED: "user.account_locked",
  NEW_DEVICE_LOGIN: "user.new_device_login",
  MFA_ENABLED: "user.mfa_enabled",
  MFA_DISABLED: "user.mfa_disabled",
  MFA_CHALLENGE_FAILED: "user.mfa_challenge_failed",
  SESSION_REVOKED: "user.session_revoked",
  SESSIONS_REVOKED_ALL: "user.sessions_revoked_all",
  OAUTH_ACCOUNT_LINKED: "user.oauth_account_linked",
  OAUTH_ACCOUNT_UNLINKED: "user.oauth_account_unlinked",
  OAUTH_LOGIN_SUCCEEDED: "user.oauth_login_succeeded",
  /** RC-7 — the session a self-registered user gets auto-signed-into
   *  immediately after account creation. Deliberately its own action
   *  rather than reusing USER_LOGIN_SUCCEEDED — a security investigator
   *  reading "login succeeded" for an account created the same
   *  millisecond would need this distinction to not misread it as a
   *  compromised/reused-immediately credential. */
  USER_SELF_REGISTERED: "user.self_registered",
} as const;
