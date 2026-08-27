import { describe, it, expect } from "vitest";
import {
  isWhatsAppMarketingSendAllowed,
  isWhatsAppStopKeyword,
  normalizeWhatsAppMarketingConsent,
} from "./marketingConsent";
import { leadService } from "@/lib/services/leads";
import { conversationService } from "@/lib/services/conversations";
import { whatsappCampaignService, enqueueMessagesForSending } from "./whatsappCampaignService";
import { getCampaignTemplateRepository, getLeadRepository } from "@/lib/db";
import { CAMPAIGN_SEND_STAGGER_MS } from "@/config/whatsappCampaigns";
import { listScheduledJobs } from "@/lib/services/scheduler";
import { SEND_MESSAGE_JOB_TYPE } from "./jobTypes";

async function createApprovedTemplate(): Promise<string> {
  const result = await whatsappCampaignService.createTemplate({
    name: `Safety Template ${Date.now()}`,
    metaTemplateName: `safety_tpl_${Date.now()}`,
    languageCode: "en_US",
    variableLabels: [],
  });
  if (!result.success) throw new Error(JSON.stringify(result.errors));
  await (await getCampaignTemplateRepository()).updateApprovalStatus(result.template.id, {
    approvalStatus: "approved",
    approvalStatusCheckedAt: new Date().toISOString(),
  });
  return result.template.id;
}

async function createOptedInLead(phone: string, name = "Opted In"): Promise<string> {
  const created = await leadService.registerLead({
    name,
    email: `${phone.replace(/\+/g, "")}@example.com`,
    phone,
    source: "unit_test",
  });
  if (!created.success) throw new Error(JSON.stringify(created.errors));
  await leadService.updateLead(created.lead.id, { whatsappMarketingConsent: "opted_in" });
  return created.lead.id;
}

describe("marketingConsent helpers", () => {
  it("treats unknown / missing as not opted in", () => {
    expect(isWhatsAppMarketingSendAllowed("opted_in")).toBe(true);
    expect(isWhatsAppMarketingSendAllowed("opted_out")).toBe(false);
    expect(isWhatsAppMarketingSendAllowed("unknown")).toBe(false);
    expect(isWhatsAppMarketingSendAllowed(undefined)).toBe(false);
    expect(normalizeWhatsAppMarketingConsent(undefined)).toBe("unknown");
  });

  it.each(["STOP", "stop please", "UNSUBSCRIBE", "Cancel", "REMOVE ME", "remove me now"])(
    "detects STOP keyword: %s",
    (body) => {
      expect(isWhatsAppStopKeyword(body)).toBe(true);
    },
  );

  it("does not false-positive mid-sentence STOP", () => {
    expect(isWhatsAppStopKeyword("please do not stop the program")).toBe(false);
  });
});

describe("Phase 2B — STOP → opted_out", () => {
  it("inbound STOP opts the Lead out of WhatsApp marketing", async () => {
    const phone = `+9198${String(Date.now()).slice(-8)}`;
    const leadId = await createOptedInLead(phone);
    await conversationService.recordInboundMessage({
      providerMessageId: `wamid.${Date.now()}`,
      fromPhoneE164: phone,
      contactName: "Stopper",
      messageType: "text",
      body: "STOP",
      timestamp: new Date().toISOString(),
      channel: "whatsapp",
    });
    const lead = await (await getLeadRepository()).findById(leadId);
    expect(lead?.whatsappMarketingConsent).toBe("opted_out");
  });
});

describe("Phase 2B — audience consent + template gate + stagger", () => {
  it("excludes unknown/opted_out phones from manual audience", async () => {
    const templateId = await createApprovedTemplate();
    const campaign = await whatsappCampaignService.createCampaign({
      name: "Consent Audience",
      templateId,
    });
    if (!campaign.success) throw new Error(JSON.stringify(campaign.errors));

    const optedInPhone = `+9197${String(Date.now()).slice(-8)}`;
    await createOptedInLead(optedInPhone, "In");
    const unknownPhone = `+9196${String(Date.now()).slice(-8)}`;

    const resolved = await whatsappCampaignService.resolveAudience(campaign.campaign.id, {
      source: "manual",
      recipients: [
        { phoneE164: optedInPhone, name: "In" },
        { phoneE164: unknownPhone, name: "Unknown" },
      ],
    });
    expect(resolved.success).toBe(true);
    if (!resolved.success) return;
    expect(resolved.data.recipientCount).toBe(1);
    expect(resolved.data.excludedCount).toBe(1);
  });

  it("blocks sendNow when template is not approved", async () => {
    const created = await whatsappCampaignService.createTemplate({
      name: "Pending Tpl",
      metaTemplateName: `pending_${Date.now()}`,
      languageCode: "en_US",
      variableLabels: [],
    });
    if (!created.success) throw new Error(JSON.stringify(created.errors));
    // leave approvalStatus = unknown

    const campaign = await whatsappCampaignService.createCampaign({
      name: "Unapproved Send",
      templateId: created.template.id,
    });
    if (!campaign.success) throw new Error(JSON.stringify(campaign.errors));

    const phone = `+9195${String(Date.now()).slice(-8)}`;
    await createOptedInLead(phone);
    const resolved = await whatsappCampaignService.resolveAudience(campaign.campaign.id, {
      source: "manual",
      recipients: [{ phoneE164: phone }],
    });
    expect(resolved.success).toBe(true);

    const send = await whatsappCampaignService.sendNow(campaign.campaign.id);
    expect(send.success).toBe(false);
    if (send.success) return;
    expect(send.errors[0]?.message).toMatch(/not Meta-approved|approvalStatus/i);
  });

  it("staggers enqueue runAt by CAMPAIGN_SEND_STAGGER_MS", async () => {
    const templateId = await createApprovedTemplate();
    const campaign = await whatsappCampaignService.createCampaign({
      name: "Stagger",
      templateId,
    });
    if (!campaign.success) throw new Error(JSON.stringify(campaign.errors));

    const phones = [
      `+9194${String(Date.now()).slice(-8)}`,
      `+9193${String(Date.now()).slice(-8)}`,
      `+9192${String(Date.now()).slice(-8)}`,
    ];
    for (const phone of phones) await createOptedInLead(phone);

    await whatsappCampaignService.resolveAudience(campaign.campaign.id, {
      source: "manual",
      recipients: phones.map((phoneE164) => ({ phoneE164 })),
    });

    const count = await enqueueMessagesForSending(campaign.campaign.id);
    expect(count).toBe(3);

    const page = await listScheduledJobs({ jobType: SEND_MESSAGE_JOB_TYPE }, 1, 100);
    const ours = [...page.items].sort((a, b) => a.runAt.localeCompare(b.runAt));
    expect(ours.length).toBeGreaterThanOrEqual(3);
    const lastThree = ours.slice(-3);
    const t0 = new Date(lastThree[0].runAt).getTime();
    const t1 = new Date(lastThree[1].runAt).getTime();
    const t2 = new Date(lastThree[2].runAt).getTime();
    expect(t1 - t0).toBe(CAMPAIGN_SEND_STAGGER_MS);
    expect(t2 - t1).toBe(CAMPAIGN_SEND_STAGGER_MS);
  });
});
