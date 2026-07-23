"use client";

import Image from "next/image";
import { bonusIcons } from "../data";
import { useLanguage } from "../LanguageContext";

export function MentorBonuses() {
  const { t } = useLanguage();

  return (
    <>
      <section id="mentor" style={{ background: "var(--ls-dark)", color: "#fff", padding: "90px 6%" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", gap: 40, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative", width: 160, height: 160, borderRadius: "50%", overflow: "hidden", flexShrink: 0 }}>
            <Image
              src="/bootcamplogos/me.png"
              alt="Pratik Sabale, Founder"
              fill
              sizes="160px"
              style={{ objectFit: "cover" }}
            />
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-display-promo)", fontWeight: 800, fontSize: "clamp(24px, 5vw, 30px)" }}>
              {t.bonuses.founderName}
            </div>
            <div style={{ color: "var(--ls-primary-light)", fontWeight: 700, fontSize: 15, marginTop: 6 }}>
              {t.bonuses.founderTitle}
            </div>
            <p style={{ color: "var(--ink-200)", fontSize: 16, marginTop: 16, maxWidth: 520, lineHeight: 1.6, fontStyle: "italic" }}>
              {t.bonuses.quote}
            </p>
            <p style={{ color: "var(--ink-200)", fontSize: 16, marginTop: 12, maxWidth: 520, lineHeight: 1.6 }}>
              {t.bonuses.body}
            </p>
          </div>
        </div>
      </section>

      <section style={{ background: "var(--paper)", padding: "90px 6%" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <h2
            style={{
              fontFamily: "var(--font-heading-editorial)",
              fontWeight: 800,
              fontSize: 34,
              color: "var(--ink-black)",
              textAlign: "center",
              margin: "0 0 8px",
            }}
          >
            {t.bonuses.headline}
          </h2>
          <p style={{ textAlign: "center", color: "var(--ink-600)", fontSize: 15.5, margin: "0 0 40px" }}>
            {t.bonuses.subcopy}
          </p>
          <div className="aig-card" style={{ padding: "12px 32px" }}>
            {t.bonuses.items.map((b, i) => {
              const Icon = bonusIcons[i];
              return (
                <div
                  key={b.text}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    padding: "16px 0",
                    borderBottom: "1px solid var(--border-editorial)",
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 12,
                      background: "var(--icon-tile-bg)",
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon size={18} color="var(--blue-600)" />
                  </div>
                  <span style={{ flex: 1, fontWeight: 700, fontSize: 15.5 }}>{b.text}</span>
                  <span style={{ fontFamily: "var(--font-heading-editorial)", fontWeight: 700, fontSize: 15, color: "var(--ink-400)" }}>
                    {b.value}
                  </span>
                </div>
              );
            })}
            <div style={{ display: "flex", alignItems: "center", padding: "20px 0 4px" }}>
              <span style={{ flex: 1, fontWeight: 800, fontSize: 16, color: "var(--ink-black)" }}>{t.bonuses.totalLabel}</span>
              <span style={{ fontFamily: "var(--font-heading-editorial)", fontWeight: 800, fontSize: 20, color: "var(--ink-black)" }}>
                {t.bonuses.totalValue}
              </span>
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-400)", padding: "0 0 20px" }}>{t.bonuses.disclaimer}</div>
          </div>
          <div style={{ textAlign: "center", marginTop: 28, background: "var(--blue-600)", borderRadius: 20, padding: 24, color: "#fff" }}>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", opacity: 0.85 }}>
              {t.bonuses.priceLabel}
            </div>
            <div style={{ fontFamily: "var(--font-display-promo)", fontWeight: 800, fontSize: 32, marginTop: 4 }}>
              {t.bonuses.priceValue}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
