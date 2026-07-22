import { audiencesList, problemsList, solutionsList } from "../data";

export function AudienceComparison() {
  return (
    <>
      <section style={{ background: "var(--paper)", padding: "100px 6% 96px" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <div style={{ textAlign: "center", maxWidth: 640, margin: "0 auto 56px" }}>
            <h3
              style={{
                fontFamily: "var(--font-heading-editorial)",
                fontWeight: 800,
                lineHeight: 1.2,
                margin: "0.5rem 0 1rem",
                fontSize: "clamp(28px, 5.5vw, 42px)",
                letterSpacing: "-0.01em",
              }}
            >
              <span style={{ color: "var(--ink-black)" }}>Who is this </span>
              <span style={{ color: "var(--ls-primary)" }}>Bootcamp&nbsp;</span>
              <span style={{ color: "var(--ink-black)" }}>for?</span>
            </h3>
          </div>
          <div className="aib-2col" style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 24 }}>
            {audiencesList.map((a) => {
              const Icon = a.icon;
              return (
                <div
                  key={a.headline}
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
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 14,
                      background: "var(--icon-tile-bg)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon size={24} color="var(--blue-600)" />
                  </div>
                  <div style={{ color: "var(--ink-400)", fontSize: 13, fontWeight: 700, marginTop: 20 }}>{a.label}</div>
                  <div
                    style={{
                      fontFamily: "var(--font-heading-editorial)",
                      fontWeight: 800,
                      fontSize: 21,
                      color: "var(--ink-black)",
                      marginTop: 8,
                      lineHeight: 1.25,
                    }}
                  >
                    {a.headline}
                  </div>
                  <p style={{ color: "var(--ink-600)", fontSize: 14.5, lineHeight: 1.6, margin: "12px 0 0", flex: 1 }}>
                    {a.description}
                  </p>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginTop: 20,
                      paddingTop: 18,
                      borderTop: "1px solid var(--border-editorial)",
                    }}
                  >
                    <span style={{ color: "var(--success)", fontSize: 15 }}>✓</span>
                    <span style={{ fontWeight: 700, fontSize: 14, color: "var(--ink-black)" }}>{a.outcome}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section style={{ background: "var(--paper)", padding: "90px 6%" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <h2
            style={{
              fontFamily: "var(--font-heading-editorial)",
              fontWeight: 800,
              fontSize: "clamp(26px, 5vw, 38px)",
              color: "var(--ink-black)",
              textAlign: "center",
              margin: "0 0 48px",
            }}
          >
            You&apos;ve Been Taught AI Backwards.
          </h2>
          <div className="aib-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            <div className="aib-card" style={{ padding: 32 }}>
              <div
                style={{
                  fontWeight: 800,
                  fontSize: 16,
                  color: "var(--ink-400)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: 18,
                }}
              >
                Traditional Learning
              </div>
              {problemsList.map((item) => (
                <div key={item.text} style={{ display: "flex", gap: 10, padding: "8px 0", color: "var(--ink-600)", fontSize: 15 }}>
                  <span style={{ color: "var(--danger)" }}>✕</span>
                  {item.text}
                </div>
              ))}
            </div>
            <div className="aib-card" style={{ padding: 32, border: "2px solid var(--blue-600)" }}>
              <div
                style={{
                  fontWeight: 800,
                  fontSize: 16,
                  color: "var(--blue-600)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: 18,
                }}
              >
                LearnSynaptic
              </div>
              {solutionsList.map((item) => (
                <div
                  key={item.text}
                  style={{ display: "flex", gap: 10, padding: "8px 0", color: "var(--ink-black)", fontSize: 15, fontWeight: 600 }}
                >
                  <span style={{ color: "var(--success)" }}>✓</span>
                  {item.text}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
