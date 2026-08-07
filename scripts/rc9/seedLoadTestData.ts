import { getConnection } from "@/lib/db/connection";
import { runWithTenantContext } from "@/lib/tenancy/context";
import { authService } from "@/lib/services/auth";
import { getUserRepository } from "@/lib/db";
import { onboardingService } from "@/lib/services/onboarding";
import { leadService } from "@/lib/services/leads";
import { taskService } from "@/lib/services/crm/tasks";
import { activityService } from "@/lib/services/crm/activities";
import { pipelineService } from "@/lib/services/crm/pipelines";
import { conversationService } from "@/lib/services/conversations";
import { campaignService } from "@/lib/services/campaigns";
import { createWorkflowDefinition } from "@/lib/services/automation/definitions";
import bcrypt from "bcryptjs";

/**
 * RC-9 — Full-System Validation, Load, Stress, Security & Failure
 * Testing. Seeds THREE real, independent organizations (A/B/C) with
 * representative data across every major entity, through the REAL
 * service layer (not raw Mongo inserts) wherever a service exists for
 * it — this exercises real validation/dedup/audit/event-publishing
 * code paths during seeding itself, and guarantees every record is a
 * shape the app's own code actually produces, not a hand-guessed
 * schema. Idempotent is NOT attempted here — this is a one-shot,
 * disposable load-test fixture for an isolated test database; refuses
 * to run against anything that doesn't look like one.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/rc9/seedLoadTestData.ts [leadsPerOrg]
 */

const LEADS_PER_ORG = Number(process.argv[2]) || 120;

interface OrgHandle {
  label: string;
  orgId: string;
  adminId: string;
  managerId: string;
  counsellorId: string;
  adminEmail: string;
  managerEmail: string;
  counsellorEmail: string;
  password: string;
}

const FIRST_NAMES = ["Aarav", "Vivaan", "Aditya", "Priya", "Ananya", "Diya", "Ishaan", "Kabir", "Meera", "Riya", "Sai", "Zara", "Rohan", "Neha", "Arjun"];
const LAST_NAMES = ["Sharma", "Verma", "Iyer", "Nair", "Reddy", "Gupta", "Singh", "Kapoor", "Menon", "Rao"];
const SOURCES = ["website", "referral", "instagram", "csv-import", "google-ads"];

function randPhone(): string {
  const n = 6000000000 + Math.floor(Math.random() * 3999999999);
  return `+91${n}`;
}

function randName(): string {
  return `${FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]} ${LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]}`;
}

async function createOrg(label: string, slug: string): Promise<OrgHandle> {
  const password = "RC9-Load-Test-Pass-1";
  const adminEmail = `rc9-${slug}-admin@learnsynaptic.internal`;

  const registerResult = await authService.registerUser({
    name: `${label} Admin`,
    email: adminEmail,
    password,
    termsAccepted: true,
  });
  if (!registerResult.success) throw new Error(`registerUser failed for ${label}: ${JSON.stringify(registerResult.errors)}`);
  const adminId = registerResult.user.id;

  // Skip real email verification for this fixture — stamp it directly,
  // the same "seed script bypasses the human-in-the-loop step" shape
  // scripts/createAdminUser.ts already establishes.
  const userRepo = await getUserRepository();
  await userRepo.update(adminId, { emailVerifiedAt: new Date().toISOString() });

  const orgResult = await onboardingService.createOrganizationForUser(adminId, {
    name: label,
    industry: "Education",
    teamSize: "11-50",
    country: "IN",
    timezone: "Asia/Kolkata",
  });
  if (!orgResult.success) throw new Error(`createOrganizationForUser failed for ${label}: ${JSON.stringify(orgResult.errors)}`);
  const orgId = orgResult.organization.id;

  const passwordHash = await bcrypt.hash(password, 10);
  const managerEmail = `rc9-${slug}-manager@learnsynaptic.internal`;
  const counsellorEmail = `rc9-${slug}-counsellor@learnsynaptic.internal`;
  const manager = await userRepo.create({ email: managerEmail, passwordHash, role: "manager", name: `${label} Manager`, organizationId: orgId });
  const counsellor = await userRepo.create({ email: counsellorEmail, passwordHash, role: "counsellor", name: `${label} Counsellor`, organizationId: orgId });

  console.log(`[${label}] org=${orgId} admin=${adminId} manager=${manager.id} counsellor=${counsellor.id}`);

  return { label, orgId, adminId, managerId: manager.id, counsellorId: counsellor.id, adminEmail, managerEmail, counsellorEmail, password };
}

