"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Loader2, ArrowLeft, MailCheck } from "lucide-react";
import { forgotPassword } from "@/components/admin/apiClient";

/**
 * /admin/forgot-password — mirrors /admin/login's own unauthenticated,
 * no-shell page shape (no AdminAuthProvider, hardcoded dark theme).
 * Always shows the same generic "check your email" confirmation
 * regardless of whether the address matched a real account —
 * authService.requestPasswordReset()'s own anti-enumeration guarantee,
 * preserved all the way to this UI rather than undone by a client-side
 * "email not found" message.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    await forgotPassword(email);
    setLoading(false);
    setSubmitted(true);
  }

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
                Reset your password
              </h1>
              <p className="mt-1 text-sm" style={{ color: "var(--adm-text-muted)" }}>
                We&apos;ll email you a link to choose a new one.
              </p>
            </div>
          </div>

          {submitted ? (
            <div className="space-y-4 text-center">
              <MailCheck size={28} className="mx-auto" style={{ color: "var(--adm-accent)" }} />
              <p className="text-sm" style={{ color: "var(--adm-text-muted)" }}>
                If an account exists for <strong>{email}</strong>, a reset link has been sent.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="w-full space-y-4" noValidate>
              <div>
                <label htmlFor="forgot-email" className="mb-1.5 block text-sm font-medium" style={{ color: "var(--adm-text)" }}>
                  Email
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@learnsynaptic.com"
                  className="adm-input adm-focus-ring h-11"
                />
              </div>
              <button type="submit" disabled={loading} className="adm-focus-ring adm-btn adm-btn-primary h-11 w-full text-sm">
                {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                Send reset link
              </button>
            </form>
          )}

          <Link href="/admin/login" className="mt-5 flex items-center justify-center gap-1.5 text-sm font-medium" style={{ color: "var(--adm-accent)" }}>
            <ArrowLeft size={14} /> Back to sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
