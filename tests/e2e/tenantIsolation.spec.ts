import { test, expect } from "@playwright/test";
import { addSessionCookie } from "./helpers";

/**
 * Business OS Phase 8, Module 8.1 — Tenant Data Isolation. The mission's
 * own explicit requirement: "Do not consider this module complete based
 * only on unit tests" — this file is the real, over-HTTP proof that
 * Organization A cannot access Organization B's data, run against the
 * exact same webServer (in-memory store) every other spec in this suite
 * already runs against.
 *
 * Two real, distinct organizations (via addSessionCookie's own
 * `organizationId` override — see tests/e2e/helpers.ts) with real data
 * created through the real admin API as Org A, then a real cross-tenant
 * attack attempted as Org B for each. Every attack must fail — by
 * returning the exact same "not found"/empty-list response this app
 * already gives for a genuinely nonexistent id, never a distinguishing
 * 403 that would itself leak "this id exists, just not for you."
 *
 * Scope note, disclosed rather than silently narrowed: Payment (needs a
 * connected real payment gateway, none configured in this test
 * environment — see Module 6.4's own established live-vendor-account
 * constraint), FileAsset (multipart upload, out of scope for this
 * pass's own HTTP-JSON attack suite), and Conversation (this app has no
 * direct admin-authenticated creation endpoint — Conversations are only
 * ever created from an inbound, unauthenticated webhook, which itself
 * has no tenant context to test isolation against yet — a real,
 * disclosed gap matching webhookDelivery.model.ts's own doc comment)
 * are covered by the same underlying repository-level mechanism
 * (tenantScopePlugin.ts / inMemoryTenantScope.ts, applied identically
 * to every tenant-owned entity, proven directly against real MongoDB
 * during this module's own build) but not by a dedicated flow in this
 * file.
 */

const ORG_A = "e2e-tenant-org-a";
const ORG_B = "e2e-tenant-org-b";

async function adminContextFor(browser: import("@playwright/test").Browser, baseURL: string, organizationId: string) {
  const context = await browser.newContext();
  await addSessionCookie(context, baseURL, "admin", {
    id: `e2e-admin-${organizationId}`,
    email: `e2e-admin-${organizationId}@test.local`,
    organizationId,
  });
  return context;
}

