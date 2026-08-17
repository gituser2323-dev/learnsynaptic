import { testimonialsList } from "../data";

export function Testimonials() {
  return (
    <section style={{ background: "var(--white)", padding: "90px 6%" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <div style={{ textAlign: "center", maxWidth: 640, margin: "0 auto 48px" }}>
          <h2
            style={{
              fontFamily: "var(--font-heading-editorial)",
              fontWeight: 800,
              fontSize: "clamp(26px, 5vw, 38px)",
              color: "var(--ink-black)",
              margin: "0 0 12px",
            }}
          >
            Students Who Already Made The Jump
          </h2>
          <p style={{ color: "var(--ink-600)", fontSize: 16, margin: 0 }}>
            Real seats, real outcomes — from the 5,000+ who came before you.
          </p>
        </div>
        <div className="aib-2col" style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 24 }}>
          {testimonialsList.map((t, i) => (
            <div
              key={`${t.name}-${i}`}
              className="aib-lift-card"
              style={{
                background: "#fff",
                border: "1px solid var(--ls-border)",
                borderRadius: "var(--radius-card)",
                padding: 36,
                display: "flex",
                flexDirection: "column",
                height: "100%",
                boxSizing: "border-box",
              }}
            >
              <p style={{ color: "var(--ink-black)", fontSize: 15, lineHeight: 1.65, fontStyle: "italic", margin: 0, flex: 1 }}>
                &ldquo;{t.quote}&rdquo;
              </p>
              <div style={{ marginTop: 20, paddingTop: 18, borderTop: "1px solid var(--border-editorial)" }}>
                <div
                  style={{
                    fontFamily: "var(--font-heading-editorial)",
                    fontWeight: 800,
                    fontSize: 15.5,
                    color: "var(--ink-black)",
                  }}
                >
                  {t.name}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                  <span style={{ color: "var(--success)", fontSize: 14 }}>✓</span>
                  <span style={{ fontWeight: 700, fontSize: 13.5, color: "var(--ink-600)" }}>{t.outcome}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
