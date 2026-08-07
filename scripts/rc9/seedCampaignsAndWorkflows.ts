import { getConnection } from "@/lib/db/connection";
import { runWithTenantContext } from "@/lib/tenancy/context";
import { getOrganizationRepository } from "@/lib/db";
import { campaignService } from "@/lib/services/campaigns";
import { createWorkflowDefinition } from "@/lib/services/automation/definitions";

/**
 * RC-9 patch — fills in the two entity types
 * scripts/rc9/seedLoadTestData.ts got a real field-shape wrong on
 * (campaign `channel` enum, workflow definition's required `id` +
 * step `id` + `add_tag`'s real `tagId` param name) without re-running
 * the whole (slow) lead/task/activity/opportunity/conversation seed.
 */
async function main(): Promise<void> {
  const { MONGODB_URI } = await import("@/config/database");
  if (!/rc9|test|dev|local|127\.0\.0\.1/i.test(MONGODB_URI)) {
    console.error("Refusing: MONGODB_URI doesn't look like a safe test database.");
    process.exit(1);
  }
  await getConnection();

  const orgRepo = await getOrganizationRepository();
  const orgs = await orgRepo.list({}, 1, 50);
  const rc9Orgs = orgs.items.filter((o) => o.name.startsWith("RC9 Organization"));
  console.log(`Found ${rc9Orgs.length} RC-9 organizations`);

  for (const org of rc9Orgs) {
    await runWithTenantContext({ organizationId: org.id, role: "admin" }, async () => {
      for (let i = 0; i < 2; i++) {
        const result = await campaignService.createCampaign({
          name: `${org.name} RC-9 Load Test Campaign ${i}`,
          code: `RC9-${org.name.replace(/\s+/g, "").toUpperCase()}-${i}`,
          channel: "meta",
          startDate: new Date().toISOString().slice(0, 10),
        });
        if (!result.success) console.warn(`[${org.name}] campaign ${i} failed:`, result.errors);
        else console.log(`[${org.name}] campaign ${i} created: ${result.campaign.id}`);
      }

      const workflowResult = await createWorkflowDefinition({
        id: `rc9-lead-nurture-${org.id}`,
        name: `${org.name} RC-9 Lead Nurture (inactive)`,
        triggerEventType: "lead.created",
        active: false,
        steps: [{ id: "step-1", action: { type: "add_tag", params: { tagId: "rc9-load-test" } } }],
      });
      if (!workflowResult.success) console.warn(`[${org.name}] workflow definition failed:`, workflowResult.errors);
      else console.log(`[${org.name}] workflow definition created (inactive): ${workflowResult.definition.id}`);
    });
  }

  process.exit(0);
}

main().catch((error) => {
  console.error("Failed:", error);
  process.exit(1);
});
