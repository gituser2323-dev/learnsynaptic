"use client";

import { Fragment, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { buildWorkflows } from "../data";
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
      viewport={{ once: true, amount: 0.7 }}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

function TimelineRow({ text, index, tone }: { text: string; index: number; tone: "muted" | "bold" }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -14 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, amount: 0.85 }}
      transition={{ duration: 0.45, delay: index * 0.14, ease: "easeOut" }}
      style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, padding: "8px 0" }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          flexShrink: 0,
          background: tone === "muted" ? "var(--ink-200)" : "var(--ls-primary)",
          boxShadow: tone === "bold" ? "0 0 10px rgba(22,93,252,0.5)" : "none",
        }}
      />
      <span
        style={{
          fontSize: tone === "muted" ? 17 : 19,
          fontWeight: tone === "muted" ? 500 : 700,
          color: tone === "muted" ? "var(--ink-400)" : "var(--ink-black)",
        }}
      >
        {text}
      </span>
    </motion.div>
  );
}

export function ProblemAwareness() {
  const [activeId, setActiveId] = useState(buildWorkflows[0].id);
  const active = buildWorkflows.find((w) => w.id === activeId) ?? buildWorkflows[0];

  return (
    <>
      {/* ACT 1 — Realization */}
      <section style={{ background: "var(--ls-dark)", color: "#fff", padding: "96px 6% clamp(80px, 16vw, 128px)", position: "relative", overflow: "hidden" }}>
        <div
          style={{
            position: "absolute",
            top: -40,
            left: "50%",
            transform: "translateX(-50%)",
            width: 560,
            height: 320,
            background: "radial-gradient(ellipse, rgba(22,93,252,0.18), transparent 70%)",
            pointerEvents: "none",
          }}
        />
        <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center", position: "relative" }}>
          <FadeIn delay={0}>
            <span
              style={{
                display: "inline-flex",
                border: "1px solid var(--border-promo)",
                borderRadius: 999,
                padding: "8px 16px",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--ls-primary-light)",
              }}
            >
              The Mistake
            </span>
          </FadeIn>

          <FadeIn delay={0.35}>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontWeight: 600,
                fontSize: "clamp(18px, 4vw, 26px)",
                color: "var(--ink-400)",
                margin: "32px 0 0",
                lineHeight: 1.45,
              }}
            >
              Most people think learning AI means learning ChatGPT.
            </p>
          </FadeIn>

          <FadeIn delay={0.85}>
            <h2
              style={{
                fontFamily: "var(--font-heading-editorial)",
                fontWeight: 800,
                fontSize: "clamp(26px, 5.5vw, 42px)",
                color: "#fff",
                margin: "28px 0 0",
                lineHeight: 1.2,
                letterSpacing: "-0.01em",
              }}
            >
              Professional AI engineers don&apos;t learn one AI.
            </h2>
          </FadeIn>

          <FadeIn delay={1.35}>
            <h2
              style={{
                fontFamily: "var(--font-heading-editorial)",
                fontWeight: 800,
                fontSize: "clamp(32px, 7vw, 58px)",
                color: "var(--ls-primary-light)",
                margin: "16px 0 0",
                lineHeight: 1.12,
                letterSpacing: "-0.02em",
              }}
            >
              They learn AI systems.
            </h2>
          </FadeIn>
        </div>
      </section>

      {/* ACT 2 — Identity shift */}
      <section style={{ background: "#fff", padding: "clamp(72px, 16vw, 128px) 6%" }}>
        <div style={{ maxWidth: 560, margin: "0 auto", textAlign: "center" }}>
          <FadeIn>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--ink-400)",
              }}
            >
              Traditional Developer
            </div>
          </FadeIn>

          <div style={{ marginTop: 20 }}>
            {["Writes code manually", "Uses one AI", "Works alone"].map((text, i) => (
              <TimelineRow key={text} text={text} index={i} tone="muted" />
            ))}
          </div>

          <FadeIn y={0} delay={0.1}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, margin: "36px 0" }}>
              <div
                style={{
                  width: 2,
                  height: 28,
                  background: "linear-gradient(180deg, var(--ink-200), var(--ls-primary))",
                }}
              />
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--ls-primary)",
                }}
              >
                becomes
              </div>
              <div
                style={{
                  width: 2,
                  height: 28,
                  background: "var(--ls-primary)",
                }}
              />
            </div>
          </FadeIn>

          <FadeIn delay={0.15}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--ls-primary)",
              }}
            >
              AI Engineer
            </div>
          </FadeIn>

          <div style={{ marginTop: 20 }}>
            <TimelineRow text="Designs workflows" index={0} tone="bold" />
            <TimelineRow text="Uses multiple AI tools" index={1} tone="bold" />
            <motion.div
              initial={{ opacity: 0, x: -14 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.85 }}
              transition={{ duration: 0.45, delay: 0.28, ease: "easeOut" }}
              style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 14, padding: "8px 0" }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  flexShrink: 0,
                  alignSelf: "center",
                  background: "var(--ls-primary)",
                  boxShadow: "0 0 10px rgba(22,93,252,0.5)",
                }}
              />
              <span style={{ fontSize: 19, fontWeight: 700, color: "var(--ink-black)" }}>
                Ships{" "}
                <span style={{ fontSize: 30, fontWeight: 800, color: "var(--ls-primary)" }}>10×</span> faster
              </span>
            </motion.div>
          </div>

          <FadeIn delay={0.5}>
            <p style={{ fontSize: 14.5, color: "var(--ink-400)", fontStyle: "italic", margin: "40px 0 0" }}>
              This is who you&apos;re becoming.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ACT 3 — Interactive moment */}
      <section style={{ background: "var(--paper)", padding: "clamp(64px, 14vw, 112px) 6%" }}>
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          <div style={{ textAlign: "center", maxWidth: 640, margin: "0 auto 40px" }}>
            <FadeIn>
              <h3
                style={{
                  fontFamily: "var(--font-heading-editorial)",
                  fontWeight: 800,
                  fontSize: 34,
                  color: "var(--ink-black)",
                  margin: 0,
                  letterSpacing: "-0.01em",
                }}
              >
                What do you want to build?
              </h3>
            </FadeIn>
            <FadeIn delay={0.1}>
              <p style={{ color: "var(--ink-600)", fontSize: 15.5, lineHeight: 1.6, margin: "14px 0 0" }}>
                Pick a goal. Watch the workflow reveal itself — and why every tool in it earns its place.
              </p>
            </FadeIn>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", marginBottom: 36 }}>
            {buildWorkflows.map((w) => (
              <button
                key={w.id}
                onClick={() => setActiveId(w.id)}
                className={`aib-eco-pill${activeId === w.id ? " aib-eco-pill-active" : ""}`}
                style={{ border: "none", cursor: "pointer", borderRadius: 999, padding: "10px 20px", fontSize: 13.5, fontWeight: 700 }}
              >
                {w.label}
              </button>
            ))}
          </div>

          <div
            className="aib-flow-canvas"
            style={{
              position: "relative",
              background: "#fff",
              border: "1px solid var(--ls-border)",
              borderRadius: "var(--radius-panel)",
              padding: "48px 24px",
              overflow: "hidden",
            }}
          >
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage: "radial-gradient(circle, rgba(15,23,42,0.055) 1px, transparent 1px)",
                backgroundSize: "22px 22px",
                pointerEvents: "none",
              }}
            />
            <AnimatePresence mode="wait">
              <motion.div
                key={active.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="aib-flow-wrap"
                style={{ position: "relative" }}
              >
                {active.steps.map((step, i) => (
                  <Fragment key={`${active.id}-${step.toolId}-${i}`}>
                    <motion.div
                      className="aib-flow-node"
                      initial={{ opacity: 0, y: 16, scale: 0.94 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.4, delay: i * 0.13, ease: "easeOut" }}
                      style={{
                        width: 184,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        textAlign: "center",
                        background: "#fff",
                        border: "1px solid var(--ls-border)",
                        borderRadius: "var(--radius-card)",
                        padding: "22px 16px",
                        boxShadow: "0 1px 2px rgba(10,10,14,0.04)",
                      }}
                    >
                      <ToolLogo id={step.toolId} name={step.name} size={52} radius={14} />
                      <div style={{ fontWeight: 800, fontSize: 15, color: "var(--ink-black)", marginTop: 14 }}>
                        {step.name}
                      </div>
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.13 + 0.22, duration: 0.4 }}
                        style={{ fontSize: 12.5, color: "var(--ink-400)", lineHeight: 1.5, margin: "8px 0 0" }}
                      >
                        {step.why}
                      </motion.p>
                    </motion.div>
                    {i < active.steps.length - 1 && (
                      <motion.div
                        className="aib-flow-arrow"
                        initial={{ opacity: 0, scale: 0.6 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.13 + 0.12, duration: 0.3 }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 36,
                          height: 52,
                          marginTop: 22,
                          flexShrink: 0,
                          color: "var(--blue-600)",
                        }}
                      >
                        <ArrowRight size={20} strokeWidth={2.5} />
                      </motion.div>
                    )}
                  </Fragment>
                ))}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* ACT 4 — Mindset shift */}
      <section style={{ background: "var(--ls-dark)", color: "#fff", padding: "clamp(80px, 17vw, 136px) 6%", position: "relative", overflow: "hidden" }}>
        <div
          style={{
            position: "absolute",
            bottom: -160,
            right: "10%",
            width: 480,
            height: 360,
            background: "radial-gradient(ellipse, rgba(22,93,252,0.16), transparent 70%)",
            pointerEvents: "none",
          }}
        />
        <div style={{ maxWidth: 860, margin: "0 auto", textAlign: "center", position: "relative" }}>
          <FadeIn>
            <h2
              style={{
                fontFamily: "var(--font-heading-editorial)",
                fontWeight: 800,
                fontSize: "clamp(28px, 6vw, 46px)",
                color: "#fff",
                margin: 0,
                lineHeight: 1.2,
                letterSpacing: "-0.01em",
              }}
            >
              The future belongs to engineers who know{" "}
              <span style={{ color: "var(--ls-primary-light)" }}>which</span> AI to use.
            </h2>
          </FadeIn>
          <FadeIn delay={0.35}>
            <p
              style={{
                fontSize: 19,
                color: "var(--ink-200)",
                margin: "28px 0 0",
                lineHeight: 1.65,
                maxWidth: 640,
                marginLeft: "auto",
                marginRight: "auto",
              }}
            >
              AI isn&apos;t replacing developers. Developers using AI are replacing developers who don&apos;t.
            </p>
          </FadeIn>
        </div>
      </section>
    </>

);
}
