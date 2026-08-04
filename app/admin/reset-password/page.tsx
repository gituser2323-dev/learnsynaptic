"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { resetPassword } from "@/components/admin/apiClient";

/**
 * /admin/reset-password?token=... — the page a password-reset EMAIL
 * link points to. Reads the token from the query string for the click
 * (as any such link must), but the actual redemption is a POST body,
 * never a GET with the token re-appended (see
 * /api/auth/reset-password's own route doc comment) — the token never
 * leaves this page in a URL a second time.
 */
function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const result = await resetPassword(token, newPassword);
    if (!result.success) {
      setError(result.errors[0]?.message ?? "Something went wrong.");
      setLoading(false);
      return;
    }
    setDone(true);
    setLoading(false);
  }

  if (!token) {
    return (
      <p className="text-sm" style={{ color: "var(--adm-text-muted)" }}>
        This reset link is missing its token. Request a new one from the sign-in page.
      </p>
    );
  }

  if (done) {
    return (
      <div className="space-y-4 text-center">
        <CheckCircle2 size={28} className="mx-auto" style={{ color: "var(--adm-success)" }} />
        <p className="text-sm" style={{ color: "var(--adm-text-muted)" }}>
          Your password has been reset. Every existing session was signed out for your security.
        </p>
        <button onClick={() => router.push("/admin/login")} className="adm-focus-ring adm-btn adm-btn-primary h-11 w-full text-sm">
          Sign in
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-4" noValidate>
      <div>
        <label htmlFor="new-password" className="mb-1.5 block text-sm font-medium" style={{ color: "var(--adm-text)" }}>
          New password
        </label>
        <input
          id="new-password"
          type="password"
          autoComplete="new-password"
          required
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          placeholder="••••••••"
          className="adm-input adm-focus-ring h-11"
        />
        <p className="mt-1.5 text-xs" style={{ color: "var(--adm-text-muted)" }}>
          At least 10 characters, with uppercase, lowercase, and a digit.
        </p>
      </div>
      {error && (
        <p role="alert" className="rounded-[var(--adm-radius-md)] px-3 py-2 text-sm font-medium" style={{ background: "var(--adm-danger-soft)", color: "var(--adm-danger)" }}>
          {error}
        </p>
      )}
      <button type="submit" disabled={loading} className="adm-focus-ring adm-btn adm-btn-primary h-11 w-full text-sm">
        {loading ? <Loader2 size={16} className="animate-spin" /> : null}
        Reset password
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
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
            <h1 className="!text-lg font-bold" style={{ color: "var(--adm-text)" }}>
              Choose a new password
            </h1>
          </div>

          <Suspense fallback={null}>
            <ResetPasswordForm />
          </Suspense>

          <Link href="/admin/login" className="mt-5 flex items-center justify-center gap-1.5 text-sm font-medium" style={{ color: "var(--adm-accent)" }}>
            <ArrowLeft size={14} /> Back to sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
