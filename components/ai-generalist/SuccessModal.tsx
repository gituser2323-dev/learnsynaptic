"use client";

import { ModalShell } from "./ModalShell";
import { useRegisterModal } from "./RegisterModalContext";
import { useLanguage } from "./LanguageContext";
import { WhatsAppIcon } from "./WhatsAppIcon";
import { AI_BOOTCAMP_WHATSAPP_COMMUNITY_URL } from "@/config/aiBootcamp";

export function SuccessModal() {
  const { isSuccessOpen, closeSuccess, registeredName } = useRegisterModal();
  const { t } = useLanguage();
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
          {firstName ? `✅ ${t.success.greetingPrefix} ${firstName}!` : `✅ ${t.success.greetingFallback}`}
        </h2>
        <p style={{ color: "var(--ink-200)", fontSize: 15.5, lineHeight: 1.6, margin: 0 }}>{t.success.welcome}</p>
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
        <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>{t.success.lastStepTitle}</div>
        <p style={{ color: "var(--ink-200)", fontSize: 13.5, lineHeight: 1.6, margin: "0 0 16px" }}>
          {t.success.lastStepBody}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {t.success.benefits.map((benefit) => (
            <div key={benefit} style={{ fontSize: 14, color: "var(--ink-200)" }}>
              ✓ {benefit}
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 12 }}>
        <a
          href={AI_BOOTCAMP_WHATSAPP_COMMUNITY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="aig-btn aig-btn-whatsapp"
          style={{ height: 56, fontSize: 16 }}
        >
          {t.success.joinCta}
        </a>

        <button
          onClick={closeSuccess}
          className="aig-btn"
          style={{
            height: 48,
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.15)",
            color: "var(--ink-200)",
            fontSize: 14.5,
          }}
        >
          {t.success.laterCta}
        </button>
      </div>
    </ModalShell>
  );
}
