"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import { DEFAULT_LANG, LANG_STORAGE_KEY, translations, type Lang, type Translation } from "./translations";

/** Same-tab listeners for language changes — the native "storage" event
 *  only fires in *other* tabs, so writes made here notify these directly. */
const listeners = new Set<() => void>();

function readStoredLang(): Lang {
  const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
  if (stored === "en" || stored === "hi" || stored === "mr") return stored;
  return DEFAULT_LANG;
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function getServerSnapshot(): Lang {
  return DEFAULT_LANG;
}

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Translation;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const lang = useSyncExternalStore(subscribe, readStoredLang, getServerSnapshot);

  const setLang = useCallback((next: Lang) => {
    window.localStorage.setItem(LANG_STORAGE_KEY, next);
    listeners.forEach((listener) => listener());
  }, []);

  const value = useMemo(() => ({ lang, setLang, t: translations[lang] }), [lang, setLang]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
