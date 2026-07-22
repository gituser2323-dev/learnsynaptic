"use client";

import { useState } from "react";
import { faqList } from "../data";
import { useRegisterModal } from "../RegisterModalContext";

export function FaqClosing() {
  const [openIndex, setOpenIndex] = useState<Record<number, boolean>>({});
  const { openRegister } = useRegisterModal();

  return (
    <>
      <section id="faq" style={{ background: "var(--white)", padding: "90px 6%" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <h2
            style={{
              fontFamily: "var(--font-heading-editorial)",
              fontWeight: 800,
              fontSize: 34,
              color: "var(--ink-black)",
              textAlign: "center",
              margin: "0 0 40px",
            }}
          >
            Frequently Asked Questions
          </h2>
          {faqList.map((f, i) => {
            const open = !!openIndex[i];
            return (
              <div key={f.q} style={{ borderBottom: "1px solid var(--border-editorial)", padding: "18px 0" }}>
                <button
                  onClick={() => setOpenIndex((s) => ({ ...s, [i]: !s[i] }))}
                  aria-expanded={open}
                  className="aib-faq-q"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: 16.5,
                    fontWeight: 700,
                    color: "var(--ink-black)",
                  }}
                >
                  {f.q}
                  <span aria-hidden="true">{open ? "−" : "+"}</span>
                </button>
                {open && <p style={{ color: "var(--ink-600)", fontSize: 15, margin: "12px 0 0", lineHeight: 1.6 }}>{f.a}</p>}
              </div>
            );
          })}
        </div>
      </section>

      <section style={{ background: "var(--white)", padding: "80px 6%", textAlign: "center" }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <h2 style={{ fontFamily: "var(--font-heading-editorial)", fontWeight: 800, fontSize: 30, color: "var(--ink-black)", margin: "0 0 16px" }}>
            Why We Cap Every Cohort
          </h2>
          <p style={{ color: "var(--ink-600)", fontSize: 16, lineHeight: 1.6, margin: 0 }}>
            Every project gets reviewed live. Every question gets answered on the spot. That only works in a small
            room — so registration closes once the cohort fills. No countdown gimmicks. Just a simple fact: the
            sooner you join, the sooner Day 1 starts.
          </p>
        </div>
      </section>

      <section style={{ background: "var(--ls-dark)", color: "#fff", padding: "100px 6%", textAlign: "center" }}>
        <h2 style={{ fontFamily: "var(--font-display-promo)", fontWeight: 800, fontSize: "clamp(30px, 6vw, 46px)", margin: "0 0 16px" }}>
          Stop Watching.
          <br />
          <span style={{ color: "var(--ls-primary-light)" }}>Start Shipping.</span>
        </h2>
        <p style={{ color: "var(--ink-200)", fontSize: 17, margin: "0 0 32px" }}>
          Cohort starts July 27. Seats close when it&apos;s full.
        </p>
        <button
          onClick={openRegister}
          className="aib-btn"
          style={{
            background: "linear-gradient(180deg,var(--ls-primary),var(--ls-primary-hover))",
            color: "#fff",
            padding: "20px 44px",
            fontSize: 19,
            boxShadow: "var(--shadow-glow)",
          }}
        >
          Start Building Free
        </button>
        <div style={{ marginTop: 44, color: "var(--ink-400)", fontSize: 14 }}>
          learnsynaptic.com · #AISoftwareEngineeringCohort
        </div>
      </section>
    </>
  );
}
