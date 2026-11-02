import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Info } from "lucide-react";
import { useTranslation } from "@/i18n/language";
import { cn } from "@/lib/utils";

type Phase = "open" | "fading" | "folded" | "growing";

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Advisor My Company intro: shows in full when the page opens, folds after 4s
 * into a small tag. The wait pauses while the pointer or focus is on it and
 * refolds 1.5s after they leave; ⌄ reopens it until "less" or a page reopen.
 * The sentence stays in the page for screen readers (sr-only when folded), so
 * the same instance must persist across firm picks — no key on the panel.
 */
export function IntroFold({ sentence, tag }: { sentence: React.ReactNode; tag: string }) {
  const { language } = useTranslation();
  const th = language === "th";
  const [phase, setPhase] = useState<Phase>("open");
  const [pinned, setPinned] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fromWidth = useRef(0);
  const sentenceId = useId();

  const clearTimer = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
  }, []);

  const fold = useCallback(() => {
    clearTimer();
    const el = box.current;
    if (!el || reduced()) { setPhase("folded"); return; }
    setPhase("fading"); // sentence fades out first (0.18s)…
    timer.current = setTimeout(() => { fromWidth.current = el.offsetWidth; setPhase("folded"); }, 180);
  }, [clearTimer]);

  const expand = useCallback(() => {
    clearTimer();
    setPinned(true); // opened with ⌄: stays open until "less" or a page reopen
    const el = box.current;
    if (!el || reduced()) { setPhase("open"); return; }
    fromWidth.current = el.offsetWidth;
    setPhase("growing"); // box grows back (0.34s), then the sentence fades in
    timer.current = setTimeout(() => setPhase("open"), 340);
  }, [clearTimer]);

  // Fold 4 seconds after My Company opens (the component mounts with the page).
  useEffect(() => {
    timer.current = setTimeout(fold, 4000);
    return clearTimer;
  }, [fold, clearTimer]);

  // Shrink/grow the box width once the folded/open markup is in place.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el || (phase !== "folded" && phase !== "growing") || reduced()) return;
    const target = el.offsetWidth; // CSS: folded → fit-content, growing → 100%
    const start = fromWidth.current;
    if (Math.abs(target - start) < 2) return;
    el.style.transition = "none";
    el.style.width = `${start}px`;
    void el.offsetWidth;
    el.style.transition = "width .34s cubic-bezier(.2,.7,.2,1)";
    el.style.width = `${target}px`;
    const done = setTimeout(() => { el.style.transition = ""; el.style.width = ""; }, 360);
    return () => clearTimeout(done);
  }, [phase]);

  const pause = () => { if (phase === "open") clearTimer(); };
  const resume = () => {
    if (phase === "open" && !pinned) { clearTimer(); timer.current = setTimeout(fold, 1500); }
  };

  const open = phase !== "folded";
  return (
    <div
      ref={box}
      className={cn("intro-fold", `is-${phase}`)}
      onPointerEnter={pause}
      onPointerLeave={resume}
      onFocusCapture={pause}
      onBlurCapture={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) resume(); }}
    >
      <Info className="intro-fold-icon" aria-hidden />
      <span aria-hidden className="intro-fold-tag">{tag}</span>
      <p id={sentenceId} className={cn("intro-fold-sentence", phase === "folded" && "sr-only")}>{sentence}</p>
      <button
        type="button"
        className="intro-fold-btn"
        aria-expanded={open}
        aria-controls={sentenceId}
        aria-label={open ? (th ? "แสดงน้อยลง" : "Show less") : (th ? "แสดงเพิ่มเติม" : "Show more")}
        onClick={open ? fold : expand}
      >
        {open ? <>{th ? "แสดงน้อยลง" : "less"}<ChevronUp size={14} aria-hidden /></> : <ChevronDown size={14} aria-hidden />}
      </button>
    </div>
  );
}
