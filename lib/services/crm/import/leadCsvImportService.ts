import Papa from "papaparse";
import { isValidIndianMobile, normalizeIndianMobile } from "@/lib/ai-bootcamp/validation";

/**
 * General Lead CSV import — Enterprise CRM (Phase 1). Generalizes the
 * parser already built for WhatsApp campaign audiences
 * (lib/services/whatsappCampaigns/csvImportService.ts): same library
 * (Papa Parse, already a dependency — zero new packages), same
 * flexible-header-matching approach, same rejected-rows-report shape,
 * same India-specific phone validator this codebase already
 * standardized on. Kept as a distinct file/service because a general
 * Lead import needs a wider column set (name/email/program) that a
 * WhatsApp-audience import has no reason to carry.
 */

export interface LeadCsvRow {
  name: string;
  email: string;
  phone: string;
  program?: string;
}

export interface LeadCsvRejectedRow {
  rowNumber: number;
  raw: Record<string, string>;
  reason: string;
}

export interface LeadCsvImportResult {
  rows: LeadCsvRow[];
  rejected: LeadCsvRejectedRow[];
  truncated: boolean;
  fileError?: string;
}

const MAX_ROWS = 5000;

const NAME_HEADERS = ["name", "full name", "lead name"];
const EMAIL_HEADERS = ["email", "email address"];
const PHONE_HEADERS = ["phone", "phone number", "whatsapp number", "mobile", "mobile number"];
const PROGRAM_HEADERS = ["program", "course", "course interest"];

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase();
}

function findColumn(headers: string[], candidates: string[]): string | undefined {
  const normalized = headers.map(normalizeHeader);
  for (const candidate of candidates) {
    const index = normalized.indexOf(candidate);
    if (index !== -1) return headers[index];
  }
  return undefined;
}

/** Shared by both the preview (dry-run) and commit paths — a preview is
 *  just this result rendered without calling leadService.registerLead()
 *  for each row, guaranteeing the two can never disagree about which
 *  rows would be rejected. */
export function parseAndValidateLeadCsv(csvText: string): LeadCsvImportResult {
  const parsed = Papa.parse<Record<string, string>>(csvText, { header: true, skipEmptyLines: true });
  const headers = parsed.meta.fields ?? [];

  const nameColumn = findColumn(headers, NAME_HEADERS);
  const emailColumn = findColumn(headers, EMAIL_HEADERS);
  const phoneColumn = findColumn(headers, PHONE_HEADERS);
  const programColumn = findColumn(headers, PROGRAM_HEADERS);

  const missing = [
    !nameColumn && "name",
    !emailColumn && "email",
    !phoneColumn && "phone",
  ].filter(Boolean);
  if (missing.length > 0) {
    return {
      rows: [],
      rejected: [],
      truncated: false,
      fileError: `Missing required column(s): ${missing.join(", ")}. Expected headers like: name, email, phone.`,
    };
  }

  const allRows = parsed.data;
  const truncated = allRows.length > MAX_ROWS;
  const rowsToProcess = allRows.slice(0, MAX_ROWS);

  const rows: LeadCsvRow[] = [];
  const rejected: LeadCsvRejectedRow[] = [];
  const seenInFile = new Set<string>();

  rowsToProcess.forEach((raw, index) => {
    const rowNumber = index + 2; // header row + 1-indexed
    const name = (raw[nameColumn!] ?? "").trim();
    const email = (raw[emailColumn!] ?? "").trim().toLowerCase();
    const rawPhone = (raw[phoneColumn!] ?? "").trim();
    const program = programColumn ? raw[programColumn]?.trim() || undefined : undefined;

    if (!name) return rejected.push({ rowNumber, raw, reason: "Missing name" });
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return rejected.push({ rowNumber, raw, reason: "Missing or invalid email" });
    }
    if (!rawPhone || !isValidIndianMobile(rawPhone)) {
      return rejected.push({ rowNumber, raw, reason: "Missing or invalid phone number" });
    }

    const phone = normalizeIndianMobile(rawPhone);
    const dedupeKey = `${phone}|${email}`;
    if (seenInFile.has(dedupeKey)) {
      return rejected.push({ rowNumber, raw, reason: "Duplicate within this file" });
    }
    seenInFile.add(dedupeKey);

    rows.push({ name, email, phone, program });
  });

  return { rows, rejected, truncated };
}
