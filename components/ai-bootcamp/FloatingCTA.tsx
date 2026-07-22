"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRegisterModal } from "./RegisterModalContext";

interface FloatingCTAProps {
  seatsReserved?: number;
  seatsTotal?: number;
}

/** Floating bottom CTA bar — appears once the visitor has scrolled ~20% into
 *  the page, hidden again at the very top and while a modal is open so it
 *  never sits on top of the registration flow. */
export function FloatingCTA({ seatsReserved = 127, seatsTotal = 200 }: FloatingCTAProps) {
  const { openRegister, isRegisterOpen, isSuccessOpen } = useRegisterModal();
  const [scrolledPast, setScrolledPast] = useState(false);

  useEffect(() => {
    let ticking = false;

    function evaluate() {
      const scrollY = window.scrollY;
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const progress = scrollable > 0 ? scrollY / scrollable : 0;
      setScrolledPast(scrollY > 96 && progress >= 0.2);
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
              <span className="aib-floating-cta-trust">
                <span className="aib-live-dot" />
                {seatsReserved} of {seatsTotal} seats reserved
              </span>
            </div>

            <div className="aib-floating-cta-action">
              <div className="aib-floating-cta-price">
                <span className="aib-floating-cta-strike">₹10,000</span>
                <span className="aib-floating-cta-free">Free</span>
              </div>
              <button onClick={openRegister} className="aib-btn aib-floating-cta-btn">
                Reserve my seat
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
