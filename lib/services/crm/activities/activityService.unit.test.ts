import { describe, it, expect } from "vitest";
import { activityService } from "./activityService";

/**
 * Module 1.1's own long-standing disclosed gap (implementation audit
 * §3/§6): Activity timeline pagination was never verified at real
 * scale — "not a known defect, just an untested scale claim." Testing
 * it here found a real one: the Lead detail page's Timeline tab called
 * `listActivities("Lead", leadId)` with no page argument and rendered
 * `data.items` directly, with no control to ever reach page 2 — any
 * lead with more than 50 timeline entries (very plausible over months
 * of status changes, tags, tasks, notes, and message activity) had its
 * older history permanently unreachable in the UI, not just untested.
 * Fixed in the same pass (see app/admin/(dashboard)/leads/[id]/page.tsx's
 * TimelineTab — now paginated via the same Pagination component every
 * other list in this codebase already uses). This file covers the
 * pagination arithmetic itself, at real scale (55 entries), independent
 * of the UI fix.
 */
describe("activityService.listTimeline — pagination at real scale", () => {
  it("paginates 55 entries correctly across a 50-item page boundary: no gaps, no duplicates, no truncation", async () => {
    const entityId = `unit-test-lead-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const TOTAL = 55;
    for (let i = 0; i < TOTAL; i++) {
      await activityService.logActivity({ entityType: "Lead", entityId, type: "note", body: `entry-${i}` });
    }

    const page1 = await activityService.listTimeline({ entityType: "Lead", entityId }, 1, 50);
    expect(page1.items).toHaveLength(50);
    expect(page1.total).toBe(TOTAL);
    expect(page1.totalPages).toBe(2);
    expect(page1.page).toBe(1);

    const page2 = await activityService.listTimeline({ entityType: "Lead", entityId }, 2, 50);
    expect(page2.items).toHaveLength(5);
    expect(page2.total).toBe(TOTAL);
    expect(page2.totalPages).toBe(2);

    // Every one of the 55 seeded entries appears exactly once across
    // both pages — the real failure mode a naive off-by-one slice
    // would produce (a duplicated or skipped boundary item).
    const allBodies = [...page1.items, ...page2.items].map((a) => a.body);
    expect(new Set(allBodies).size).toBe(TOTAL);
    for (let i = 0; i < TOTAL; i++) expect(allBodies).toContain(`entry-${i}`);

    // A page past the end returns empty, not an error or a wraparound.
    const page3 = await activityService.listTimeline({ entityType: "Lead", entityId }, 3, 50);
    expect(page3.items).toHaveLength(0);
    expect(page3.total).toBe(TOTAL);
  });

  it("an entity with fewer than one page of entries reports totalPages: 1, not 0", async () => {
    const entityId = `unit-test-lead-small-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await activityService.logActivity({ entityType: "Lead", entityId, type: "note", body: "only entry" });

    const result = await activityService.listTimeline({ entityType: "Lead", entityId }, 1, 50);
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.totalPages).toBe(1);
  });

  it("pagination is scoped per-entity — a different lead's 55 entries never leak into this one's page count", async () => {
    const entityA = `unit-test-lead-a-${Date.now()}`;
    const entityB = `unit-test-lead-b-${Date.now()}`;

    for (let i = 0; i < 60; i++) {
      await activityService.logActivity({ entityType: "Lead", entityId: entityA, type: "note", body: `a-${i}` });
    }
    await activityService.logActivity({ entityType: "Lead", entityId: entityB, type: "note", body: "b-only" });

    const resultB = await activityService.listTimeline({ entityType: "Lead", entityId: entityB }, 1, 50);
    expect(resultB.total).toBe(1);
    expect(resultB.items[0].body).toBe("b-only");
  });
});
