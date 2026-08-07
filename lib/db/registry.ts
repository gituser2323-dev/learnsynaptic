import { IS_MONGODB_CONFIGURED } from "@/config/database";
import { inMemoryCampaignRepository } from "./repositories/campaign.inMemory.repository";
import { inMemoryRegistrationRepository } from "./repositories/registration.inMemory.repository";
import { inMemoryAuditLogRepository } from "./repositories/auditLog.inMemory.repository";
import { inMemoryWorkflowRunRepository } from "./repositories/workflowRun.inMemory.repository";
import { inMemoryAttendanceRepository } from "./repositories/attendance.inMemory.repository";
import { inMemoryUserRepository } from "./repositories/user.inMemory.repository";
import { inMemoryRefreshTokenRepository } from "./repositories/refreshToken.inMemory.repository";
import { inMemoryScheduledJobRepository } from "./repositories/scheduledJob.inMemory.repository";
import { inMemoryWhatsAppCampaignRepository } from "./repositories/whatsappCampaign.inMemory.repository";
import { inMemoryCampaignTemplateRepository } from "./repositories/campaignTemplate.inMemory.repository";
import { inMemoryMessageRepository } from "./repositories/message.inMemory.repository";
import { inMemoryMessageAttemptRepository } from "./repositories/messageAttempt.inMemory.repository";
import { inMemoryOrganizationRepository } from "./repositories/organization.inMemory.repository";
import { inMemoryTeamInvitationRepository } from "./repositories/teamInvitation.inMemory.repository";
import { inMemoryActivityRepository } from "./repositories/activity.inMemory.repository";
import { inMemoryTagRepository } from "./repositories/tag.inMemory.repository";
import { inMemoryCustomFieldDefinitionRepository } from "./repositories/customFieldDefinition.inMemory.repository";
import { inMemoryTaskRepository } from "./repositories/task.inMemory.repository";
import { inMemoryNotificationRepository } from "./repositories/notification.inMemory.repository";
import { inMemoryAssignmentRuleRepository } from "./repositories/assignmentRule.inMemory.repository";
import { inMemoryPipelineRepository } from "./repositories/pipeline.inMemory.repository";
import { inMemoryOpportunityRepository } from "./repositories/opportunity.inMemory.repository";
import { inMemoryConversationRepository } from "./repositories/conversation.inMemory.repository";
import { inMemoryWorkflowDefinitionRepository } from "./repositories/workflowDefinition.inMemory.repository";
import { inMemoryAutoReplyRuleRepository } from "./repositories/autoReplyRule.inMemory.repository";
import { inMemoryWebhookDeliveryRepository } from "./repositories/webhookDelivery.inMemory.repository";
import { inMemoryPhoneNumberRepository } from "./repositories/phoneNumber.inMemory.repository";
import { inMemoryLeadInsightRepository } from "./repositories/leadInsight.inMemory.repository";
import { inMemoryConversationInsightRepository } from "./repositories/conversationInsight.inMemory.repository";
import { inMemoryIntegrationConnectionRepository } from "./repositories/integrationConnection.inMemory.repository";
import { inMemoryIntegrationLogRepository } from "./repositories/integrationLog.inMemory.repository";
import { inMemoryFileAssetRepository } from "./repositories/fileAsset.inMemory.repository";
import { inMemoryMeetingRepository } from "./repositories/meeting.inMemory.repository";
import { inMemoryWebhookEndpointRepository } from "./repositories/webhookEndpoint.inMemory.repository";
import { inMemoryWebhookDeliveryAttemptRepository } from "./repositories/webhookDeliveryAttempt.inMemory.repository";
import { inMemoryPaymentRepository } from "./repositories/payment.inMemory.repository";
import { inMemoryPaymentWebhookEventRepository } from "./repositories/paymentWebhookEvent.inMemory.repository";
import { inMemoryPlanRepository } from "./repositories/plan.inMemory.repository";
import { inMemorySubscriptionRepository } from "./repositories/subscription.inMemory.repository";
import { inMemoryUsageCounterRepository } from "./repositories/usageCounter.inMemory.repository";
import { inMemoryFeatureFlagRepository } from "./repositories/featureFlag.inMemory.repository";
import { inMemoryBrandConfigurationRepository } from "./repositories/brandConfiguration.inMemory.repository";
import { inMemoryPasswordResetTokenRepository } from "./repositories/passwordResetToken.inMemory.repository";
import { inMemoryEmailVerificationTokenRepository } from "./repositories/emailVerificationToken.inMemory.repository";
import { inMemoryMfaRecoveryCodeRepository } from "./repositories/mfaRecoveryCode.inMemory.repository";
import { inMemoryTrustedDeviceRepository } from "./repositories/trustedDevice.inMemory.repository";
import { inMemoryOAuthAccountRepository } from "./repositories/oauthAccount.inMemory.repository";
import { inMemoryMfaEmailOtpRepository } from "./repositories/mfaEmailOtp.inMemory.repository";
import { inMemoryDataExportRequestRepository } from "./repositories/dataExportRequest.inMemory.repository";
import { inMemoryBackupLogRepository } from "./repositories/backupLog.inMemory.repository";
import { inMemoryLeadRepository } from "@/lib/services/leads/repositories/inMemory.repository";
import type { LeadRepository } from "@/lib/services/leads/types";
import type { OrganizationRepository } from "@/lib/services/organizations/types";
import type { TeamInvitationRepository } from "@/lib/services/onboarding/invitationTypes";
import type { ActivityRepository } from "@/lib/services/crm/activities/types";
import type { TagRepository } from "@/lib/services/crm/tags/types";
import type { CustomFieldDefinitionRepository } from "@/lib/services/crm/customFields/types";
import type { TaskRepository } from "@/lib/services/crm/tasks/types";
import type { NotificationRepository } from "@/lib/services/crm/notifications/types";
import type { AssignmentRuleRepository } from "@/lib/services/crm/assignment/types";
import type { PipelineRepository, OpportunityRepository } from "@/lib/services/crm/pipelines/types";
import type { ConversationRepository } from "@/lib/services/conversations/types";
import type { WorkflowRunRepository, WorkflowDefinitionRepository } from "@/lib/services/automation/types";
import type { AutoReplyRuleRepository } from "@/lib/services/automation/autoReply/types";
import type { WebhookDeliveryRepository } from "@/lib/services/webhookMonitoring/types";
import type { PhoneNumberRepository } from "@/lib/services/whatsapp/phoneNumbers/types";
import type { AttendanceRepository } from "@/lib/services/attendance/types";
import type { LeadInsightRepository } from "@/lib/services/crm/leadInsights/types";
import type { ConversationInsightRepository } from "@/lib/services/conversations/insights/types";
import type { IntegrationConnectionRepository, IntegrationLogRepository } from "@/lib/services/integrations/types";
import type { FileAssetRepository } from "@/lib/services/storage/types";
import type { MeetingRepository } from "@/lib/services/calendar/types";
import type { WebhookEndpointRepository, WebhookDeliveryAttemptRepository } from "@/lib/services/webhooks/types";
import type { PaymentRepository, PaymentWebhookEventRepository } from "@/lib/services/payments/types";
import type { PlanRepository, SubscriptionRepository, UsageCounterRepository, FeatureFlagRepository } from "@/lib/services/billing/types";
import type { BrandConfigurationRepository } from "@/lib/services/branding/types";
import type { DataExportRequestRepository } from "@/lib/services/dataExport/types";
import type { BackupLogRepository } from "@/lib/services/backupMonitoring/types";
import type {
  UserRepository,
  RefreshTokenRepository,
  PasswordResetTokenRepository,
  EmailVerificationTokenRepository,
  MfaRecoveryCodeRepository,
  TrustedDeviceRepository,
  OAuthAccountRepository,
  MfaEmailOtpRepository,
} from "@/lib/services/auth/types";
import type { ScheduledJobRepository } from "@/lib/services/scheduler/types";
import type {
  WhatsAppCampaignRepository,
  CampaignTemplateRepository,
  MessageRepository,
  MessageAttemptRepository,
} from "@/lib/services/whatsappCampaigns/types";
import type { CampaignRepository, RegistrationRepository, AuditLogRepository } from "./repositories/types";

