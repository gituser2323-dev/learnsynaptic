import type { CreateAutoReplyRuleInput, UpdateAutoReplyRuleInput } from "./types";

export interface AutoReplyRuleValidationError {
  field: string;
  message: string;
}

export type AutoReplyRuleValidationResult<T> =
  | { valid: true; data: T }
  | { valid: false; errors: AutoReplyRuleValidationError[] };

const MAX_REPLY_LENGTH = 1000;
const MAX_KEYWORDS = 20;

function normalizeKeywords(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((k): k is string => typeof k === "string")
    .map((k) => k.trim())
    .filter(Boolean);
}

export function validateCreateAutoReplyRuleInput(input: unknown): AutoReplyRuleValidationResult<CreateAutoReplyRuleInput> {
  const errors: AutoReplyRuleValidationError[] = [];
  const body = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;

  const isFallback = typeof body.isFallback === "boolean" ? body.isFallback : false;
  const active = typeof body.active === "boolean" ? body.active : true;

  const replyText = typeof body.replyText === "string" ? body.replyText.trim() : "";
  if (!replyText) errors.push({ field: "replyText", message: "Reply text is required." });
  if (replyText.length > MAX_REPLY_LENGTH) {
    errors.push({ field: "replyText", message: `Reply text must be ${MAX_REPLY_LENGTH} characters or fewer.` });
  }

  const keywords = normalizeKeywords(body.keywords);
  if (!isFallback) {
    if (keywords.length === 0) {
      errors.push({ field: "keywords", message: "At least one keyword is required for a non-fallback rule." });
    }
    if (keywords.length > MAX_KEYWORDS) {
      errors.push({ field: "keywords", message: `A rule can have at most ${MAX_KEYWORDS} keywords.` });
    }
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true, data: { keywords: isFallback ? [] : keywords, replyText, isFallback, active } };
}

/** Per-field shape only — the cross-field rule ("a non-fallback rule
 *  needs at least one keyword") depends on the existing record's
 *  isFallback when it isn't part of this same patch, so it's checked
 *  in autoReplyService.updateAutoReplyRule() once the merged result is
 *  known, not here. */
export function validateUpdateAutoReplyRuleInput(input: unknown): AutoReplyRuleValidationResult<UpdateAutoReplyRuleInput> {
  const errors: AutoReplyRuleValidationError[] = [];
  const body = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const patch: UpdateAutoReplyRuleInput = {};

  if (body.replyText !== undefined) {
    const replyText = typeof body.replyText === "string" ? body.replyText.trim() : "";
    if (!replyText) errors.push({ field: "replyText", message: "Reply text cannot be empty." });
    else if (replyText.length > MAX_REPLY_LENGTH) {
      errors.push({ field: "replyText", message: `Reply text must be ${MAX_REPLY_LENGTH} characters or fewer.` });
    } else patch.replyText = replyText;
  }

  if (body.isFallback !== undefined) {
    if (typeof body.isFallback !== "boolean") errors.push({ field: "isFallback", message: "isFallback must be a boolean." });
    else patch.isFallback = body.isFallback;
  }

  if (body.active !== undefined) {
    if (typeof body.active !== "boolean") errors.push({ field: "active", message: "active must be a boolean." });
    else patch.active = body.active;
  }

  if (body.keywords !== undefined) {
    const keywords = normalizeKeywords(body.keywords);
    if (keywords.length > MAX_KEYWORDS) {
      errors.push({ field: "keywords", message: `A rule can have at most ${MAX_KEYWORDS} keywords.` });
    } else {
      patch.keywords = keywords;
    }
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true, data: patch };
}
