/**
 * RC-2 Enterprise Security Hardening — Next.js's own supported "runs
 * once when the server process starts, before any request is handled"
 * hook (App Router, auto-enabled since Next.js 15 — no
 * experimental.instrumentationHook flag needed on this app's Next.js
 * 16). The one place this app's own startup validation belongs: a
 * per-request check would run the same static env-var checks on every
 * request for no benefit; a per-feature-use check (inline in each
 * config file) only surfaces a gap the first time that specific
 * feature is touched, which in production can be days after a real
 * deploy. See lib/startupValidation.ts's own doc comment for exactly
 * what's checked and why this only warns rather than crashing the
 * process.
 *
 * Guarded to the Node.js runtime only — `register()` also fires for
 * the Edge runtime (middleware.ts's own bundle), which doesn't have
 * `process.env` populated the same way and doesn't need this check
 * running a second time anyway (middleware.ts's own module graph is
 * deliberately Node-free — see that file's own doc comment).
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { runStartupValidation } = await import("./lib/startupValidation");
  runStartupValidation();
}
