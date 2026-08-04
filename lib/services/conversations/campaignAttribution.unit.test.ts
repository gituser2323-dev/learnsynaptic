import { describe, it, expect } from "vitest";
import { conversationService } from "./conversationService";
import { getMessageRepository, getWhatsAppCampaignRepository } from "@/lib/db";
import { whatsappCampaignService } from "@/lib/services/whatsappCampaigns";

/**
 * WhatsApp Platform (Phase 2), Module 2.5 — reply/click-rate tracking.
 * Exercises `conversationService.recordInboundMessage()`'s real
 * attribution hook (not a mock), against real repositories.
 */

let templateCounter = 0;
async function createCampaignWithOutboundMessage(recipientPhoneE164: string): Promise<string> {
  templateCounter += 1;
  const template = await whatsappCampaignService.createTemplate({
    name: `Attribution Test Template ${templateCounter}`,
    metaTemplateName: `attribution_test_${templateCounter}`,
    languageCode: "en_US",
    variableLabels: [],
  });
  if (!template.success) throw new Error("Failed to create template");

  const campaign = await whatsappCampaignService.createCampaign({
    name: `Attribution Test Campaign ${templateCounter}`,
    templateId: template.template.id,
  });
  if (!campaign.success) throw new Error("Failed to create campaign");

  const messageRepository = await getMessageRepository();
  await messageRepository.create({
    campaignId: campaign.campaign.id,
    recipientPhoneE164,
    direction: "outbound",
    templateId: template.template.id,
  });

  return campaign.campaign.id;
}

describe("conversationService.recordInboundMessage — campaign reply/click attribution", () => {
  it("a plain-text reply from a campaign recipient increments replyCount but not clickCount", async () => {
    const phone = `+9198765${Math.floor(Math.random() * 100000)}`;
    const campaignId = await createCampaignWithOutboundMessage(phone);

    await conversationService.recordInboundMessage({
      providerMessageId: `unit-test-${Date.now()}`,
      fromPhoneE164: phone,
      messageType: "text",
      body: "Sounds good, thanks!",
      timestamp: new Date().toISOString(),
      channel: "whatsapp",
    });

    const campaignRepository = await getWhatsAppCampaignRepository();
    const campaign = await campaignRepository.findById(campaignId);
    expect(campaign?.replyCount).toBe(1);
    expect(campaign?.clickCount).toBe(0);
  });

  it("a button_reply counts as both a reply and a click", async () => {
    const phone = `+9198765${Math.floor(Math.random() * 100000)}`;
    const campaignId = await createCampaignWithOutboundMessage(phone);

    await conversationService.recordInboundMessage({
      providerMessageId: `unit-test-${Date.now()}`,
      fromPhoneE164: phone,
      messageType: "button_reply",
      body: "Tapped: Book a call",
      timestamp: new Date().toISOString(),
      channel: "whatsapp",
    });

    const campaignRepository = await getWhatsAppCampaignRepository();
    const campaign = await campaignRepository.findById(campaignId);
    expect(campaign?.replyCount).toBe(1);
    expect(campaign?.clickCount).toBe(1);
  });

  it("a list_reply also counts as a click", async () => {
    const phone = `+9198765${Math.floor(Math.random() * 100000)}`;
    const campaignId = await createCampaignWithOutboundMessage(phone);

    await conversationService.recordInboundMessage({
      providerMessageId: `unit-test-${Date.now()}`,
      fromPhoneE164: phone,
      messageType: "list_reply",
      body: "Selected: GenAI Builder",
      timestamp: new Date().toISOString(),
      channel: "whatsapp",
    });

    const campaignRepository = await getWhatsAppCampaignRepository();
    const campaign = await campaignRepository.findById(campaignId);
    expect(campaign?.clickCount).toBe(1);
  });

  it("silently no-ops for a contact who never received a campaign message — the common case", async () => {
    const phone = `+9198765${Math.floor(Math.random() * 100000)}`;

    // Should not throw, and no campaign anywhere should be affected.
    await expect(
      conversationService.recordInboundMessage({
        providerMessageId: `unit-test-${Date.now()}`,
        fromPhoneE164: phone,
        messageType: "text",
        body: "Hi, is anyone there?",
        timestamp: new Date().toISOString(),
        channel: "whatsapp",
      }),
    ).resolves.toBeDefined();
  });

  it("attributes to the most recent campaign message when a contact received more than one", async () => {
    const phone = `+9198765${Math.floor(Math.random() * 100000)}`;
    await createCampaignWithOutboundMessage(phone);
    // Ensure a distinct createdAt ordering isn't a tie.
    await new Promise((resolve) => setTimeout(resolve, 5));
    const secondCampaignId = await createCampaignWithOutboundMessage(phone);

    await conversationService.recordInboundMessage({
      providerMessageId: `unit-test-${Date.now()}`,
      fromPhoneE164: phone,
      messageType: "text",
      body: "Replying to the latest one",
      timestamp: new Date().toISOString(),
      channel: "whatsapp",
    });

    const campaignRepository = await getWhatsAppCampaignRepository();
    const secondCampaign = await campaignRepository.findById(secondCampaignId);
    expect(secondCampaign?.replyCount).toBe(1);
  });
});
