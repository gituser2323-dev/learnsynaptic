"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Loader2, ArrowRight, ShieldCheck, KeyRound } from "lucide-react";
import { login, listOAuthProviders, oauthAuthorizeHref, oauthMfaVerify, mfaRequestEmailOtp, type OAuthProviderSummary } from "@/components/admin/apiClient";

/**
 * /admin/login — the one dashboard page with no sidebar/header shell
 * (see app/admin/(dashboard)/layout.tsx for the rest) and no
 * AdminAuthProvider — it doesn't need "who's logged in," it establishes
 * that. middleware.ts already redirects here on any unauthenticated
 * /admin/* page request (appending ?from=<path>) and redirects *away*
 * from here if a valid session already exists — this page trusts both
 * of those and just handles the form. Dark theme is hardcoded (not
 * user-toggleable here, unlike the rest of the dashboard) — a single
 * auth screen doesn't need AdminThemeProvider's persisted state.
 *
 * RC-1 — extended (not rewritten) with three genuinely new steps, none
 * of which replace the original email/password form:
 *   1. MFA code entry, when login() reports `mfaRequired: true` —
 *      resubmits to the SAME /api/auth/login endpoint with the same
 *      email+password plus `mfaCode` (see authService.login()'s own
 *      doc comment for why there's no separate "step 2" route).
 *   2. Social Login buttons — only rendered for providers
 *      listOAuthProviders() actually reports configured ("Do NOT
 *      hardcode providers"). A full-page navigation to the vendor's
 *      consent screen, not a fetch.
 *   3. The OAuth-login MFA step, reached via the callback's own
 *      `?oauthMfaPending=&oauthProvider=` redirect (see that route's
 *      doc comment) — a parallel code-entry step that redeems the
 *      pending token instead of resubmitting a password this flow never
 *      had.
 *
 * Business OS Phase 8, Module 8.4 — deliberately renders the default
 * LearnSynaptic branding always, never a per-organization one (see this
 * file's own git history for the full reasoning: no hostname-to-
 * organization resolution exists pre-auth).
 */

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  denied: "Sign-in was cancelled.",
  invalid_request: "That sign-in link was invalid or has expired. Please try again.",
  not_linked: "No LearnSynaptic account is linked to that identity yet. Ask an admin to invite you, then connect it from Security Settings.",
  account_disabled: "This account is disabled.",
  connection_failed: "Something went wrong connecting to the provider. Please try again.",
};

