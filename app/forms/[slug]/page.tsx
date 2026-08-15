"use client";

import { use, useEffect, useState } from "react";
import { PublicLeadCaptureForm } from "@/components/lead-capture/PublicLeadCaptureForm";
import type { PublicLeadCaptureFormConfig } from "@/lib/services/crm/leadCaptureForms";

type LoadState = "loading" | "ready" | "not_found";

/**
 * Lead Capture — the hosted public form page. A client component that
 * fetches its own config over real HTTP (GET /api/lead-capture/[slug])
 * rather than a Server Component calling publicSubmissionService
 * directly — see that route's own doc comment for why (a real,
 * e2e-caught module-instance-isolation bug in the first version of this
 * file, not a style preference). Matches this app's own established
 * pattern for every other data-driven page (client fetch + loading/
 * empty/error state), just without an authenticated session.
 *
 * This page (not a tenant's own external site) is deliberately what a
 * Lead Capture Form's public URL points at — see the approved plan's
 * "hosted page, not an embed widget" decision: keeping the form on this
 * app's own origin is what lets the submission route reuse the existing
 * same-origin check unchanged.
 */
export default function LeadCaptureFormPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [state, setState] = useState<LoadState>("loading");
  const [config, setConfig] = useState<PublicLeadCaptureFormConfig | null>(null);

  useEffect(() => {
    let ignore = false;
    fetch(`/api/lead-capture/${slug}`)
      .then(async (response) => {
        if (ignore) return;
        if (!response.ok) {
          setState("not_found");
          return;
        }
        const body = (await response.json()) as { form: PublicLeadCaptureFormConfig };
        setConfig(body.form);
        setState("ready");
      })
      .catch(() => {
        if (!ignore) setState("not_found");
      });
    return () => {
      ignore = true;
    };
  }, [slug]);

  if (state === "loading") {
    return <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-16" aria-busy="true" />;
  }

  if (state === "not_found" || !config) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-2 bg-neutral-50 px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-neutral-900">This page could not be found.</h1>
        <p className="text-sm text-neutral-500">The form you&apos;re looking for is unavailable.</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-neutral-900">{config.name}</h1>
        <p className="mt-1 text-sm text-neutral-500">We&apos;ll get back to you shortly.</p>
        <div className="mt-6">
          <PublicLeadCaptureForm slug={slug} config={config} />
        </div>
      </div>
    </main>
  );
}
