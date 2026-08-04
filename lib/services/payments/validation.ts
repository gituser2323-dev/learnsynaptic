import { isPaymentProviderId } from "./registry";
import type { CreateCheckoutSessionInput, PaymentProviderId } from "./types";

export interface PaymentValidationError {
  field: string;
  message: string;
}

const CURRENCY_RE = /^[A-Z]{3}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_METADATA_ENTRIES = 20;

export function validateCreateCheckoutSessionInput(
  input: unknown,
): { valid: true; data: CreateCheckoutSessionInput } | { valid: false; errors: PaymentValidationError[] } {
  const errors: PaymentValidationError[] = [];
  const body = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;

  const provider = typeof body.provider === "string" && isPaymentProviderId(body.provider) ? (body.provider as PaymentProviderId) : undefined;
  if (!provider) errors.push({ field: "provider", message: "provider must be a supported payment provider id." });

  const amountInSmallestUnit = typeof body.amountInSmallestUnit === "number" ? body.amountInSmallestUnit : NaN;
  if (!Number.isInteger(amountInSmallestUnit) || amountInSmallestUnit <= 0) {
    errors.push({ field: "amountInSmallestUnit", message: "amountInSmallestUnit must be a positive integer (e.g. paise, not rupees)." });
  }

  const currency = typeof body.currency === "string" ? body.currency.trim().toUpperCase() : "";
  if (!CURRENCY_RE.test(currency)) errors.push({ field: "currency", message: "currency must be a 3-letter ISO 4217 code, e.g. \"INR\"." });

  const purpose = typeof body.purpose === "string" ? body.purpose.trim() : "";
  if (!purpose) errors.push({ field: "purpose", message: "purpose is required." });

  const returnUrl = typeof body.returnUrl === "string" ? body.returnUrl.trim() : "";
  if (!returnUrl) {
    errors.push({ field: "returnUrl", message: "returnUrl is required." });
  } else {
    try {
      const parsed = new URL(returnUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        errors.push({ field: "returnUrl", message: "returnUrl must be http or https." });
      }
    } catch {
      errors.push({ field: "returnUrl", message: "returnUrl must be a valid URL." });
    }
  }

  const customerEmail = typeof body.customerEmail === "string" ? body.customerEmail.trim() : "";
  if (customerEmail && !EMAIL_RE.test(customerEmail)) errors.push({ field: "customerEmail", message: "customerEmail must be a valid email." });

  const metadataRaw = body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata) ? (body.metadata as Record<string, unknown>) : {};
  const metadata: Record<string, string> = {};
  const metadataEntries = Object.entries(metadataRaw).slice(0, MAX_METADATA_ENTRIES);
  for (const [key, value] of metadataEntries) {
    if (typeof value === "string" || typeof value === "number") metadata[key] = String(value);
  }

  if (errors.length > 0) return { valid: false, errors };

  return {
    valid: true,
    data: {
      provider: provider!,
      amountInSmallestUnit,
      currency,
      purpose,
      returnUrl,
      customerName: typeof body.customerName === "string" && body.customerName.trim() ? body.customerName.trim() : undefined,
      customerEmail: customerEmail || undefined,
      customerPhone: typeof body.customerPhone === "string" && body.customerPhone.trim() ? body.customerPhone.trim() : undefined,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    },
  };
}

export interface ValidatedCreatePaymentInput {
  checkout: CreateCheckoutSessionInput;
  leadId?: string;
  registrationId?: string;
  opportunityId?: string;
  campaignId?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

/** The admin-facing "Create Payment" input — the checkout fields above,
 *  plus optional CRM linkage. Kept as a thin wrapper rather than
 *  merging into validateCreateCheckoutSessionInput itself: the inbound
 *  webhook path and any future public checkout caller only ever need
 *  the checkout shape, never the CRM-linkage fields an admin action
 *  supplies. */
export function validateCreatePaymentInput(
  input: unknown,
): { valid: true; data: ValidatedCreatePaymentInput } | { valid: false; errors: PaymentValidationError[] } {
  const checkoutResult = validateCreateCheckoutSessionInput(input);
  if (!checkoutResult.valid) return checkoutResult;

  const body = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const str = (key: string): string | undefined => (typeof body[key] === "string" && (body[key] as string).trim() ? (body[key] as string).trim() : undefined);

  return {
    valid: true,
    data: {
      checkout: checkoutResult.data,
      leadId: str("leadId"),
      registrationId: str("registrationId"),
      opportunityId: str("opportunityId"),
      campaignId: str("campaignId"),
      relatedEntityType: str("relatedEntityType"),
      relatedEntityId: str("relatedEntityId"),
    },
  };
}