/**
 * The single seam where every entity's persistence becomes a concrete
 * repository. This file is the ONLY place allowed to import a concrete
 * *.mongodb.repository.ts — every service/route depends on the
 * repository interfaces (LeadRepository, CampaignRepository, etc.),
 * never on Mongoose or a specific adapter.
 *
 * Each getter lazily imports its mongo adapter (never at module scope)
 * so mongoose is never loaded — and MONGODB_URI never dereferenced for a
 * real connection — unless MongoDB is actually configured. Each is
 * cached independently after first resolution.
 */
async function selectRepository<T>(inMemory: T, loadMongo: () => Promise<T>): Promise<T> {
  if (!IS_MONGODB_CONFIGURED) return inMemory;
  return loadMongo();
}

let leadRepo: LeadRepository | null = null;
export async function getLeadRepository(): Promise<LeadRepository> {
  if (leadRepo) return leadRepo;
  leadRepo = await selectRepository(inMemoryLeadRepository, async () => {
    const { mongodbLeadRepository } = await import("./repositories/lead.mongodb.repository");
    return mongodbLeadRepository;
  });
  return leadRepo;
}

let campaignRepo: CampaignRepository | null = null;
export async function getCampaignRepository(): Promise<CampaignRepository> {
  if (campaignRepo) return campaignRepo;
  campaignRepo = await selectRepository(inMemoryCampaignRepository, async () => {
    const { mongodbCampaignRepository } = await import("./repositories/campaign.mongodb.repository");
    return mongodbCampaignRepository;
  });
  return campaignRepo;
}

