"use client";

import { awarenessIcons } from "../data";
import { useLanguage } from "../LanguageContext";

export function AwarenessCards() {
  const { t } = useLanguage();

  return (
    <section style={{ background: "var(--white)", padding: "96px 6%" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <div style={{ textAlign: "center", maxWidth: 760, margin: "0 auto 64px" }}>
          <h2
            style={{
              fontFamily: "var(--font-heading-editorial)",
              fontWeight: 800,
              fontSize: "clamp(28px, 5.5vw, 56px)",
              lineHeight: 1.08,
              color: "var(--ink-black)",
              margin: 0,
              letterSpacing: "-0.02em",
            }}
          >
            {t.awareness.headline}
          </h2>
        </div>
        <div className="aig-3col" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 32 }}>
          {t.awareness.items.map((item, i) => {
            const Icon = awarenessIcons[i];
            return (
              <div
                key={item.headline}
                className="aig-sf-card"
                style={{
                  background: "var(--white)",
                  borderRadius: 22,
                  padding: "44px 36px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  height: "100%",
                  boxSizing: "border-box",
                  border: "1px solid rgba(15,23,42,0.06)",
                  boxShadow: "0 20px 40px rgba(15,23,42,0.05)",
                }}
              >
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: "50%",
                    background: "var(--icon-tile-bg)",
                    boxShadow: "0 0 0 8px rgba(22,93,252,0.05)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon size={28} color="var(--blue-600)" />
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-heading-editorial)",
                    fontWeight: 800,
                    fontSize: 21,
                    color: "var(--ink-black)",
                    marginTop: 24,
                    lineHeight: 1.3,
                  }}
                >
                  {item.headline}
                </div>
                <p style={{ color: "var(--ink-600)", fontSize: 15.5, lineHeight: 1.6, margin: "12px 0 0" }}>
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
