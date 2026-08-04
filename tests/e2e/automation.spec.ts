import { test, expect } from "@playwright/test";
import { addSessionCookie } from "./helpers";

/**
 * Automation Platform (Phase 3) — Module 3.1 (Persisted Workflow
 * Definitions) and Module 3.3 (Auto-Reply Engine), both admin-only.
 * The in-memory test repository starts empty on every run (no
 * migration has been run against it — scripts/backfillWorkflowDefinitions.ts
 * only ever targets the real MongoDB instance), so these tests create
 * their own definitions/rules through the real UI rather than assuming
 * lead-nurture-sequence exists.
 */
test.describe("Automation — Workflow Definitions (3.1)", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await addSessionCookie(context, baseURL!, "admin");
  });

  test("create, toggle inactive, edit steps, and delete a workflow definition — via the Module 3.2 structured builder, not JSON", async ({
    page,
  }) => {
    await page.goto("/admin/automation");
    await expect(page.locator("#main-content").getByRole("heading", { name: "Automation" })).toBeVisible();

    await page.getByRole("button", { name: "New workflow" }).click();
    const id = `e2e-workflow-${Date.now()}`;
    await page.locator("#new-workflow-id").fill(id);
    await page.locator("#new-workflow-name").fill("E2E Test Workflow");
    await page.locator("#new-workflow-trigger").fill("lead.created");

    // The default step (newEmptyStep()) is already a send_whatsapp_template
    // action — free-text templateName, no dependency on a real Tag/staff
    // record existing yet (unlike add_tag/assign_lead's <select>s), so
    // this exercises the structured builder without needing to seed
    // unrelated CRM data first.
    const createForm = page.locator("form", { hasText: "Create workflow" });
    await createForm.getByLabel("Step id").fill("welcome-step");
    await createForm.getByLabel("Template name").fill("welcome_template_v1");
    await page.getByRole("button", { name: "Create workflow" }).click();

    const card = page.locator(".rounded-2xl", { hasText: "E2E Test Workflow" });
    await expect(card).toBeVisible();
    await expect(card.getByText("Active", { exact: true })).toBeVisible();
    await expect(card.getByText("welcome-step")).toBeVisible();
    await expect(card.getByText("send_whatsapp_template")).toBeVisible();

    await card.getByRole("button", { name: "Deactivate" }).click();
    await expect(card.getByText("Inactive", { exact: true })).toBeVisible();

    await card.getByRole("button", { name: /edit steps/i }).click();
    await card.getByLabel("Template name").fill("welcome_template_v2");
    await card.getByRole("button", { name: "Save steps" }).click();

    // Reload so the card remounts from a fresh server read — proves the
    // edit actually persisted server-side, not just that it's still
    // sitting in the builder's own local (unmounted) state.
    await page.reload();
    const reloadedCard = page.locator(".rounded-2xl", { hasText: "E2E Test Workflow" });
    await reloadedCard.getByRole("button", { name: /edit steps/i }).click();
    await expect(reloadedCard.getByLabel("Template name")).toHaveValue("welcome_template_v2");

    page.on("dialog", (dialog) => dialog.accept());
    await reloadedCard.getByRole("button", { name: `Delete workflow E2E Test Workflow` }).click();
    await expect(page.locator(".rounded-2xl", { hasText: "E2E Test Workflow" })).toHaveCount(0);
  });

  test("create a workflow with a Send Email step — Module 4.2's action type in the 3.2 builder", async ({ page }) => {
    await page.goto("/admin/automation");
    await page.getByRole("button", { name: "New workflow" }).click();
    const id = `e2e-workflow-email-${Date.now()}`;
    await page.locator("#new-workflow-id").fill(id);
    await page.locator("#new-workflow-name").fill("E2E Email Workflow");
    await page.locator("#new-workflow-trigger").fill("lead.created");

    const createForm = page.locator("form", { hasText: "Create workflow" });
    await createForm.getByLabel("Step id").fill("welcome-email-step");
    await createForm.getByLabel("Action").selectOption("send_email");
    await createForm.getByLabel("Subject").fill("Welcome to LearnSynaptic");
    await createForm.getByLabel("Body").fill("Thanks for your interest — we'll be in touch soon.");
    await page.getByRole("button", { name: "Create workflow" }).click();

    const card = page.locator(".rounded-2xl", { hasText: "E2E Email Workflow" });
    await expect(card).toBeVisible();
    await expect(card.getByText("welcome-email-step")).toBeVisible();
    await expect(card.getByText("send_email")).toBeVisible();

    // Reload so the card remounts from a fresh server read — same
    // stricter persistence proof the send_whatsapp_template test above
    // uses, not just unmounted builder state.
    await page.reload();
    const reloadedCard = page.locator(".rounded-2xl", { hasText: "E2E Email Workflow" });
    await reloadedCard.getByRole("button", { name: /edit steps/i }).click();
    await expect(reloadedCard.getByLabel("Subject")).toHaveValue("Welcome to LearnSynaptic");
    await expect(reloadedCard.getByLabel("Body")).toHaveValue("Thanks for your interest — we'll be in touch soon.");

    page.on("dialog", (dialog) => dialog.accept());
    await reloadedCard.getByRole("button", { name: `Delete workflow E2E Email Workflow` }).click();
    await expect(page.locator(".rounded-2xl", { hasText: "E2E Email Workflow" })).toHaveCount(0);
  });

  test("a manager session is forbidden — automation definitions are admin-tier", async ({ browser, baseURL }) => {
    const context = await browser.newContext();
    await addSessionCookie(context, baseURL!, "manager");
    const response = await context.request.get("/api/admin/automation/definitions");
    expect(response.status()).toBe(403);
    await context.close();
  });
});

test.describe("Automation — Auto-Reply Rules (3.3)", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await addSessionCookie(context, baseURL!, "admin");
  });

  test("create a keyword rule and a fallback rule, toggle, then delete", async ({ page }) => {
    await page.goto("/admin/automation");

    const keyword = `e2ekeyword${Date.now()}`;
    await page.locator("#new-auto-reply-keywords").fill(keyword);
    await page.locator("#new-auto-reply-text").fill("This is the E2E keyword reply.");
    await page.getByRole("button", { name: "Add rule" }).click();
    await expect(page.getByText(keyword)).toBeVisible();
    await expect(page.getByText("This is the E2E keyword reply.")).toBeVisible();

    await page.getByLabel(/this is the fallback reply/i).check();
    await page.locator("#new-auto-reply-text").fill("This is the E2E fallback reply.");
    await page.getByRole("button", { name: "Add rule" }).click();
    await expect(page.getByText("This is the E2E fallback reply.")).toBeVisible();
    await expect(page.getByText("Fallback", { exact: true })).toBeVisible();

    const keywordRow = page.getByTestId("auto-reply-rule").filter({ hasText: "This is the E2E keyword reply." });
    await keywordRow.getByRole("button", { name: "Deactivate" }).click();

    page.on("dialog", (dialog) => dialog.accept());
    await keywordRow.getByRole("button", { name: "Delete rule" }).click();
    await expect(page.getByText("This is the E2E keyword reply.")).toHaveCount(0);
  });
});
