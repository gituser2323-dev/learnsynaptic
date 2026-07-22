// Indian mobile numbers: 10 digits starting 6-9, with an optional +91 / 91 / 0 prefix.
const INDIAN_MOBILE_RE = /^(?:\+91[\s-]?|91[\s-]?|0)?[6-9]\d{9}$/;

export function isValidIndianMobile(value: string): boolean {
  const trimmed = value.trim().replace(/[\s-]/g, "");
  return INDIAN_MOBILE_RE.test(trimmed);
}

export function normalizeIndianMobile(value: string): string {
  const digits = value.trim().replace(/[\s-]/g, "").replace(/^(\+91|91|0)/, "");
  return `+91${digits}`;
}
