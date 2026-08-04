"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Loader2, ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { verifyEmail } from "@/components/admin/apiClient";

/** /admin/verify-email?token=... — lands here from the emailed
 *  verification link; the actual redemption is a POST (see
 *  /api/auth/verify-email's own doc comment for why), fired once on
 *  mount rather than requiring a second click. */
function VerifyEmailStatus() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  // No token is knowable synchronously from the URL alone — the initial
  // state itself reflects that, rather than an effect setState-ing past
  // "pending" a moment after render (react-hooks/set-state-in-effect).
  const [state, setState] = useState<"pending" | "verified" | "failed">(token ? "pending" : "failed");
  const [message, setMessage] = useState<string | null>(token ? null : "This verification link is missing its token.");

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    verifyEmail(token).then((result) => {
      if (cancelled) return;
      if (result.success) {
        setState("verified");
      } else {
        setState("failed");
        setMessage(result.errors[0]?.message ?? "This verification link is invalid.");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state === "pending") {
    return (
      <div className="flex flex-col items-center gap-3 py-4">
        <Loader2 size={24} className="animate-spin" style={{ color: "var(--adm-accent)" }} />
        <p className="text-sm" style={{ color: "var(--adm-text-muted)" }}>
          Verifying your email…
        </p>
      </div>
    );
  }

  if (state === "verified") {
    return (
      <div className="space-y-3 text-center">
        <CheckCircle2 size={28} className="mx-auto" style={{ color: "var(--adm-success)" }} />
        <p className="text-sm" style={{ color: "var(--adm-text-muted)" }}>
          Your email address has been verified.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-center">
      <XCircle size={28} className="mx-auto" style={{ color: "var(--adm-danger)" }} />
      <p className="text-sm" style={{ color: "var(--adm-text-muted)" }}>
        {message}
      </p>
    </div>
  );
}

export default function VerifyEmailPage() {
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
              Email verification
            </h1>
          </div>

          <Suspense fallback={null}>
            <VerifyEmailStatus />
          </Suspense>

          <Link href="/admin/login" className="mt-5 flex items-center justify-center gap-1.5 text-sm font-medium" style={{ color: "var(--adm-accent)" }}>
            <ArrowLeft size={14} /> Back to sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