let registrationRepo: RegistrationRepository | null = null;
export async function getRegistrationRepository(): Promise<RegistrationRepository> {
  if (registrationRepo) return registrationRepo;
  registrationRepo = await selectRepository(inMemoryRegistrationRepository, async () => {
    const { mongodbRegistrationRepository } = await import("./repositories/registration.mongodb.repository");
    return mongodbRegistrationRepository;
  });
  return registrationRepo;
}

let auditLogRepo: AuditLogRepository | null = null;
export async function getAuditLogRepository(): Promise<AuditLogRepository> {
  if (auditLogRepo) return auditLogRepo;
  auditLogRepo = await selectRepository(inMemoryAuditLogRepository, async () => {
    const { mongodbAuditLogRepository } = await import("./repositories/auditLog.mongodb.repository");
    return mongodbAuditLogRepository;
  });
  return auditLogRepo;
}

let workflowRunRepo: WorkflowRunRepository | null = null;
export async function getWorkflowRunRepository(): Promise<WorkflowRunRepository> {
  if (workflowRunRepo) return workflowRunRepo;
  workflowRunRepo = await selectRepository(inMemoryWorkflowRunRepository, async () => {
    const { mongodbWorkflowRunRepository } = await import("./repositories/workflowRun.mongodb.repository");
    return mongodbWorkflowRunRepository;
  });
  return workflowRunRepo;
}

let attendanceRepo: AttendanceRepository | null = null;
export async function getAttendanceRepository(): Promise<AttendanceRepository> {
  if (attendanceRepo) return attendanceRepo;
  attendanceRepo = await selectRepository(inMemoryAttendanceRepository, async () => {
    const { mongodbAttendanceRepository } = await import("./repositories/attendance.mongodb.repository");
    return mongodbAttendanceRepository;
  });
  return attendanceRepo;
}

let userRepo: UserRepository | null = null;
export async function getUserRepository(): Promise<UserRepository> {
  if (userRepo) return userRepo;
  userRepo = await selectRepository(inMemoryUserRepository, async () => {
    const { mongodbUserRepository } = await import("./repositories/user.mongodb.repository");
    return mongodbUserRepository;
  });
  return userRepo;
}

let refreshTokenRepo: RefreshTokenRepository | null = null;
export async function getRefreshTokenRepository(): Promise<RefreshTokenRepository> {
  if (refreshTokenRepo) return refreshTokenRepo;
  refreshTokenRepo = await selectRepository(inMemoryRefreshTokenRepository, async () => {
    const { mongodbRefreshTokenRepository } = await import("./repositories/refreshToken.mongodb.repository");
    return mongodbRefreshTokenRepository;
  });
  return refreshTokenRepo;
}

// RC-1 — Production Hardening: Authentication & Identity.
let passwordResetTokenRepo: PasswordResetTokenRepository | null = null;
export async function getPasswordResetTokenRepository(): Promise<PasswordResetTokenRepository> {
  if (passwordResetTokenRepo) return passwordResetTokenRepo;
  passwordResetTokenRepo = await selectRepository(inMemoryPasswordResetTokenRepository, async () => {
    const { mongodbPasswordResetTokenRepository } = await import("./repositories/passwordResetToken.mongodb.repository");
    return mongodbPasswordResetTokenRepository;
  });
  return passwordResetTokenRepo;
}

