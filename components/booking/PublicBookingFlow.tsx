"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import type { PublicAppointmentTypeConfig } from "@/lib/services/crm/appointments";

type Status = "idle" | "sending" | "error";

interface PublicBookingFlowProps {
  slug: string;
  config: PublicAppointmentTypeConfig;
}

function todayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/**
 * The client half of the hosted public booking page
 * (app/book/[slug]/page.tsx). Four steps, matching the approved plan's
 * own flow exactly: Date -> Time -> Details -> Confirmation. Deliberately
 * its own component rather than reusing PublicLeadCaptureForm — the
 * fields collected (a time slot, not just contact details) and the
 * two-request flow (GET availability, then POST book) don't fit that
 * component's single-submit shape, the same "different enough to earn
 * its own component" reasoning components/lead-capture/
 * PublicLeadCaptureForm.tsx's own doc comment already applies to
 * useLeadCapture.ts.
 */
export function PublicBookingFlow({ slug, config }: PublicBookingFlowProps) {
  const [date, setDate] = useState(todayDateString());
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const [form, setForm] = useState({ name: "", email: "", phone: "", notes: "", website: "" });
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{ startAt: string; timezone: string } | null>(null);
  // Bumped after a 409 (the selected slot was just taken by someone
  // else) to force a re-fetch even when `date` itself hasn't changed —
  // setting `date` to its own current value wouldn't re-trigger the
  // effect below, since React skips a state update that's Object.is-equal
  // to the current value.
  const [refreshToken, setRefreshToken] = useState(0);

  // The same render-phase-setState pattern components/admin/useAdminData.ts
  // already established (see that file's own doc comment) to satisfy this
  // codebase's react-hooks/set-state-in-effect lint rule: `setLoadingSlots(true)`
  // happens here, during render, when the tracked key changes — never
  // synchronously at the top of the effect body below.
  const depsKey = `${slug}:${date}:${refreshToken}`;
  const [trackedKey, setTrackedKey] = useState(depsKey);
  if (trackedKey !== depsKey) {
    setTrackedKey(depsKey);
    setLoadingSlots(true);
    setSelectedSlot(null);
  }

  useEffect(() => {
    let ignore = false;
    fetch(`/api/booking/${slug}/availability?date=${date}`)
      .then(async (response) => {
        if (ignore) return;
        if (!response.ok) {
          setSlots([]);
          return;
        }
        const body = (await response.json()) as { slots: string[] };
        setSlots(body.slots);
      })
      .catch(() => {
        if (!ignore) setSlots([]);
      })
      .finally(() => {
        if (!ignore) setLoadingSlots(false);
      });
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedSlot) return;
    setStatus("sending");
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/booking/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startAt: selectedSlot,
          timezone: config.timezone,
          name: form.name,
          email: form.email,
          phone: form.phone,
          notes: form.notes || undefined,
          // Honeypot — same shape as PublicLeadCaptureForm's own hidden
          // field; a bot that fills every input blind trips it,
          // publicBookingService quietly no-ops on a non-empty value.
          website: form.website,
        }),
      });
      const body = (await response.json()) as { success: boolean; startAt?: string; timezone?: string; message?: string; errors?: { field: string; message: string }[] };

      if (!response.ok || !body.success) {
        setStatus("error");
        setErrorMessage(body.errors?.[0]?.message ?? "Something went wrong. Please try again.");
        // A 409 (slot just taken) means the slot list is stale — refresh
        // it so the customer picks from what's actually still available.
        if (response.status === 409) {
          setSelectedSlot(null);
          setRefreshToken((n) => n + 1);
        }
        return;
      }

      setConfirmed({ startAt: body.startAt ?? selectedSlot, timezone: body.timezone ?? config.timezone });
    } catch {
      setStatus("error");
      setErrorMessage("Could not reach the server. Please check your connection and try again.");
    }
  }

  if (confirmed) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <CheckCircle2 className="h-8 w-8 text-emerald-500" aria-hidden="true" />
        <p className="text-sm font-medium text-neutral-900">Your appointment is confirmed</p>
        <p className="text-sm text-neutral-600">
          {new Date(confirmed.startAt).toLocaleString("en-IN", { timeZone: confirmed.timezone, dateStyle: "medium", timeStyle: "short" })}
        </p>
        <p className="text-xs text-neutral-500">({confirmed.timezone})</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="booking-date" className="text-sm font-medium text-neutral-700">
          Date
        </label>
        <input
          id="booking-date"
          type="date"
          min={todayDateString()}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
        />
      </div>

      {loadingSlots ? (
        <p className="flex items-center gap-2 text-sm text-neutral-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading available times…
        </p>
      ) : slots.length === 0 ? (
        <p className="text-sm text-neutral-500">No times available on this day. Try another date.</p>
      ) : (
        <div>
          <p className="mb-1.5 text-sm font-medium text-neutral-700">Available times</p>
          <div className="grid grid-cols-3 gap-2">
            {slots.map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => setSelectedSlot(slot)}
                className={`rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                  selectedSlot === slot ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 text-neutral-700 hover:border-neutral-500"
                }`}
              >
                {new Date(slot).toLocaleTimeString("en-IN", { timeZone: config.timezone, hour: "numeric", minute: "2-digit" })}
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedSlot && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 border-t border-neutral-200 pt-4">
          {/* Honeypot field — visually hidden and off the tab order,
              never shown to a real visitor, same shape as
              PublicLeadCaptureForm's own hidden field. */}
          <div className="absolute -left-[9999px] top-auto h-0 w-0 overflow-hidden" aria-hidden="true">
            <label htmlFor="booking-website">Website</label>
            <input
              id="booking-website"
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="booking-name" className="text-sm font-medium text-neutral-700">
              Name
            </label>
            <input
              id="booking-name"
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="booking-email" className="text-sm font-medium text-neutral-700">
              Email
            </label>
            <input
              id="booking-email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="booking-phone" className="text-sm font-medium text-neutral-700">
              Phone
            </label>
            <input
              id="booking-phone"
              type="tel"
              required
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="booking-notes" className="text-sm font-medium text-neutral-700">
              Anything you&apos;d like us to know? (optional)
            </label>
            <textarea
              id="booking-notes"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
            />
          </div>

          {status === "error" && errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}

          <button
            type="submit"
            disabled={status === "sending"}
            className="mt-1 flex items-center justify-center gap-2 rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-60"
          >
            {status === "sending" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Book appointment
          </button>
        </form>
      )}
    </div>
  );
}
