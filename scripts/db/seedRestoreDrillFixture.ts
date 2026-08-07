import bcrypt from "bcryptjs";
import { getConnection } from "@/lib/db/connection";
import { OrganizationModel } from "@/lib/db/models/organization.model";
import { UserModel } from "@/lib/db/models/user.model";
import { LeadModel } from "@/lib/db/models/lead.model";
import { TaskModel } from "@/lib/db/models/task.model";
import { ConversationModel } from "@/lib/db/models/conversation.model";
import { MessageModel } from "@/lib/db/models/message.model";

/**
 * RC-5 — Backup, Restore & Disaster Recovery.
 *
 * The mission's own restore-testing requirement is explicit: prove
 * tenant isolation survives a restore using AT LEAST TWO real
 * organizations. This repo's local dev database normally holds only
 * one (the "default" org created by scripts/createAdminUser.ts /
 * ensureDefaultOrganization()) — this script seeds a second, fully
 * independent organization with one representative record in every
 * major tenant-scoped entity family (a user, a lead, a task, a
 * conversation + message), so a backup/restore drill has real
 * cross-tenant data to verify isolation against.
 *
 * Idempotent — safe to re-run; every document is upserted on a stable
 * natural key rather than duplicated.
 *
 * NEVER run this against a real production database — it creates
 * clearly-labelled fixture/test data. Refuses to run unless
 * MONGODB_URI resolves to a database whose name contains "restore" or
 * the operator passes --i-know-this-is-not-production.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/db/seedRestoreDrillFixture.ts
 */

const ORG_B_SLUG = "rc5-restore-drill-org-b";
const ORG_B_NAME = "RC-5 Restore Drill — Organization B";
const USER_B_EMAIL = "restore-drill-orgb@learnsynaptic.local";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const { MONGODB_URI } = await import("@/config/database");
  const looksSafe = /restore|drill|test|dev|local/i.test(MONGODB_URI);
  if (!looksSafe && !args.includes("--i-know-this-is-not-production")) {
    console.error(
      `Refusing: MONGODB_URI ("${MONGODB_URI.replace(/\/\/[^@]*@/, "//<redacted>@")}") doesn't ` +
        "look like a drill/dev/test database. This script writes fixture data and must never " +
        "run against production. Re-run with --i-know-this-is-not-production if this is genuinely intended.",
    );
    process.exit(1);
  }

  await getConnection();

  const orgA = await OrganizationModel.findOne({ slug: "default" });
  if (!orgA) {
    console.error('No pre-existing "default" organization found — run scripts/createAdminUser.ts first to establish Organization A.');
    process.exit(1);
  }
  console.log(`Organization A (pre-existing default org): ${orgA._id} (${orgA.name})`);

  // A record scoped to Organization A too, so the isolation proof is
  // symmetric: each org must see its OWN distinct record and never the
  // other's, rather than B's-data-doesn't-leak-into-an-empty-A alone.
  const leadA = await LeadModel.findOneAndUpdate(
    { email: "orga-lead@learnsynaptic.local", organizationId: orgA._id },
    {
      $setOnInsert: {
        name: "Org A Restore Drill Lead",
        email: "orga-lead@learnsynaptic.local",
        phone: "+919800000098",
        source: "rc5-restore-drill",
        organizationId: orgA._id,
      },
    },
    { upsert: true, new: true },
  );
  console.log(`Lead A: ${leadA._id}`);

  const orgB = await OrganizationModel.findOneAndUpdate(
    { slug: ORG_B_SLUG },
    { $setOnInsert: { name: ORG_B_NAME, slug: ORG_B_SLUG } },
    { upsert: true, new: true },
  );
  console.log(`Organization B: ${orgB._id} (${orgB.name})`);

  const passwordHash = await bcrypt.hash("Restore-Drill-Fixture-Pw1!", 10);
  const userB = await UserModel.findOneAndUpdate(
    { email: USER_B_EMAIL },
    {
      $setOnInsert: {
        email: USER_B_EMAIL,
        passwordHash,
        role: "admin",
        name: "Restore Drill Org B Admin",
        organizationId: orgB._id,
      },
    },
    { upsert: true, new: true },
  );
  console.log(`User B: ${userB._id} (${userB.email})`);

  const leadB = await LeadModel.findOneAndUpdate(
    { email: "orgb-lead@learnsynaptic.local", organizationId: orgB._id },
    {
      $setOnInsert: {
        name: "Org B Restore Drill Lead",
        email: "orgb-lead@learnsynaptic.local",
        phone: "+919800000099",
        source: "rc5-restore-drill",
        organizationId: orgB._id,
      },
    },
    { upsert: true, new: true },
  );
  console.log(`Lead B: ${leadB._id}`);

  const taskB = await TaskModel.findOneAndUpdate(
    { title: "RC-5 Restore Drill Task (Org B)", organizationId: orgB._id },
    {
      $setOnInsert: {
        title: "RC-5 Restore Drill Task (Org B)",
        dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        assigneeId: userB._id,
        organizationId: orgB._id,
      },
    },
    { upsert: true, new: true },
  );
  console.log(`Task B: ${taskB._id}`);

  const conversationB = await ConversationModel.findOneAndUpdate(
    { contactPhoneE164: "+919800000099", organizationId: orgB._id },
    {
      $setOnInsert: {
        channel: "whatsapp",
        contactPhoneE164: "+919800000099",
        contactName: "Org B Restore Drill Lead",
        leadId: leadB._id,
        status: "open",
        lastMessageAt: new Date(),
        organizationId: orgB._id,
      },
    },
    { upsert: true, new: true },
  );
  console.log(`Conversation B: ${conversationB._id}`);

  const messageB = await MessageModel.findOneAndUpdate(
    { conversationId: conversationB._id, organizationId: orgB._id },
    {
      $setOnInsert: {
        conversationId: conversationB._id,
        recipientPhoneE164: "+919800000099",
        leadId: leadB._id,
        direction: "inbound",
        body: "RC-5 restore drill fixture message (Org B)",
        messageType: "text",
        status: "received",
        queuedAt: new Date(),
        organizationId: orgB._id,
      },
    },
    { upsert: true, new: true },
  );
  console.log(`Message B: ${messageB._id}`);

  console.log(
    "\nOrganization B fixture ready. Organization A is whatever this database's own " +
      "pre-existing default org is (ensureDefaultOrganization()) — both now exist side by " +
      "side for the restore drill's tenant-isolation verification.",
  );
  process.exit(0);
}

main().catch((error) => {
  console.error("Seeding restore-drill fixture failed:", error);
  process.exit(1);
});
