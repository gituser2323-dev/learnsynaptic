import type { OrganizationTeamSize } from "@/lib/services/organizations";

export interface OnboardingValidationError {
  field: string;
  message: string;
}

export interface CreateOrganizationRequest {
  name: string;
  industry?: string;
  teamSize?: OrganizationTeamSize;
  website?: string;
  country?: string;
  timezone?: string;
}

export type ValidateCreateOrganizationInputResult =
  | { valid: true; data: CreateOrganizationRequest }
  | { valid: false; errors: OnboardingValidationError[] };

const MAX_NAME = 150;
const TEAM_SIZES: OrganizationTeamSize[] = ["1-10", "11-50", "51-200", "201-1000", "1000+"];
const COUNTRY_RE = /^[A-Za-z]{2}$/;

/** Same "reject javascript:/data:/any non-http(s) scheme" discipline
 *  brandingService's own isSafeHttpUrl already established for a
 *  stored, later-rendered-as-`<a href>` URL — organization.website is
 *  the identical shape (stored once, rendered as a link in the
 *  business-setup summary/checklist), so it needs the identical XSS
 *  defense, not a lighter one just because it's collected earlier in
 *  the funnel. */
function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** A real check, not a regex guess: the runtime's own IANA tz database
 *  either recognizes the zone or `Intl.DateTimeFormat` throws — the
 *  same "ask the platform, don't hand-roll a list" approach this app
 *  already prefers for country/currency-shaped validation elsewhere. */
function isValidTimezone(value: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/**
 * RC-7 — Customer Onboarding & SaaS Activation. Backs
 * `POST /api/onboarding/organization`. Deliberately short — the
 * mission's own "collect only useful initial information... do not
 * turn onboarding into a giant questionnaire" instruction (§4) — only
 * `name` is required, everything else is optional and validated
 * loosely (a business's own self-reported industry/team-size/country
 * isn't security-sensitive; the real defenses here are the URL-scheme
 * check on `website` and the real-timezone-database check on
 * `timezone`, the two fields with an actual injection/garbage-data
 * risk).
 */
export function validateCreateOrganizationInput(input: unknown): ValidateCreateOrganizationInputResult {
  const errors: OnboardingValidationError[] = [];

  if (typeof input !== "object" || input === null) {
    return { valid: false, errors: [{ field: "root", message: "Request body must be a JSON object." }] };
  }
  const record = input as Record<string, unknown>;

  const name = typeof record.name === "string" ? record.name.trim() : "";
  if (!name) errors.push({ field: "name", message: "Organization name is required." });
  else if (name.length > MAX_NAME) errors.push({ field: "name", message: `Organization name must be ${MAX_NAME} characters or fewer.` });

  const industry = typeof record.industry === "string" && record.industry.trim() ? record.industry.trim() : undefined;

  let teamSize: OrganizationTeamSize | undefined;
  if (record.teamSize !== undefined) {
    if (typeof record.teamSize !== "string" || !TEAM_SIZES.includes(record.teamSize as OrganizationTeamSize)) {
      errors.push({ field: "teamSize", message: `Team size must be one of: ${TEAM_SIZES.join(", ")}.` });
    } else {
      teamSize = record.teamSize as OrganizationTeamSize;
    }
  }

  let website: string | undefined;
  if (typeof record.website === "string" && record.website.trim()) {
    const trimmed = record.website.trim();
    if (!isSafeHttpUrl(trimmed)) {
      errors.push({ field: "website", message: "Website must be a real http:// or https:// URL." });
    } else {
      website = trimmed;
    }
  }

  let country: string | undefined;
  if (typeof record.country === "string" && record.country.trim()) {
    const trimmed = record.country.trim().toUpperCase();
    if (!COUNTRY_RE.test(trimmed)) {
      errors.push({ field: "country", message: "Country must be a real 2-letter code (e.g. IN, US)." });
    } else {
      country = trimmed;
    }
  }

  let timezone: string | undefined;
  if (typeof record.timezone === "string" && record.timezone.trim()) {
    const trimmed = record.timezone.trim();
    if (!isValidTimezone(trimmed)) {
      errors.push({ field: "timezone", message: "Timezone must be a real IANA timezone (e.g. Asia/Kolkata)." });
    } else {
      timezone = trimmed;
    }
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true, data: { name, industry, teamSize, website, country, timezone } };
}
