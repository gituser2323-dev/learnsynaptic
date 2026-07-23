"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRegisterModal } from "./RegisterModalContext";

interface FloatingCTAProps {
  seatsReserved?: number;
  seatsTotal?: number;
}

/** First live cohort — a one-off Monday launch. Every cohort after this
 *  one falls back to the recurring weekly slot below, so this date is the
 *  only place a real calendar date is ever hardcoded. */
const FIRST_COHORT = new Date("2026-07-27T20:30:00+05:30");
/** Second cohort — anchors the recurring weekly cadence (+7 days from here
 *  onward). Visitors are never shown the cadence itself, only whichever
 *  single upcoming date this resolves to "right now". */
const SECOND_COHORT = new Date("2026-08-02T20:30:00+05:30");
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

/** Resolves to the single next upcoming cohort start, given the current
 *  time. Once `now` passes a cohort's start, this rolls forward — first to
 *  the second cohort, then week-by-week indefinitely — with no manual
 *  updates required. */
function getNextCohortDate(now: number): Date {
  if (now < FIRST_COHORT.getTime()) return FIRST_COHORT;
  if (now < SECOND_COHORT.getTime()) return SECOND_COHORT;
  const weeksElapsed = Math.floor((now - SECOND_COHORT.getTime()) / WEEK_MS);
  let candidate = SECOND_COHORT.getTime() + weeksElapsed * WEEK_MS;
  if (candidate <= now) candidate += WEEK_MS;
  return new Date(candidate);
}

function formatCohortDate(d: Date): string {
  const day = d.getDate();
  const month = d.toLocaleString("en-US", { month: "long" });
  return `${day} ${month} • 8:30 PM Onwards`;
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

/** Tracks the next upcoming cohort and the live countdown to it, rolling
 *  forward automatically once the current cohort's start time passes.
 *  Re-renders are gated on the minute actually changing, keeping this
 *  premium and quiet rather than ticking every second. */
function useNextCohort() {
  const [state, setState] = useState(() => {
    const now = Date.now();
    const target = getNextCohortDate(now);
    return { target, ...getRemaining(target.getTime(), now) };
  });

  useEffect(() => {
    const tick = () => {
      setState((prev) => {
        const now = Date.now();
        const target = getNextCohortDate(now);
        const remaining = getRemaining(target.getTime(), now);
        if (
          target.getTime() === prev.target.getTime() &&
          remaining.totalMinutes === prev.totalMinutes
        ) {
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
    <span className="aib-countdown-unit">
      <span className="aib-countdown-value">
        {animate ? (
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={padded}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="aib-countdown-value-frame"
            >
              {padded}
            </motion.span>
          </AnimatePresence>
        ) : (
          padded
        )}
      </span>
      <span className="aib-countdown-label">{label}</span>
    </span>
  );
}

/** Floating bottom CTA bar — appears once the visitor has scrolled ~20% into
 *  the page, hidden again at the very top and while a modal is open so it
 *  never sits on top of the registration flow. */
export function FloatingCTA({ seatsReserved = 27, seatsTotal =40 }: FloatingCTAProps) {
  const { openRegister, isRegisterOpen, isSuccessOpen } = useRegisterModal();
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
          className="aib-floating-cta-wrap"
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 28 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="aib-floating-cta">
            <div className="aib-floating-cta-info">
              <span className="aib-floating-cta-title">7-Day AI Engineering Bootcamp</span>
              <div className="aib-floating-cta-meta">
                <span className="aib-floating-cta-cohort">
                  <span className="aib-floating-cta-cohort-label">Upcoming Live Cohort</span>
                  <span className="aib-floating-cta-cohort-date">{formatCohortDate(target)}</span>
                </span>
                <span className="aib-floating-cta-meta-divider" aria-hidden="true" />
                <div
                  className="aib-floating-cta-countdown"
                  role="timer"
                  aria-label={`Starts in ${days} days, ${hours} hours, ${minutes} minutes`}
                >
                  <CountdownUnit value={days} label="Days" />
                  <span className="aib-countdown-divider" aria-hidden="true" />
                  <CountdownUnit value={hours} label="Hrs" />
                  <span className="aib-countdown-divider" aria-hidden="true" />
                  <CountdownUnit value={minutes} label="Min" animate />
                </div>
              </div>
            </div>

            <div className="aib-floating-cta-action">
              <span className="aib-floating-cta-seats">
                <span className="aib-live-dot" style={{ backgroundColor: "rgb(0, 213, 27)" }} />
                {seatsReserved} / {seatsTotal} Seats Reserved
              </span>
              <button onClick={openRegister} className="aib-btn aib-floating-cta-btn">
                Reserve My Free Seat →
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
