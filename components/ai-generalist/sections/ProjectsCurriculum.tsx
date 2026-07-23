"use client";

import { useState } from "react";
import { projectIcons } from "../data";
import { useLanguage } from "../LanguageContext";

export function ProjectsCurriculum() {
  const { t } = useLanguage();
  const [activeDay, setActiveDay] = useState(4);
  const activeDayData = t.projects.days.find((_, i) => i + 1 === activeDay) ?? t.projects.days[0];

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
            {t.projects.headline}
          </h2>
          <p style={{ textAlign: "center", color: "var(--ink-600)", fontSize: 17, margin: "0 0 48px" }}>
            {t.projects.subcopy}
          </p>
          <div className="aig-3col" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 20 }}>
            {t.projects.items.map((title, i) => {
              const Icon = projectIcons[i];
              return (
                <div key={title} className="aig-card aig-lift-card" style={{ padding: 26 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      background: "var(--icon-tile-bg)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon size={20} color="var(--blue-600)" />
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 16, marginTop: 16 }}>{title}</div>
                </div>
              );
            })}
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
            {t.projects.curriculumHeadline}
          </h2>
          <div className="aig-day-grid" style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 32 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {t.projects.days.map((d, i) => {
                const day = i + 1;
                const active = day === activeDay;
                return (
                  <button
                    key={d.label}
                    onClick={() => setActiveDay(day)}
                    className="aig-day-btn"
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
            <div className="aig-card" style={{ padding: 36 }}>
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
                    {t.projects.problemLabel}
                  </div>
                  <div style={{ fontSize: 16, color: "var(--ink-black)", marginTop: 4 }}>{activeDayData.problem}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-400)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {t.projects.solutionLabel}
                  </div>
                  <div style={{ fontSize: 16, color: "var(--ink-black)", marginTop: 4 }}>{activeDayData.solution}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-400)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {t.projects.techLabel}
                  </div>
                  <div style={{ fontSize: 16, color: "var(--ink-black)", marginTop: 4 }}>{activeDayData.tech}</div>
                </div>
                <div style={{ background: "var(--icon-tile-bg)", borderRadius: 14, padding: "16px 20px" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--blue-600)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {t.projects.buildLabel}
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