let emailVerificationTokenRepo: EmailVerificationTokenRepository | null = null;
export async function getEmailVerificationTokenRepository(): Promise<EmailVerificationTokenRepository> {
  if (emailVerificationTokenRepo) return emailVerificationTokenRepo;
  emailVerificationTokenRepo = await selectRepository(inMemoryEmailVerificationTokenRepository, async () => {
    const { mongodbEmailVerificationTokenRepository } = await import("./repositories/emailVerificationToken.mongodb.repository");
    return mongodbEmailVerificationTokenRepository;
  });
  return emailVerificationTokenRepo;
}

let mfaRecoveryCodeRepo: MfaRecoveryCodeRepository | null = null;
export async function getMfaRecoveryCodeRepository(): Promise<MfaRecoveryCodeRepository> {
  if (mfaRecoveryCodeRepo) return mfaRecoveryCodeRepo;
  mfaRecoveryCodeRepo = await selectRepository(inMemoryMfaRecoveryCodeRepository, async () => {
    const { mongodbMfaRecoveryCodeRepository } = await import("./repositories/mfaRecoveryCode.mongodb.repository");
    return mongodbMfaRecoveryCodeRepository;
  });
  return mfaRecoveryCodeRepo;
}

let trustedDeviceRepo: TrustedDeviceRepository | null = null;
export async function getTrustedDeviceRepository(): Promise<TrustedDeviceRepository> {
  if (trustedDeviceRepo) return trustedDeviceRepo;
  trustedDeviceRepo = await selectRepository(inMemoryTrustedDeviceRepository, async () => {
    const { mongodbTrustedDeviceRepository } = await import("./repositories/trustedDevice.mongodb.repository");
    return mongodbTrustedDeviceRepository;
  });
  return trustedDeviceRepo;
}

let oauthAccountRepo: OAuthAccountRepository | null = null;
export async function getOAuthAccountRepository(): Promise<OAuthAccountRepository> {
  if (oauthAccountRepo) return oauthAccountRepo;
  oauthAccountRepo = await selectRepository(inMemoryOAuthAccountRepository, async () => {
    const { mongodbOAuthAccountRepository } = await import("./repositories/oauthAccount.mongodb.repository");
    return mongodbOAuthAccountRepository;
  });
  return oauthAccountRepo;
}

let mfaEmailOtpRepo: MfaEmailOtpRepository | null = null;
export async function getMfaEmailOtpRepository(): Promise<MfaEmailOtpRepository> {
  if (mfaEmailOtpRepo) return mfaEmailOtpRepo;
  mfaEmailOtpRepo = await selectRepository(inMemoryMfaEmailOtpRepository, async () => {
    const { mongodbMfaEmailOtpRepository } = await import("./repositories/mfaEmailOtp.mongodb.repository");
    return mongodbMfaEmailOtpRepository;
  });
  return mfaEmailOtpRepo;
}

let scheduledJobRepo: ScheduledJobRepository | null = null;
export async function getScheduledJobRepository(): Promise<ScheduledJobRepository> {
  if (scheduledJobRepo) return scheduledJobRepo;
  scheduledJobRepo = await selectRepository(inMemoryScheduledJobRepository, async () => {
    const { mongodbScheduledJobRepository } = await import("./repositories/scheduledJob.mongodb.repository");
    return mongodbScheduledJobRepository;
  });
  return scheduledJobRepo;
}

let whatsAppCampaignRepo: WhatsAppCampaignRepository | null = null;
export async function getWhatsAppCampaignRepository(): Promise<WhatsAppCampaignRepository> {
  if (whatsAppCampaignRepo) return whatsAppCampaignRepo;
  whatsAppCampaignRepo = await selectRepository(inMemoryWhatsAppCampaignRepository, async () => {
    const { mongodbWhatsAppCampaignRepository } = await import("./repositories/whatsappCampaign.mongodb.repository");
    return mongodbWhatsAppCampaignRepository;
  });
  return whatsAppCampaignRepo;
}

let campaignTemplateRepo: CampaignTemplateRepository | null = null;
export async function getCampaignTemplateRepository(): Promise<CampaignTemplateRepository> {
  if (campaignTemplateRepo) return campaignTemplateRepo;
  campaignTemplateRepo = await selectRepository(inMemoryCampaignTemplateRepository, async () => {
    const { mongodbCampaignTemplateRepository } = await import("./repositories/campaignTemplate.mongodb.repository");
    return mongodbCampaignTemplateRepository;
  });
  return campaignTemplateRepo;
}

