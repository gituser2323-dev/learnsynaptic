"use client";

import { ModalShell } from "./ModalShell";
import { useRegisterModal } from "./RegisterModalContext";
import { WhatsAppIcon } from "./WhatsAppIcon";
import { whatsappBenefitsList } from "./data";
import { AI_FULLSTACK_WHATSAPP_COMMUNITY_URL } from "@/config/aiFullStackEngineering";

export function SuccessModal() {
  const { isSuccessOpen, closeSuccess, registeredName } = useRegisterModal();
  const firstName = registeredName.trim().split(/\s+/)[0];

  return (
    <ModalShell open={isSuccessOpen} onClose={closeSuccess} maxWidth={480}>
      <div style={{ textAlign: "center" }}>
        <h2
          style={{
            fontFamily: "var(--font-display-promo)",
            fontWeight: 800,
            fontSize: 28,
            margin: "16px 0 8px",
          }}
        >
          {firstName ? `✅ You're In, ${firstName}!` : "✅ Registration Successful"}
        </h2>
        <p style={{ color: "var(--ink-200)", fontSize: 15.5, lineHeight: 1.6, margin: 0 }}>
          You&apos;re all set!
        </p>
      </div>

      <div
        style={{
          marginTop: 28,
          background: "rgba(22,93,252,0.08)",
          border: "1px solid var(--border-promo)",
          borderRadius: 20,
          padding: 24,
          textAlign: "left",
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>Next Step</div>
        <p style={{ color: "var(--ink-200)", fontSize: 13.5, lineHeight: 1.6, margin: "0 0 16px" }}>
          Join our WhatsApp Community to receive:
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {whatsappBenefitsList.map((w) => (
            <div key={w.text} style={{ fontSize: 14, color: "var(--ink-200)" }}>
              ✓ {w.text}
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 12 }}>
      

        <button
          onClick={closeSuccess}
          className="aib-btn"
          style={{
            height: 48,
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.15)",
            color: "var(--ink-200)",
            fontSize: 14.5,
          }}
        >
          Maybe Later
        </button>
      </div>
    </ModalShell>
  );
}
