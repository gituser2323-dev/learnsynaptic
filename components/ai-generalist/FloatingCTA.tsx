"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRegisterModal } from "./RegisterModalContext";
import { useLanguage } from "./LanguageContext";
import { getNextCohortSaturday, getIstDateParts } from "@/lib/cohortDate";
import type { Translation } from "./translations";

interface FloatingCTAProps {
  seatsReserved?: number;
  seatsTotal?: number;
}

const MINUTE_MS = 60 * 1000;

function formatCohortDate(d: Date, t: Translation): string {
  const { day, month } = getIstDateParts(d);
  return `${t.dates.saturday}, ${day} ${t.dates.months[month]} • ${t.floatingCta.timeLabel}`;
}

interface Remaining {
  days: number;
  hours: number;
  minutes: number;
  totalMinutes: number;
}

function getRemaining(target: number, now: number): Remaining {
  const diffMs = Math.max(0, target - now);
  const totalMinutes = Math.floor(diffMs / MINUTE_MS);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  return { days, hours, minutes, totalMinutes };
}

function useNextCohort() {
  const [state, setState] = useState(() => {
    const now = Date.now();
    const target = getNextCohortSaturday(now);
    return { target, ...getRemaining(target.getTime(), now) };
  });

  useEffect(() => {
    const tick = () => {
      setState((prev) => {
        const now = Date.now();
        const target = getNextCohortSaturday(now);
        const remaining = getRemaining(target.getTime(), now);
        if (target.getTime() === prev.target.getTime() && remaining.totalMinutes === prev.totalMinutes) {
          return prev;
        }
        return { target, ...remaining };
      });
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  return state;
}

function CountdownUnit({ value, label, animate }: { value: number; label: string; animate?: boolean }) {
  const padded = String(value).padStart(2, "0");
  return (
    <span className="aig-countdown-unit">
      <span className="aig-countdown-value">
        {animate ? (
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={padded}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="aig-countdown-value-frame"
            >
              {padded}
            </motion.span>
          </AnimatePresence>
        ) : (
          padded
        )}
      </span>
      <span className="aig-countdown-label">{label}</span>
    </span>
  );
}

/** Floating bottom CTA bar — appears once the visitor has scrolled past the
 *  top, hidden while a modal is open so it never sits on top of the
 *  registration flow. */
export function FloatingCTA({ seatsReserved = 27, seatsTotal = 40 }: FloatingCTAProps) {
  const { openRegister, isRegisterOpen, isSuccessOpen } = useRegisterModal();
  const { t } = useLanguage();
  const [scrolledPast, setScrolledPast] = useState(false);
  const { target, days, hours, minutes } = useNextCohort();

  useEffect(() => {
    let ticking = false;

    function evaluate() {
      const scrollY = window.scrollY;
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const progress = scrollable > 0 ? scrollY / scrollable : 0;
      setScrolledPast(scrollY > 10 && progress >= 0);
      ticking = false;
    }

    function onScroll() {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(evaluate);
      }
    }

    evaluate();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const visible = scrolledPast && !isRegisterOpen && !isSuccessOpen;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="aig-floating-cta-wrap"
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 28 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="aig-floating-cta">
            <div className="aig-floating-cta-info">
              <span className="aig-floating-cta-title">{t.floatingCta.title}</span>
              <div className="aig-floating-cta-meta">
                <span className="aig-floating-cta-cohort">
                  <span className="aig-floating-cta-cohort-label">{t.floatingCta.cohortLabel}</span>
                  <span className="aig-floating-cta-cohort-date">
                    {formatCohortDate(target, t)}
                  </span>
                </span>
                <span className="aig-floating-cta-meta-divider" aria-hidden="true" />
                <div
                  className="aig-floating-cta-countdown"
                  role="timer"
                  aria-label={`${days} ${t.floatingCta.daysLabel}, ${hours} ${t.floatingCta.hrsLabel}, ${minutes} ${t.floatingCta.minLabel}`}
                >
                  <CountdownUnit value={days} label={t.floatingCta.daysLabel} />
                  <span className="aig-countdown-divider" aria-hidden="true" />
                  <CountdownUnit value={hours} label={t.floatingCta.hrsLabel} />
                  <span className="aig-countdown-divider" aria-hidden="true" />
                  <CountdownUnit value={minutes} label={t.floatingCta.minLabel} animate />
                </div>
              </div>
            </div>

            <div className="aig-floating-cta-action">
              <span className="aig-floating-cta-seats">
                <span className="aig-live-dot" style={{ backgroundColor: "rgb(0, 213, 27)" }} />
                {seatsReserved} / {seatsTotal} {t.floatingCta.seatsSuffix}
              </span>
              <button onClick={openRegister} className="aig-btn aig-floating-cta-btn">
                {t.floatingCta.cta}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
