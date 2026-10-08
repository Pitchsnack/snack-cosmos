import { useState, type ReactNode } from "react";
import { useHomeLang } from "./public-shell";

type C = { en: string; th: string };

/**
 * Hero picture switcher shared by the public pages: stacked pictures, dots and
 * one caption. No auto-play. The pictures are hidden from screen readers; the
 * dots and the caption are not.
 */
export function HeroSlides({ slides, captions }: { slides: ReactNode[]; captions: C[] }) {
  const { t, lang } = useHomeLang();
  const [cur, setCur] = useState(0);
  const n = slides.length;
  return (
    <div className="hs">
      <div className="hs-stage" aria-hidden="true">
        <i className="hs-glow" />
        {slides.map((s, i) => (
          <div key={i} className={i === cur ? "hs-pic is-on" : "hs-pic"} inert={i !== cur || undefined}>{s}</div>
        ))}
      </div>
      <div className="hs-dots" role="group" aria-label={lang === "th" ? "เลือกภาพ" : "Choose a picture"}>
        {slides.map((_, i) => (
          <button key={i} type="button" className="hs-dot" aria-pressed={i === cur} onClick={() => setCur(i)}
            aria-label={lang === "th" ? `ภาพที่ ${i + 1} จาก ${n}` : `Picture ${i + 1} of ${n}`}><span /></button>
        ))}
      </div>
      <div className="hs-cap" aria-live="polite">
        {captions.map((c, i) => <span key={i} className={i === cur ? "is-on" : undefined}>{t(c)}</span>)}
      </div>
    </div>
  );
}
