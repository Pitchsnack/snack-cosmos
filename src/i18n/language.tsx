import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { TH } from "./th";

export type Language = "en" | "th";

const STORAGE_KEY = "sp2.lang";

type Ctx = {
  language: Language;
  setLanguage: (next: Language) => void;
  t: (text: string) => string;
};

const LanguageContext = createContext<Ctx>({
  language: "en",
  setLanguage: () => {},
  t: (text) => text,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Always start at "en" so SSR and the first client render match.
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "th" || stored === "en") setLanguageState(stored);
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = language;
    document.documentElement.dataset.lang = language;
  }, [language]);

  const value = useMemo<Ctx>(
    () => ({
      language,
      setLanguage: (next) => {
        setLanguageState(next);
        try {
          localStorage.setItem(STORAGE_KEY, next);
        } catch {
          /* noop */
        }
      },
      t: (text: string) => (language === "th" ? TH[text] ?? text : text),
    }),
    [language],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useTranslation() {
  return useContext(LanguageContext);
}