let messageRepo: MessageRepository | null = null;
export async function getMessageRepository(): Promise<MessageRepository> {
  if (messageRepo) return messageRepo;
  messageRepo = await selectRepository(inMemoryMessageRepository, async () => {
    const { mongodbMessageRepository } = await import("./repositories/message.mongodb.repository");
    return mongodbMessageRepository;
  });
  return messageRepo;
}

let messageAttemptRepo: MessageAttemptRepository | null = null;
export async function getMessageAttemptRepository(): Promise<MessageAttemptRepository> {
  if (messageAttemptRepo) return messageAttemptRepo;
  messageAttemptRepo = await selectRepository(inMemoryMessageAttemptRepository, async () => {
    const { mongodbMessageAttemptRepository } = await import("./repositories/messageAttempt.mongodb.repository");
    return mongodbMessageAttemptRepository;
  });
  return messageAttemptRepo;
}

let organizationRepo: OrganizationRepository | null = null;
export async function getOrganizationRepository(): Promise<OrganizationRepository> {
  if (organizationRepo) return organizationRepo;
  organizationRepo = await selectRepository(inMemoryOrganizationRepository, async () => {
    const { mongodbOrganizationRepository } = await import("./repositories/organization.mongodb.repository");
    return mongodbOrganizationRepository;
  });
  return organizationRepo;
}

let teamInvitationRepo: TeamInvitationRepository | null = null;
export async function getTeamInvitationRepository(): Promise<TeamInvitationRepository> {
  if (teamInvitationRepo) return teamInvitationRepo;
  teamInvitationRepo = await selectRepository(inMemoryTeamInvitationRepository, async () => {
    const { mongodbTeamInvitationRepository } = await import("./repositories/teamInvitation.mongodb.repository");
    return mongodbTeamInvitationRepository;
  });
  return teamInvitationRepo;
}

// ─── Enterprise CRM (Phase 1) ───────────────────────────────────────────

let activityRepo: ActivityRepository | null = null;
export async function getActivityRepository(): Promise<ActivityRepository> {
  if (activityRepo) return activityRepo;
  activityRepo = await selectRepository(inMemoryActivityRepository, async () => {
    const { mongodbActivityRepository } = await import("./repositories/activity.mongodb.repository");
    return mongodbActivityRepository;
  });
  return activityRepo;
}

let tagRepo: TagRepository | null = null;
export async function getTagRepository(): Promise<TagRepository> {
  if (tagRepo) return tagRepo;
  tagRepo = await selectRepository(inMemoryTagRepository, async () => {
    const { mongodbTagRepository } = await import("./repositories/tag.mongodb.repository");
    return mongodbTagRepository;
  });
  return tagRepo;
}

let customFieldDefinitionRepo: CustomFieldDefinitionRepository | null = null;
export async function getCustomFieldDefinitionRepository(): Promise<CustomFieldDefinitionRepository> {
  if (customFieldDefinitionRepo) return customFieldDefinitionRepo;
  customFieldDefinitionRepo = await selectRepository(inMemoryCustomFieldDefinitionRepository, async () => {
    const { mongodbCustomFieldDefinitionRepository } = await import("./repositories/customFieldDefinition.mongodb.repository");
    return mongodbCustomFieldDefinitionRepository;
  });
  return customFieldDefinitionRepo;
}

let taskRepo: TaskRepository | null = null;
export async function getTaskRepository(): Promise<TaskRepository> {
  if (taskRepo) return taskRepo;
  taskRepo = await selectRepository(inMemoryTaskRepository, async () => {
    const { mongodbTaskRepository } = await import("./repositories/task.mongodb.repository");
    return mongodbTaskRepository;
  });
  return taskRepo;
}

let notificationRepo: NotificationRepository | null = null;
export async function getNotificationRepository(): Promise<NotificationRepository> {
  if (notificationRepo) return notificationRepo;
  notificationRepo = await selectRepository(inMemoryNotificationRepository, async () => {
    const { mongodbNotificationRepository } = await import("./repositories/notification.mongodb.repository");
    return mongodbNotificationRepository;
  });
  return notificationRepo;
}

