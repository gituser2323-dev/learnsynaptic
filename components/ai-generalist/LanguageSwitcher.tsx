"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { useLanguage } from "./LanguageContext";
import { SUPPORTED_LANGS } from "./translations";

/** Premium segmented control, fixed top-right, switching every visible
 *  string on the page instantly via LanguageContext — no page reload. */
export function LanguageSwitcher() {
  const { lang, setLang } = useLanguage();
  const optionRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  return (
    <div className="aig-lang-switch-wrap">
      <div className="aig-lang-switch" role="group" aria-label="Choose language">
        {SUPPORTED_LANGS.map((option) => {
          const active = option.code === lang;
          return (
            <button
              key={option.code}
              ref={(el) => {
                optionRefs.current[option.code] = el;
              }}
              onClick={() => setLang(option.code)}
              className={`aig-lang-option${active ? " aig-lang-option-active" : ""}`}
              aria-pressed={active}
            >
              {active && (
                <motion.span
                  layoutId="aig-lang-pill"
                  className="aig-lang-pill"
                  style={{ left: 0, right: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 34 }}
                />
              )}
              <span className="aig-lang-option-flag" aria-hidden="true" style={{ position: "relative" }}>
                {option.flag}
              </span>
              <span className="aig-lang-option-label" style={{ position: "relative" }}>
                {option.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