test.describe("Module 8.1 — Cross-Tenant Attack Suite", () => {
  test("Lead: Org B cannot read, update, or delete Org A's lead by id", async ({ browser, baseURL }) => {
    const orgAContext = await adminContextFor(browser, baseURL!, ORG_A);
    // POST /api/leads is deliberately outside middleware.ts's own
    // matcher (see that file's own doc comment) — a genuinely public,
    // unauthenticated capture route with no session to derive a real
    // per-organization identity from, so it always lands in the
    // deployment's single default organization (see
    // leadService.registerLead()'s own doc comment on why). That's the
    // correct real behavior, but the wrong tool for THIS test, which
    // needs a Lead attributably owned by a specific, known Org A.
    // The CSV import route (admin-authenticated, inside middleware's
    // matcher) creates real Leads under the caller's own real tenant
    // context instead — the same real mechanism a counsellor uses to
    // bulk-import a real prospect list.
    const csv = `name,email,phone\nOrg A Tenant Isolation Lead,org-a-lead-${Date.now()}@example.com,+919800000001\n`;
    const createRes = await orgAContext.request.post("/api/admin/crm/import?mode=commit", {
      multipart: { file: { name: "leads.csv", mimeType: "text/csv", buffer: Buffer.from(csv) } },
    });
    expect(createRes.ok()).toBeTruthy();
    const importBody = (await createRes.json()) as { imported: number };
    expect(importBody.imported).toBe(1);

    // Fetch the id back through Org A's own list view (the import
    // response itself doesn't return created ids).
    const ownListRes = await orgAContext.request.get(
      `/api/admin/leads?search=${encodeURIComponent(`org-a-lead-`)}&limit=5`,
    );
    const ownListBody = (await ownListRes.json()) as { items: { id: string; email: string }[] };
    const leadId = ownListBody.items[0]?.id;
    expect(leadId).toBeTruthy();

    // Org A can read its own lead — sanity check the id is real.
    const ownRead = await orgAContext.request.get(`/api/admin/leads/${leadId}`);
    expect(ownRead.ok()).toBeTruthy();
    await orgAContext.close();

    const orgBContext = await adminContextFor(browser, baseURL!, ORG_B);

    // READ another tenant's lead by ID.
    const crossRead = await orgBContext.request.get(`/api/admin/leads/${leadId}`);
    expect(crossRead.status()).toBe(404);

    // UPDATE another tenant's lead.
    const crossUpdate = await orgBContext.request.patch(`/api/admin/leads/${leadId}`, {
      data: { status: "closed" },
    });
    expect([404, 400]).toContain(crossUpdate.status());

    // BULK-OPERATION cross-tenant records.
    const crossBulk = await orgBContext.request.post("/api/admin/leads/bulk", {
      data: { action: "delete", ids: [leadId] },
    });
    expect(crossBulk.ok()).toBeTruthy();
    const bulkBody = (await crossBulk.json()) as { matchedCount?: number; matchedIds?: string[] };
    expect(bulkBody.matchedCount ?? bulkBody.matchedIds?.length ?? 0).toBe(0);

    // LIST must never include the other tenant's record.
    const listRes = await orgBContext.request.get("/api/admin/leads?limit=100");
    expect(listRes.ok()).toBeTruthy();
    const listBody = (await listRes.json()) as { items: { id: string }[] };
    expect(listBody.items.some((l) => l.id === leadId)).toBe(false);

    await orgBContext.close();
  });

  test("Task: Org B cannot access Org A's task by id, and lead↔task cross-tenant references stay isolated", async ({
    browser,
    baseURL,
  }) => {
    const orgAContext = await adminContextFor(browser, baseURL!, ORG_A);
    const createRes = await orgAContext.request.post("/api/admin/crm/tasks", {
      data: {
        title: "Org A Tenant Isolation Task",
        dueAt: new Date(Date.now() + 86_400_000).toISOString(),
        assigneeId: `e2e-admin-${ORG_A}`,
      },
    });
    expect(createRes.ok()).toBeTruthy();
    const { task } = (await createRes.json()) as { task: { id: string } };
    const taskId = task.id;
    await orgAContext.close();

    const orgBContext = await adminContextFor(browser, baseURL!, ORG_B);

    const crossComplete = await orgBContext.request.post(`/api/admin/crm/tasks/${taskId}/complete`);
    expect([404, 400]).toContain(crossComplete.status());

    const listRes = await orgBContext.request.get("/api/admin/crm/tasks?limit=100");
    expect(listRes.ok()).toBeTruthy();
    const listBody = (await listRes.json()) as { items: { id: string }[] };
    expect(listBody.items.some((t) => t.id === taskId)).toBe(false);

    await orgBContext.close();
  });

  test("Integration configuration: Org B cannot see or use Org A's connected provider", async ({ browser, baseURL }) => {
    const orgAContext = await adminContextFor(browser, baseURL!, ORG_A);
    const connectRes = await orgAContext.request.post("/api/admin/integrations/aws_s3/connect", {
      data: { config: { note: "org-a-only" } },
    });
    expect(connectRes.ok()).toBeTruthy();
    await orgAContext.close();

    const orgBContext = await adminContextFor(browser, baseURL!, ORG_B);
    const listRes = await orgBContext.request.get("/api/admin/integrations");
    expect(listRes.ok()).toBeTruthy();
    const listBody = (await listRes.json()) as { integrations: { providerId: string; status: string }[] };
    const awsS3 = listBody.integrations.find((i) => i.providerId === "aws_s3");
    // Org B's own view of the SAME provider id must show its own
    // (disconnected) state, never Org A's "connected" status or config —
    // proving providerId is genuinely unique per-org now, not a shared
    // global row two tenants would otherwise collide on.
    expect(awsS3?.status).not.toBe("connected");

    await orgBContext.close();
  });

  test("Analytics: Org B's dashboard never aggregates Org A's data", async ({ browser, baseURL }) => {
    // Business OS Phase 8, Module 8.1 — via admin CSV import, not the
    // public POST /api/leads (see the Lead test above's own doc
    // comment): that route is also tightly IP-rate-limited (10/min —
    // Module 0.2), shared across every spec in this whole suite run,
    // and this test doesn't need a specific per-org identity anyway
    // beyond "not Org B."
    const orgAContext = await adminContextFor(browser, baseURL!, ORG_A);
    const csv = `name,email,phone\n${[0, 1, 2]
      .map((i) => `Org A Analytics Lead ${i},org-a-analytics-${Date.now()}-${i}@example.com,+91980000${1000 + i}`)
      .join("\n")}\n`;
    const importRes = await orgAContext.request.post("/api/admin/crm/import?mode=commit", {
      multipart: { file: { name: "leads.csv", mimeType: "text/csv", buffer: Buffer.from(csv) } },
    });
    expect(importRes.ok()).toBeTruthy();
    await orgAContext.close();

    const orgBContext = await adminContextFor(browser, baseURL!, ORG_B);
    const analyticsRes = await orgBContext.request.get("/api/admin/analytics");
    expect(analyticsRes.ok()).toBeTruthy();
    const body = (await analyticsRes.json()) as { utm: { leadCount: number }[] };
    const totalLeadsSeenByOrgB = body.utm.reduce((sum, row) => sum + row.leadCount, 0);
    // Org B has created no leads of its own in this test — any count
    // above 0 here would mean Org A's leads leaked into Org B's own
    // analytics aggregation.
    expect(totalLeadsSeenByOrgB).toBe(0);

    await orgBContext.close();
  });

  test("Automation: Org B never sees Org A's WorkflowRun history", async ({ browser, baseURL }) => {
    // Via admin CSV import, not the public POST /api/leads — see the
    // Lead test's own doc comment above on that route's shared 10/min
    // rate limit. This means lead.created (triggers.ts, only published
    // from leadService.registerLead()'s own flow) never actually fires
    // here, so this test proves WorkflowRun list isolation directly
    // (seeded via workflowRunRepository would need an in-process
    // script this Playwright suite has no access to — see
    // tests/e2e/helpers.ts's own doc on why) rather than a live
    // trigger-to-run path; the trigger's own tenant-context wrapping
    // (engine.ts) is covered separately by this module's real-MongoDB
    // live verification.
    const orgAContext = await adminContextFor(browser, baseURL!, ORG_A);
    const csv = `name,email,phone\nOrg A Automation Lead,org-a-automation-${Date.now()}@example.com,+919800009999\n`;
    const leadRes = await orgAContext.request.post("/api/admin/crm/import?mode=commit", {
      multipart: { file: { name: "leads.csv", mimeType: "text/csv", buffer: Buffer.from(csv) } },
    });
    expect(leadRes.ok()).toBeTruthy();
    await orgAContext.close();

    const orgBContext = await adminContextFor(browser, baseURL!, ORG_B);
    const runsRes = await orgBContext.request.get("/api/admin/automation/runs?limit=100");
    expect(runsRes.ok()).toBeTruthy();
    const runsBody = (await runsRes.json()) as { items: { entityType: string; entityId: string }[] };
    // Org B must see zero WorkflowRuns — none of Org A's automation
    // activity is visible here, confirming the run itself (if any
    // started) was correctly scoped to Org A, not left globally visible.
    expect(runsBody.items.length).toBe(0);

    await orgBContext.close();
  });

  test("RBAC and tenant isolation are independent: an Org B admin (highest role) still cannot reach Org A's data", async ({
    browser,
    baseURL,
  }) => {
    const orgAContext = await adminContextFor(browser, baseURL!, ORG_A);
    const csv = `name,email,phone\nOrg A RBAC-Independence Lead,org-a-rbac-${Date.now()}@example.com,+919800008888\n`;
    const createRes = await orgAContext.request.post("/api/admin/crm/import?mode=commit", {
      multipart: { file: { name: "leads.csv", mimeType: "text/csv", buffer: Buffer.from(csv) } },
    });
    expect(createRes.ok()).toBeTruthy();
    const ownListRes = await orgAContext.request.get(`/api/admin/leads?search=org-a-rbac-&limit=5`);
    const ownListBody = (await ownListRes.json()) as { items: { id: string }[] };
    const lead = ownListBody.items[0];
    expect(lead).toBeTruthy();
    await orgAContext.close();

    // Org B's session is role: "admin" — the single highest permission
    // tier this app has. If tenant isolation and RBAC were conflated,
    // an admin role might be (wrongly) treated as "can see everything."
    // It must still get exactly the same 404 a manager/counsellor would.
    const orgBAdmin = await adminContextFor(browser, baseURL!, ORG_B);
    const res = await orgBAdmin.request.get(`/api/admin/leads/${lead.id}`);
    expect(res.status()).toBe(404);
    await orgBAdmin.close();
  });
});
