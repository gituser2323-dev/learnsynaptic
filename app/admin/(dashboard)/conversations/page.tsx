"use client";

import { useEffect, useState } from "react";
import { Loader2, Search, Tag as TagIcon, UserCircle, X, Paperclip, MapPin, User as UserIcon, FileText, Sparkles, LineChart } from "lucide-react";
import {
  listConversations,
  getConversationThread,
  assignConversation,
  setConversationLabels,
  addConversationNote,
  setConversationStatus,
  sendConversationReply,
  generateConversationReply,
  listConversationInsights,
  analyzeConversationAi,
  uploadFile,
  listStaff,
} from "@/components/admin/apiClient";
import { useAdminData } from "@/components/admin/useAdminData";
import { useAdminAuth } from "@/components/admin/AdminAuthContext";
import { useDebouncedValue } from "@/components/admin/useDebouncedValue";
import { FilterInput, FilterSelect } from "@/components/admin/FilterControls";
import { Badge, conversationStatusTone, conversationSentimentTone, conversationIntentTone } from "@/components/admin/Badge";
import { Pagination } from "@/components/admin/Pagination";
import { ForbiddenState, ErrorState, EmptyState, LoadingState } from "@/components/admin/DataStates";
import { buildUnifiedTimeline } from "@/components/admin/conversationTimeline";
import type { Conversation, ConversationChannel, ConversationStatus, SendReplyInput } from "@/lib/services/conversations";
import type { ReplyTone, GenerateReplyResult } from "@/lib/services/conversations/aiReply";
import type { Message } from "@/lib/services/whatsappCampaigns";
import type { Activity } from "@/lib/services/crm/activities";
import type { WhatsAppMediaKind } from "@/lib/services/whatsapp";

const MEDIA_KINDS: WhatsAppMediaKind[] = ["image", "video", "audio", "document"];
const REPLY_MODES = ["text", "buttons", "list", "media"] as const;
type ReplyMode = (typeof REPLY_MODES)[number];

const REPLY_TONES: ReplyTone[] = ["professional", "friendly", "concise", "follow_up"];
const REPLY_TONE_LABELS: Record<ReplyTone, string> = {
  professional: "Professional",
  friendly: "Friendly",
  concise: "Concise",
  follow_up: "Follow-up",
};

/** Generic fallback bodies the server synthesizes when inbound media
 *  arrives without a caption, or an outbound media reply is sent
 *  without one (see MEDIA_KIND_FALLBACK_BODY in conversationService.ts
 *  and describeInboundContent in the Meta provider — kept in sync
 *  manually across all three, same as those two already are with each
 *  other). Suppresses a redundant caption line under the media itself. */
const GENERIC_MEDIA_BODIES = new Set(["📷 Photo", "🎥 Video", "🎤 Voice message", "📄 Document"]);

const PAGE_SIZE = 25;
const CHANNEL_OPTIONS: ConversationChannel[] = ["whatsapp", "email"];
const STATUS_OPTIONS: ConversationStatus[] = ["open", "closed"];

