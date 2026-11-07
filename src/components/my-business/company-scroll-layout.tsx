import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Shared presentation boundary; profile hosts retain all selection and access decisions. */
export function CompanyScrollLayout({ list, panel, listLabel, panelLabel, selectedKey, resetKey = "", mode = "profiles", className, listClassName }: {
  list: ReactNode; panel: ReactNode; listLabel: string; panelLabel: string;
  selectedKey?: string | null; resetKey?: string; mode?: string;
  className?: string; listClassName?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const left = useRef<HTMLDivElement>(null);
  const right = useRef<HTMLElement>(null);
  const previousReset = useRef(resetKey);
  const previousMode = useRef(mode);
  const revealed = useRef(false);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const main = el.closest("main");
    const media = window.matchMedia("(min-width: 1024px)");
    const measure = () => {
      const enabled = media.matches;
      main?.classList.toggle("company-scroll-page", enabled);
      if (enabled) {
        el.style.setProperty("--company-scroll-height", `${Math.max(0, window.innerHeight - el.getBoundingClientRect().top - 16)}px`);
      } else el.style.removeProperty("--company-scroll-height");
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (el.parentElement) observer.observe(el.parentElement);
    if (main) observer.observe(main);
    window.addEventListener("resize", measure);
    media.addEventListener("change", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      media.removeEventListener("change", measure);
      main?.classList.remove("company-scroll-page");
    };
  }, []);

  useEffect(() => {
    if (!window.matchMedia("(min-width: 1024px)").matches) return;
    const filterChanged = previousReset.current !== resetKey;
    const modeChanged = previousMode.current !== mode;
    previousReset.current = resetKey;
    previousMode.current = mode;
    if (filterChanged && left.current) left.current.scrollTop = 0;
    if (right.current) right.current.scrollTop = 0;
    // Reveal only on entry/layout changes; a click never changes the list's position.
    if (!filterChanged && (modeChanged || !revealed.current)) {
      const selected = left.current?.querySelector<HTMLElement>("[data-company-selected='true']");
      const area = left.current;
      if (selected && area) {
        revealed.current = true;
        const a = area.getBoundingClientRect();
        const s = selected.getBoundingClientRect();
        if (s.bottom > a.bottom || s.top < a.top) area.scrollTop += s.top - a.top;
      }
    }
  }, [selectedKey, resetKey, mode]);

  return <div ref={root} className={cn("company-scroll-layout grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]", className)}>
    <div ref={left} tabIndex={0} role="region" aria-label={listLabel} className={cn("company-scroll-list min-w-0", listClassName)} onKeyDown={(event) => {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      requestAnimationFrame(() => {
        const focused = document.activeElement;
        const area = left.current;
        if (focused instanceof HTMLElement && area?.contains(focused) && focused !== area) {
          const a = area.getBoundingClientRect();
          const f = focused.getBoundingClientRect();
          if (f.bottom > a.bottom) area.scrollTop += f.bottom - a.bottom;
          else if (f.top < a.top) area.scrollTop += f.top - a.top;
        }
      });
    }}>{list}</div>
    <section ref={right} tabIndex={0} aria-label={panelLabel} className="company-scroll-panel min-w-0 self-start">{panel}</section>
  </div>;
}