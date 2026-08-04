"use client";

import { useState } from "react";
import { Loader2, ShieldCheck, ShieldOff, KeyRound, Monitor, History, Link2, Link2Off, Copy, Check, LogOut } from "lucide-react";
import {
  changePassword,
  resendVerificationEmail,
  listSessions,
  revokeSession,
  revokeOtherSessions,
  listLoginHistory,
  mfaBeginSetup,
  mfaConfirmSetup,
  mfaDisable,
  mfaRegenerateRecoveryCodes,
  listTrustedDevices,
  revokeTrustedDevice,
  listOAuthProviders,
  listOAuthAccounts,
  unlinkOAuthAccount,
  oauthAuthorizeHref,
  type SessionSummary,
  type LoginHistoryEntry,
  type TrustedDeviceSummary,
  type ConnectedOAuthAccount,
  type OAuthProviderSummary,
} from "@/components/admin/apiClient";
import { useAdminAuth } from "@/components/admin/AdminAuthContext";
import { useAdminData } from "@/components/admin/useAdminData";
import { LoadingState, ForbiddenState, ErrorState, EmptyState } from "@/components/admin/DataStates";
import { Badge } from "@/components/admin/Badge";

/**
 * RC-1 — /admin/settings/security. A separate page from the main
 * Settings dashboard (rather than one more section wedged into that
 * already-large file) — every action here operates on the CALLER'S OWN
 * account (password, MFA, sessions, connected providers), a distinct
 * concern from Settings' own org-wide configuration (tags, integrations,
 * billing). Every one of these sections is a thin UI over an RC-1 API
 * route that already enforces its own ownership/ordering rules
 * server-side — this page never re-implements that logic, only renders
 * it and lets the user act.
 */

function SectionCard({ title, icon: Icon, description, children }: { title: string; icon: React.ElementType; description?: string; children: React.ReactNode }) {
  return (
    <section className="adm-card adm-animate-in space-y-4 p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--adm-radius-md)]" style={{ background: "var(--adm-accent-soft)", color: "var(--adm-accent)" }}>
          <Icon size={17} />
        </span>
        <div>
          <h2 className="text-sm font-semibold" style={{ color: "var(--adm-text)" }}>
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 text-xs" style={{ color: "var(--adm-text-muted)" }}>
              {description}
            </p>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

function Banner({ tone, message }: { tone: "success" | "danger"; message: string }) {
  return (
    <p
      role="status"
      className="rounded-[var(--adm-radius-md)] px-3 py-2 text-sm font-medium"
      style={{
        background: tone === "success" ? "var(--adm-success-soft)" : "var(--adm-danger-soft)",
        color: tone === "success" ? "var(--adm-success)" : "var(--adm-danger)",
      }}
    >
      {message}
    </p>
  );
}

// ─── Password ─────────────────────────────────────────────────────────────

function PasswordSection() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    const result = await changePassword(currentPassword, newPassword);
    setLoading(false);
    if (!result.success) {
      setMessage({ tone: "danger", text: result.errors[0]?.message ?? "Something went wrong." });
      return;
    }
    setMessage({ tone: "success", text: "Password changed. Every other session was signed out." });
    setCurrentPassword("");
    setNewPassword("");
  }

  return (
    <SectionCard title="Password" icon={KeyRound} description="Changing your password signs out every other active session.">
      <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="current-password" className="mb-1.5 block text-xs font-medium" style={{ color: "var(--adm-text-secondary)" }}>
            Current password
          </label>
          <input
            id="current-password"
            type="password"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className="adm-input adm-focus-ring"
          />
        </div>
        <div>
          <label htmlFor="new-password-settings" className="mb-1.5 block text-xs font-medium" style={{ color: "var(--adm-text-secondary)" }}>
            New password
          </label>
          <input
            id="new-password-settings"
            type="password"
            autoComplete="new-password"
            required
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            className="adm-input adm-focus-ring"
          />
        </div>
        {message && (
          <div className="sm:col-span-2">
            <Banner tone={message.tone} message={message.text} />
          </div>
        )}
        <div className="sm:col-span-2">
          <button type="submit" disabled={loading} className="adm-focus-ring adm-btn adm-btn-primary text-sm">
            {loading ? <Loader2 size={14} className="animate-spin" /> : null}
            Change password
          </button>
        </div>
      </form>
    </SectionCard>
  );
}

