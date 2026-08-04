import { describe, it, expect } from "vitest";
import { leadService } from "@/lib/services/leads";
import { pipelineService } from "@/lib/services/crm/pipelines";
import { getCrmRevenueFunnel } from "./funnelService";
import type { DateRange } from "./types";

/** Enterprise Analytics (Phase 7), module 7.2 — Funnel Analytics
 *  (mission §5): real Lead -> Opportunity -> Won stage counts, using
 *  pipelineService.moveStage()'s own real stageHistory rather than a
 *  hand-built fixture. */

let counter = 0;
function uniqueId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

function wideRange(): DateRange {
  return { from: new Date(Date.now() - 60_000).toISOString(), to: new Date(Date.now() + 60_000).toISOString() };
}

async function createLead(): Promise<string> {
  const result = await leadService.registerLead({
    name: "Funnel Test Lead",
    email: `${uniqueId("lead")}@example.com`,
    phone: `+9198${String(Math.floor(Math.random() * 10_000_000)).padStart(8, "0")}`,
    source: "unit-test",
  });
  if (!result.success) throw new Error(JSON.stringify(result.errors));
  return result.lead.id;
}

describe("getCrmRevenueFunnel", () => {
  it("counts leadsCreated, opportunitiesCreated, and opportunitiesWon as real, independent, non-decreasing-in-general stage volumes", async () => {
    const range = wideRange();
    const before = await getCrmRevenueFunnel(range);
    const beforeLeads = before.stages.find((s) => s.key === "leadsCreated")!.count;
    const beforeOpps = before.stages.find((s) => s.key === "opportunitiesCreated")!.count;
    const beforeWon = before.stages.find((s) => s.key === "opportunitiesWon")!.count;

    const leadId = await createLead();
    const pipeline = await pipelineService.createPipeline({
      name: uniqueId("funnel-test-pipeline"),
      stages: [{ name: "Open" }, { name: "Won", isWon: true }],
    });
    const opportunity = await pipelineService.createOpportunity({
      leadId,
      pipelineId: pipeline.id,
      stageId: pipeline.stages[0].id,
      expectedRevenueInr: 75000,
    });
    await pipelineService.moveStage(opportunity.id, pipeline.stages[1].id);

    const after = await getCrmRevenueFunnel(range);
    const afterLeads = after.stages.find((s) => s.key === "leadsCreated")!.count;
    const afterOpps = after.stages.find((s) => s.key === "opportunitiesCreated")!.count;
    const afterWon = after.stages.find((s) => s.key === "opportunitiesWon")!.count;
    const afterWonStage = after.stages.find((s) => s.key === "opportunitiesWon")!;

    expect(afterLeads).toBe(beforeLeads + 1);
    expect(afterOpps).toBe(beforeOpps + 1);
    expect(afterWon).toBe(beforeWon + 1);
    expect(afterWonStage.revenueInr).not.toBeNull();
    expect(afterWonStage.revenueInr!).toBeGreaterThanOrEqual(75000);
  });

  it("the final Enrolled stage never repeats Payment Succeeded's own revenue figure (would double-count)", async () => {
    const result = await getCrmRevenueFunnel(wideRange());
    const enrolledStage = result.stages.find((s) => s.key === "registrationsConfirmed")!;
    expect(enrolledStage.revenueInr).toBeNull();
  });

  it("conversionFromFirstPct is null when zero leads exist in range (no division by zero fabricating 0%)", async () => {
    const emptyFutureRange: DateRange = {
      from: new Date(Date.now() + 10 * 86_400_000).toISOString(),
      to: new Date(Date.now() + 11 * 86_400_000).toISOString(),
    };
    const result = await getCrmRevenueFunnel(emptyFutureRange);
    for (const stage of result.stages) {
      expect(stage.conversionFromFirstPct).toBeNull();
    }
  });
});
