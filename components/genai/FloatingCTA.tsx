"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRegisterModal } from "./RegisterModalContext";
import { formatFloatingDate } from "@/lib/genai/schedule";
import { getNextSessionDate } from "@/lib/masterclassSchedule";

interface FloatingCTAProps {
  seatsReserved?: number;
  seatsTotal?: number;
}

const MINUTE_MS = 60 * 1000;

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

/** Tracks the next upcoming live session and the countdown to it, re-reading
 *  getNextSessionDate() on every tick so the moment one session's start time
 *  passes, the target rolls forward to the next alternating slot on its own —
 *  never a date that needs to be updated by hand. Re-renders are gated on the
 *  minute actually changing, keeping this premium and quiet rather than
 *  ticking every second. */
function useNextSession() {
  const [state, setState] = useState(() => {
    const now = Date.now();
    const target = getNextSessionDate(now);
    return { target, ...getRemaining(target.getTime(), now) };
  });

  useEffect(() => {
    const tick = () => {
      setState((prev) => {
        const now = Date.now();
        const target = getNextSessionDate(now);
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
  const { days, hours, minutes } = useNextSession();

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
              <span className="aib-floating-cta-title">2-Hour GenAI Masterclass</span>
              <div className="aib-floating-cta-meta">
                <span className="aib-floating-cta-cohort">
                  <span className="aib-floating-cta-cohort-label">Upcoming Live Masterclass</span>
                  <span className="aib-floating-cta-cohort-date">{formatFloatingDate()}</span>
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
