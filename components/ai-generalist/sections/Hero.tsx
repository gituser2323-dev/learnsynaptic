"use client";

import { useMemo } from "react";
import Image from "next/image";
import { useRegisterModal } from "../RegisterModalContext";
import { useLanguage } from "../LanguageContext";
import { WhatsAppIcon } from "../WhatsAppIcon";
import { getNextCohortSaturday, getIstDateParts } from "@/lib/cohortDate";
import { AI_BOOTCAMP_WHATSAPP_COMMUNITY_URL } from "@/config/aiBootcamp";

function GlassBadge({ text, style }: { text: string; style: React.CSSProperties }) {
  return (
    <div
      className="aig-glass aig-hero-badge"
      style={{
        position: "absolute",
        borderRadius: 14,
        padding: "10px 16px",
        display: "flex",
        alignItems: "center",
        gap: 9,
        ...style,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          flexShrink: 0,
          background: "var(--ls-primary)",
          boxShadow: "0 0 8px rgba(22,93,252,0.7)",
        }}
      />
      <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{text}</span>
    </div>
  );
}

export function Hero() {
  const { openRegister } = useRegisterModal();
  const { t } = useLanguage();

  const nextCohortLabel = useMemo(() => {
    const { day, month } = getIstDateParts(getNextCohortSaturday());
    return `${t.dates.saturday} • ${day} ${t.dates.months[month]}`;
  }, [t]);

  return (
    <section style={{ background: "var(--ls-dark)", color: "#fff", padding: "72px 6% 96px", position: "relative", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          top: -120,
          left: -80,
          width: 360,
          height: 360,
          background: "radial-gradient(circle, rgba(22,93,252,0.22), transparent 70%)",
          filter: "blur(20px)",
        }}
      />
      <div
        className="aig-hero-grid"
        style={{
          position: "relative",
          display: "grid",
          gridTemplateColumns: "1.1fr 0.9fr",
          gridTemplateAreas: '"badge image" "eyebrow image" "headline image" "subhead image" "checklist image" "buttons image" "note image"',
          columnGap: 56,
          rowGap: 0,
          alignItems: "center",
          maxWidth: 1280,
          margin: "0 auto",
        }}
      >
        <span
          style={{
            gridArea: "badge",
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            border: "1px solid var(--border-promo)",
            borderRadius: 999,
            padding: "8px 16px",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.04em",
            justifySelf: "start",
          }}
        >
          <span className="aig-live-dot" style={{ backgroundColor: "rgb(0, 213, 27)" }} />
          {t.hero.badgePrefix} ·&nbsp; {nextCohortLabel.toUpperCase()}
        </span>
        <div
          className="aig-hero-item"
          style={{
            gridArea: "eyebrow",
            color: "var(--ls-primary-light)",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            marginTop: 28,
          }}
        >
          &nbsp;{t.hero.eyebrow}
        </div>
        <h1
          className="aig-hero-item"
          style={{
            gridArea: "headline",
            fontWeight: 800,
            fontSize: "clamp(34px, 6vw, 56px)",
            lineHeight: 1.05,
            margin: "12px 0 0",
            letterSpacing: "-0.02em",
          }}
        >
          {t.hero.h1Line1}
          <br />
          <span style={{ color: "var(--ls-primary-light)" }}>{t.hero.h1Line2}</span>
        </h1>
        <p className="aig-hero-item" style={{ gridArea: "subhead", fontSize: 17, color: "var(--ink-200)", maxWidth: 520, margin: "22px 0 0", lineHeight: 1.6 }}>
          {t.hero.subhead}
        </p>
        <div className="aig-hero-item" style={{ gridArea: "checklist", display: "flex", flexDirection: "column", gap: 12, marginTop: 28 }}>
          {t.hero.checklist.map((text) => (
            <div key={text} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span
                style={{
                  width: 22,
                  height: 22,
                  flexShrink: 0,
                  borderRadius: "50%",
                  background: "rgba(22,93,252,0.16)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Image
                  src="/bootcamplogos/icons8-check-mark-94.png"
                  alt=""
                  width={13}
                  height={13}
                  style={{ objectFit: "contain" }}
                />
              </span>
              <span style={{ fontSize: 15, color: "var(--ink-200)" }}>{text}</span>
            </div>
          ))}
        </div>
        <div className="aig-cta-row aig-hero-item" style={{ gridArea: "buttons", marginTop: 34 }}>
          <button
            onClick={openRegister}
            className="aig-btn"
            style={{
              background: "linear-gradient(180deg,var(--ls-primary),var(--ls-primary-hover))",
              color: "#fff",
              padding: "18px 34px",
              fontSize: 17,
              boxShadow: "var(--shadow-glow)",
            }}
          >
            {t.hero.ctaPrimary}
          </button>
          <a
            href={AI_BOOTCAMP_WHATSAPP_COMMUNITY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="aig-btn aig-btn-whatsapp"
            style={{ padding: "18px 30px", fontSize: 17 }}
          >
            {t.hero.ctaWhatsapp}
          </a>
        </div>
        <p className="aig-hero-item" style={{ gridArea: "note", fontSize: 13, color: "var(--ink-400)", margin: "14px 0 0", lineHeight: 1.5 }}>
          {t.hero.note}
        </p>

        <div
          style={{
            gridArea: "image",
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 500,
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%,-56%)",
              width: "clamp(260px, 75vw, 440px)",
              height: "clamp(260px, 75vw, 440px)",
              borderRadius: "50%",
              filter: "blur(8px)",
              pointerEvents: "none",
              backgroundColor: "rgba(11,18,32,0.5)",
            }}
          />
          <div
            style={{
              position: "relative",
              width: "clamp(200px, 55vw, 300px)",
              height: "clamp(200px, 55vw, 300px)",
              borderRadius: "50%",
              overflow: "hidden",
              border: "1px solid rgba(22,93,252,0.4)",
              boxShadow: "0px 24px 87px 0px rgba(22,93,252,0.32)",
            }}
          >
            <Image
              src="/bootcamplogos/me.png"
              alt="Pratik Sabale, Co-Founder at LearnSynaptic"
              fill
              sizes="(max-width: 1100px) 55vw, 300px"
              style={{ objectFit: "cover" }}
              priority
            />
          </div>

          <GlassBadge text={t.hero.badges[0]} style={{ top: "8%", left: "-2%" }} />
          <GlassBadge text={t.hero.badges[1]} style={{ top: 81, right: -51 }} />
          <GlassBadge text={t.hero.badges[2]} style={{ bottom: "26%", left: "-6%" }} />

          <div style={{ position: "relative", textAlign: "center", marginTop: 28 }}>
            <div style={{ fontFamily: "var(--font-display-promo)", fontWeight: 800, fontSize: 22, color: "#fff" }}>
              {t.hero.founderCaption}
            </div>
            <div style={{ color: "var(--ls-primary-light)", fontSize: 13.5, fontWeight: 700, marginTop: 4 }}>
              {t.hero.founderTitle}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
