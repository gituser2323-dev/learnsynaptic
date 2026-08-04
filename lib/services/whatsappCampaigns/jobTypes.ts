/**
 * Job type string constants shared between whatsappCampaignService.ts
 * (enqueues jobs) and jobHandlers.ts (registers handlers for them) —
 * kept in their own file so neither needs to import the other just for
 * these two strings.
 */
export const SEND_MESSAGE_JOB_TYPE = "whatsapp_campaign.send_message";
export const PROMOTE_SCHEDULED_JOB_TYPE = "whatsapp_campaign.promote_scheduled";