function formatTime(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay
    ? date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function ConversationListItem({
  conversation,
  active,
  onClick,
}: {
  conversation: Conversation;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="adm-focus-ring flex w-full flex-col gap-1 border-b px-4 py-3 text-left transition-colors"
      style={{
        borderColor: "var(--adm-border)",
        background: active ? "var(--adm-accent-soft)" : "transparent",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-semibold" style={{ color: "var(--adm-text)" }}>
          {conversation.contactName || conversation.contactPhoneE164 || conversation.contactEmail}
        </p>
        <span className="shrink-0 text-[11px]" style={{ color: "var(--adm-text-muted)" }}>
          {formatTime(conversation.lastMessageAt)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs" style={{ color: "var(--adm-text-muted)" }}>
          {conversation.lastMessageDirection === "outbound" ? "You: " : ""}
          {conversation.lastMessagePreview || "No messages yet"}
        </p>
        {conversation.unreadCount > 0 && (
          <span
            className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold text-white"
            style={{ background: "var(--adm-accent)" }}
          >
            {conversation.unreadCount}
          </span>
        )}
      </div>
      {conversation.labels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {conversation.labels.map((label) => (
            <span key={label} className="adm-chip text-[10px]">
              {label}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

/** Module 2.2 (Rich Messaging) — renders a Message's content by
 *  `messageType`. Every branch still falls back to `body` on its own
 *  (the server always synthesizes a readable one — see
 *  describeInboundContent/MEDIA_KIND_FALLBACK_BODY), so an
 *  unrecognized or missing type degrades to plain text instead of
 *  rendering nothing. */
function MessageContent({ message }: { message: Message }) {
  const payload = message.interactivePayload;

  switch (message.messageType) {
    case "email":
      return (
        <div className="space-y-1">
          {message.subject && <p className="font-semibold">{message.subject}</p>}
          <p style={{ whiteSpace: "pre-wrap" }}>{message.body}</p>
        </div>
      );
    case "image":
      return (
        <div className="space-y-1.5">
          <img
            src={message.mediaUrl}
            alt={message.body || "Photo"}
            loading="lazy"
            className="max-w-full rounded-[var(--adm-radius-sm)]"
            style={{ maxHeight: 260, display: "block" }}
          />
          {message.body && !GENERIC_MEDIA_BODIES.has(message.body) && <p className="mt-1.5">{message.body}</p>}
        </div>
      );
    case "video":
      return (
        <div className="space-y-1.5">
          <video controls src={message.mediaUrl} className="max-w-full rounded-[var(--adm-radius-sm)]" style={{ maxHeight: 260 }} />
          {message.body && !GENERIC_MEDIA_BODIES.has(message.body) && <p className="mt-1.5">{message.body}</p>}
        </div>
      );
    case "audio":
      return <audio controls src={message.mediaUrl} className="max-w-full" style={{ height: 36, width: 240 }} />;
    case "document":
      return (
        <a
          href={message.mediaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 underline underline-offset-2"
        >
          <FileText size={16} className="shrink-0" /> {message.body || "Document"}
        </a>
      );
    case "location": {
      const latitude = payload?.latitude;
      const longitude = payload?.longitude;
      const hasCoords = typeof latitude === "number" && typeof longitude === "number";
      return (
        <div className="flex items-start gap-2">
          <MapPin size={16} className="mt-0.5 shrink-0" />
          <div>
            <p>{message.body}</p>
            {hasCoords && (
              <a
                href={`https://www.google.com/maps?q=${latitude},${longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs underline underline-offset-2"
              >
                Open in Maps
              </a>
            )}
          </div>
        </div>
      );
    }
    case "contacts":
      return (
        <div className="flex items-start gap-2">
          <UserIcon size={16} className="mt-0.5 shrink-0" />
          <p>{message.body}</p>
        </div>
      );
    case "interactive_button":
    case "interactive_list": {
      const buttons = (payload?.buttons as { id: string; title: string }[] | undefined) ?? [];
      const sections = (payload?.sections as { rows: { id: string; title: string }[] }[] | undefined) ?? [];
      const chips = buttons.length > 0 ? buttons : sections.flatMap((section) => section.rows);
      return (
        <div className="space-y-2">
          <p>{message.body}</p>
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {chips.map((chip) => (
                <span key={chip.id} className="adm-chip text-[11px]">
                  {chip.title}
                </span>
              ))}
            </div>
          )}
        </div>
      );
    }
    default:
      return <>{message.body || <span style={{ opacity: 0.6 }}>[no content]</span>}</>;
  }
}

function MessageBubble({ message }: { message: Message }) {
  const outbound = message.direction === "outbound";

  // A reaction isn't a message in its own right — render it as a small
  // centered annotation rather than a full left/right bubble, closer to
  // how WhatsApp itself shows a reaction attached to another message.
  if (message.messageType === "reaction") {
    return (
      <div className="flex justify-center">
        <span className="adm-chip text-[11px]" style={{ color: "var(--adm-text-muted)" }}>
          {message.body}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ alignItems: outbound ? "flex-end" : "flex-start" }}>
      <div
        className="max-w-[75%] rounded-[var(--adm-radius-md)] px-3.5 py-2 text-sm"
        style={{
          background: outbound ? "var(--adm-accent)" : "var(--adm-surface-2)",
          color: outbound ? "#fff" : "var(--adm-text)",
        }}
      >
        <MessageContent message={message} />
      </div>
      <span className="mt-1 text-[10px]" style={{ color: "var(--adm-text-muted)" }}>
        {new Date(message.createdAt).toLocaleString()}
      </span>
    </div>
  );
}

/** Module 4.1 (Unified Inbox) — a "note"/"system" Activity rendered
 *  inline in the same timeline as Messages, per the blueprint's own
 *  "one thread, not three tabs" goal. Not a message bubble: full-width,
 *  visually distinct (tinted, not left/right-aligned) so a counsellor
 *  never mistakes an internal note for something the contact actually
 *  said or received. System events (status changes, etc.) reuse the
 *  same small centered-pill treatment MessageBubble already gives
 *  WhatsApp reactions — both are thread annotations, not conversation
 *  content in their own right. */
function ActivityMarker({ activity }: { activity: Activity }) {
  if (activity.type === "system") {
    return (
      <div className="flex justify-center">
        <span className="adm-chip text-[11px]" style={{ color: "var(--adm-text-muted)" }}>
          {activity.body}
        </span>
      </div>
    );
  }

  return (
    <div
      className="mx-auto max-w-[85%] rounded-[var(--adm-radius-md)] border px-3.5 py-2 text-sm"
      style={{ borderColor: "var(--adm-warning)", background: "var(--adm-warning-soft)" }}
    >
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--adm-text-muted)" }}>
        Internal note — not sent to the contact
      </p>
      <p style={{ whiteSpace: "pre-wrap", color: "var(--adm-text)" }}>{activity.body}</p>
      <span className="mt-1 block text-[10px]" style={{ color: "var(--adm-text-muted)" }}>
        {new Date(activity.createdAt).toLocaleString()}
      </span>
    </div>
  );
}

function LabelsEditor({ conversation, onSaved }: { conversation: Conversation; onSaved: () => void }) {
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);

  async function commit(next: string[]) {
    setSaving(true);
    await setConversationLabels(conversation.id, next);
    setSaving(false);
    onSaved();
  }

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    const label = input.trim();
    if (!label || conversation.labels.includes(label)) return;
    setInput("");
    await commit([...conversation.labels, label]);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {conversation.labels.length === 0 && (
          <span className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
            No labels yet.
          </span>
        )}
        {conversation.labels.map((label) => (
          <button
            key={label}
            type="button"
            disabled={saving}
            onClick={() => commit(conversation.labels.filter((l) => l !== label))}
            className="adm-chip adm-focus-ring"
          >
            {label} <X size={10} />
          </button>
        ))}
      </div>
      <form onSubmit={handleAdd} className="flex gap-2">
        <FilterInput
          label="Add label"
          placeholder="Add label…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={saving}
          className="w-full"
        />
      </form>
    </div>
  );
}

/** AI CRM (Phase 5), Module 5.2 — a suggestion tool, never a send path
 *  of its own. "Insert into composer" hands the text to the existing
 *  text-mode composer below (via onInsert) — the counsellor still
 *  reviews/edits and clicks the same Send button either way; nothing
 *  here calls sendReply directly. Renders three distinct outcomes
 *  before ever showing a real suggestion (idle / unavailable / error),
 *  the same three-state discipline 5.1's AI Insights card established. */
function AiReplyAssistant({ conversationId, onInsert }: { conversationId: string; onInsert: (text: string) => void }) {
  const [tone, setTone] = useState<ReplyTone>("professional");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerateReplyResult | null>(null);

  async function handleGenerate() {
    setLoading(true);
    const response = await generateConversationReply(conversationId, tone);
    setLoading(false);
    if (response.success) setResult(response.data.result);
  }

  return (
    <div className="adm-card space-y-2.5 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--adm-text)" }}>
          <Sparkles size={13} /> AI Reply Assistant
        </div>
        <FilterSelect label="Tone" value={tone} onChange={(e) => setTone(e.target.value as ReplyTone)} className="w-36">
          {REPLY_TONES.map((t) => (
            <option key={t} value={t}>
              {REPLY_TONE_LABELS[t]}
            </option>
          ))}
        </FilterSelect>
      </div>

      <button type="button" onClick={handleGenerate} disabled={loading} className="adm-focus-ring adm-btn adm-btn-secondary text-xs">
        {loading && <Loader2 size={13} className="animate-spin" />}
        {result?.success ? "Regenerate" : "Generate Reply"}
      </button>

      {result && !result.success && result.reason === "unavailable" && (
        <p className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
          AI replies are unavailable: no AI provider is configured for this environment.
        </p>
      )}
      {result && !result.success && result.reason === "error" && (
        <p className="text-xs" style={{ color: "var(--adm-danger)" }}>
          Could not generate a reply: {result.message}
        </p>
      )}
      {result && result.success && (
        <div className="space-y-2 border-t pt-2.5" style={{ borderColor: "var(--adm-border)" }}>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="adm-chip"
              style={{ background: "var(--adm-accent-soft)", color: "var(--adm-accent)" }}
              title="The model's own stated confidence in this suggestion"
            >
              <span className="adm-chip-dot" aria-hidden="true" />
              Confidence {result.suggestion.confidence}%
            </span>
            {result.suggestion.detectedLanguage && (
              <span className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
                Detected language: {result.suggestion.detectedLanguage}
              </span>
            )}
          </div>
          <p className="whitespace-pre-wrap text-sm" style={{ color: "var(--adm-text)" }}>
            {result.suggestion.replyText}
          </p>
          {result.suggestion.reasoning && (
            <p className="text-xs italic" style={{ color: "var(--adm-text-muted)" }}>
              Why this reply: {result.suggestion.reasoning}
            </p>
          )}
          <button
            type="button"
            onClick={() => onInsert(result.suggestion.replyText)}
            className="adm-focus-ring adm-btn adm-btn-primary text-xs"
          >
            Insert into composer
          </button>

          {result.suggestion.suggestedFollowUps.length > 0 && (
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--adm-text-muted)" }}>
                Suggested follow-up questions
              </p>
              <div className="flex flex-wrap gap-1.5">
                {result.suggestion.suggestedFollowUps.map((question, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onInsert(question)}
                    className="adm-chip adm-focus-ring"
                    style={{ background: "var(--adm-surface-2)", color: "var(--adm-text-secondary)" }}
                    title="Insert this follow-up into the composer instead"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Module 2.2 (Rich Messaging) — the reply composer. Four modes share
 *  one panel rather than four separate forms: a counsellor picks the
 *  mode once per message, not once per session, so a tab switcher reads
 *  clearer here than a permanent four-form stack. Each mode keeps its
 *  own local state so switching tabs never loses what's half-typed in
 *  another. */
function ComposePanel({
  conversationId,
  channel,
  onSent,
}: {
  conversationId: string;
  channel: ConversationChannel;
  onSent: () => void;
}) {
  const [mode, setMode] = useState<ReplyMode>("text");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Module 4.2 — email has no interactive-buttons/list/media equivalent
  // (those are WhatsApp Rich Messaging concepts, module 2.2); an email
  // conversation only ever composes a plain text reply, server-enforced
  // too (see conversationService.sendReply's channel check), not just
  // hidden in this tab list.
  const availableModes = channel === "email" ? (["text"] as const) : REPLY_MODES;

  const [text, setText] = useState("");

  const [buttonsBodyText, setButtonsBodyText] = useState("");
  const [buttonTitles, setButtonTitles] = useState<string[]>(["", "", ""]);

  const [listBodyText, setListBodyText] = useState("");
  const [listButtonText, setListButtonText] = useState("");
  const [listRows, setListRows] = useState<{ title: string; description: string }[]>([{ title: "", description: "" }]);

  const [mediaKind, setMediaKind] = useState<WhatsAppMediaKind>("image");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaCaption, setMediaCaption] = useState("");
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  /** Module 6.2 — a real upload through the centralized File Storage
   *  layer, replacing "paste a URL you already have" as the only
   *  option. The resulting `mediaUrl` still flows through the exact
   *  same existing send path below (buildInput/handleSend) — no second
   *  send mechanism, just a new way to arrive at a public URL. */
  async function handleUploadMedia(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploadError(null);
    setUploadingMedia(true);
    const result = await uploadFile(file, { category: "WHATSAPP_MEDIA", visibility: "public" });
    setUploadingMedia(false);

    if (!result.success) {
      setUploadError(result.errors[0]?.message ?? "Upload failed.");
      return;
    }
    if (!result.data.file.publicUrl) {
      setUploadError(
        "Uploaded, but the active storage provider has no public URL Meta can fetch from. Connect AWS S3 or Cloudinary in Settings → Integrations, or paste a public URL manually.",
      );
      return;
    }
    setMediaUrl(result.data.file.publicUrl);
  }

  function buildInput(): SendReplyInput | null {
    if (mode === "text") {
      if (!text.trim()) return null;
      return { type: "text", body: text.trim() };
    }
    if (mode === "buttons") {
      const buttons = buttonTitles
        .map((title, index) => ({ id: `btn_${index + 1}`, title: title.trim() }))
        .filter((button) => button.title);
      if (!buttonsBodyText.trim() || buttons.length === 0) {
        setError("Add body text and at least one button.");
        return null;
      }
      return { type: "buttons", bodyText: buttonsBodyText.trim(), buttons };
    }
    if (mode === "list") {
      const rows = listRows
        .map((row, index) => ({
          id: `row_${index + 1}`,
          title: row.title.trim(),
          description: row.description.trim() || undefined,
        }))
        .filter((row) => row.title);
      if (!listBodyText.trim() || !listButtonText.trim() || rows.length === 0) {
        setError("Add body text, a menu button label, and at least one row.");
        return null;
      }
      return { type: "list", bodyText: listBodyText.trim(), buttonText: listButtonText.trim(), sections: [{ rows }] };
    }
    if (!mediaUrl.trim()) {
      setError("Add a media URL.");
      return null;
    }
    return { type: "media", kind: mediaKind, url: mediaUrl.trim(), caption: mediaCaption.trim() || undefined };
  }

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const input = buildInput();
    if (!input) return;

    setSending(true);
    const result = await sendConversationReply(conversationId, input);
    setSending(false);
    if (!result.success) {
      setError(result.errors[0]?.message ?? "Could not send.");
      return;
    }

    setText("");
    setButtonsBodyText("");
    setButtonTitles(["", "", ""]);
    setListBodyText("");
    setListButtonText("");
    setListRows([{ title: "", description: "" }]);
    setMediaUrl("");
    setMediaCaption("");
    onSent();
  }

  return (
    <div className="space-y-2.5">
      <AiReplyAssistant
        conversationId={conversationId}
        onInsert={(suggestedText) => {
          setMode("text");
          setText(suggestedText);
          setError(null);
        }}
      />

      {availableModes.length > 1 && (
        <div className="flex gap-1" role="tablist" aria-label="Reply type">
          {availableModes.map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => {
                setMode(m);
                setError(null);
              }}
              className="adm-focus-ring rounded-[var(--adm-radius-sm)] px-2.5 py-1 text-xs font-medium capitalize transition-colors"
              style={mode === m ? { background: "var(--adm-accent-soft)", color: "var(--adm-accent)" } : { color: "var(--adm-text-secondary)" }}
            >
              {m}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleSend} className="space-y-2">
        {mode === "text" && (
          <div className="flex gap-2">
            <FilterInput
              label="Reply to contact"
              placeholder="Type a reply…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full"
            />
            <button type="submit" disabled={sending || !text.trim()} className="adm-focus-ring adm-btn adm-btn-primary shrink-0">
              {sending && <Loader2 size={14} className="animate-spin" />}
              Send
            </button>
          </div>
        )}

        {mode === "buttons" && (
          <div className="space-y-2">
            <FilterInput
              label="Body text"
              placeholder="Body text…"
              value={buttonsBodyText}
              onChange={(e) => setButtonsBodyText(e.target.value)}
              className="w-full"
            />
            <div className="grid grid-cols-3 gap-2">
              {buttonTitles.map((title, index) => (
                <FilterInput
                  key={index}
                  label={`Button ${index + 1}`}
                  placeholder={`Button ${index + 1}`}
                  value={title}
                  maxLength={20}
                  onChange={(e) => {
                    const next = [...buttonTitles];
                    next[index] = e.target.value;
                    setButtonTitles(next);
                  }}
                />
              ))}
            </div>
            <button type="submit" disabled={sending} className="adm-focus-ring adm-btn adm-btn-primary">
              {sending && <Loader2 size={14} className="animate-spin" />}
              Send buttons
            </button>
          </div>
        )}

        {mode === "list" && (
          <div className="space-y-2">
            <FilterInput label="Body text" placeholder="Body text…" value={listBodyText} onChange={(e) => setListBodyText(e.target.value)} className="w-full" />
            <FilterInput
              label="Menu button label"
              placeholder="Menu button label…"
              value={listButtonText}
              onChange={(e) => setListButtonText(e.target.value)}
              className="w-full"
            />
            <div className="space-y-1.5">
              {listRows.map((row, index) => (
                <div key={index} className="flex gap-2">
                  <FilterInput
                    label={`Row ${index + 1} title`}
                    placeholder="Row title"
                    value={row.title}
                    onChange={(e) => {
                      const next = [...listRows];
                      next[index] = { ...next[index], title: e.target.value };
                      setListRows(next);
                    }}
                    className="w-full"
                  />
                  <FilterInput
                    label={`Row ${index + 1} description`}
                    placeholder="Description (optional)"
                    value={row.description}
                    onChange={(e) => {
                      const next = [...listRows];
                      next[index] = { ...next[index], description: e.target.value };
                      setListRows(next);
                    }}
                    className="w-full"
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() => setListRows([...listRows, { title: "", description: "" }])}
                className="adm-focus-ring adm-btn adm-btn-secondary text-xs"
              >
                + Add row
              </button>
            </div>
            <button type="submit" disabled={sending} className="adm-focus-ring adm-btn adm-btn-primary">
              {sending && <Loader2 size={14} className="animate-spin" />}
              Send list
            </button>
          </div>
        )}

        {mode === "media" && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <FilterSelect label="Media kind" value={mediaKind} onChange={(e) => setMediaKind(e.target.value as WhatsAppMediaKind)} className="w-32">
                {MEDIA_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {kind}
                  </option>
                ))}
              </FilterSelect>
              <FilterInput
                label="Media URL"
                placeholder="https://… (must already be publicly reachable)"
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="flex items-center gap-2">
              <label
                className="adm-focus-ring adm-btn adm-btn-secondary cursor-pointer text-xs"
                style={uploadingMedia ? { opacity: 0.6, pointerEvents: "none" } : undefined}
              >
                {uploadingMedia && <Loader2 size={12} className="animate-spin" />}
                Upload a file
                <input type="file" className="sr-only" disabled={uploadingMedia} onChange={handleUploadMedia} />
              </label>
              <span className="text-[11px]" style={{ color: "var(--adm-text-muted)" }}>
                or paste a URL that&apos;s already public, above
              </span>
            </div>
            {uploadError && (
              <p className="text-xs" style={{ color: "var(--adm-danger)" }}>
                {uploadError}
              </p>
            )}
            <FilterInput
              label="Caption"
              placeholder="Caption (optional)"
              value={mediaCaption}
              onChange={(e) => setMediaCaption(e.target.value)}
              className="w-full"
            />
            <p className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--adm-text-muted)" }}>
              <Paperclip size={11} /> Uploaded files are stored via the centralized File Storage layer (Module 6.2) —
              a real public URL from AWS S3/Cloudinary is required for Meta to fetch it; the local dev provider has
              no public URL of its own.
            </p>
            <button type="submit" disabled={sending} className="adm-focus-ring adm-btn adm-btn-primary">
              {sending && <Loader2 size={14} className="animate-spin" />}
              Send media
            </button>
          </div>
        )}

        {error && (
          <p role="alert" className="text-xs font-medium" style={{ color: "var(--adm-danger)" }}>
            {error}
          </p>
        )}
      </form>
    </div>
  );
}

/** AI CRM (Phase 5), Module 5.3 — read-only analysis, never touches the
 *  Conversation/Message rows it reads ("store AI analysis separately
 *  so conversations remain immutable"). Renders the same three-state
 *  discipline (none / unavailable / error / ok) 5.1's AI Insights and
 *  5.2's AI Reply Assistant cards already established. */
function ConversationInsightsPanel({ conversationId }: { conversationId: string }) {
  const [analyzing, setAnalyzing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const { data, loading, error, reload } = useAdminData(() => listConversationInsights(conversationId, 1, 6), [conversationId]);
  const insight = data?.items[0];
  const history = data?.items.slice(1) ?? [];

  async function handleAnalyze() {
    setAnalyzing(true);
    await analyzeConversationAi(conversationId);
    setAnalyzing(false);
    reload();
  }

  const analyzeButton = (
    <button type="button" onClick={handleAnalyze} disabled={analyzing} className="adm-focus-ring adm-btn adm-btn-secondary text-xs">
      {analyzing && <Loader2 size={13} className="animate-spin" />}
      {insight ? "Analyze Again" : "Analyze Now"}
    </button>
  );

  return (
    <div className="border-b p-4" style={{ borderColor: "var(--adm-border)" }}>
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--adm-text)" }}>
          <LineChart size={13} /> AI Conversation Insights
        </div>
        <div className="flex items-center gap-2">
          {history.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className="adm-focus-ring text-xs font-medium"
              style={{ color: "var(--adm-accent)" }}
            >
              {showHistory ? "Hide" : "Show"} history ({history.length})
            </button>
          )}
          {analyzeButton}
        </div>
      </div>

      {loading && <LoadingState label="Loading conversation insights…" />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && !insight && (
        <p className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
          No AI analysis yet for this conversation.
        </p>
      )}
      {!loading && !error && insight && insight.status === "unavailable" && (
        <p className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
          AI analysis is unavailable: no AI provider is configured for this environment.
        </p>
      )}
      {!loading && !error && insight && insight.status === "error" && (
        <p className="text-xs" style={{ color: "var(--adm-danger)" }}>
          Last analysis failed: {insight.errorMessage ?? "unknown error"}.
        </p>
      )}
      {!loading && !error && insight && insight.status === "ok" && (
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {insight.sentiment && <Badge tone={conversationSentimentTone(insight.sentiment)}>{insight.sentiment}</Badge>}
            {insight.intent && <Badge tone={conversationIntentTone(insight.intent)}>{insight.intent.replace(/_/g, " ")}</Badge>}
            {typeof insight.buyingReadinessScore === "number" && (
              <span className="adm-chip" style={{ background: "var(--adm-accent-soft)", color: "var(--adm-accent)" }} title="Buying readiness (0-100)">
                <span className="adm-chip-dot" aria-hidden="true" />
                Buying readiness {insight.buyingReadinessScore}%
              </span>
            )}
            {typeof insight.engagementScore === "number" && (
              <span className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
                Engagement {insight.engagementScore}%
              </span>
            )}
          </div>

          {insight.summary && (
            <p className="text-sm" style={{ color: "var(--adm-text)" }}>
              {insight.summary}
            </p>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--adm-text-muted)" }}>
                Key Topics
              </p>
              {insight.keyTopics && insight.keyTopics.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {insight.keyTopics.map((topic, i) => (
                    <span key={i} className="adm-chip" style={{ background: "var(--adm-surface-2)", color: "var(--adm-text-secondary)" }}>
                      {topic}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
                  None noted.
                </p>
              )}
            </div>
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--adm-text-muted)" }}>
                Risks
              </p>
              {[...(insight.objections ?? []), ...(insight.negativeSignals ?? [])].length > 0 ? (
                <ul className="list-disc space-y-1 pl-4 text-sm" style={{ color: "var(--adm-text)" }}>
                  {[...(insight.objections ?? []), ...(insight.negativeSignals ?? [])].map((risk, i) => (
                    <li key={i}>{risk}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
                  None noted.
                </p>
              )}
            </div>
          </div>

          {insight.suggestedActions && insight.suggestedActions.length > 0 && (
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--adm-text-muted)" }}>
                Suggested Actions
              </p>
              <ul className="list-disc space-y-1 pl-4 text-sm" style={{ color: "var(--adm-text)" }}>
                {insight.suggestedActions.map((action, i) => (
                  <li key={i}>{action}</li>
                ))}
              </ul>
            </div>
          )}

          {insight.missedOpportunities && insight.missedOpportunities.length > 0 && (
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--adm-text-muted)" }}>
                Missed Opportunities
              </p>
              <ul className="list-disc space-y-1 pl-4 text-sm" style={{ color: "var(--adm-text-secondary)" }}>
                {insight.missedOpportunities.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {insight.responseQualityNotes && (
            <p className="text-xs italic" style={{ color: "var(--adm-text-muted)" }}>
              Response quality: {insight.responseQualityNotes}
            </p>
          )}

          <p className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
            Last analysis: {new Date(insight.createdAt).toLocaleString()}
            {insight.providerId ? ` · ${insight.providerId}` : ""}
            {typeof insight.confidence === "number" ? ` · Confidence ${insight.confidence}%` : ""}
          </p>
        </div>
      )}

      {/* Deliberately outside the "ok"-only block above: the latest run
       *  can be "unavailable"/"error" while earlier runs in the history
       *  are still worth seeing — the toggle and its list must not
       *  disappear just because the most recent attempt didn't
       *  produce a result. */}
      {!loading && !error && showHistory && history.length > 0 && (
        <div className="mt-2.5 space-y-1.5 border-t pt-2.5" style={{ borderColor: "var(--adm-border)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--adm-text-muted)" }}>
            Analysis History
          </p>
          {history.map((past) => (
            <div key={past.id} className="flex flex-wrap items-center gap-2 text-xs" style={{ color: "var(--adm-text-muted)" }}>
              <span>{new Date(past.createdAt).toLocaleString()}</span>
              {past.status === "ok" && past.sentiment && <Badge tone={conversationSentimentTone(past.sentiment)}>{past.sentiment}</Badge>}
              {past.status === "ok" && typeof past.buyingReadinessScore === "number" && <span>Readiness {past.buyingReadinessScore}%</span>}
              {past.status !== "ok" && <span>{past.status}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ThreadPane({ conversationId, onChanged }: { conversationId: string; onChanged: () => void }) {
  const { user } = useAdminAuth();
  const [noteBody, setNoteBody] = useState("");
  const [submittingNote, setSubmittingNote] = useState(false);
  const [savingAssign, setSavingAssign] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);

  const { data, loading, error, reload } = useAdminData(() => getConversationThread(conversationId), [conversationId]);
  const { data: staffData } = useAdminData(() => listStaff(), []);

  // Fetching the thread marks it read server-side — refresh the list's
  // unread badge to match once that side effect has actually happened.
  useEffect(() => {
    if (data) onChanged();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (loading) return <LoadingState label="Loading conversation…" />;
  if (error || !data) return <ErrorState message={error ?? "Could not load this conversation."} onRetry={reload} />;

  const { conversation, messages, activities } = data;
  const timeline = buildUnifiedTimeline(messages, activities);

  async function handleAssign(userId: string) {
    if (!userId) return;
    setSavingAssign(true);
    await assignConversation(conversationId, userId);
    setSavingAssign(false);
    reload();
  }

  async function handleToggleStatus() {
    setSavingStatus(true);
    await setConversationStatus(conversationId, conversation.status === "open" ? "closed" : "open");
    setSavingStatus(false);
    reload();
  }

  async function handleAddNote(event: React.FormEvent) {
    event.preventDefault();
    if (!noteBody.trim()) return;
    setSubmittingNote(true);
    const result = await addConversationNote(conversationId, noteBody.trim());
    setSubmittingNote(false);
    if (result.success) {
      setNoteBody("");
      reload();
    }
  }

  const assignedStaff = staffData?.users.find((u) => u.id === conversation.assignedTo);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b p-4" style={{ borderColor: "var(--adm-border)" }}>
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--adm-text)" }}>
            {conversation.contactName || conversation.contactPhoneE164 || conversation.contactEmail}
          </p>
          <p className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
            {conversation.contactPhoneE164 || conversation.contactEmail} · {conversation.channel}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={conversationStatusTone(conversation.status)}>{conversation.status}</Badge>
          <button
            type="button"
            onClick={handleToggleStatus}
            disabled={savingStatus}
            className="adm-focus-ring adm-btn adm-btn-secondary"
          >
            {savingStatus && <Loader2 size={12} className="animate-spin" />}
            {conversation.status === "open" ? "Close" : "Reopen"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 border-b p-4 sm:grid-cols-2" style={{ borderColor: "var(--adm-border)" }}>
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--adm-text-muted)" }}>
            <UserCircle size={13} /> Assigned to
          </p>
          <p className="mb-2 text-sm" style={{ color: "var(--adm-text)" }}>
            {assignedStaff ? assignedStaff.name || assignedStaff.email : "Unassigned"}
          </p>
          {/* A stateless trigger select (value is always "", never bound to
           *  conversation.assignedTo) — same pattern as the Leads detail
           *  page's own "Reassign to" control. A controlled value here
           *  would need a matching <option> for the current assignee on
           *  every render; excluding that option to avoid a duplicate
           *  entry left the select with no matching option at all, which
           *  silently mis-assigned to whatever the browser fell back to. */}
          <FilterSelect
            label="Assign to"
            value=""
            onChange={(e) => handleAssign(e.target.value)}
            disabled={savingAssign}
            className="w-full"
          >
            <option value="">{savingAssign ? "Assigning…" : "Assign / reassign…"}</option>
            {staffData?.users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name || u.email}
              </option>
            ))}
          </FilterSelect>
        </div>
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--adm-text-muted)" }}>
            <TagIcon size={13} /> Labels
          </p>
          <LabelsEditor conversation={conversation} onSaved={reload} />
        </div>
      </div>

      <ConversationInsightsPanel conversationId={conversationId} />

      <div className="flex-1 space-y-3 overflow-y-auto p-4" style={{ minHeight: 260 }} data-testid="unified-timeline">
        {timeline.length === 0 && <EmptyState message="No messages in this thread yet." />}
        {timeline.map((entry) =>
          entry.kind === "message" ? (
            <MessageBubble key={`message-${entry.message.id}`} message={entry.message} />
          ) : (
            <ActivityMarker key={`activity-${entry.activity.id}`} activity={entry.activity} />
          ),
        )}
      </div>

      <div className="border-t p-4" style={{ borderColor: "var(--adm-border)" }}>
        <ComposePanel conversationId={conversationId} channel={conversation.channel} onSent={reload} />
      </div>

      {/* Module 4.1 — notes now render inline in the unified timeline
       *  above (see ActivityMarker), so this is just the add-note
       *  affordance, not a second history list duplicating what's
       *  already shown there. */}
      <div className="border-t p-4" style={{ borderColor: "var(--adm-border)" }}>
        <form onSubmit={handleAddNote} className="flex gap-2">
          <FilterInput
            label="Add an internal note"
            placeholder="Add an internal note (not sent to the contact)…"
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
            className="w-full"
          />
          <button type="submit" disabled={submittingNote || !noteBody.trim()} className="adm-focus-ring adm-btn adm-btn-primary shrink-0">
            {submittingNote && <Loader2 size={14} className="animate-spin" />}
            Note
          </button>
        </form>
      </div>

      {user && (
        <p className="sr-only" aria-hidden="true">
          Viewing as {user.name || user.email}
        </p>
      )}
    </div>
  );
}

export default function AdminConversationsPage() {
  const { user } = useAdminAuth();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [channel, setChannel] = useState<ConversationChannel | "">("");
  const [status, setStatus] = useState<ConversationStatus | "">("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(searchInput);

  const filters = { search: debouncedSearch || undefined, channel: channel || undefined, status: status || undefined };

  const { data, loading, error, forbidden, reload } = useAdminData(
    () => listConversations(filters, page, PAGE_SIZE),
    [page, debouncedSearch, channel, status],
  );

  // Auto-select the first conversation once the list loads — a
  // render-phase conditional setState (React's documented pattern for
  // "derive state from a prop/data change"), not an effect, matching
  // useAdminData.ts's own reasoning for the same trick.
  if (!selectedId && data && data.items.length > 0) {
    setSelectedId(data.items[0].id);
  }

  function onFilterChange<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  if (forbidden) return <ForbiddenState role={user?.role} />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="!text-xl font-bold" style={{ color: "var(--adm-text)" }}>
          Conversations
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--adm-text-secondary)" }}>
          A contact&apos;s whole WhatsApp or email history as one thread — assign, label, and reply from here.
        </p>
      </div>

      <div className="adm-card overflow-hidden p-0" style={{ height: "calc(100vh - 220px)", minHeight: 480 }}>
        <div className="grid h-full grid-cols-1 lg:grid-cols-[340px_1fr]">
          <div className="flex flex-col border-r" style={{ borderColor: "var(--adm-border)" }}>
            <div className="space-y-2 border-b p-3" style={{ borderColor: "var(--adm-border)" }}>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--adm-text-muted)" }} />
                <FilterInput
                  label="Search conversations"
                  placeholder="Search name, phone, or email…"
                  value={searchInput}
                  onChange={(e) => onFilterChange(setSearchInput)(e.target.value)}
                  className="w-full pl-8"
                />
              </div>
              <div className="flex gap-2">
                <FilterSelect
                  label="Filter by channel"
                  value={channel}
                  onChange={(e) => onFilterChange(setChannel)(e.target.value as ConversationChannel | "")}
                  className="w-full"
                >
                  <option value="">All channels</option>
                  {CHANNEL_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </FilterSelect>
                <FilterSelect
                  label="Filter by status"
                  value={status}
                  onChange={(e) => onFilterChange(setStatus)(e.target.value as ConversationStatus | "")}
                  className="w-full"
                >
                  <option value="">All statuses</option>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </FilterSelect>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading && <LoadingState label="Loading conversations…" />}
              {!loading && error && <ErrorState message={error} onRetry={reload} />}
              {!loading && !error && data && data.items.length === 0 && (
                <EmptyState message="No conversations match these filters." />
              )}
              {!loading &&
                !error &&
                data &&
                data.items.map((conversation) => (
                  <ConversationListItem
                    key={conversation.id}
                    conversation={conversation}
                    active={conversation.id === selectedId}
                    onClick={() => setSelectedId(conversation.id)}
                  />
                ))}
            </div>

            {data && data.totalPages > 1 && (
              <div className="border-t p-2" style={{ borderColor: "var(--adm-border)" }}>
                <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPageChange={setPage} />
              </div>
            )}
          </div>

          <div className="flex flex-col">
            {selectedId ? (
              <ThreadPane conversationId={selectedId} onChanged={reload} />
            ) : (
              <div className="flex h-full items-center justify-center">
                <EmptyState message="Select a conversation to view its thread." />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
