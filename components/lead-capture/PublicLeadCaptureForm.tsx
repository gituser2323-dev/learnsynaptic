"use client";

import { useState } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import type { PublicLeadCaptureFormConfig } from "@/lib/services/crm/leadCaptureForms";

type Status = "idle" | "sending" | "success" | "error";

interface PublicLeadCaptureFormProps {
  slug: string;
  config: PublicLeadCaptureFormConfig;
}

/**
 * The client half of the hosted public form (app/forms/[slug]/page.tsx).
 * Deliberately its own small component rather than reusing
 * components/lead-capture/useLeadCapture.ts — that hook is wired
 * specifically to LearnSynaptic's own /api/leads route and its
 * analytics/EmailJS side effects, neither of which applies to a tenant's
 * own form (a different submission endpoint, and no reason for a
 * tenant's visitor's browser to fire LearnSynaptic's own GA4/Meta Pixel
 * events).
 */
export function PublicLeadCaptureForm({ slug, config }: PublicLeadCaptureFormProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", program: "", message: "", website: "" });

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("sending");
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/lead-capture/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          program: config.fields.program.enabled ? form.program : undefined,
          message: config.fields.message.enabled ? form.message : undefined,
          // Honeypot — real visitors never see or fill this field (see
          // the hidden input below). A bot that fills every input blind
          // trips it; publicSubmissionService quietly no-ops on a
          // non-empty value here.
          website: form.website,
        }),
      });
      const body = (await response.json()) as { success: boolean; message?: string; errors?: { field: string; message: string }[] };

      if (!response.ok || !body.success) {
        setStatus("error");
        setErrorMessage(body.errors?.[0]?.message ?? "Something went wrong. Please try again.");
        return;
      }

      setStatus("success");
      setSuccessMessage(body.message ?? "Thanks — we'll be in touch.");
    } catch {
      setStatus("error");
      setErrorMessage("Could not reach the server. Please check your connection and try again.");
    }
  }

  if (status === "success") {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <CheckCircle2 className="h-8 w-8 text-emerald-500" aria-hidden="true" />
        <p className="text-sm text-neutral-700">{successMessage}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Honeypot field — visually hidden and off the tab order, never
          shown to a real visitor. A bot that populates every field on
          the page (a common naive scraping pattern) fills this one too;
          a human never sees it exists. */}
      <div className="absolute -left-[9999px] top-auto h-0 w-0 overflow-hidden" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={form.website}
          onChange={(e) => setForm({ ...form, website: e.target.value })}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium text-neutral-700">
          Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium text-neutral-700">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="phone" className="text-sm font-medium text-neutral-700">
          Phone
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          required
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
        />
      </div>

      {config.fields.program.enabled && (
        <div className="flex flex-col gap-1">
          <label htmlFor="program" className="text-sm font-medium text-neutral-700">
            Program / interest
          </label>
          <input
            id="program"
            name="program"
            type="text"
            required={config.fields.program.required}
            value={form.program}
            onChange={(e) => setForm({ ...form, program: e.target.value })}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
          />
        </div>
      )}

      {config.fields.message.enabled && (
        <div className="flex flex-col gap-1">
          <label htmlFor="message" className="text-sm font-medium text-neutral-700">
            Message
          </label>
          <textarea
            id="message"
            name="message"
            rows={3}
            required={config.fields.message.required}
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
          />
        </div>
      )}

      {status === "error" && errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}

      <button
        type="submit"
        disabled={status === "sending"}
        className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-60"
      >
        {status === "sending" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        Submit
      </button>
    </form>
  );
}
