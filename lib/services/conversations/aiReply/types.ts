/**
 * AI CRM (Phase 5), Module 5.2 — AI-Assisted Replies.
 *
 * Deliberately stateless — no new database model. Unlike 5.1's
 * LeadInsight (which needed a persisted history because "insights
 * history" was its own explicit requirement), nothing here mutates
 * state until a counsellor actually reviews, optionally edits, and
 * sends a suggestion through the existing composer — at which point
 * it's just an ordinary outbound Message, indistinguishable from one a
 * counsellor typed from scratch. A suggestion that's discarded or
 * regenerated leaves no trace, which is correct: it was never sent,
 * never seen by the contact, and carries no business-audit weight on
 * its own (see aiReplyService.ts's own doc comment for the full
 * reasoning on why this isn't audit-logged).
 */
export type ReplyTone = "professional" | "friendly" | "concise" | "follow_up";

export interface ReplySuggestion {
  replyText: string;
  tone: ReplyTone;
  /** 0-100 — the model's own stated confidence in this suggestion. */
  confidence: number;
  /** "Explain why the reply was suggested" — the module's own wording. */
  reasoning: string;
  suggestedFollowUps: string[];
  /** Best-effort, e.g. "English", "Hindi", "Hinglish" — unset if the
   *  model didn't return one rather than guessed. */
  detectedLanguage?: string;
  providerId: string;
}

export type GenerateReplyResult =
  | { success: true; suggestion: ReplySuggestion }
  | { success: false; reason: "unavailable" | "error"; message: string };