async function seedOrgData(org: OrgHandle, leadsPerOrg: number): Promise<void> {
  await runWithTenantContext({ organizationId: org.orgId, userId: org.adminId, role: "admin" }, async () => {
    const pipeline = await pipelineService.ensureDefaultPipeline();
    const stageIds = pipeline.stages.map((s) => s.id);
    console.log(`[${org.label}] pipeline=${pipeline.id} stages=${stageIds.length}`);

    const leadIds: string[] = [];
    for (let i = 0; i < leadsPerOrg; i++) {
      const name = randName();
      const result = await leadService.registerLead({
        name,
        email: `${name.toLowerCase().replace(/\s+/g, ".")}.${org.label.toLowerCase().replace(/\s+/g, "")}.${i}@example.com`,
        phone: randPhone(),
        source: SOURCES[i % SOURCES.length],
        program: i % 3 === 0 ? "AI Bootcamp" : "Full Stack DevOps",
      });
      if (result.success) leadIds.push(result.lead.id);
      else if (i === 0) console.warn(`[${org.label}] first lead creation failed:`, result.errors);
    }
    console.log(`[${org.label}] leads created: ${leadIds.length}/${leadsPerOrg}`);

    const assignees = [org.counsellorId, org.managerId, org.adminId];
    let taskCount = 0;
    let activityCount = 0;
    let opportunityCount = 0;
    for (let i = 0; i < leadIds.length; i++) {
      const leadId = leadIds[i];
      if (i % 2 === 0) {
        await taskService.createTask({
          title: `Follow up with lead ${i}`,
          dueAt: new Date(Date.now() + 86400000 * (1 + (i % 7))).toISOString(),
          assigneeId: assignees[i % assignees.length],
          entityType: "Lead",
          entityId: leadId,
        });
        taskCount++;
      }
      if (i % 3 === 0) {
        await activityService.logActivity({
          entityType: "Lead",
          entityId: leadId,
          type: "note",
          body: `Synthetic RC-9 load-test activity note #${i}`,
          actorId: assignees[i % assignees.length],
        });
        activityCount++;
      }
      if (i % 5 === 0) {
        await pipelineService.createOpportunity({
          leadId,
          pipelineId: pipeline.id,
          stageId: stageIds[i % stageIds.length],
          expectedRevenueInr: 20000 + (i % 10) * 5000,
          probability: 10 + (i % 9) * 10,
          ownerId: assignees[i % assignees.length],
        });
        opportunityCount++;
      }
    }
    console.log(`[${org.label}] tasks=${taskCount} activities=${activityCount} opportunities=${opportunityCount}`);

    for (let i = 0; i < Math.min(5, leadIds.length); i++) {
      const { conversation } = await conversationService.recordInboundMessage({
        channel: "whatsapp",
        fromPhoneE164: randPhone(),
        contactName: randName(),
        providerMessageId: `rc9-seed-${org.label}-${i}-${Date.now()}`,
        messageType: "text",
        body: `Hi, I'm interested in your program. (RC-9 synthetic conversation #${i})`,
        timestamp: new Date().toISOString(),
      });
      console.log(`[${org.label}] conversation ${i}: ${conversation.id}`);
    }

    for (let i = 0; i < 2; i++) {
      const campaignResult = await campaignService.createCampaign({
        name: `${org.label} RC-9 Load Test Campaign ${i}`,
        code: `RC9-${org.label.replace(/\s+/g, "").toUpperCase()}-${i}`,
        channel: "whatsapp",
        startDate: new Date().toISOString().slice(0, 10),
      });
      if (!campaignResult.success) console.warn(`[${org.label}] campaign ${i} failed:`, campaignResult.errors);
    }

    const workflowResult = await createWorkflowDefinition({
      name: `${org.label} RC-9 Lead Nurture (inactive)`,
      triggerEventType: "lead.created",
      isActive: false,
      steps: [{ order: 1, action: { type: "add_tag", params: { tag: "rc9-load-test" } } }],
    });
    if (!workflowResult.success) console.warn(`[${org.label}] workflow definition failed:`, workflowResult.errors);
    else console.log(`[${org.label}] workflow definition created (inactive): ${workflowResult.definition.id}`);
  });
}

async function main(): Promise<void> {
  const { MONGODB_URI } = await import("@/config/database");
  const looksSafe = /rc9|load|test|dev|local|learnsynaptic/i.test(MONGODB_URI) && !/production|prod\./i.test(MONGODB_URI);
  if (!looksSafe) {
    console.error(`Refusing: MONGODB_URI doesn't look like a safe test database.`);
    process.exit(1);
  }

  await getConnection();

  const orgs: OrgHandle[] = [];
  orgs.push(await createOrg("RC9 Organization A", "org-a"));
  orgs.push(await createOrg("RC9 Organization B", "org-b"));
  orgs.push(await createOrg("RC9 Organization C", "org-c"));

  for (const org of orgs) {
    await seedOrgData(org, LEADS_PER_ORG);
  }

  console.log("\n=== SEED SUMMARY ===");
  for (const org of orgs) {
    console.log(`${org.label}: orgId=${org.orgId}`);
    console.log(`  admin:      ${org.adminEmail} / ${org.password}`);
    console.log(`  manager:    ${org.managerEmail} / ${org.password}`);
    console.log(`  counsellor: ${org.counsellorEmail} / ${org.password}`);
  }

  process.exit(0);
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
