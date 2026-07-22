"use client";

import { useState } from "react";
import { LoaderCircle, Phone, User, ArrowRight } from "lucide-react";
import { ModalShell } from "./ModalShell";
import { useRegisterModal } from "./RegisterModalContext";
import { isValidIndianMobile } from "@/lib/ai-bootcamp/validation";
import { sendAiBootcampRegistration } from "@/lib/ai-bootcamp/email";

export function RegistrationModal() {
  const { isRegisterOpen, closeRegister, openSuccess } = useRegisterModal();

  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [fullName, setFullName] = useState("");
  const [whatsappError, setWhatsappError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");

  function handleClose() {
    if (status === "sending") return;
    closeRegister();
  }

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
    setStatus("sending");

    try {
      await sendAiBootcampRegistration({ whatsappNumber, fullName });
      openSuccess(fullName);
    } catch (err) {
      console.error(err);
      setStatus("error");
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
        FREE · 7-DAY AI LIVE BOOTCAMP
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
        Enter your WhatsApp number and we&apos;ll send you everything you need for Day 1.
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
              value={whatsappNumber}
              onChange={(e) => {
                setWhatsappNumber(e.target.value);
                if (whatsappError) setWhatsappError(null);
                if (status === "error") setStatus("idle");
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
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="aib-input"
            style={{ paddingLeft: 46 }}
          />
        </div>

        <button
          type="submit"
          disabled={status === "sending"}
          className="aib-btn"
          style={{
            marginTop: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            height: 56,
            background: "linear-gradient(180deg,var(--ls-primary),var(--ls-primary-hover))",
            color: "#fff",
            fontSize: 16,
            boxShadow: "var(--shadow-glow)",
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
          By continuing, you agree to receive bootcamp updates via WhatsApp.
        </p>
      </form>
    </ModalShell>
  );
}
