import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Check, ChevronDown, Globe, LogIn } from "lucide-react";
import logoWhite from "@/assets/pitchsnack-white.png";
import { FOOTER, NAV, type Lang } from "./home-copy";
import { PrivacyLink } from "./privacy-notice";

/** Shared chrome for the public pages: language, top bar, footer. */

const FONT_URL = "https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&family=IBM+Plex+Sans+Thai+Looped:wght@400;500;600;700&family=Noto+Serif+Thai:wght@600;700&family=IBM+Plex+Mono:wght@500&display=swap";
const KEY = "ps-home-lang";

const LangCtx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (c: { en: string; th: string }) => string }>({
  lang: "th", setLang: () => {}, t: (c) => c.th,
});
export const useHomeLang = () => useContext(LangCtx);

/** Renders "\n" as line breaks, **x** as bold and ==x== as the highlighted word. */
export function Rich({ s }: { s: string }) {
  return (
    <>
      {s.split("\n").map((line, i) => (
        <span key={i}>
          {i > 0 && <br />}
          {line.split(/(\*\*[^*]+\*\*|==[^=]+==)/).map((p, j) =>
            p.startsWith("**") ? <b key={j}>{p.slice(2, -2)}</b> : p.startsWith("==") ? <mark key={j} className="ph-mark">{p.slice(2, -2)}</mark> : p,
          )}
        </span>
      ))}
    </>
  );
}

export function PublicShell({ current, children, talkHref, footCurrent }: { current: keyof typeof NAV | null; children: ReactNode; talkHref?: string; footCurrent?: "contact" }) {
  const [lang, setLangState] = useState<Lang>("th");
  useEffect(() => {
    const saved = localStorage.getItem(KEY);
    if (saved === "en" || saved === "th") setLangState(saved);
  }, []);
  useEffect(() => {
    const html = document.documentElement;
    const prev = { lang: html.lang, size: html.style.fontSize };
    html.lang = lang;
    html.style.fontSize = lang === "th" ? "17.5px" : "16px";
    return () => { html.lang = prev.lang || "en"; html.style.fontSize = prev.size; };
  }, [lang]);
  const setLang = (l: Lang) => { setLangState(l); localStorage.setItem(KEY, l); };
  const t = (c: { en: string; th: string }) => c[lang];
  return (
    <LangCtx.Provider value={{ lang, setLang, t }}>
      <link rel="stylesheet" href={FONT_URL} precedence="default" />
      <div className="ph" data-lang={lang}>
        <TopBar current={current} talkHref={talkHref} />
        <main>{children}</main>
        <Footer current={footCurrent} />
      </div>
    </LangCtx.Provider>
  );
}

function TopBar({ current, talkHref }: { current: keyof typeof NAV | null; talkHref?: string }) {
  const { t } = useHomeLang();
  const links: [keyof typeof NAV, string][] = [["home", "/"], ["sellers", "/sellers"], ["buyers", "/buyers"], ["partners", "/partners"], ["plans", "/plans"], ["discovery", "/discovery"]];
  const onHome = current === "home";
  return (
    <header className="ph-bar">
      <div className="ph-bar-in">
        <Link to="/" className="ph-logo" aria-label="PitchSnack"><img src={logoWhite} alt="PitchSnack" /></Link>
        <nav className="ph-links" aria-label="Main">
          {links.map(([k, to]) => (
            k === "home" && onHome
              ? <a key={k} href="#top" aria-current="page" className="is-cur">{t(NAV[k])}</a>
              : <Link key={k} to={to} preload="intent" aria-current={current === k ? "page" : undefined} className={current === k ? "is-cur" : undefined}>{t(NAV[k])}</Link>
          ))}
        </nav>
        <div className="ph-ctrls">
          <Link to="/contact" hash="enquiry" hashScrollIntoView={false} className="ph-talk"
            onClick={() => { if (typeof window !== "undefined" && window.location.pathname === "/contact") window.dispatchEvent(new Event("ps-enquiry")); }}>{t(NAV.talk)}</Link>
          <div className="ph-ctrls-r">
            <LangMenu />
            <Link to="/login" className="ph-login"><LogIn className="ph-login-ic" size={15} />{t(NAV.login)}</Link>
          </div>
        </div>
      </div>
    </header>
  );
}

function LangMenu() {
  const { lang, setLang, t } = useHomeLang();
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const opts: { v: Lang; name: string }[] = [{ v: "th", name: "ภาษาไทย" }, { v: "en", name: "English" }];
  useEffect(() => {
    if (!open) return;
    box.current?.querySelector<HTMLButtonElement>(`[data-v="${lang}"]`)?.focus();
    const click = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", click);
    return () => document.removeEventListener("mousedown", click);
  }, [open, lang]);
  const onMenuKey = (e: React.KeyboardEvent) => {
    const items = [...(box.current?.querySelectorAll<HTMLButtonElement>("[role=menuitemradio]") ?? [])];
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown") { e.preventDefault(); items[(i + 1) % items.length]?.focus(); }
    if (e.key === "ArrowUp") { e.preventDefault(); items[(i - 1 + items.length) % items.length]?.focus(); }
    if (e.key === "Escape") { e.preventDefault(); setOpen(false); btn.current?.focus(); }
    if (e.key === "Tab") setOpen(false);
  };
  return (
    <div className="ph-lang">
      <button ref={btn} type="button" className="ph-lang-btn" aria-haspopup="menu" aria-expanded={open} title="ภาษา / Language"
        aria-label={`${t(NAV.langShort)} · ภาษา / Language`} onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => { if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); } }}>
        <Globe size={15} /><span>{t(NAV.langShort)}</span><ChevronDown size={13} className={open ? "ph-rot" : undefined} />
      </button>
      {open && (
        <div ref={box} role="menu" className="ph-lang-menu" onKeyDown={onMenuKey}>
          {opts.map((o) => (
            <button key={o.v} data-v={o.v} type="button" role="menuitemradio" aria-checked={lang === o.v} className={lang === o.v ? "is-on" : undefined}
              onClick={() => { setLang(o.v); setOpen(false); btn.current?.focus(); }}>
              <span><b>{o.name}</b></span>
              {lang === o.v && <Check size={16} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Footer({ current }: { current?: "contact" }) {
  const { t } = useHomeLang();
  return (
    <footer className="ph-foot">
      <div className="ph-wrap">
        <p className="ph-legal">{t(FOOTER.legal)}</p>
        <nav className="ph-foot-links" aria-label="Footer">
          {FOOTER.links.map(([to, l]) => <Link key={to} to={to} preload="intent">{t(l)}</Link>)}
          <Link to="/contact" preload="intent" aria-current={current === "contact" ? "page" : undefined}>{t(FOOTER.contact)}</Link>
          <PrivacyLink>{t(FOOTER.privacy)}</PrivacyLink>
        </nav>
      </div>
    </footer>
  );
}
