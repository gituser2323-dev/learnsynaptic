/**
 * Test-only side-effect module: sets the env vars config/identityOAuth.ts
 * reads at import time, so Google's real provider adapter reports
 * isConfigured() === true in oauthService.unit.test.ts without a real
 * OAuth app registered — that test mocks `fetch` for the vendor calls
 * instead. Must be the FIRST import in any test file that needs this
 * (ESM evaluates sibling top-level imports in declaration order, so this
 * runs — and sets process.env — before oauthService's own import chain
 * reaches config/identityOAuth.ts's module-level `process.env.X || ""`
 * reads).
 */
process.env.AUTH_GOOGLE_CLIENT_ID = "test-google-client-id";
process.env.AUTH_GOOGLE_CLIENT_SECRET = "test-google-client-secret";
process.env.AUTH_GOOGLE_REDIRECT_URI = "https://app.test/api/auth/oauth/google/callback";
