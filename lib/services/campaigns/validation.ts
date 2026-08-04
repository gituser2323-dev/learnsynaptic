import type { CampaignChannel, CampaignStatus, CreateCampaignInput } from "@/lib/db";
import type { CampaignValidationError } from "./types";

const CODE_RE = /^[A-Z0-9_-]{2,50}$/;
const CHANNELS: CampaignChannel[] = ["meta", "google", "organic", "referral", "email", "other"];
const STATUSES: CampaignStatus[] = ["draft", "active", "paused", "ended"];

export type ValidateCreateCampaignInputResult =
  | { valid: true; data: CreateCampaignInput }
  | { valid: false; errors: CampaignValidationError[] };

/**
 * Validates and normalizes a raw, untrusted request body into
 * CreateCampaignInput — the server-side boundary, same role as
 * lib/services/leads/validation.ts's validateCreateLeadInput.
 */
export function validateCreateCampaignInput(input: unknown): ValidateCreateCampaignInputResult {
  const errors: CampaignValidationError[] = [];

  if (typeof input !== "object" || input === null) {
    return { valid: false, errors: [{ field: "root", message: "Request body must be a JSON object." }] };
  }
  const record = input as Record<string, unknown>;

  const name = typeof record.name === "string" ? record.name.trim() : "";
  if (!name) errors.push({ field: "name", message: "Name is required." });
  else if (name.length > 150) errors.push({ field: "name", message: "Name must be under 150 characters." });

  const code = typeof record.code === "string" ? record.code.trim().toUpperCase() : "";
  if (!code) errors.push({ field: "code", message: "Code is required." });
  else if (!CODE_RE.test(code)) {
    errors.push({
      field: "code",
      message: "Code must be 2-50 characters: letters, numbers, hyphens, or underscores only.",
    });
  }

  const channel = typeof record.channel === "string" ? (record.channel as CampaignChannel) : undefined;
  if (!channel) errors.push({ field: "channel", message: "Channel is required." });
  else if (!CHANNELS.includes(channel)) {
    errors.push({ field: "channel", message: `Channel must be one of: ${CHANNELS.join(", ")}.` });
  }

  let status: CampaignStatus | undefined;
  if (record.status !== undefined) {
    if (typeof record.status !== "string" || !STATUSES.includes(record.status as CampaignStatus)) {
      errors.push({ field: "status", message: `Status must be one of: ${STATUSES.join(", ")}.` });
    } else {
      status = record.status as CampaignStatus;
    }
  }

  const startDateRaw = typeof record.startDate === "string" ? record.startDate : "";
  const startDate = startDateRaw ? new Date(startDateRaw) : null;
  if (!startDateRaw) errors.push({ field: "startDate", message: "Start date is required." });
  else if (!startDate || Number.isNaN(startDate.getTime())) {
    errors.push({ field: "startDate", message: "Start date must be a valid date." });
  }

  let endDate: Date | null = null;
  if (record.endDate !== undefined) {
    const endDateRaw = typeof record.endDate === "string" ? record.endDate : "";
    endDate = endDateRaw ? new Date(endDateRaw) : null;
    if (!endDate || Number.isNaN(endDate.getTime())) {
      errors.push({ field: "endDate", message: "End date must be a valid date." });
    } else if (startDate && !Number.isNaN(startDate.getTime()) && endDate < startDate) {
      errors.push({ field: "endDate", message: "End date must be on or after the start date." });
    }
  }

  let budgetInr: number | undefined;
  if (record.budgetInr !== undefined) {
    if (typeof record.budgetInr !== "number" || Number.isNaN(record.budgetInr) || record.budgetInr < 0) {
      errors.push({ field: "budgetInr", message: "Budget must be a non-negative number." });
    } else {
      budgetInr = record.budgetInr;
    }
  }

  if (errors.length > 0) return { valid: false, errors };

  const utmSource =
    typeof record.utmSource === "string" && record.utmSource.trim() ? record.utmSource.trim() : undefined;
  const utmMedium =
    typeof record.utmMedium === "string" && record.utmMedium.trim() ? record.utmMedium.trim() : undefined;
  const utmCampaign =
    typeof record.utmCampaign === "string" && record.utmCampaign.trim() ? record.utmCampaign.trim() : undefined;
  const notes = typeof record.notes === "string" && record.notes.trim() ? record.notes.trim() : undefined;
  const externalAdCampaignId =
    typeof record.externalAdCampaignId === "string" && record.externalAdCampaignId.trim()
      ? record.externalAdCampaignId.trim()
      : undefined;

  return {
    valid: true,
    data: {
      name,
      code,
      channel: channel as CampaignChannel,
      status,
      startDate: (startDate as Date).toISOString(),
      endDate: endDate ? endDate.toISOString() : undefined,
      budgetInr,
      utmSource,
      utmMedium,
      utmCampaign,
      notes,
      externalAdCampaignId,
    },
  };
}
