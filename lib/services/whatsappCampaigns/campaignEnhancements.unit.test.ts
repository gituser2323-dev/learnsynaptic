import { describe, it, expect } from "vitest";
import { whatsappCampaignService, checkCampaignCompletion } from "./whatsappCampaignService";
import { getMessageRepository, getWhatsAppCampaignRepository } from "@/lib/db";
import { validateCreateCampaignInput } from "./validation";

/**
 * WhatsApp Platform (Phase 2), Module 2.5 — Campaign Enhancements.
 * Covers the module's own stated Testing/Definition-of-Done
 * requirements directly, against real service code and real in-memory
 * repositories, not hand-rolled fakes.
 */

let templateCounter = 0;
async function createTestTemplate(): Promise<string> {
  templateCounter += 1;
  const result = await whatsappCampaignService.createTemplate({
    name: `Unit Test Template ${templateCounter}`,
    metaTemplateName: `unit_test_template_${templateCounter}`,
    languageCode: "en_US",
    variableLabels: [],
  });
  if (!result.success) throw new Error(`Failed to create test template: ${JSON.stringify(result.errors)}`);
  return result.template.id;
}

async function createTestCampaign(overrides: Record<string, unknown> = {}): Promise<string> {
  const templateId = await createTestTemplate();
  const result = await whatsappCampaignService.createCampaign({
    name: "Unit Test Campaign",
    templateId,
    ...overrides,
  });
  if (!result.success) throw new Error(`Failed to create test campaign: ${JSON.stringify(result.errors)}`);
  return result.campaign.id;
}

describe("validateCreateCampaignInput — recurrenceRule", () => {
  it("accepts a campaign with no recurrenceRule (unchanged, one-off default)", () => {
    const result = validateCreateCampaignInput({ name: "One-off", templateId: "t1" });
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.data.recurrenceRule).toBeUndefined();
  });

  it("accepts a well-formed recurrenceRule", () => {
    const result = validateCreateCampaignInput({
      name: "Recurring",
      templateId: "t1",
      recurrenceRule: { frequency: "weekly", interval: 2 },
    });
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.data.recurrenceRule).toEqual({ frequency: "weekly", interval: 2 });
  });

  it.each([
    [{ frequency: "yearly", interval: 1 }, "unrecognized frequency"],
    [{ frequency: "weekly", interval: 0 }, "zero interval"],
    [{ frequency: "weekly", interval: -1 }, "negative interval"],
    [{ frequency: "weekly" }, "missing interval"],
    [{ interval: 1 }, "missing frequency"],
  ])("rejects a malformed recurrenceRule: %o (%s)", (recurrenceRule, description) => {
    const result = validateCreateCampaignInput({ name: "Bad", templateId: "t1", recurrenceRule });
    expect(result.valid, `expected rejection for: ${description}`).toBe(false);
  });
});

describe("whatsappCampaignService.cloneCampaign — the module's own Definition of Done", () => {
  it("cloning a completed campaign produces a clean draft with zero carried-over Message rows", async () => {
    const campaignId = await createTestCampaign();

    // Resolve a real audience — this is what actually creates Message
    // rows against the source campaign.
    const resolveResult = await whatsappCampaignService.resolveAudience(campaignId, {
      source: "manual",
      recipients: [{ phoneE164: "+919876500001", name: "Recipient One" }, { phoneE164: "+919876500002" }],
    });
    expect(resolveResult.success).toBe(true);

    // Simulate the campaign having actually run and completed, with
    // some real non-zero rollups — exactly the state a clone must NOT
    // carry over.
    const repository = await getWhatsAppCampaignRepository();
    await repository.update(campaignId, { status: "completed" });
    await repository.incrementCounts(campaignId, { sentCount: 2, deliveredCount: 2, readCount: 1, replyCount: 3, clickCount: 1 });

    const cloneResult = await whatsappCampaignService.cloneCampaign(campaignId);
    expect(cloneResult.success).toBe(true);
    if (!cloneResult.success) return;

    const clone = cloneResult.campaign;
    expect(clone.id).not.toBe(campaignId);
    expect(clone.status).toBe("draft");
    expect(clone.recipientCount).toBe(0);
    expect(clone.sentCount).toBe(0);
    expect(clone.deliveredCount).toBe(0);
    expect(clone.readCount).toBe(0);
    expect(clone.replyCount).toBe(0);
    expect(clone.clickCount).toBe(0);
    expect(clone.audienceSource).toBeUndefined();
    expect(clone.clonedFromId).toBe(campaignId);

    // The literal DoD wording: zero carried-over Message rows.
    const messageRepository = await getMessageRepository();
    const cloneMessages = await messageRepository.list({ campaignId: clone.id }, 1, 50);
    expect(cloneMessages.total).toBe(0);

    // The source campaign's own Message rows are untouched by cloning.
    const sourceMessages = await messageRepository.list({ campaignId }, 1, 50);
    expect(sourceMessages.total).toBe(2);
  });

  it("carries forward name (with a Copy suffix), template, and recurrence rule — the reusable parts only", async () => {
    const campaignId = await createTestCampaign({ recurrenceRule: { frequency: "monthly", interval: 1 } });
    const source = await (await getWhatsAppCampaignRepository()).findById(campaignId);
    expect(source).not.toBeNull();

    const cloneResult = await whatsappCampaignService.cloneCampaign(campaignId);
    expect(cloneResult.success).toBe(true);
    if (!cloneResult.success) return;

    expect(cloneResult.campaign.name).toBe(`${source!.name} (Copy)`);
    expect(cloneResult.campaign.templateId).toBe(source!.templateId);
    expect(cloneResult.campaign.recurrenceRule).toEqual({ frequency: "monthly", interval: 1 });
  });

  it("returns an error for a nonexistent campaign id, rather than throwing", async () => {
    const result = await whatsappCampaignService.cloneCampaign("no-such-campaign-id");
    expect(result.success).toBe(false);
  });
});

