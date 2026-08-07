"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Loader2, ArrowRight, ShieldCheck, Users } from "lucide-react";
import { acceptTeamInvitation } from "@/components/admin/apiClient";

/**
 * /admin/accept-invite?token=... — RC-7 Customer Onboarding & SaaS
 * Activation. The TEAM step's own recipient-side page — reused shell
 * from /admin/login (see that page's own doc comment), listed in
 * middleware.ts's OTHER_PUBLIC_PAGE_PATHS (reachable with no session,
 * never redirects an already-authenticated visitor away — see that
 * file's own doc comment for why).
 *
 * On success, lands the new teammate directly on /admin — they're
 * joining an ALREADY-onboarded organization, so there's no wizard for
 * them to see (mission §12's own scope: the wizard is for the
 * organization's own creator).
 */
function AcceptInviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!token) {
    return (
      <p className="text-center text-sm" style={{ color: "var(--adm-text-muted)" }}>
        This invitation link is missing its token. Ask whoever invited you to resend it.
      </p>
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setErrors({});

    const result = await acceptTeamInvitation({ token, name, password });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const error of result.errors) fieldErrors[error.field] = error.message;
      setErrors(fieldErrors);
      setLoading(false);
      return;
    }

    router.push("/admin");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-4" noValidate>
      <div>
        <label htmlFor="accept-name" className="mb-1.5 block text-sm font-medium" style={{ color: "var(--adm-text)" }}>
          Your name
        </label>
        <input
          id="accept-name"
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
        <label htmlFor="accept-password" className="mb-1.5 block text-sm font-medium" style={{ color: "var(--adm-text)" }}>
          Choose a password
        </label>
        <input
          id="accept-password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="••••••••"
          className="adm-input adm-focus-ring h-11"
        />
        {errors.password && <p className="mt-1 text-xs" style={{ color: "var(--adm-danger)" }}>{errors.password}</p>}
      </div>

      {(errors.root || errors.token) && (
        <p role="alert" className="rounded-[var(--adm-radius-md)] px-3 py-2 text-sm font-medium" style={{ background: "var(--adm-danger-soft)", color: "var(--adm-danger)" }}>
          {errors.root ?? errors.token}
        </p>
      )}

      <button type="submit" disabled={loading} className="adm-focus-ring adm-btn adm-btn-primary h-11 w-full text-sm">
        {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
        Join workspace
      </button>
    </form>
  );
}

export default function AcceptInvitePage() {
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
                Join your team
              </h1>
              <p className="mt-1 text-sm" style={{ color: "var(--adm-text-muted)" }}>
                You&apos;ve been invited to a LearnSynaptic workspace.
              </p>
            </div>
          </div>

          <Suspense fallback={null}>
            <AcceptInviteForm />
          </Suspense>
        </div>

        <p
          className="mt-5 flex items-center justify-center gap-1.5 text-center text-xs"
          style={{ color: "var(--adm-text-muted)" }}
        >
          <Users size={13} /> <ShieldCheck size={13} /> Invitations expire after 7 days
        </p>
      </div>
    </main>
  );
}
