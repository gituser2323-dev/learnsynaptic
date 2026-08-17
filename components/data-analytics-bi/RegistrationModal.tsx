"use client";

import { useState } from "react";
import { LoaderCircle, Phone, User, ArrowRight } from "lucide-react";
import { ModalShell } from "./ModalShell";
import { useRegisterModal } from "./RegisterModalContext";
import { WhatsAppIcon } from "./WhatsAppIcon";
import { isValidIndianMobile, normalizeIndianMobile } from "@/lib/data-analytics-bi/validation";
import { sendDataAnalyticsRegistration } from "@/lib/data-analytics-bi/email";
import { DATAANALYTICS_WHATSAPP_COMMUNITY_URL } from "@/config/dataAnalyticsBi";
import { useLeadCapture } from "@/components/lead-capture/useLeadCapture";
import { syntheticEmailFromPhone } from "@/lib/services/leads/phoneOnlyEmail";

export function RegistrationModal() {
  const { isRegisterOpen, closeRegister, openSuccess } = useRegisterModal();

  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [fullName, setFullName] = useState("");
  const [whatsappError, setWhatsappError] = useState<string | null>(null);
  const { status, submit, reset } = useLeadCapture();

  function handleClose() {
    if (status === "sending") return;
    closeRegister();
  }

  /* RC-1: this modal is a deliberately WhatsApp-number-only funnel — no
   * email field, by product design (see phoneOnlyEmail.ts for why a
   * synthesized placeholder is used rather than adding one). /api/leads
   * is now the primary, awaited call; the existing EmailJS-backed
   * sendDataAnalyticsRegistration() becomes a best-effort secondary
   * notification. */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "sending") return;

    if (!whatsappNumber.trim()) {
      setWhatsappError("WhatsApp number is required.");
      return;
    }
    if (!isValidIndianMobile(whatsappNumber)) {
      setWhatsappError("Enter a valid Indian mobile number.");
      return;
    }
    setWhatsappError(null);

    const normalizedPhone = normalizeIndianMobile(whatsappNumber);
    const result = await submit({
      lead: {
        name: fullName || "Not provided",
        email: syntheticEmailFromPhone(normalizedPhone),
        phone: normalizedPhone,
        program: "2-Hour Data Analytics & BI Masterclass",
        source: "data-analytics-bi-modal",
      },
      analyticsEvent: "CompleteRegistration",
      analyticsParams: { formName: "DataAnalyticsRegistration" },
      notify: () => sendDataAnalyticsRegistration({ whatsappNumber, fullName }),
    });

    if (result.success) {
      openSuccess(fullName);
    }
  }

  return (
    <ModalShell open={isRegisterOpen} onClose={handleClose}>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          border: "1px solid var(--border-promo)",
          borderRadius: 999,
          padding: "8px 16px",
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.04em",
        }}
      >
        <span className="aib-live-dot" style={{ backgroundColor: "rgb(0, 213, 27)" }} />
        FREE · 2-HOUR LIVE AI MASTERCLASS
      </span>

      <h2
        style={{
          fontFamily: "var(--font-heading-editorial)",
          fontWeight: 800,
          fontSize: 28,
          lineHeight: 1.2,
          margin: "18px 0 8px",
          letterSpacing: "-0.01em",
        }}
      >
        Claim My <span style={{ color: "var(--ls-primary-light)" }}>Free Seat</span>
      </h2>
      <p style={{ color: "var(--ink-200)", fontSize: 14.5, lineHeight: 1.6, margin: "0 0 28px" }}>
        Enter your WhatsApp number and we&apos;ll send you everything you need for the session.
      </p>

      <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <div style={{ position: "relative" }}>
            <Phone
              size={18}
              style={{
                position: "absolute",
                left: 16,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--ink-400)",
                pointerEvents: "none",
              }}
            />
            <input
              type="tel"
              inputMode="numeric"
              placeholder="WhatsApp Number *"
              aria-label="WhatsApp Number"
              value={whatsappNumber}
              onChange={(e) => {
                setWhatsappNumber(e.target.value);
                if (whatsappError) setWhatsappError(null);
                if (status === "error") reset();
              }}
              className={`aib-input${whatsappError ? " aib-input-error" : ""}`}
              style={{ paddingLeft: 46 }}
              aria-invalid={!!whatsappError}
              aria-describedby={whatsappError ? "whatsapp-error" : undefined}
            />
          </div>
          {whatsappError && (
            <p id="whatsapp-error" style={{ color: "var(--danger-on-dark)", fontSize: 12.5, margin: "6px 0 0" }}>
              {whatsappError}
            </p>
          )}
        </div>

        <div style={{ position: "relative" }}>
          <User
            size={18}
            style={{
              position: "absolute",
              left: 16,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--ink-400)",
              pointerEvents: "none",
            }}
          />
          <input
            type="text"
            placeholder="Full Name (optional)"
            aria-label="Full Name (optional)"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="aib-input"
            style={{ paddingLeft: 46 }}
          />
        </div>

        <button
          type="submit"
          disabled={status === "sending"}
          className="aib-btn aib-btn-primary"
          style={{
            marginTop: 8,
            height: 56,
            fontSize: 16,
          }}
        >
          {status === "sending" ? (
            <>
              <LoaderCircle size={18} className="animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              Claim My Free Seat
              <ArrowRight size={18} />
            </>
          )}
        </button>

        {status === "error" && (
          <p style={{ textAlign: "center", fontSize: 13, color: "var(--danger-on-dark)", margin: 0 }}>
            Something went wrong sending your registration. Please try again — your details are still filled in.
          </p>
        )}

        <p style={{ textAlign: "center", fontSize: 11.5, color: "var(--ink-400)", lineHeight: 1.5, margin: 0 }}>
          By continuing, you agree to receive masterclass updates via WhatsApp.
        </p>
      </form>

      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "24px 0" }}>
        <span style={{ flex: 1, height: 1, background: "var(--border-promo)" }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-400)" }}>OR</span>
        <span style={{ flex: 1, height: 1, background: "var(--border-promo)" }} />
      </div>

    
    </ModalShell>
  );
}
