export {
  getLeadRepository,
  getCampaignRepository,
  getRegistrationRepository,
  getAuditLogRepository,
  getWorkflowRunRepository,
  getAttendanceRepository,
  getUserRepository,
  getRefreshTokenRepository,
  getScheduledJobRepository,
  getWhatsAppCampaignRepository,
  getCampaignTemplateRepository,
  getMessageRepository,
  getMessageAttemptRepository,
  // Enterprise CRM (Phase 1)
  getActivityRepository,
  getTagRepository,
  getCustomFieldDefinitionRepository,
  getTaskRepository,
  getNotificationRepository,
  getAssignmentRuleRepository,
  getPipelineRepository,
  getOpportunityRepository,
  // WhatsApp Platform (Phase 2)
  getConversationRepository,
  // Automation Platform (Phase 3)
  getWorkflowDefinitionRepository,
  getAutoReplyRuleRepository,
  // WhatsApp Platform (Phase 2), Module 2.4
  getWebhookDeliveryRepository,
  // WhatsApp Platform (Phase 2), Module 2.3
  getPhoneNumberRepository,
  // AI CRM (Phase 5), Module 5.1
  getLeadInsightRepository,
  // AI CRM (Phase 5), Module 5.3
  getConversationInsightRepository,
  // Integrations Hub (Phase 6), Module 6.1
  getIntegrationConnectionRepository,
  getIntegrationLogRepository,
  // File Storage (Phase 6), Module 6.2
  getFileAssetRepository,
  // Calendar & Meeting Connectors (Phase 6), Module 6.3
  getMeetingRepository,
  // Generic Webhooks & Team Notifications (Phase 6), Module 6.5
  getWebhookEndpointRepository,
  getWebhookDeliveryAttemptRepository,
  // Payments Integration (Phase 6), Module 6.4
  getPaymentRepository,
  getPaymentWebhookEventRepository,
  // Billing, Plans & Feature Flags (Phase 8), Module 8.3
  getPlanRepository,
  getSubscriptionRepository,
  getUsageCounterRepository,
  getFeatureFlagRepository,
  // White Label & Branding (Phase 8), Module 8.4
  getBrandConfigurationRepository,
  // RC-1 — Production Hardening: Authentication & Identity
  getPasswordResetTokenRepository,
  getEmailVerificationTokenRepository,
  getMfaRecoveryCodeRepository,
  getTrustedDeviceRepository,
  getOAuthAccountRepository,
  getMfaEmailOtpRepository,
} from "./registry";
export { runInTransaction } from "./transaction";
export { runPendingMigrations } from "./migrations";
export { DuplicateKeyError, isDuplicateKeyError } from "./types";
export type {
  Campaign,
  CampaignChannel,
  CampaignStatus,
  CreateCampaignInput,
  CampaignRepository,
  CampaignListFilters,
  Registration,
  RegistrationStatus,
  CreateRegistrationInput,
  RegistrationRepository,
  RegistrationListFilters,
  RegistrationAnalytics,
  AuditLogEntry,
  AuditEntityType,
  AuditCategory,
  AuditActorType,
  CreateAuditLogInput,
  AuditLogRepository,
  AuditLogListFilters,
} from "./repositories/types";

// Deliberately NOT exported: connection.ts's getConnection, every
// *.model.ts, and every *.mongodb.repository.ts / *.inMemory.repository.ts.
// Consumers get repository getters + domain types only — the same
// enforcement pattern used by lib/services/leads, lib/services/whatsapp,
// and lib/services/analytics.