let assignmentRuleRepo: AssignmentRuleRepository | null = null;
export async function getAssignmentRuleRepository(): Promise<AssignmentRuleRepository> {
  if (assignmentRuleRepo) return assignmentRuleRepo;
  assignmentRuleRepo = await selectRepository(inMemoryAssignmentRuleRepository, async () => {
    const { mongodbAssignmentRuleRepository } = await import("./repositories/assignmentRule.mongodb.repository");
    return mongodbAssignmentRuleRepository;
  });
  return assignmentRuleRepo;
}

let pipelineRepo: PipelineRepository | null = null;
export async function getPipelineRepository(): Promise<PipelineRepository> {
  if (pipelineRepo) return pipelineRepo;
  pipelineRepo = await selectRepository(inMemoryPipelineRepository, async () => {
    const { mongodbPipelineRepository } = await import("./repositories/pipeline.mongodb.repository");
    return mongodbPipelineRepository;
  });
  return pipelineRepo;
}

let opportunityRepo: OpportunityRepository | null = null;
export async function getOpportunityRepository(): Promise<OpportunityRepository> {
  if (opportunityRepo) return opportunityRepo;
  opportunityRepo = await selectRepository(inMemoryOpportunityRepository, async () => {
    const { mongodbOpportunityRepository } = await import("./repositories/opportunity.mongodb.repository");
    return mongodbOpportunityRepository;
  });
  return opportunityRepo;
}

let conversationRepo: ConversationRepository | null = null;
export async function getConversationRepository(): Promise<ConversationRepository> {
  if (conversationRepo) return conversationRepo;
  conversationRepo = await selectRepository(inMemoryConversationRepository, async () => {
    const { mongodbConversationRepository } = await import("./repositories/conversation.mongodb.repository");
    return mongodbConversationRepository;
  });
  return conversationRepo;
}

let workflowDefinitionRepo: WorkflowDefinitionRepository | null = null;
export async function getWorkflowDefinitionRepository(): Promise<WorkflowDefinitionRepository> {
  if (workflowDefinitionRepo) return workflowDefinitionRepo;
  workflowDefinitionRepo = await selectRepository(inMemoryWorkflowDefinitionRepository, async () => {
    const { mongodbWorkflowDefinitionRepository } = await import("./repositories/workflowDefinition.mongodb.repository");
    return mongodbWorkflowDefinitionRepository;
  });
  return workflowDefinitionRepo;
}

let autoReplyRuleRepo: AutoReplyRuleRepository | null = null;
export async function getAutoReplyRuleRepository(): Promise<AutoReplyRuleRepository> {
  if (autoReplyRuleRepo) return autoReplyRuleRepo;
  autoReplyRuleRepo = await selectRepository(inMemoryAutoReplyRuleRepository, async () => {
    const { mongodbAutoReplyRuleRepository } = await import("./repositories/autoReplyRule.mongodb.repository");
    return mongodbAutoReplyRuleRepository;
  });
  return autoReplyRuleRepo;
}

// WhatsApp Platform (Phase 2), Module 2.4
let webhookDeliveryRepo: WebhookDeliveryRepository | null = null;
export async function getWebhookDeliveryRepository(): Promise<WebhookDeliveryRepository> {
  if (webhookDeliveryRepo) return webhookDeliveryRepo;
  webhookDeliveryRepo = await selectRepository(inMemoryWebhookDeliveryRepository, async () => {
    const { mongodbWebhookDeliveryRepository } = await import("./repositories/webhookDelivery.mongodb.repository");
    return mongodbWebhookDeliveryRepository;
  });
  return webhookDeliveryRepo;
}

// WhatsApp Platform (Phase 2), Module 2.3
let phoneNumberRepo: PhoneNumberRepository | null = null;
export async function getPhoneNumberRepository(): Promise<PhoneNumberRepository> {
  if (phoneNumberRepo) return phoneNumberRepo;
  phoneNumberRepo = await selectRepository(inMemoryPhoneNumberRepository, async () => {
    const { mongodbPhoneNumberRepository } = await import("./repositories/phoneNumber.mongodb.repository");
    return mongodbPhoneNumberRepository;
  });
  return phoneNumberRepo;
}

// AI CRM (Phase 5), Module 5.1
let leadInsightRepo: LeadInsightRepository | null = null;
export async function getLeadInsightRepository(): Promise<LeadInsightRepository> {
  if (leadInsightRepo) return leadInsightRepo;
  leadInsightRepo = await selectRepository(inMemoryLeadInsightRepository, async () => {
    const { mongodbLeadInsightRepository } = await import("./repositories/leadInsight.mongodb.repository");
    return mongodbLeadInsightRepository;
  });
  return leadInsightRepo;
}

