"use client";

import { MessageCircle } from "lucide-react";
import { ModalShell } from "./ModalShell";
import { useRegisterModal } from "./RegisterModalContext";
import { whatsappBenefitsList } from "./data";
import { AI_BOOTCAMP_WHATSAPP_COMMUNITY_URL } from "@/config/aiBootcamp";

export function SuccessModal() {
  const { isSuccessOpen, closeSuccess } = useRegisterModal();

  return (
    <ModalShell open={isSuccessOpen} onClose={closeSuccess} maxWidth={480}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 52 }}>🎉</div>
        <h2
          style={{
            fontFamily: "var(--font-display-promo)",
            fontWeight: 800,
            fontSize: 28,
            margin: "16px 0 8px",
          }}
        >
          Registration Successful!
        </h2>
        <p style={{ color: "var(--ink-200)", fontSize: 15.5, lineHeight: 1.6, margin: 0 }}>
          Welcome to the 7-Day AI Engineering Bootcamp.
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
        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>One Last Step</div>
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
        <a
          href={AI_BOOTCAMP_WHATSAPP_COMMUNITY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="aib-btn"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            height: 56,
            background: "var(--success)",
            color: "#fff",
            fontSize: 16,
            textDecoration: "none",
          }}
        >
          <MessageCircle size={18} />
          Join WhatsApp Community
        </a>

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
