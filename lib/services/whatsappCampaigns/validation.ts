import type { CampaignRecurrenceRule, CampaignValidationError, CreateCampaignTemplateInput, CreateWhatsAppCampaignInput } from "./types";

export type ValidateCreateCampaignInputResult =
  | { valid: true; data: CreateWhatsAppCampaignInput }
  | { valid: false; errors: CampaignValidationError[] };

const RECURRENCE_FREQUENCIES: CampaignRecurrenceRule["frequency"][] = ["daily", "weekly", "monthly"];

/** Module 2.5 — optional at creation; omitting it entirely (the
 *  existing, unchanged default) makes a plain one-off campaign, same as
 *  before this module. */
function validateRecurrenceRule(
  raw: unknown,
  errors: CampaignValidationError[],
): CampaignRecurrenceRule | undefined {
  if (raw === undefined) return undefined;
  const body = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const frequency = RECURRENCE_FREQUENCIES.includes(body.frequency as CampaignRecurrenceRule["frequency"])
    ? (body.frequency as CampaignRecurrenceRule["frequency"])
    : undefined;
  const interval = typeof body.interval === "number" && Number.isInteger(body.interval) && body.interval > 0 ? body.interval : undefined;
  if (!frequency || !interval) {
    errors.push({
      field: "recurrenceRule",
      message: `recurrenceRule must be { frequency: one of ${RECURRENCE_FREQUENCIES.join(", ")}, interval: positive integer }.`,
    });
    return undefined;
  }
  return { frequency, interval };
}

export function validateCreateCampaignInput(input: unknown): ValidateCreateCampaignInputResult {
  const errors: CampaignValidationError[] = [];

  if (typeof input !== "object" || input === null) {
    return { valid: false, errors: [{ field: "root", message: "Request body must be a JSON object." }] };
  }
  const record = input as Record<string, unknown>;

  const name = typeof record.name === "string" ? record.name.trim() : "";
  if (!name) errors.push({ field: "name", message: "Name is required." });
  else if (name.length > 150) errors.push({ field: "name", message: "Name must be under 150 characters." });

  const templateId = typeof record.templateId === "string" ? record.templateId.trim() : "";
  if (!templateId) errors.push({ field: "templateId", message: "templateId is required." });

  const marketingCampaignId =
    typeof record.marketingCampaignId === "string" && record.marketingCampaignId.trim()
      ? record.marketingCampaignId.trim()
      : undefined;

  const recurrenceRule = validateRecurrenceRule(record.recurrenceRule, errors);

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true, data: { name, templateId, marketingCampaignId, recurrenceRule } };
}

export type ValidateCreateCampaignTemplateInputResult =
  | { valid: true; data: CreateCampaignTemplateInput }
  | { valid: false; errors: CampaignValidationError[] };

export function validateCreateCampaignTemplateInput(input: unknown): ValidateCreateCampaignTemplateInputResult {
  const errors: CampaignValidationError[] = [];

  if (typeof input !== "object" || input === null) {
    return { valid: false, errors: [{ field: "root", message: "Request body must be a JSON object." }] };
  }
  const record = input as Record<string, unknown>;

  const name = typeof record.name === "string" ? record.name.trim() : "";
  if (!name) errors.push({ field: "name", message: "Name is required." });

  const metaTemplateName = typeof record.metaTemplateName === "string" ? record.metaTemplateName.trim() : "";
  if (!metaTemplateName) errors.push({ field: "metaTemplateName", message: "metaTemplateName is required." });

  const languageCode = typeof record.languageCode === "string" ? record.languageCode.trim() : "";
  if (!languageCode) errors.push({ field: "languageCode", message: "languageCode is required." });

  const variableLabels = Array.isArray(record.variableLabels)
    ? record.variableLabels.filter((value): value is string => typeof value === "string")
    : [];

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true, data: { name, metaTemplateName, languageCode, variableLabels } };
}
