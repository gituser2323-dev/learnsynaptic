import Papa from "papaparse";
import { isValidIndianMobile, normalizeIndianMobile } from "@/lib/ai-bootcamp/validation";
import { CSV_IMPORT_MAX_ROWS } from "@/config/whatsappCampaigns";

/**
 * CSV import (CAMPAIGN_ARCHITECTURE.md §6, approved decisions 1 and 2:
 * Papa Parse, 5,000-row cap). Kept as its own file/single responsibility
 * — CSV parsing has nothing to do with campaign lifecycle logic
 * (whatsappCampaignService.ts).
 *
 * Phone validation reuses `isValidIndianMobile`/`normalizeIndianMobile`
 * (lib/ai-bootcamp/validation.ts) rather than introducing a new
 * international phone validator — the only phone-format validation that
 * exists anywhere in this codebase today is India-specific, matching
 * this business's actual market. Scoped explicitly, not an oversight —
 * see CHANGELOG's future considerations if this ever needs to change.
 *
 * Streaming-friendly by construction, even though the approved 5,000-row
 * cap makes an in-memory buffer (Papa Parse's default `data` array,
 * used below) perfectly adequate today: `validateRow()` is a pure
 * function of one row, entirely independent of how rows are fed to it.
 * A future larger-dataset version would swap this file's `Papa.parse()`
 * call for Papa Parse's own `step` callback (processing one row at a
 * time as it's read from a stream) without validateRow() itself
 * changing at all.
 */

export interface CsvImportRecipient {
  phoneE164: string;
  name?: string;
}

export interface CsvImportRejectedRow {
  rowNumber: number;
  rawPhone: string;
  reason: string;
}

export interface CsvImportResult {
  recipients: CsvImportRecipient[];
  rejected: CsvImportRejectedRow[];
  /** True if the file had more data rows than CSV_IMPORT_MAX_ROWS — the
   *  excess rows were not processed at all (not silently dropped after
   *  validation; the caller should be told the file was bigger than
   *  what got imported). */
  truncated: boolean;
  /** Set only for a file-level problem (no recognizable phone column)
   *  that makes per-row validation meaningless — distinct from
   *  `rejected`, which is always about specific rows. */
  fileError?: string;
}

const PHONE_HEADER_CANDIDATES = ["phone", "phone number", "whatsapp number", "mobile", "mobile number", "whatsapp"];
const NAME_HEADER_CANDIDATES = ["name", "full name", "contact name"];

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

function emptyResult(fileError: string): CsvImportResult {
  return { recipients: [], rejected: [], truncated: false, fileError };
}

export function parseAndValidateCsv(csvText: string): CsvImportResult {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  const headers = parsed.meta.fields ?? [];
  const phoneColumn = findColumn(headers, PHONE_HEADER_CANDIDATES);
  if (!phoneColumn) {
    return emptyResult(
      `No phone number column found. Expected a header matching one of: ${PHONE_HEADER_CANDIDATES.join(", ")}.`,
    );
  }
  const nameColumn = findColumn(headers, NAME_HEADER_CANDIDATES);

  const rows = parsed.data;
  const truncated = rows.length > CSV_IMPORT_MAX_ROWS;
  const rowsToProcess = rows.slice(0, CSV_IMPORT_MAX_ROWS);

  const recipients: CsvImportRecipient[] = [];
  const rejected: CsvImportRejectedRow[] = [];
  const seenPhones = new Set<string>();

  rowsToProcess.forEach((row, index) => {
    // +1 for the header row, +1 to make it 1-indexed for a human reading
    // the rejected-rows report against their own spreadsheet.
    const rowNumber = index + 2;
    const rawPhone = (row[phoneColumn] ?? "").trim();
    const rawName = nameColumn ? row[nameColumn]?.trim() : undefined;

    if (!rawPhone) {
      rejected.push({ rowNumber, rawPhone, reason: "Missing phone number" });
      return;
    }
    if (!isValidIndianMobile(rawPhone)) {
      rejected.push({ rowNumber, rawPhone, reason: "Invalid phone number format" });
      return;
    }

    const phoneE164 = normalizeIndianMobile(rawPhone);
    if (seenPhones.has(phoneE164)) {
      rejected.push({ rowNumber, rawPhone, reason: "Duplicate within this file" });
      return;
    }
    seenPhones.add(phoneE164);
    recipients.push({ phoneE164, name: rawName || undefined });
  });

  return { recipients, rejected, truncated };
}
