"use client";

import { useState } from "react";
import { submitLead } from "@/lib/services/leads/client";
import { analytics, getAttribution } from "@/lib/services/analytics";
import type { CreateLeadInput, LeadUtmParams } from "@/lib/services/leads";

/**
 * RC-1 stabilization: the one shared submission flow every lead-capture
 * form on the marketing site now goes through. Before this, seven forms
 * each hand-rolled their own EmailJS call + status state machine, and
 * six of the seven never reached the backend at all — EmailJS was
 * simultaneously the primary action AND the only record that a
 * submission ever happened. Neither was true of the CRM.
 *
 * The fix is a reordering, not a redesign: `submitLead()` (POST
 * /api/leads — CreateLead → CRM persistence → lead.created event →
 * Automation Engine trigger → audit log, all pre-existing, all
 * unchanged) is now the PRIMARY, AWAITED call that decides the visitor-
 * facing success/error state. Each form's existing EmailJS notification
 * (still whatever template/payload it always used) becomes a secondary,
 * best-effort side effect — attempted after a successful backend write,
 * never awaited by the UI, its failure only logged. If EmailJS is down,
 * the lead is still safely in the CRM; if the CRM write fails, the
 * visitor sees a real error instead of a false "success" that silently
 * lost their submission.
 */
export type LeadCaptureStatus = "idle" | "sending" | "success" | "error";

export interface LeadCaptureSubmitOptions {
  lead: CreateLeadInput;
  /** Each form keeps whichever standard event it already used — 'Lead'
   *  for a general inquiry, 'CompleteRegistration' for a form that
   *  represents a completed program registration. Not unified: these
   *  are two legitimately different funnel-stage signals for GA4/Meta
   *  Pixel, not an inconsistency to collapse into one name. */
  analyticsEvent: "Lead" | "CompleteRegistration";
  analyticsParams?: Record<string, string | number | boolean | undefined>;
  /** The form's own existing notification call (EmailJS, etc.) — always
   *  attempted after a successful backend write, never awaited by the
   *  returned status. A failure here is logged, not surfaced. */
  notify?: () => Promise<unknown>;
}

export interface LeadCaptureSubmitResult {
  success: boolean;
  leadId?: string;
  errorMessage?: string;
}

/** Reads the UTM/click-id attribution cookie the same way LeadForm.tsx
 *  always has — now available to every form, not just one. */
export function buildLeadUtm(): LeadUtmParams | undefined {
  const attribution = getAttribution();
  if (!attribution) return undefined;
  const { utm_source, utm_medium, utm_campaign, utm_content, utm_term } = attribution.last;
  if (!utm_source && !utm_medium && !utm_campaign && !utm_content && !utm_term) return undefined;
  return {
    utmSource: utm_source,
    utmMedium: utm_medium,
    utmCampaign: utm_campaign,
    utmContent: utm_content,
    utmTerm: utm_term,
  };
}

export function useLeadCapture() {
  const [status, setStatus] = useState<LeadCaptureStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function submit({
    lead,
    analyticsEvent,
    analyticsParams,
    notify,
  }: LeadCaptureSubmitOptions): Promise<LeadCaptureSubmitResult> {
    setStatus("sending");
    setErrorMessage(null);

    const input: CreateLeadInput = { ...lead, utm: lead.utm ?? buildLeadUtm() };

    let result: Awaited<ReturnType<typeof submitLead>> | null = null;
    try {
      result = await submitLead(input);
    } catch (err) {
      console.error("[useLeadCapture] /api/leads request failed:", err);
    }

    if (!result || !result.success) {
      const message = result && !result.success
        ? (result.errors[0]?.message ?? "Something went wrong. Please try again.")
        : "Could not reach the server. Please check your connection and try again.";
      setStatus("error");
      setErrorMessage(message);
      // Best-effort safety net: even if the CRM write failed, still try
      // to notify so the inquiry isn't silently lost twice over.
      void notify?.().catch((err) => console.error("[useLeadCapture] notify() failed:", err));
      return { success: false, errorMessage: message };
    }

    analytics.track(analyticsEvent, analyticsParams);
    void notify?.().catch((err) => console.error("[useLeadCapture] notify() failed:", err));
    setStatus("success");
    return { success: true, leadId: result.lead.id };
  }

  return { status, errorMessage, submit, reset: () => setStatus("idle") };
}
