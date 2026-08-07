"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Loader2, ArrowRight, ShieldCheck } from "lucide-react";
import { registerAccount } from "@/components/admin/apiClient";

/**
 * /admin/register — RC-7 Customer Onboarding & SaaS Activation.
 * NEW USER -> ACCOUNT, the first hop of the mission's own funnel. Same
 * unauthenticated, no-sidebar shell /admin/login uses (see that page's
 * own doc comment) — reused, not redesigned. middleware.ts treats this
 * as a second "auth entry" page alongside login (see its own
 * REGISTER_PAGE_PATH doc comment): reachable with no session, redirects
 * an already-authenticated visitor away.
 *
 * On success the account is auto-signed-in (authService.registerUser()'s
 * own doc comment) and lands directly on /admin/onboarding — nothing
 * else exists yet for a brand-new account, so this isn't "trapping" a
 * user (mission §34's own instruction), it's the only real next step.
 */
function PasswordHint() {
  return (
    <p className="mt-1.5 text-xs" style={{ color: "var(--adm-text-muted)" }}>
      At least 10 characters, with both uppercase and lowercase letters and a number.
    </p>
  );
}

function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setErrors({});

    const result = await registerAccount({ email, name, password, termsAccepted });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const error of result.errors) fieldErrors[error.field] = error.message;
      setErrors(fieldErrors);
      setLoading(false);
      return;
    }

    router.push("/admin/onboarding");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-4" noValidate>
      <div>
        <label htmlFor="register-name" className="mb-1.5 block text-sm font-medium" style={{ color: "var(--adm-text)" }}>
          Your name
        </label>
        <input
          id="register-name"
          type="text"
          autoComplete="name"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Jamie Rivera"
          className="adm-input adm-focus-ring h-11"
        />
        {errors.name && <p className="mt-1 text-xs" style={{ color: "var(--adm-danger)" }}>{errors.name}</p>}
      </div>

      <div>
        <label htmlFor="register-email" className="mb-1.5 block text-sm font-medium" style={{ color: "var(--adm-text)" }}>
          Business email
        </label>
        <input
          id="register-email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@yourbusiness.com"
          className="adm-input adm-focus-ring h-11"
        />
        {errors.email && <p className="mt-1 text-xs" style={{ color: "var(--adm-danger)" }}>{errors.email}</p>}
      </div>

      <div>
        <label htmlFor="register-password" className="mb-1.5 block text-sm font-medium" style={{ color: "var(--adm-text)" }}>
          Password
        </label>
        <input
          id="register-password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="••••••••"
          className="adm-input adm-focus-ring h-11"
        />
        {errors.password ? <p className="mt-1 text-xs" style={{ color: "var(--adm-danger)" }}>{errors.password}</p> : <PasswordHint />}
      </div>

      <label className="flex items-start gap-2 text-sm" style={{ color: "var(--adm-text-muted)" }}>
        <input
          type="checkbox"
          checked={termsAccepted}
          onChange={(event) => setTermsAccepted(event.target.checked)}
          className="mt-0.5 h-4 w-4"
        />
        <span>I agree to the Terms of Service and Privacy Policy.</span>
      </label>
      {errors.termsAccepted && <p className="text-xs" style={{ color: "var(--adm-danger)" }}>{errors.termsAccepted}</p>}

      {errors.root && (
        <p role="alert" className="rounded-[var(--adm-radius-md)] px-3 py-2 text-sm font-medium" style={{ background: "var(--adm-danger-soft)", color: "var(--adm-danger)" }}>
          {errors.root}
        </p>
      )}

      <button type="submit" disabled={loading} className="adm-focus-ring adm-btn adm-btn-primary h-11 w-full text-sm">
        {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
        Create your account
      </button>
    </form>
  );
}

export default function AdminRegisterPage() {
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
                Start your workspace
              </h1>
              <p className="mt-1 text-sm" style={{ color: "var(--adm-text-muted)" }}>
                Free to try — set up your business in minutes.
              </p>
            </div>
          </div>

          <RegisterForm />

          <p className="mt-5 text-center text-sm" style={{ color: "var(--adm-text-muted)" }}>
            Already have an account?{" "}
            <Link href="/admin/login" className="font-medium" style={{ color: "var(--adm-accent)" }}>
              Sign in
            </Link>
          </p>
        </div>

        <p
          className="mt-5 flex items-center justify-center gap-1.5 text-center text-xs"
          style={{ color: "var(--adm-text-muted)" }}
        >
          <ShieldCheck size={13} /> Your data is private to your organization
        </p>
      </div>
    </main>
  );
}
