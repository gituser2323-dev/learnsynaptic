import Image from "next/image";
import { bonusesList } from "../data";

export function MentorBonuses() {
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
            <div style={{ fontFamily: "var(--font-display-promo)", fontWeight: 800, fontSize: "clamp(24px, 5vw, 30px)" }}>Pratik Sabale</div>
            <div style={{ color: "var(--ls-primary-light)", fontWeight: 700, fontSize: 15, marginTop: 6 }}>
              Founder · AI Engineer · Software Engineer · Mentor
            </div>
            <p style={{ color: "var(--ink-200)", fontSize: 16, marginTop: 16, maxWidth: 520, lineHeight: 1.6, fontStyle: "italic" }}>
              &quot;I met too many graduates who could explain transformers but had never shipped one. So we built
              the cohort I wish someone had run for me.&quot;
            </p>
            <p style={{ color: "var(--ink-200)", fontSize: 16, marginTop: 12, maxWidth: 520, lineHeight: 1.6 }}>
              No slide decks. No theory-only sessions. Every class ends with code you wrote yourself.
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
            Everything You Need. Nothing You Don&apos;t.
          </h2>
          <p style={{ textAlign: "center", color: "var(--ink-600)", fontSize: 15.5, margin: "0 0 40px" }}>
            Usually sold separately. Included here, free.
          </p>
          <div className="aib-card" style={{ padding: "12px 32px" }}>
            {bonusesList.map((b) => {
              const Icon = b.icon;
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
              <span style={{ flex: 1, fontWeight: 800, fontSize: 16, color: "var(--ink-black)" }}>Estimated Learning Value</span>
              <span style={{ fontFamily: "var(--font-heading-editorial)", fontWeight: 800, fontSize: 20, color: "var(--ink-black)" }}>
                ₹17,500
              </span>
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-400)", padding: "0 0 20px" }}>
              Estimate based on typical market pricing for comparable live cohorts, project reviews and resources —
              shown for context, not a discount claim.
            </div>
          </div>
          <div style={{ textAlign: "center", marginTop: 28, background: "var(--blue-600)", borderRadius: 20, padding: 24, color: "#fff" }}>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", opacity: 0.85 }}>
              Your Price Today
            </div>
            <div style={{ fontFamily: "var(--font-display-promo)", fontWeight: 800, fontSize: 32, marginTop: 4 }}>Free</div>
          </div>
        </div>
      </section>
    </>
  );
}
