"use client";

import { useState } from "react";
import { Bot } from "lucide-react";
import { daysData } from "../data";

export function ProjectsCurriculum() {
  const [activeDay, setActiveDay] = useState(1);
  const activeDayData = daysData.find((d) => d.day === activeDay) ?? daysData[0];

  return (
    <>
      <section id="projects" style={{ background: "var(--white)", padding: "90px 6%" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <h2
            style={{
              fontFamily: "var(--font-heading-editorial)",
              fontWeight: 800,
              fontSize: "clamp(26px, 5vw, 38px)",
              color: "var(--ink-black)",
              textAlign: "center",
              margin: "0 0 12px",
            }}
          >
            Live Build. Zero Simulations.
          </h2>
          <p style={{ textAlign: "center", color: "var(--ink-600)", fontSize: 17, margin: "0 0 48px" }}>
            Built with you, working, and yours to keep.
          </p>
          <div style={{ maxWidth: 360, margin: "0 auto" }}>
            <div className="aib-card aib-lift-card" style={{ padding: 32, textAlign: "center" }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  background: "var(--icon-tile-bg)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto",
                }}
              >
                <Bot size={26} color="var(--blue-600)" />
              </div>
              <div style={{ fontWeight: 700, fontSize: 18, marginTop: 18 }}>{daysData[0].project}</div>
            </div>
          </div>
        </div>
      </section>

      <section id="curriculum" style={{ background: "var(--paper)", padding: "90px 6%" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
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
            What You&apos;ll Build, Live.
          </h2>
          <div className="aib-day-grid" style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 32 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {daysData.map((d) => {
                const active = d.day === activeDay;
                return (
                  <button
                    key={d.day}
                    onClick={() => setActiveDay(d.day)}
                    className="aib-day-btn"
                    style={{
                      padding: "14px 18px",
                      borderRadius: 12,
                      fontSize: 14.5,
                      fontWeight: 700,
                      width: "100%",
                      background: active ? "var(--blue-600)" : "#fff",
                      color: active ? "#fff" : "var(--ink-black)",
                      boxShadow: active ? "none" : "var(--shadow-card)",
                    }}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
            <div className="aib-card" style={{ padding: 36 }}>
              <div
                style={{
                  color: "var(--blue-600)",
                  fontWeight: 800,
                  fontSize: 14,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: 8,
                }}
              >
                {activeDayData.label}
              </div>
              <h3 style={{ fontFamily: "var(--font-heading-editorial)", fontWeight: 800, fontSize: 26, margin: "0 0 24px" }}>
                {activeDayData.project}
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-400)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Problem
                  </div>
                  <div style={{ fontSize: 16, color: "var(--ink-black)", marginTop: 4 }}>{activeDayData.problem}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-400)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Solution
                  </div>
                  <div style={{ fontSize: 16, color: "var(--ink-black)", marginTop: 4 }}>{activeDayData.solution}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-400)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Technology
                  </div>
                  <div style={{ fontSize: 16, color: "var(--ink-black)", marginTop: 4 }}>{activeDayData.tech}</div>
                </div>
                <div style={{ background: "var(--icon-tile-bg)", borderRadius: 14, padding: "16px 20px" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--blue-600)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    You&apos;ll Build
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: "var(--ink-black)", marginTop: 4 }}>{activeDayData.project}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
