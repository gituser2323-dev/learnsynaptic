"use client";

import { useMemo, useState } from "react";
import { useRegisterModal } from "../RegisterModalContext";
import { useLanguage } from "../LanguageContext";
import { WhatsAppIcon } from "../WhatsAppIcon";
import { getNextCohortSaturday, getIstDateParts } from "@/lib/cohortDate";
import { AI_BOOTCAMP_WHATSAPP_COMMUNITY_URL } from "@/config/aiBootcamp";

export function FaqClosing() {
  const [openIndex, setOpenIndex] = useState<Record<number, boolean>>({});
  const { openRegister } = useRegisterModal();
  const { t } = useLanguage();

  const nextCohortLabel = useMemo(() => {
    const { day, month } = getIstDateParts(getNextCohortSaturday());
    return `${t.dates.saturday}, ${day} ${t.dates.months[month]}`;
  }, [t]);

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
            {t.faq.headline}
          </h2>
          {t.faq.items.map((f, i) => {
            const open = !!openIndex[i];
            return (
              <div key={f.q} style={{ borderBottom: "1px solid var(--border-editorial)", padding: "10px 0" }}>
                <button
                  onClick={() => setOpenIndex((s) => ({ ...s, [i]: !s[i] }))}
                  aria-expanded={open}
                  className="aig-faq-q"
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
            {t.faq.capHeadline}
          </h2>
          <p style={{ color: "var(--ink-600)", fontSize: 16, lineHeight: 1.6, margin: 0 }}>{t.faq.capBody}</p>
        </div>
      </section>

      <section style={{ background: "var(--ls-dark)", color: "#fff", padding: "100px 6%", textAlign: "center" }}>
        <h2 style={{ fontFamily: "var(--font-display-promo)", fontWeight: 800, fontSize: "clamp(30px, 6vw, 46px)", margin: "0 0 16px" }}>
          {t.faq.finalHeadline1}
          <br />
          <span style={{ color: "var(--ls-primary-light)" }}>{t.faq.finalHeadline2}</span>
        </h2>
        <p style={{ color: "var(--ink-200)", fontSize: 17, margin: "0 0 32px" }}>
          {t.faq.finalSubcopy.replace("{date}", nextCohortLabel)}
        </p>
        <div className="aig-cta-row" style={{ justifyContent: "center" }}>
          <button
            onClick={openRegister}
            className="aig-btn"
            style={{
              background: "linear-gradient(180deg,var(--ls-primary),var(--ls-primary-hover))",
              color: "#fff",
              padding: "20px 44px",
              fontSize: 19,
              boxShadow: "var(--shadow-glow)",
            }}
          >
            {t.faq.finalCta}
          </button>
          <a
            href={AI_BOOTCAMP_WHATSAPP_COMMUNITY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="aig-btn aig-btn-whatsapp"
            style={{ padding: "20px 40px", fontSize: 19 }}
          >
            <WhatsAppIcon size={20} />
            {t.faq.finalCtaWhatsapp}
          </a>
        </div>
        <div style={{ marginTop: 44, color: "var(--ink-400)", fontSize: 14 }}>{t.faq.finalFooter}</div>
      </section>
    </>
  );
}
