"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { buildWorkflows, compareLogos } from "../data";
import { ToolLogo } from "../ToolLogo";

function FadeIn({
  children,
  delay = 0,
  y = 16,
  ...rest
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
} & Omit<React.ComponentProps<typeof motion.div>, "children" | "initial" | "whileInView" | "viewport" | "transition">) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.6 }}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function ProblemAwareness() {
  const [activeId, setActiveId] = useState(buildWorkflows[0].id);
  const active = buildWorkflows.find((w) => w.id === activeId) ?? buildWorkflows[0];

  return (
    <section style={{ background: "var(--white)", padding: "clamp(72px, 14vw, 112px) 6%" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        {/* Headline + supporting copy */}
        <div style={{ textAlign: "center", maxWidth: 720, margin: "0 auto 56px" }}>
          <FadeIn>
            <h2
              style={{
                fontFamily: "var(--font-heading-editorial)",
                fontWeight: 800,
                fontSize: "clamp(28px, 5.5vw, 42px)",
                color: "var(--ink-black)",
                margin: 0,
                lineHeight: 1.2,
                letterSpacing: "-0.01em",
              }}
            >
              Most Analysts
              <br />
              <span style={{ color: "var(--ls-primary)" }}>vs AI-Powered Analysts</span>
            </h2>
          </FadeIn>
          <FadeIn delay={0.1}>
            <p style={{ color: "var(--ink-600)", fontSize: 16.5, lineHeight: 1.65, margin: "20px 0 0" }}>
              Anyone can open ChatGPT. Modern AI engineers solve different problems with different platforms.
              LearnSynaptic teaches you how to choose the right tool for the job — not just how to use one.
            </p>
          </FadeIn>
        </div>

        {/* Most Beginners vs AI Engineers */}
        <div className="aib-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 64 }}>
          <FadeIn y={20}>
            <div
              className="aib-lift-card"
              style={{
                background: "var(--paper)",
                borderRadius: "var(--radius-panel)",
                padding: "40px 36px",
                textAlign: "center",
                height: "100%",
                boxSizing: "border-box",
              }}
            >
              <div
                style={{
                  fontSize: 12.5,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--ink-400)",
                  marginBottom: 24,
                }}
              >
                Most Analysts
              </div>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <ToolLogo id="chatgpt" name="ChatGPT" size={88} radius={20} />
              </div>
              <p style={{ color: "var(--ink-600)", fontSize: 15, margin: "24px 0 0" }}>Uses Excel for everything.</p>
            </div>
          </FadeIn>

          <FadeIn y={20} delay={0.1}>
            <div
              className="aib-lift-card"
              style={{
                background: "#fff",
                border: "2px solid var(--ls-primary)",
                borderRadius: "var(--radius-panel)",
                padding: "40px 36px",
                textAlign: "center",
                height: "100%",
                boxSizing: "border-box",
              }}
            >
              <div
                style={{
                  fontSize: 12.5,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--ls-primary)",
                  marginBottom: 24,
                }}
              >
                AI-Powered Analysts
              </div>
              <div
                className="aib-compare-logo-grid"
                style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 10 }}
              >
                {compareLogos.map((logo) => (
                  <ToolLogo key={logo.toolId} id={logo.toolId} name={logo.name} size={44} radius={12} />
                ))}
              </div>
              <p style={{ color: "var(--ink-black)", fontSize: 15, fontWeight: 600, margin: "22px 0 0" }}>
                Chooses the right tool for the job — SQL for querying, Python for modeling, BI tools for
                stakeholders who won&apos;t read a spreadsheet.
              </p>
            </div>
          </FadeIn>
        </div>

        {/* What do you want to build? */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <FadeIn>
            <h3
              style={{
                fontFamily: "var(--font-heading-editorial)",
                fontWeight: 800,
                fontSize: 26,
                color: "var(--ink-black)",
                margin: 0,
              }}
            >
              What do you want to build?
            </h3>
          </FadeIn>
        </div>

        <FadeIn delay={0.05}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", marginBottom: 36 }}>
            {buildWorkflows.map((w) => (
              <button
                key={w.id}
                onClick={() => setActiveId(w.id)}
                className={`aib-eco-pill${activeId === w.id ? " aib-eco-pill-active" : ""}`}
                style={{ border: "none", cursor: "pointer", borderRadius: 999, padding: "9px 18px", fontSize: 13.5, fontWeight: 700 }}
              >
                {w.label}
              </button>
            ))}
          </div>
        </FadeIn>

        <AnimatePresence mode="wait">
          <motion.div
            key={active.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="aib-eco-tool-grid"
            style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 20, marginBottom: 64 }}
          >
            {active.steps.map((step, i) => (
              <motion.div
                key={`${active.id}-${step.toolId}`}
                className="aib-lift-card"
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.4, delay: i * 0.08, ease: "easeOut" }}
                style={{
                  background: "#fff",
                  border: "1px solid var(--ls-border)",
                  borderRadius: "var(--radius-card)",
                  padding: 24,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                }}
              >
                <ToolLogo id={step.toolId} name={step.name} size={48} radius={14} />
                <div style={{ fontWeight: 800, fontSize: 16, color: "var(--ink-black)", marginTop: 16 }}>
                  {step.name}
                </div>
                <div style={{ fontSize: 12.5, color: "var(--ink-400)", marginTop: 4, lineHeight: 1.5 }}>{step.why}</div>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>

        {/* Closing statement */}
        <FadeIn>
          <div
            style={{
              background: "var(--ink-black)",
              borderRadius: "var(--radius-panel)",
              padding: "56px 48px",
              textAlign: "center",
            }}
          >
            <h3
              style={{
                fontFamily: "var(--font-heading-editorial)",
                fontWeight: 800,
                fontSize: 26,
                color: "#fff",
                margin: "0 auto",
                maxWidth: 640,
                lineHeight: 1.4,
              }}
            >
              The biggest mistake beginners make? <br />
              Trying to learn every AI tool.
            </h3>
            <p style={{ color: "var(--ink-200)", fontSize: 15.5, maxWidth: 560, margin: "20px auto 0", lineHeight: 1.7 }}>
              In our masterclass, you won&apos;t memorize 120 platforms. You&apos;ll learn when to use them, why to use
              them, and how to combine them into real AI workflows.
            </p>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
