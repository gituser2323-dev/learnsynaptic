export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | boolean | undefined | null;
}

/**
 * RC-9 — Full-System Validation, Load, Stress, Security & Failure
 * Testing. A real, live-proven CSV/formula-injection vulnerability
 * found and fixed this pass: a leading `=`, `+`, `-`, or `@` (or a
 * leading tab/CR) makes Excel/Google Sheets/LibreOffice interpret a
 * cell as a FORMULA when the exported file is opened, not plain text
 * — a well-known, real vulnerability class (OWASP: CSV Injection /
 * Formula Injection), not a theoretical one. Confirmed live: a lead
 * created through this app's own fully PUBLIC, unauthenticated
 * lead-capture endpoint with the name `=1+1+cmd|' /C calc'!A0`
 * appeared verbatim, un-neutralized, in a real admin's CSV export —
 * meaning an anonymous, unauthenticated actor could plant a formula
 * that executes on a STAFF MEMBER's own machine the moment they open
 * an exported CSV in a spreadsheet program (ranging from an annoyance
 * to, with a DDE/WEBSERVICE-style formula, real data exfiltration or
 * command execution, depending on the victim's own spreadsheet
 * application and its own macro/DDE settings).
 *
 * Every CSV export in this codebase goes through this one function —
 * fixed here once, not per-route. The OWASP-recommended mitigation:
 * prefix a formula-triggering leading character with a single quote,
 * which every mainstream spreadsheet application treats as "force
 * this cell to be plain text," neutralizing the formula while leaving
 * the visible cell content otherwise unchanged for the common case (a
 * value that never started with one of these characters is completely
 * untouched — this never rewrites ordinary data).
 */
const FORMULA_TRIGGER_RE = /^[=+\-@\t\r]/;

function escapeCsvField(value: unknown): string {
  let str = value === undefined || value === null ? "" : String(value);
  if (FORMULA_TRIGGER_RE.test(str)) {
    str = `'${str}`;
  }
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Plain CSV serialization — no library needed for something this small. */
export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((column) => escapeCsvField(column.header)).join(",");
  const lines = rows.map((row) => columns.map((column) => escapeCsvField(column.value(row))).join(","));
  return [header, ...lines].join("\r\n");
}
