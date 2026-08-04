import type { NextResponse } from "next/server";
import { withApiRoute, apiSuccess, parseJsonBody, ValidationApiError, NotFoundApiError, UpstreamServiceApiError } from "@/lib/api";
import type { ApiRouteContext } from "@/lib/api";
import { conversationService, ConversationSendFailedError } from "@/lib/services/conversations";
import type { SendReplyInput } from "@/lib/services/conversations";
import { WhatsAppProviderNotImplementedError } from "@/lib/services/whatsapp";
import type { WhatsAppQuickReplyButton, WhatsAppListSection, WhatsAppMediaKind } from "@/lib/services/whatsapp";

const MEDIA_KINDS: WhatsAppMediaKind[] = ["image", "video", "audio", "document"];

/** Parses and validates the request body into a SendReplyInput —
 *  deliberately manual rather than a generic schema library, matching
 *  every other admin route's own inline-validation convention (see
 *  e.g. app/api/admin/crm/pipelines/route.ts). Throws ValidationApiError
 *  on any malformed shape rather than letting a bad request reach
 *  conversationService.sendReply() at all. */
function parseSendReplyInput(body: Record<string, unknown>): SendReplyInput {
  const type = body.type;

  if (type === "text") {
    const text = body.body;
    if (typeof text !== "string" || !text.trim()) {
      throw new ValidationApiError([{ field: "body", message: "body is required for a text reply." }]);
    }
    return { type: "text", body: text.trim() };
  }

  if (type === "buttons") {
    const bodyText = body.bodyText;
    const buttons = body.buttons;
    if (typeof bodyText !== "string" || !bodyText.trim()) {
      throw new ValidationApiError([{ field: "bodyText", message: "bodyText is required for a buttons reply." }]);
    }
    if (!Array.isArray(buttons) || buttons.length === 0 || buttons.length > 3) {
      throw new ValidationApiError([{ field: "buttons", message: "buttons must be an array of 1-3 items." }]);
    }
    const parsedButtons = buttons.map((button, index) => {
      if (!button || typeof button.id !== "string" || typeof button.title !== "string" || !button.title.trim()) {
        throw new ValidationApiError([{ field: `buttons[${index}]`, message: "Each button needs an id and a title." }]);
      }
      return { id: button.id, title: button.title } satisfies WhatsAppQuickReplyButton;
    });
    return { type: "buttons", bodyText: bodyText.trim(), buttons: parsedButtons };
  }

  if (type === "list") {
    const bodyText = body.bodyText;
    const buttonText = body.buttonText;
    const sections = body.sections;
    if (typeof bodyText !== "string" || !bodyText.trim()) {
      throw new ValidationApiError([{ field: "bodyText", message: "bodyText is required for a list reply." }]);
    }
    if (typeof buttonText !== "string" || !buttonText.trim()) {
      throw new ValidationApiError([{ field: "buttonText", message: "buttonText is required for a list reply." }]);
    }
    if (!Array.isArray(sections) || sections.length === 0) {
      throw new ValidationApiError([{ field: "sections", message: "At least one section is required." }]);
    }
    const parsedSections = sections.map((section, sectionIndex) => {
      if (!section || !Array.isArray(section.rows) || section.rows.length === 0) {
        throw new ValidationApiError([{ field: `sections[${sectionIndex}]`, message: "Each section needs at least one row." }]);
      }
      const rows = section.rows.map((row: Record<string, unknown>, rowIndex: number) => {
        if (!row || typeof row.id !== "string" || typeof row.title !== "string" || !row.title.trim()) {
          throw new ValidationApiError([
            { field: `sections[${sectionIndex}].rows[${rowIndex}]`, message: "Each row needs an id and a title." },
          ]);
        }
        return { id: row.id, title: row.title, description: typeof row.description === "string" ? row.description : undefined };
      });
      return { title: typeof section.title === "string" ? section.title : undefined, rows } satisfies WhatsAppListSection;
    });
    return { type: "list", bodyText: bodyText.trim(), buttonText: buttonText.trim(), sections: parsedSections };
  }

  if (type === "media") {
    const kind = body.kind;
    const url = body.url;
    if (typeof kind !== "string" || !MEDIA_KINDS.includes(kind as WhatsAppMediaKind)) {
      throw new ValidationApiError([{ field: "kind", message: "kind must be one of image, video, audio, document." }]);
    }
    if (typeof url !== "string" || !url.trim()) {
      throw new ValidationApiError([{ field: "url", message: "url is required for a media reply." }]);
    }
    return {
      type: "media",
      kind: kind as WhatsAppMediaKind,
      url: url.trim(),
      caption: typeof body.caption === "string" ? body.caption : undefined,
      filename: typeof body.filename === "string" ? body.filename : undefined,
    };
  }

  throw new ValidationApiError([{ field: "type", message: "type must be one of text, buttons, list, media." }]);
}

/**
 * POST /api/admin/conversations/[id]/messages
 *
 * Module 2.2 (Rich Messaging) — sends a reply from the thread view and
 * records it as an outbound Message, same as an inbound webhook message
 * records one. Every content type routes through
 * conversationService.sendReply(); this route's only job is validating
 * the request shape into a SendReplyInput and translating the two
 * failure modes sendReply can throw:
 *  - WhatsAppProviderNotImplementedError → 400, the active provider
 *    (console, or an unwired vendor stub) doesn't support this send
 *    type yet.
 *  - ConversationSendFailedError → 502, the provider attempted the send
 *    and Meta (or whichever vendor) rejected/failed it.
 *
 * ⚠️ requiredRole: "admin".
 */
async function handleSendReply(request: Request, ctx: ApiRouteContext): Promise<NextResponse> {
  const { id } = ctx.params;
  const body = (await parseJsonBody(request)) as Record<string, unknown>;
  const input = parseSendReplyInput(body);

  try {
    const message = await conversationService.sendReply(id, input);
    if (!message) throw new NotFoundApiError("Conversation", id);
    return apiSuccess({ message });
  } catch (error) {
    if (error instanceof WhatsAppProviderNotImplementedError) {
      throw new ValidationApiError([{ field: "type", message: error.message }]);
    }
    if (error instanceof ConversationSendFailedError) {
      throw new UpstreamServiceApiError(error.message);
    }
    throw error;
  }
}

export const POST = withApiRoute("admin.conversations.sendMessage", handleSendReply, {
  requiredRole: "admin",
  rateLimit: { limit: 30, windowMs: 60_000 },
});