// ─── Email verification ────────────────────────────────────────────────────

function EmailVerificationSection() {
  const { user } = useAdminAuth();
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!user || user.emailVerified) return null;

  async function handleResend() {
    setLoading(true);
    await resendVerificationEmail();
    setLoading(false);
    setSent(true);
  }

  return (
    <SectionCard title="Email verification" icon={ShieldCheck} description="Your email address hasn't been verified yet.">
      {sent ? (
        <Banner tone="success" message="Verification email sent — check your inbox." />
      ) : (
        <button type="button" onClick={handleResend} disabled={loading} className="adm-focus-ring adm-btn adm-btn-secondary text-sm">
          {loading ? <Loader2 size={14} className="animate-spin" /> : null}
          Resend verification email
        </button>
      )}
    </SectionCard>
  );
}

// ─── MFA ───────────────────────────────────────────────────────────────────

function MfaSetupFlow({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<"start" | "confirm" | "codes">("start");
  const [secret, setSecret] = useState("");
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleBegin() {
    setLoading(true);
    setError(null);
    const result = await mfaBeginSetup();
    setLoading(false);
    if (!result.success) {
      setError(result.errors[0]?.message ?? "Something went wrong.");
      return;
    }
    setSecret(result.data.secret);
    setQrCodeDataUrl(result.data.qrCodeDataUrl);
    setStep("confirm");
  }

  async function handleConfirm(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const result = await mfaConfirmSetup(code);
    setLoading(false);
    if (!result.success) {
      setError(result.errors[0]?.message ?? "Invalid code.");
      return;
    }
    setRecoveryCodes(result.data.recoveryCodes);
    setStep("codes");
  }

  if (step === "start") {
    return (
      <div className="space-y-3">
        <button type="button" onClick={handleBegin} disabled={loading} className="adm-focus-ring adm-btn adm-btn-primary text-sm">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
          Enable two-factor authentication
        </button>
        {error && <Banner tone="danger" message={error} />}
      </div>
    );
  }

  if (step === "confirm") {
    return (
      <form onSubmit={handleConfirm} className="max-w-xs space-y-3">
        {qrCodeDataUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- a data: URL, not a static/remote asset next/image is meant for.
          <img src={qrCodeDataUrl} alt="Scan this QR code with your authenticator app" width={180} height={180} className="rounded-[var(--adm-radius-md)]" />
        )}
        <p className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
          Scan with Google Authenticator, Authy, or 1Password. Can&apos;t scan?{" "}
          <span className="font-mono" style={{ color: "var(--adm-text)" }}>
            {secret}
          </span>
        </p>
        <div>
          <label htmlFor="mfa-confirm-code" className="mb-1.5 block text-xs font-medium" style={{ color: "var(--adm-text-secondary)" }}>
            Enter the 6-digit code from your app
          </label>
          <input
            id="mfa-confirm-code"
            type="text"
            inputMode="numeric"
            required
            value={code}
            onChange={(event) => setCode(event.target.value)}
            className="adm-input adm-focus-ring"
            placeholder="123456"
          />
        </div>
        {error && <Banner tone="danger" message={error} />}
        <button type="submit" disabled={loading} className="adm-focus-ring adm-btn adm-btn-primary text-sm">
          {loading ? <Loader2 size={14} className="animate-spin" /> : null}
          Confirm and enable
        </button>
      </form>
    );
  }

  return (
    <div className="max-w-xs space-y-3">
      <Banner tone="success" message="Two-factor authentication is now enabled." />
      <div>
        <p className="mb-1.5 text-xs font-medium" style={{ color: "var(--adm-text-secondary)" }}>
          Save these recovery codes somewhere safe — each works once, and this is the only time they&apos;re shown.
        </p>
        <div className="adm-card grid grid-cols-2 gap-1.5 p-3 font-mono text-xs" style={{ color: "var(--adm-text)" }}>
          {recoveryCodes.map((rc) => (
            <span key={rc}>{rc}</span>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(recoveryCodes.join("\n"));
          setCopied(true);
        }}
        className="adm-focus-ring adm-btn adm-btn-secondary text-sm"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
        {copied ? "Copied" : "Copy codes"}
      </button>
      <button type="button" onClick={onDone} className="adm-focus-ring adm-btn adm-btn-primary block text-sm">
        Done
      </button>
    </div>
  );
}

function MfaDisableFlow({ onDone }: { onDone: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const result = await mfaDisable(currentPassword);
    setLoading(false);
    if (!result.success) {
      setError(result.errors[0]?.message ?? "Something went wrong.");
      return;
    }
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xs space-y-3">
      <label htmlFor="mfa-disable-password" className="mb-1.5 block text-xs font-medium" style={{ color: "var(--adm-text-secondary)" }}>
        Confirm your current password to disable two-factor authentication
      </label>
      <input
        id="mfa-disable-password"
        type="password"
        autoComplete="current-password"
        required
        value={currentPassword}
        onChange={(event) => setCurrentPassword(event.target.value)}
        className="adm-input adm-focus-ring"
      />
      {error && <Banner tone="danger" message={error} />}
      <button type="submit" disabled={loading} className="adm-focus-ring adm-btn adm-btn-secondary text-sm" style={{ color: "var(--adm-danger)" }}>
        {loading ? <Loader2 size={14} className="animate-spin" /> : <ShieldOff size={14} />}
        Disable two-factor authentication
      </button>
    </form>
  );
}

function MfaSection() {
  const { user } = useAdminAuth();
  const [mfaEnabled, setMfaEnabled] = useState<boolean | null>(user?.mfaEnabled ?? null);
  const [showSetup, setShowSetup] = useState(false);
  const [showDisable, setShowDisable] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState<string[] | null>(null);
  const trustedDevices = useAdminData(listTrustedDevices, []);

  const enabled = mfaEnabled ?? user?.mfaEnabled ?? false;

  async function handleRegenerateRecoveryCodes() {
    const result = await mfaRegenerateRecoveryCodes();
    if (result.success) setRecoveryMessage(result.data.recoveryCodes);
  }

  return (
    <SectionCard title="Two-factor authentication" icon={ShieldCheck} description="Require a code from an authenticator app in addition to your password.">
      <div className="flex items-center gap-2">
        <Badge tone={enabled ? "success" : "neutral"}>{enabled ? "Enabled" : "Not enabled"}</Badge>
      </div>

      {!enabled && !showSetup && (
        <button type="button" onClick={() => setShowSetup(true)} className="adm-focus-ring adm-btn adm-btn-primary text-sm">
          Enable two-factor authentication
        </button>
      )}
      {!enabled && showSetup && (
        <MfaSetupFlow
          onDone={() => {
            setMfaEnabled(true);
            setShowSetup(false);
          }}
        />
      )}

      {enabled && !showDisable && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={handleRegenerateRecoveryCodes} className="adm-focus-ring adm-btn adm-btn-secondary text-sm">
            Regenerate recovery codes
          </button>
          <button
            type="button"
            onClick={() => setShowDisable(true)}
            className="adm-focus-ring adm-btn adm-btn-secondary text-sm"
            style={{ color: "var(--adm-danger)" }}
          >
            <ShieldOff size={14} /> Disable
          </button>
        </div>
      )}
      {enabled && showDisable && (
        <MfaDisableFlow
          onDone={() => {
            setMfaEnabled(false);
            setShowDisable(false);
          }}
        />
      )}

      {recoveryMessage && (
        <div className="max-w-xs space-y-2">
          <p className="text-xs font-medium" style={{ color: "var(--adm-text-secondary)" }}>
            New recovery codes — save them now, they won&apos;t be shown again:
          </p>
          <div className="adm-card grid grid-cols-2 gap-1.5 p-3 font-mono text-xs" style={{ color: "var(--adm-text)" }}>
            {recoveryMessage.map((rc) => (
              <span key={rc}>{rc}</span>
            ))}
          </div>
        </div>
      )}

      {enabled && trustedDevices.data && trustedDevices.data.devices.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium" style={{ color: "var(--adm-text-secondary)" }}>
            Trusted devices (skip MFA for 30 days)
          </p>
          <ul className="space-y-1.5">
            {trustedDevices.data.devices.map((device: TrustedDeviceSummary) => (
              <li key={device.id} className="flex items-center justify-between text-sm" style={{ color: "var(--adm-text)" }}>
                <span>{device.deviceName ?? "Unknown device"}</span>
                <button
                  type="button"
                  onClick={() => revokeTrustedDevice(device.id).then(() => trustedDevices.reload())}
                  className="adm-focus-ring text-xs font-medium"
                  style={{ color: "var(--adm-danger)" }}
                >
                  Forget
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </SectionCard>
  );
}

// ─── Active sessions ────────────────────────────────────────────────────────

function formatSessionLabel(session: SessionSummary): string {
  const parts = [session.browser, session.os].filter(Boolean);
  return parts.length > 0 ? parts.join(" on ") : (session.deviceName ?? "Unknown device");
}

function SessionsSection() {
  const sessions = useAdminData(listSessions, []);

  if (sessions.loading) return <LoadingState />;
  if (sessions.forbidden) return <ForbiddenState />;
  if (sessions.error) return <ErrorState message={sessions.error} onRetry={sessions.reload} />;

  const list = sessions.data?.sessions ?? [];

  return (
    <SectionCard title="Active sessions" icon={Monitor} description="Devices currently signed in to your account.">
      {list.length === 0 ? (
        <EmptyState message="No active sessions." />
      ) : (
        <>
          <ul className="space-y-2">
            {list.map((session) => (
              <li key={session.id} className="flex items-center justify-between gap-3 rounded-[var(--adm-radius-md)] px-3 py-2" style={{ background: "var(--adm-surface-2)" }}>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium" style={{ color: "var(--adm-text)" }}>
                    {formatSessionLabel(session)} {session.isCurrent && <Badge tone="success">This device</Badge>}
                  </p>
                  <p className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
                    {session.ipAddress ?? "Unknown IP"} · last used {session.lastUsedAt ? new Date(session.lastUsedAt).toLocaleString() : new Date(session.createdAt).toLocaleString()}
                  </p>
                </div>
                {!session.isCurrent && (
                  <button
                    type="button"
                    onClick={() => revokeSession(session.id).then(() => sessions.reload())}
                    className="adm-focus-ring shrink-0 text-xs font-medium"
                    style={{ color: "var(--adm-danger)" }}
                  >
                    Log out
                  </button>
                )}
              </li>
            ))}
          </ul>
          {list.length > 1 && (
            <button
              type="button"
              onClick={() => revokeOtherSessions().then(() => sessions.reload())}
              className="adm-focus-ring adm-btn adm-btn-secondary text-sm"
            >
              <LogOut size={14} /> Log out all other devices
            </button>
          )}
        </>
      )}
    </SectionCard>
  );
}

// ─── Login history ──────────────────────────────────────────────────────────

const HISTORY_LABELS: Record<string, string> = {
  "user.login_succeeded": "Signed in",
  "user.login_failed": "Failed sign-in attempt",
  "user.logged_out": "Signed out",
  "user.password_reset": "Password reset (admin)",
  "user.password_reset_completed": "Password reset",
  "user.new_device_login": "New device sign-in",
  "user.account_locked": "Account locked (too many failed attempts)",
  "user.mfa_challenge_failed": "Failed MFA verification",
};

function LoginHistorySection() {
  const history = useAdminData(listLoginHistory, []);

  if (history.loading) return <LoadingState />;
  if (history.forbidden) return <ForbiddenState />;
  if (history.error) return <ErrorState message={history.error} onRetry={history.reload} />;

  const entries: LoginHistoryEntry[] = history.data?.history ?? [];

  return (
    <SectionCard title="Login history" icon={History} description="Recent sign-in activity on your account.">
      {entries.length === 0 ? (
        <EmptyState message="No recent activity." />
      ) : (
        <ul className="space-y-1.5">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between gap-3 text-sm" style={{ color: "var(--adm-text)" }}>
              <span>
                {HISTORY_LABELS[entry.action] ?? entry.action}
                {entry.deviceName ? ` · ${entry.deviceName}` : ""}
                {entry.ipAddress ? ` · ${entry.ipAddress}` : ""}
              </span>
              <span className="shrink-0 text-xs" style={{ color: "var(--adm-text-muted)" }}>
                {new Date(entry.createdAt).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

// ─── Connected accounts (OAuth) ─────────────────────────────────────────────

function ConnectedAccountsSection() {
  const providers = useAdminData(listOAuthProviders, []);
  const accounts = useAdminData(listOAuthAccounts, []);

  if (providers.loading || accounts.loading) return <LoadingState />;
  if (accounts.forbidden) return <ForbiddenState />;

  const configuredProviders: OAuthProviderSummary[] = providers.data?.providers ?? [];
  if (configuredProviders.length === 0) return null; // "Do NOT hardcode providers" — nothing configured, section doesn't render.

  const linked: ConnectedOAuthAccount[] = accounts.data?.accounts ?? [];

  return (
    <SectionCard title="Connected accounts" icon={Link2} description="Sign in with a linked provider instead of your password.">
      <ul className="space-y-2">
        {configuredProviders.map((provider) => {
          const account = linked.find((a) => a.provider === provider.id);
          return (
            <li key={provider.id} className="flex items-center justify-between gap-3 rounded-[var(--adm-radius-md)] px-3 py-2" style={{ background: "var(--adm-surface-2)" }}>
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--adm-text)" }}>
                  {provider.name}
                </p>
                {account?.email && (
                  <p className="text-xs" style={{ color: "var(--adm-text-muted)" }}>
                    {account.email}
                  </p>
                )}
              </div>
              {account ? (
                <button
                  type="button"
                  onClick={() => unlinkOAuthAccount(account.id).then(() => accounts.reload())}
                  className="adm-focus-ring text-xs font-medium"
                  style={{ color: "var(--adm-danger)" }}
                >
                  <Link2Off size={13} className="mr-1 inline" /> Disconnect
                </button>
              ) : (
                <a href={oauthAuthorizeHref(provider.id)} className="adm-focus-ring text-xs font-medium" style={{ color: "var(--adm-accent)" }}>
                  Connect
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}

export default function SecuritySettingsPage() {
  const { loading: authLoading } = useAdminAuth();
  if (authLoading) return <LoadingState />;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-lg font-bold" style={{ color: "var(--adm-text)" }}>
          Security
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--adm-text-muted)" }}>
          Manage your password, two-factor authentication, active sessions, and connected accounts.
        </p>
      </div>
      <EmailVerificationSection />
      <PasswordSection />
      <MfaSection />
      <SessionsSection />
      <ConnectedAccountsSection />
      <LoginHistorySection />
    </div>
  );
}