// AI CRM (Phase 5), Module 5.3
let conversationInsightRepo: ConversationInsightRepository | null = null;
export async function getConversationInsightRepository(): Promise<ConversationInsightRepository> {
  if (conversationInsightRepo) return conversationInsightRepo;
  conversationInsightRepo = await selectRepository(inMemoryConversationInsightRepository, async () => {
    const { mongodbConversationInsightRepository } = await import("./repositories/conversationInsight.mongodb.repository");
    return mongodbConversationInsightRepository;
  });
  return conversationInsightRepo;
}

// Integrations Hub (Phase 6), Module 6.1
let integrationConnectionRepo: IntegrationConnectionRepository | null = null;
export async function getIntegrationConnectionRepository(): Promise<IntegrationConnectionRepository> {
  if (integrationConnectionRepo) return integrationConnectionRepo;
  integrationConnectionRepo = await selectRepository(inMemoryIntegrationConnectionRepository, async () => {
    const { mongodbIntegrationConnectionRepository } = await import("./repositories/integrationConnection.mongodb.repository");
    return mongodbIntegrationConnectionRepository;
  });
  return integrationConnectionRepo;
}

let integrationLogRepo: IntegrationLogRepository | null = null;
export async function getIntegrationLogRepository(): Promise<IntegrationLogRepository> {
  if (integrationLogRepo) return integrationLogRepo;
  integrationLogRepo = await selectRepository(inMemoryIntegrationLogRepository, async () => {
    const { mongodbIntegrationLogRepository } = await import("./repositories/integrationLog.mongodb.repository");
    return mongodbIntegrationLogRepository;
  });
  return integrationLogRepo;
}

// File Storage (Phase 6), Module 6.2
let fileAssetRepo: FileAssetRepository | null = null;
export async function getFileAssetRepository(): Promise<FileAssetRepository> {
  if (fileAssetRepo) return fileAssetRepo;
  fileAssetRepo = await selectRepository(inMemoryFileAssetRepository, async () => {
    const { mongodbFileAssetRepository } = await import("./repositories/fileAsset.mongodb.repository");
    return mongodbFileAssetRepository;
  });
  return fileAssetRepo;
}

// Calendar & Meeting Connectors (Phase 6), Module 6.3
let meetingRepo: MeetingRepository | null = null;
export async function getMeetingRepository(): Promise<MeetingRepository> {
  if (meetingRepo) return meetingRepo;
  meetingRepo = await selectRepository(inMemoryMeetingRepository, async () => {
    const { mongodbMeetingRepository } = await import("./repositories/meeting.mongodb.repository");
    return mongodbMeetingRepository;
  });
  return meetingRepo;
}

// Generic Webhooks & Team Notifications (Phase 6), Module 6.5
let webhookEndpointRepo: WebhookEndpointRepository | null = null;
export async function getWebhookEndpointRepository(): Promise<WebhookEndpointRepository> {
  if (webhookEndpointRepo) return webhookEndpointRepo;
  webhookEndpointRepo = await selectRepository(inMemoryWebhookEndpointRepository, async () => {
    const { mongodbWebhookEndpointRepository } = await import("./repositories/webhookEndpoint.mongodb.repository");
    return mongodbWebhookEndpointRepository;
  });
  return webhookEndpointRepo;
}

let webhookDeliveryAttemptRepo: WebhookDeliveryAttemptRepository | null = null;
export async function getWebhookDeliveryAttemptRepository(): Promise<WebhookDeliveryAttemptRepository> {
  if (webhookDeliveryAttemptRepo) return webhookDeliveryAttemptRepo;
  webhookDeliveryAttemptRepo = await selectRepository(inMemoryWebhookDeliveryAttemptRepository, async () => {
    const { mongodbWebhookDeliveryAttemptRepository } = await import("./repositories/webhookDeliveryAttempt.mongodb.repository");
    return mongodbWebhookDeliveryAttemptRepository;
  });
  return webhookDeliveryAttemptRepo;
}