describe("Archive / Unarchive", () => {
  it("archiving hides a campaign from the default (non-archived) list, and unarchiving restores it", async () => {
    const campaignId = await createTestCampaign({ name: `Archive Toggle Test ${Date.now()}` });

    const archiveResult = await whatsappCampaignService.archiveCampaign(campaignId);
    expect(archiveResult.success).toBe(true);
    if (archiveResult.success) expect(archiveResult.campaign.archived).toBe(true);

    const listDefault = await whatsappCampaignService.listCampaigns({ search: "Archive Toggle Test" }, 1, 20);
    expect(listDefault.items.some((c) => c.id === campaignId)).toBe(false);

    const listArchived = await whatsappCampaignService.listCampaigns({ search: "Archive Toggle Test", archived: true }, 1, 20);
    expect(listArchived.items.some((c) => c.id === campaignId)).toBe(true);

    const unarchiveResult = await whatsappCampaignService.unarchiveCampaign(campaignId);
    expect(unarchiveResult.success).toBe(true);
    if (unarchiveResult.success) expect(unarchiveResult.campaign.archived).toBe(false);

    const listAfterUnarchive = await whatsappCampaignService.listCampaigns({ search: "Archive Toggle Test" }, 1, 20);
    expect(listAfterUnarchive.items.some((c) => c.id === campaignId)).toBe(true);
  });
});

describe("Recurrence — auto-creates the next occurrence on completion", () => {
  it("a recurring campaign completing creates a fresh draft clone", async () => {
    const campaignId = await createTestCampaign({
      name: `Recurring Reminder ${Date.now()}`,
      recurrenceRule: { frequency: "weekly", interval: 1 },
    });

    const repository = await getWhatsAppCampaignRepository();
    // No Messages were ever created for this campaign — countByStatus
    // returns all zeros, so "sending" -> "completed" fires immediately,
    // the same as a real campaign whose last Message just resolved.
    await repository.update(campaignId, { status: "sending" });
    await checkCampaignCompletion(campaignId);

    const completed = await repository.findById(campaignId);
    expect(completed?.status).toBe("completed");

    const allCampaigns = await whatsappCampaignService.listCampaigns({}, 1, 100);
    const nextOccurrence = allCampaigns.items.find((c) => c.clonedFromId === campaignId);
    expect(nextOccurrence).toBeDefined();
    expect(nextOccurrence?.status).toBe("draft");
    expect(nextOccurrence?.recurrenceRule).toEqual({ frequency: "weekly", interval: 1 });
  });

  it("a non-recurring campaign completing does NOT auto-create anything", async () => {
    const campaignId = await createTestCampaign({ name: `One-off Completion ${Date.now()}` });
    const repository = await getWhatsAppCampaignRepository();
    await repository.update(campaignId, { status: "sending" });
    await checkCampaignCompletion(campaignId);

    const allCampaigns = await whatsappCampaignService.listCampaigns({}, 1, 100);
    expect(allCampaigns.items.some((c) => c.clonedFromId === campaignId)).toBe(false);
  });
});
