import { defineConfig, devices } from "@playwright/test";

/**
 * RC-1 — minimal smoke suite. Playwright was already a listed dependency
 * with zero config or test files; this is the setup, not a new testing
 * framework. Deliberately narrow in scope: a handful of the highest-
 * value critical-path checks (does a lead-capture form's submission
 * actually reach the backend, does the admin auth gate actually gate,
 * does an authenticated admin session actually see the dashboard), not
 * exhaustive coverage. A real test pyramid (unit tests around
 * leadService/whatsappCampaignService/the scheduler's retry math) is a
 * separate, larger follow-up — see RC_FIX_REPORT.md.
 *
 * webServer below starts `npm run start` against a production build
 * with a fixed JWT_ACCESS_TOKEN_SECRET (tests need to mint a matching
 * admin session cookie — see tests/e2e/helpers.ts) and an explicitly
 * EMPTY MONGODB_URI, forcing in-memory repositories — fresh, empty
 * state every run, which is exactly what a smoke suite wants;
 * MongoDB-backed persistence is exercised by the app's dual-repository
 * pattern either way, not by which one is active during a UI smoke
 * test.
 *
 * The explicit `MONGODB_URI: ""` below is load-bearing, not
 * decorative — found live while writing the Phase 1–3 test suite
 * (Module 3.1/3.3 follow-up): `npm run start` still loads `.env.local`
 * regardless of Playwright's own `env` block (dotenv-style env loading
 * never overrides a var Playwright already set, but it WILL set any
 * var Playwright didn't touch), so a developer's real `MONGODB_URI` in
 * `.env.local` was silently leaking into every test run — this suite
 * had actually been exercising the real dev database, accumulating
 * test data across runs, contradicting this file's own comment since
 * whenever `.env.local` first gained a real MongoDB URI. An
 * empty-state assertion in the new Conversations spec was the first
 * test to actually depend on fresh state and catch it.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npm run build && npm run start -- -p 3100",
    url: "http://localhost:3100/api/health",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      JWT_ACCESS_TOKEN_SECRET: "playwright-test-secret-at-least-32-characters-long",
      MONGODB_URI: "",
      // Business OS Phase 8, Module 8.3 — lets tenantBilling.spec.ts
      // create real test Plan catalog entries via the real
      // platform-secret-gated route, the same "real secret, test-only
      // value" pattern JWT_ACCESS_TOKEN_SECRET above already uses.
      PLATFORM_ADMIN_SECRET: "playwright-test-platform-admin-secret",
    },
  },
});