let paymentRepo: PaymentRepository | null = null;
export async function getPaymentRepository(): Promise<PaymentRepository> {
  if (paymentRepo) return paymentRepo;
  paymentRepo = await selectRepository(inMemoryPaymentRepository, async () => {
    const { mongodbPaymentRepository } = await import("./repositories/payment.mongodb.repository");
    return mongodbPaymentRepository;
  });
  return paymentRepo;
}

let paymentWebhookEventRepo: PaymentWebhookEventRepository | null = null;
export async function getPaymentWebhookEventRepository(): Promise<PaymentWebhookEventRepository> {
  if (paymentWebhookEventRepo) return paymentWebhookEventRepo;
  paymentWebhookEventRepo = await selectRepository(inMemoryPaymentWebhookEventRepository, async () => {
    const { mongodbPaymentWebhookEventRepository } = await import("./repositories/paymentWebhookEvent.mongodb.repository");
    return mongodbPaymentWebhookEventRepository;
  });
  return paymentWebhookEventRepo;
}

// Billing, Plans & Feature Flags (Phase 8), Module 8.3
let planRepo: PlanRepository | null = null;
export async function getPlanRepository(): Promise<PlanRepository> {
  if (planRepo) return planRepo;
  planRepo = await selectRepository(inMemoryPlanRepository, async () => {
    const { mongodbPlanRepository } = await import("./repositories/plan.mongodb.repository");
    return mongodbPlanRepository;
  });
  return planRepo;
}

let subscriptionRepo: SubscriptionRepository | null = null;
export async function getSubscriptionRepository(): Promise<SubscriptionRepository> {
  if (subscriptionRepo) return subscriptionRepo;
  subscriptionRepo = await selectRepository(inMemorySubscriptionRepository, async () => {
    const { mongodbSubscriptionRepository } = await import("./repositories/subscription.mongodb.repository");
    return mongodbSubscriptionRepository;
  });
  return subscriptionRepo;
}

let usageCounterRepo: UsageCounterRepository | null = null;
export async function getUsageCounterRepository(): Promise<UsageCounterRepository> {
  if (usageCounterRepo) return usageCounterRepo;
  usageCounterRepo = await selectRepository(inMemoryUsageCounterRepository, async () => {
    const { mongodbUsageCounterRepository } = await import("./repositories/usageCounter.mongodb.repository");
    return mongodbUsageCounterRepository;
  });
  return usageCounterRepo;
}

let featureFlagRepo: FeatureFlagRepository | null = null;
export async function getFeatureFlagRepository(): Promise<FeatureFlagRepository> {
  if (featureFlagRepo) return featureFlagRepo;
  featureFlagRepo = await selectRepository(inMemoryFeatureFlagRepository, async () => {
    const { mongodbFeatureFlagRepository } = await import("./repositories/featureFlag.mongodb.repository");
    return mongodbFeatureFlagRepository;
  });
  return featureFlagRepo;
}

// White Label & Branding (Phase 8), Module 8.4
let brandConfigurationRepo: BrandConfigurationRepository | null = null;
export async function getBrandConfigurationRepository(): Promise<BrandConfigurationRepository> {
  if (brandConfigurationRepo) return brandConfigurationRepo;
  brandConfigurationRepo = await selectRepository(inMemoryBrandConfigurationRepository, async () => {
    const { mongodbBrandConfigurationRepository } = await import("./repositories/brandConfiguration.mongodb.repository");
    return mongodbBrandConfigurationRepository;
  });
  return brandConfigurationRepo;
}

// RC-5 — Backup, Restore & Disaster Recovery
let dataExportRequestRepo: DataExportRequestRepository | null = null;
export async function getDataExportRequestRepository(): Promise<DataExportRequestRepository> {
  if (dataExportRequestRepo) return dataExportRequestRepo;
  dataExportRequestRepo = await selectRepository(inMemoryDataExportRequestRepository, async () => {
    const { mongodbDataExportRequestRepository } = await import("./repositories/dataExportRequest.mongodb.repository");
    return mongodbDataExportRequestRepository;
  });
  return dataExportRequestRepo;
}

let backupLogRepo: BackupLogRepository | null = null;
export async function getBackupLogRepository(): Promise<BackupLogRepository> {
  if (backupLogRepo) return backupLogRepo;
  backupLogRepo = await selectRepository(inMemoryBackupLogRepository, async () => {
    const { mongodbBackupLogRepository } = await import("./repositories/backupLog.mongodb.repository");
    return mongodbBackupLogRepository;
  });
  return backupLogRepo;
}
