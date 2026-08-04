import { getMessageRepository, getConversationRepository } from "@/lib/db";
import type { Message } from "@/lib/services/whatsappCampaigns";

const PAGE_SIZE = 500;

/**
 * WhatsApp Platform (Phase 2), module 2.1 — one-time backfill migration.
 * Groups every existing Message row by `recipientPhoneE164` into a
 * Conversation and sets `conversationId`/`direction` on each — the
 * exact migration the approved Blueprint specifies for this module:
 * "Backfill script groups every existing Message by recipient phone
 * into a Conversation — one-time, reversible."
 *
 * Reversible: Message rows are only ever patched (conversationId,
 * direction), never replaced or deleted — dropping every Conversation
 * row afterward loses only the thread view, not send history, exactly
 * as the Blueprint's own Rollback note for this module describes.
 *
 * Skips any Message that already has a conversationId (safe to re-run —
 * a second run only picks up messages created since the last run, the
 * same idempotence createAdminUser.ts's sibling scripts document for
 * their own out-of-band operations).
 *
 * Usage:
 *   npx tsx scripts/backfillConversations.ts
 */
async function main(): Promise<void> {
  const messageRepository = await getMessageRepository();
  const conversationRepository = await getConversationRepository();

  let page = 1;
  let processed = 0;
  let skipped = 0;
  let conversationsTouched = 0;
  const seenConversationIds = new Set<string>();

  for (;;) {
    const result = await messageRepository.list({}, page, PAGE_SIZE);
    if (result.items.length === 0) break;

    for (const message of result.items as Message[]) {
      if (message.conversationId) {
        skipped += 1;
        continue;
      }

      const conversation = await conversationRepository.create({
        contactPhoneE164: message.recipientPhoneE164,
        channel: "whatsapp",
        contactName: message.recipientName,
      });

      await messageRepository.update(message.id, {
        conversationId: conversation.id,
        direction: message.direction ?? "outbound",
      });

      if (!seenConversationIds.has(conversation.id)) {
        seenConversationIds.add(conversation.id);
        conversationsTouched += 1;
      }
      processed += 1;
    }

    if (page >= result.totalPages) break;
    page += 1;
  }

  // Set each touched conversation's lastMessageAt from its most recent
  // message — the rollup a live inbound/outbound write keeps current
  // going forward, but backfilled rows need it seeded once up front.
  for (const conversationId of seenConversationIds) {
    const messages = await messageRepository.list({ conversationId }, 1, PAGE_SIZE);
    if (messages.items.length === 0) continue;
    const latest = messages.items.reduce((a, b) => (a.createdAt > b.createdAt ? a : b));
    await conversationRepository.update(conversationId, {
      lastMessageAt: latest.createdAt,
      lastMessageDirection: latest.direction ?? "outbound",
      lastMessagePreview: latest.body,
    });
  }

  console.log(
    `Backfilled ${processed} message(s) into ${conversationsTouched} conversation(s); ${skipped} already had a conversationId.`,
  );
}

main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exitCode = 1;
});
