export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | boolean | undefined | null;
}

function escapeCsvField(value: unknown): string {
  const str = value === undefined || value === null ? "" : String(value);
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
