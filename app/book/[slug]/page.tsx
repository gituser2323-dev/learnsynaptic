"use client";

import { use, useEffect, useState } from "react";
import { PublicBookingFlow } from "@/components/booking/PublicBookingFlow";
import type { PublicAppointmentTypeConfig } from "@/lib/services/crm/appointments";

type LoadState = "loading" | "ready" | "not_found";

/**
 * Appointment Booking — the hosted public booking page. Mirrors
 * app/forms/[slug]/page.tsx exactly: a client component that fetches its
 * own config over real HTTP (GET /api/booking/[slug]) rather than a
 * Server Component calling publicBookingService directly — see that
 * page's own doc comment for why (a real, e2e-caught module-instance-
 * isolation bug in Lead Capture's own first version of this pattern, not
 * a style preference; the same risk applies unchanged here).
 *
 * This page (not a tenant's own external site) is deliberately what an
 * AppointmentType's public URL points at — the identical "hosted page,
 * not an embed widget" decision Lead Capture already made, for the same
 * reason: keeping the booking flow on this app's own origin is what lets
 * the submission route reuse the existing same-origin check unchanged.
 */
export default function BookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [state, setState] = useState<LoadState>("loading");
  const [config, setConfig] = useState<PublicAppointmentTypeConfig | null>(null);

  useEffect(() => {
    let ignore = false;
    fetch(`/api/booking/${slug}`)
      .then(async (response) => {
        if (ignore) return;
        if (!response.ok) {
          setState("not_found");
          return;
        }
        const body = (await response.json()) as { appointmentType: PublicAppointmentTypeConfig };
        setConfig(body.appointmentType);
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
    return <main id="main-content" className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-16" aria-busy="true" />;
  }

  if (state === "not_found" || !config) {
    return (
      <main id="main-content" className="flex min-h-screen flex-col items-center justify-center gap-2 bg-neutral-50 px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-neutral-900">This page could not be found.</h1>
        <p className="text-sm text-neutral-500">The booking page you&apos;re looking for is unavailable.</p>
      </main>
    );
  }

  return (
    <main id="main-content" className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-neutral-900">{config.name}</h1>
        {config.description && <p className="mt-1 text-sm text-neutral-500">{config.description}</p>}
        <div className="mt-6">
          <PublicBookingFlow slug={slug} config={config} />
        </div>
      </div>
    </main>
  );
}
