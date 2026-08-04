import { defineConfig } from "vitest/config";

/**
 * Unit-test layer — the "still open" half of the standing test-coverage
 * debt item (see CHANGELOG.md's "Automated Test Coverage" pass): the
 * E2E suite (playwright.config.ts, tests/e2e/) covers full-stack
 * critical paths against a running server; this covers service-layer
 * logic in isolation (retry/backoff math, scheduler due-job selection,
 * automation engine branching) where a real HTTP round-trip is the
 * wrong tool for exercising edge cases densely. Deliberately a second,
 * separate config — not a Playwright component-test mode — since these
 * specs never need a browser or a running Next.js server at all.
 *
 * `resolve.tsconfigPaths` resolves the same "@/*" alias used everywhere
 * else in the app, so a unit test can import real `lib/services/*`
 * modules exactly the way application code does, not a parallel
 * relative-path scheme.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ["**/*.unit.test.ts"],
    exclude: ["node_modules", ".next", "tests/e2e/**"],
    environment: "node",
  },
});
