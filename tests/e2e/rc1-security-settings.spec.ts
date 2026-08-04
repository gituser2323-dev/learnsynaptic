import { test, expect } from "@playwright/test";
import { addSessionCookie } from "./helpers";

/**
 * RC-1 — Authentication & Identity. Browser-level smoke coverage for
 * the new Security Settings surface and the public, pre-login pages
 * (forgot password, login's OAuth-button rendering). Deliberately
 * scoped to what's actually verifiable through this suite's own
 * fabricated-JWT session technique (see helpers.ts's own doc comment:
 * there is no cross-process way to seed a REAL backing user with a
 * real password into the webServer's in-memory store) — flows that
 * WRITE to a User row (change password, MFA setup) need a real
 * password/account to meaningfully exercise and are covered instead by
 * authService.rc1.unit.test.ts / mfaService.unit.test.ts's own real,
 * in-process service-level coverage. What's covered here is real page
 * rendering: does the Security page actually mount its sections for an
 * authenticated session, do the read-only panels degrade to empty
 * states rather than crashing for a session with no backing data, and
 * do the public pre-login pages work with zero session at all.
 */

test.describe("RC-1 — Security Settings page", () => {
  test("renders every section for an authenticated session, with read-only panels degrading to empty states", async ({ page, context, baseURL }) => {
    await addSessionCookie(context, baseURL!, "counsellor", { id: "e2e-security-settings-user", email: "e2e-security@test.local" });
    await page.goto("/admin/settings/security");

    await expect(page.getByRole("heading", { name: "Security" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Password" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Two-factor authentication" })).toBeVisible();
    await expect(page.getByText("Not enabled")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Active sessions" })).toBeVisible();
    await expect(page.getByText("No active sessions.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Login history" })).toBeVisible();
    await expect(page.getByText("No recent activity.")).toBeVisible();
  });

  test("appears in the sidebar navigation for every role, not just admin", async ({ page, context, baseURL }) => {
    await addSessionCookie(context, baseURL!, "counsellor", { id: "e2e-security-nav-user", email: "e2e-security-nav@test.local" });
    await page.goto("/admin");
    await expect(page.getByRole("link", { name: /security/i })).toBeVisible();
  });
});

test.describe("RC-1 — Forgot password (public, unauthenticated)", () => {
  test("submitting any email shows the same generic confirmation (anti-enumeration)", async ({ page }) => {
    await page.goto("/admin/forgot-password");
    await page.locator("#forgot-email").fill("no-such-account@e2e-test.local");
    await page.getByRole("button", { name: /send reset link/i }).click();
    await expect(page.getByText(/if an account exists for/i)).toBeVisible();
  });
});

test.describe("RC-1 — Social Login buttons (login page)", () => {
  test("no OAuth buttons render when no provider is configured (this test env has none)", async ({ page }) => {
    await page.goto("/admin/login");
    await expect(page.getByText(/or continue with/i)).toHaveCount(0);
  });
});

test.describe("RC-1 — Email verification landing page", () => {
  test("an invalid token shows a clear failure message, not a crash", async ({ page }) => {
    await page.goto("/admin/verify-email?token=not-a-real-token");
    await expect(page.getByText(/this verification link is invalid/i)).toBeVisible();
  });

  test("a missing token shows a clear failure message", async ({ page }) => {
    await page.goto("/admin/verify-email");
    await expect(page.getByText(/missing its token/i)).toBeVisible();
  });
});