function OAuthButtons({ disabled }: { disabled?: boolean }) {
  const [providers, setProviders] = useState<OAuthProviderSummary[]>([]);

  useEffect(() => {
    let cancelled = false;
    listOAuthProviders().then((result) => {
      if (!cancelled && result.success) setProviders(result.data.providers);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (providers.length === 0) return null;

  return (
    <div className="mt-5 space-y-2.5">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1" style={{ background: "var(--adm-border)" }} />
        <span className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
          or continue with
        </span>
        <div className="h-px flex-1" style={{ background: "var(--adm-border)" }} />
      </div>
      {providers.map((provider) => (
        <a
          key={provider.id}
          href={disabled ? undefined : oauthAuthorizeHref(provider.id)}
          aria-disabled={disabled}
          className="adm-focus-ring adm-btn adm-btn-secondary h-11 w-full text-sm"
          style={disabled ? { pointerEvents: "none", opacity: 0.6 } : undefined}
        >
          Sign in with {provider.name}
        </a>
      ))}
    </div>
  );
}

function OAuthMfaStep({ pendingToken, provider }: { pendingToken: string; provider: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const result = await oauthMfaVerify(pendingToken, code, provider);
    if (!result.success) {
      setError(result.errors[0]?.message ?? "Invalid verification code.");
      setLoading(false);
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-4" noValidate>
      <p className="text-sm" style={{ color: "var(--adm-text-muted)" }}>
        Enter the 6-digit code from your authenticator app (or a recovery code) to finish signing in.
      </p>
      <div>
        <label htmlFor="oauth-mfa-code" className="mb-1.5 block text-sm font-medium" style={{ color: "var(--adm-text)" }}>
          Verification code
        </label>
        <input
          id="oauth-mfa-code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          required
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="123456"
          className="adm-input adm-focus-ring h-11"
        />
      </div>
      {error && (
        <p role="alert" className="rounded-[var(--adm-radius-md)] px-3 py-2 text-sm font-medium" style={{ background: "var(--adm-danger-soft)", color: "var(--adm-danger)" }}>
          {error}
        </p>
      )}
      <button type="submit" disabled={loading} className="adm-focus-ring adm-btn adm-btn-primary h-11 w-full text-sm">
        {loading ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
        Verify
      </button>
    </form>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaStep, setMfaStep] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockedUntil, setLockedUntil] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);

  const oauthError = searchParams.get("oauthError");
  const oauthMfaPending = searchParams.get("oauthMfaPending");
  const oauthProvider = searchParams.get("oauthProvider");

  function followFromParam() {
    // Only ever follow ?from= back into the dashboard itself — never an
    // arbitrary external/absolute URL an attacker could plant in the
    // query string (open-redirect prevention).
    const from = searchParams.get("from");
    router.push(from && from.startsWith("/admin") ? from : "/admin");
    router.refresh();
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setLockedUntil(null);

    const result = await login(email, password, { rememberMe, mfaCode: mfaStep ? mfaCode : undefined });
    if (!result.success) {
      setError(result.errors[0]?.message ?? "Invalid email or password.");
      setLoading(false);
      return;
    }

    if ("locked" in result.data && result.data.locked) {
      setLockedUntil(result.data.lockedUntil);
      setLoading(false);
      return;
    }
    if ("mfaRequired" in result.data && result.data.mfaRequired) {
      setMfaStep(true);
      setLoading(false);
      return;
    }

    followFromParam();
  }

  async function handleRequestEmailOtp() {
    setError(null);
    const result = await mfaRequestEmailOtp(email, password);
    setOtpSent(result.success);
    if (!result.success) setError(result.errors[0]?.message ?? "Something went wrong.");
  }

  if (oauthMfaPending && oauthProvider) {
    return <OAuthMfaStep pendingToken={oauthMfaPending} provider={oauthProvider} />;
  }

  if (lockedUntil) {
    return (
      <div className="space-y-3 text-center">
        <p className="text-sm font-medium" style={{ color: "var(--adm-danger)" }}>
          Too many failed attempts. This account is temporarily locked.
        </p>
        <p className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
          Try again after {new Date(lockedUntil).toLocaleTimeString()}, or reset your password below.
        </p>
        <Link href="/admin/forgot-password" className="adm-focus-ring adm-btn adm-btn-secondary h-10 w-full text-sm">
          Reset password
        </Link>
      </div>
    );
  }

  if (mfaStep) {
    return (
      <form onSubmit={handleSubmit} className="w-full space-y-4" noValidate>
        <p className="text-sm" style={{ color: "var(--adm-text-muted)" }}>
          Enter the 6-digit code from your authenticator app, a recovery code, or an emailed code.
        </p>
        <div>
          <label htmlFor="mfa-code" className="mb-1.5 block text-sm font-medium" style={{ color: "var(--adm-text)" }}>
            Verification code
          </label>
          <input
            id="mfa-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            required
            value={mfaCode}
            onChange={(event) => setMfaCode(event.target.value)}
            placeholder="123456"
            className="adm-input adm-focus-ring h-11"
          />
        </div>
        {error && (
          <p role="alert" className="rounded-[var(--adm-radius-md)] px-3 py-2 text-sm font-medium" style={{ background: "var(--adm-danger-soft)", color: "var(--adm-danger)" }}>
            {error}
          </p>
        )}
        {otpSent && (
          <p className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
            If email codes are enabled for this account, one was just sent.
          </p>
        )}
        <button type="submit" disabled={loading} className="adm-focus-ring adm-btn adm-btn-primary h-11 w-full text-sm">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
          Verify
        </button>
        <button type="button" onClick={handleRequestEmailOtp} className="adm-focus-ring adm-btn adm-btn-secondary h-10 w-full text-xs">
          <KeyRound size={14} /> Email me a code instead
        </button>
      </form>
    );
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="w-full space-y-4" noValidate>
        <div>
          <label htmlFor="admin-email" className="mb-1.5 block text-sm font-medium" style={{ color: "var(--adm-text)" }}>
            Email
          </label>
          <input
            id="admin-email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@learnsynaptic.com"
            className="adm-input adm-focus-ring h-11"
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="admin-password" className="block text-sm font-medium" style={{ color: "var(--adm-text)" }}>
              Password
            </label>
            <Link href="/admin/forgot-password" className="text-xs font-medium" style={{ color: "var(--adm-accent)" }}>
              Forgot password?
            </Link>
          </div>
          <input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            className="adm-input adm-focus-ring h-11"
          />
        </div>

        <label className="flex items-center gap-2 text-sm" style={{ color: "var(--adm-text-muted)" }}>
          <input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} className="h-4 w-4" />
          Remember me on this device
        </label>

        {(error || oauthError) && (
          <p
            role="alert"
            className="rounded-[var(--adm-radius-md)] px-3 py-2 text-sm font-medium"
            style={{ background: "var(--adm-danger-soft)", color: "var(--adm-danger)" }}
          >
            {error ?? OAUTH_ERROR_MESSAGES[oauthError!] ?? "Something went wrong signing in."}
          </p>
        )}

        <button type="submit" disabled={loading} className="adm-focus-ring adm-btn adm-btn-primary h-11 w-full text-sm">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
          Sign in
        </button>
      </form>
      <OAuthButtons disabled={loading} />
    </>
  );
}

export default function AdminLoginPage() {
  return (
    <main
      id="main-content"
      className="admin-shell relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10"
      data-theme="dark"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 620px 420px at 50% 0%, rgba(99,102,241,0.22), transparent 60%), radial-gradient(ellipse 500px 360px at 100% 100%, rgba(34,211,238,0.12), transparent 55%)",
        }}
      />

      <div className="adm-animate-in relative w-full max-w-sm">
        <div className="adm-glass adm-card rounded-[var(--adm-radius-xl)] p-8 shadow-2xl">
          <div className="mb-7 flex flex-col items-center gap-3 text-center">
            <span
              className="flex h-12 w-12 items-center justify-center rounded-[var(--adm-radius-lg)]"
              style={{ background: "linear-gradient(135deg, var(--adm-accent), var(--adm-accent-2))" }}
            >
              <Image src="/logo.png" alt="" width={24} height={24} className="rounded-sm" />
            </span>
            <div>
              <h1 className="!text-lg font-bold" style={{ color: "var(--adm-text)" }}>
                LearnSynaptic Admin
              </h1>
              <p className="mt-1 text-sm" style={{ color: "var(--adm-text-muted)" }}>
                Sign in to your workspace
              </p>
            </div>
          </div>

          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>

        <p
          className="mt-5 flex items-center justify-center gap-1.5 text-center text-xs"
          style={{ color: "var(--adm-text-muted)" }}
        >
          <ShieldCheck size={13} /> Access restricted to authorized staff accounts
        </p>
      </div>
    </main>
  );
}
