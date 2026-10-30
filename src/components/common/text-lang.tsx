import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "@/i18n/language";
import { useSessionContext } from "@/hooks/use-session-context";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Edit information's "Texts in English | ไทย" switch. Control+Admin pick which
 * language's text boxes they edit; everyone else edits in the app language.
 * Presentation only — saving rules and authorization stay in each form's server function.
 */
export type TextLang = "en" | "th";
type Ctx = { lang: TextLang; setLang: (l: TextLang) => void; switchable: boolean };
const TextLangCtx = createContext<Ctx | null>(null);

export function TextLangProvider({ children }: { children: ReactNode }) {
  const { language } = useTranslation();
  const { data: session } = useSessionContext();
  const switchable = session?.user?.accountRole === "admin";
  const [picked, setPicked] = useState<TextLang | null>(null);
  const lang: TextLang = switchable ? picked ?? (language === "th" ? "th" : "en") : language === "th" ? "th" : "en";
  const value = useMemo(() => ({ lang, setLang: setPicked, switchable }), [lang, switchable]);
  return <TextLangCtx.Provider value={value}>{children}</TextLangCtx.Provider>;
}

/** Current text language; outside Edit information it is the app language. */
export function useTextLang(): Ctx {
  const ctx = useContext(TextLangCtx);
  const { language } = useTranslation();
  return ctx ?? { lang: language === "th" ? "th" : "en", setLang: () => {}, switchable: false };
}

export function TextLangSwitch() {
  const { lang, setLang, switchable } = useTextLang();
  const { language } = useTranslation();
  if (!switchable) return null;
  const th = language === "th";
  const opt = (k: TextLang, label: string) => (
    <button type="button" aria-pressed={lang === k} onClick={() => setLang(k)} lang={k}
      className={cn("text-lang-opt", lang === k && "is-on")}>{label}</button>
  );
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div role="group" aria-label={th ? "ภาษาของข้อความ" : "Texts in"} className="text-lang-switch">
            <span className="text-lang-lab">{th ? "ภาษาของข้อความ" : "Texts in"}</span>
            {opt("en", "English")}{opt("th", "ไทย")}
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-[280px]">
          {th ? "ภาษาของข้อความที่ท่านกำลังแก้ไข ชื่อ ตัวเลข และที่อยู่เว็บไซต์ใช้เหมือนกันทั้งสองภาษา" : "The language of the texts you’re editing. Names, numbers and web addresses are the same in both."}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** EN / TH tag after a bilingual text's label (Control+Admin only). */
export function LangTag({ className, lang: forced }: { className?: string; lang?: TextLang }) {
  const { lang, switchable } = useTextLang();
  const { language } = useTranslation();
  if (!switchable) return null;
  const l = forced ?? lang;
  const tip = l === "th" ? (language === "th" ? "ข้อความภาษาไทย" : "Thai text") : (language === "th" ? "ข้อความภาษาอังกฤษ" : "English text");
  return <span title={tip} aria-label={tip} className={cn("lang-tag", l === "th" ? "lang-tag-th" : "lang-tag-en", className)}>{l === "th" ? "TH" : "EN"}</span>;
}

export function missingLangHint(lang: TextLang, appTh: boolean, narrow = false) {
  if (lang === "th") return narrow ? (appTh ? "ยังไม่มีภาษาไทย" : "No Thai yet") : (appTh ? "ยังไม่มีภาษาไทย ผู้อ่านภาษาไทยจะเห็นข้อความภาษาอังกฤษ" : "No Thai yet. Thai readers see the English.");
  return narrow ? (appTh ? "ยังไม่มีภาษาอังกฤษ" : "No English yet") : (appTh ? "ยังไม่มีภาษาอังกฤษ ผู้อ่านภาษาอังกฤษจะเห็นข้อความภาษาไทย" : "No English yet. English readers see the Thai.");
}

/**
 * One bilingual text held as an English/Thai pair. Admin edits the picked
 * language exactly; others see their language, falling back to the other one
 * until they type (only then is their language saved).
 */
export function useBiText(en0?: string | null, th0?: string | null) {
  const [pair, setPair] = useState({ en: en0 ?? "", th: th0 ?? "" });
  const { lang, switchable } = useTextLang();
  const { language } = useTranslation();
  const other = lang === "th" ? pair.en : pair.th;
  const own = pair[lang];
  const value = switchable ? own : own || other;
  const set = useCallback((v: string) => setPair((p) => ({ ...p, [lang]: v })), [lang]);
  const placeholder = (fallback?: string, narrow = false) =>
    switchable && !own && other ? missingLangHint(lang, language === "th", narrow) : fallback;
  return { ...pair, value, set, setPair, lang, placeholder, inputLang: lang, filled: !!(pair.en.trim() || pair.th.trim()) };
}

/** Same as useBiText for a list of strings (tags, highlights). */
export function useBiList(en0?: string[] | null, th0?: string[] | null) {
  const [pair, setPair] = useState({ en: en0 ?? [], th: th0 ?? [] });
  const { lang, switchable } = useTextLang();
  const own = pair[lang];
  const other = lang === "th" ? pair.en : pair.th;
  const value = switchable ? own : own.length ? own : other;
  const set = useCallback((v: string[]) => setPair((p) => ({ ...p, [lang]: v })), [lang]);
  return { ...pair, value, set, setPair, lang, missing: switchable && !own.length && other.length > 0 };
}
