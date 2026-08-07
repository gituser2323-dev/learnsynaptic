import { Client, BASE_URL, type JsonResponseBody } from "./pentestClient";

/**
 * RC-9 §17 — Campaign scale testing. Real WhatsApp campaign against
 * the safe `console` provider (never a real vendor — WHATSAPP_PROVIDER
 * is unset in this environment, the documented safe default), using
 * real seeded RC-9 leads as the audience. Drains the real queue via
 * the real cron-secret-authenticated route, measuring real throughput.
 *
 * Usage: npx tsx scripts/rc9/loadTestCampaign.ts <recipientCount>
 */

const RECIPIENT_COUNT = Number(process.argv[2]) || 100;
const CRON_SECRET = process.env.CRON_SECRET;

async function main(): Promise<void> {
  if (!CRON_SECRET) throw new Error("CRON_SECRET env var required to drain the queue in this test");

  const admin = new Client("campaign-load", "203.0.113.150");
  const loginRes = await admin.login("rc9-org-a-admin@learnsynaptic.internal", "RC9-Load-Test-Pass-1");
  if (loginRes.status !== 200) throw new Error("login failed");

  console.log(`=== Campaign scale test: ${RECIPIENT_COUNT} recipients ===`);

  const t0 = Date.now();
  const templateRes = await admin.req("POST", "/api/admin/whatsapp-campaigns/templates", {
    body: { name: `RC-9 Load Test Template ${Date.now()}`, metaTemplateName: "rc9_load_test_template", languageCode: "en" },
  });
  const templateId = templateRes.body?.template?.id;
  console.log(`Template created: ${templateRes.status}, id=${templateId}`);

  const createRes = await admin.req("POST", "/api/admin/whatsapp-campaigns", {
    body: { name: `RC-9 Load Test ${RECIPIENT_COUNT}`, templateId },
  });
  if (createRes.status !== 201 && createRes.status !== 200) {
    console.error("Campaign creation failed:", createRes.status, JSON.stringify(createRes.body));
    return;
  }
  const campaignId = createRes.body?.campaign?.id;
  console.log(`Campaign created: ${campaignId} (${Date.now() - t0}ms)`);

  const recipients = Array.from({ length: RECIPIENT_COUNT }, (_, i) => ({
    phoneE164: `+91900000${String(i).padStart(4, "0")}`,
    name: `RC9 Recipient ${i}`,
  }));

  const t1 = Date.now();
  const audienceRes = await admin.req("POST", `/api/admin/whatsapp-campaigns/${campaignId}/audience`, {
    body: { source: "manual", recipients },
  });
  console.log(`Audience resolved: ${audienceRes.status}, count=${audienceRes.body?.resolution?.recipientCount ?? "?"} (${Date.now() - t1}ms)`);

  const t2 = Date.now();
  const sendRes = await admin.req("POST", `/api/admin/whatsapp-campaigns/${campaignId}/send`);
  console.log(`Send triggered: ${sendRes.status} (${Date.now() - t2}ms)`);

  // Drain the real queue via the real cron route, measuring real throughput,
  // repeating until no more due jobs remain or a sane iteration cap is hit.
  let totalProcessed = 0;
  let iterations = 0;
  const t3 = Date.now();
  while (iterations < 30) {
    const drainRes = await fetch(`${BASE_URL}/api/cron/run-due-jobs`, { headers: { Authorization: `Bearer ${CRON_SECRET}` } });
    const drainBody = await drainRes.json();
    const processed = drainBody?.processed ?? 0;
    totalProcessed += processed;
    iterations++;
    if (processed === 0) break;
  }
  console.log(`Queue drained: ${totalProcessed} jobs processed across ${iterations} cron ticks (${Date.now() - t3}ms)`);

  const statsRes = await admin.req("GET", `/api/admin/whatsapp-campaigns/${campaignId}`);
  const campaign = statsRes.body?.campaign;
  console.log(`Final campaign state: status=${campaign?.status}, sent=${campaign?.stats?.sent ?? "?"}, failed=${campaign?.stats?.failed ?? "?"}, pending=${campaign?.stats?.pending ?? "?"}`);

  const messagesRes = await admin.req("GET", `/api/admin/whatsapp-campaigns/${campaignId}/messages?limit=${RECIPIENT_COUNT + 10}`);
  const messages = messagesRes.body?.items ?? messagesRes.body?.messages ?? [];
  const uniqueRecipients = new Set(messages.map((m: JsonResponseBody) => m.recipientPhoneE164 ?? m.recipientPhone));
  console.log(`Real Message rows created: ${messages.length} (expect ${RECIPIENT_COUNT}), unique recipients: ${uniqueRecipients.size} (expect ${RECIPIENT_COUNT} — no duplicates)`);
  const statusCounts: Record<string, number> = {};
  for (const m of messages) statusCounts[m.status] = (statusCounts[m.status] ?? 0) + 1;
  console.log(`Message status breakdown:`, statusCounts);

  console.log(`\nTotal wall time: ${Date.now() - t0}ms`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
