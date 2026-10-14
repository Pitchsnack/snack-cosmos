import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/language";

/** "Managed by" + hat. One shared explanation (role=tooltip) stays in the page while hidden. */
export const MANAGED_TIP_ID = "managed-by-pitchsnack-tip";

type Open = { el: HTMLElement; via: "hover" | "pin"; align: "right" | "left" } | null;
let state: Open = null;
const subs = new Set<() => void>();
const set = (s: Open) => { state = s; subs.forEach((f) => f()); };
const useOpen = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => state, () => null);

function Hat({ width }: { width: number }) {
  return (
    <svg viewBox="65.1 6.6 40.54 29.93" width={width} height={Math.round(width * 0.74 * 10) / 10} aria-hidden="true" fill="#010101" className="managed-hat shrink-0">
      <path d="M85.89,6.78c-2.59.6-4.420,1.58-6.45,3.4-.62.56-3.29,3.89-3.44,4.31-.03.08.76.56,1.74,1.09,1.91.98,8.8,4.52,13.59,6.98,1.58.81,3.77,1.94,4.87,2.5,1.45.76,2.020,1,2.090.86.37-.6,1.15-2.37,1.49-3.39.75-2.23.64-4.93-.25-6.78-.54-1.09-.96-1.31-2.5-1.31-2.41-.01-3.64-.35-4.11-1.14-.13-.22-.31-.96-.43-1.62-.48-3-.69-3.64-1.37-4.32-.35-.35-.67-.52-1.15-.63-.89-.18-3.17-.16-4.07.05h0Z" />
      <path d="M65.84,10.46c-.42.22-.82,1.4-.72,2.07.42,2.59,6.22,8.09,13.9,13.22,4.31,2.88,10.09,6.11,13.68,7.67.54.24,1.3.56,1.68.73,1.41.64,4.38,1.64,6.05,2.03.62.14,1.61.3,2.23.34,1.3.09,1.88-.13,2.59-.94.64-.72.5-1.4-.43-2.19-.79-.65-3.46-1.68-6.41-2.46-2.07-.54-2.030-.52-2.030-.65,0-.07.18-.51.39-.98.22-.47.39-.92.39-.98,0-.05-.79-.51-1.73-1-.96-.48-2.45-1.24-3.31-1.69-.86-.45-2.87-1.48-4.45-2.29-1.580-.81-3.59-1.85-4.45-2.29-6.29-3.26-8.34-4.35-8.87-4.47-.08-.02-.12.05-.15.07-.13.12-.43-.13-1.33-1.13-2.51-2.77-4.35-4.44-5.48-4.96-.76-.35-1.03-.38-1.53-.1h0Z" />
    </svg>
  );
}

export type ManagedSize = "card" | "panel" | "sm" | "xs";
const SIZES: Record<ManagedSize, { h: number; px: number; fs: number; hat: number }> = {
  panel: { h: 26, px: 10, fs: 12, hat: 18 },
  card: { h: 24, px: 10, fs: 11.5, hat: 17 },
  sm: { h: 22, px: 9, fs: 11, hat: 16 },
  xs: { h: 20, px: 8, fs: 10.5, hat: 15 },
};

export function ManagedBadge({ size = "sm", border = true, shadow = false, align = "right", hatOnly = false, className }: {
  size?: ManagedSize; border?: boolean; shadow?: boolean; align?: "right" | "left"; hatOnly?: boolean; className?: string;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLButtonElement>(null);
  const open = useOpen();
  const isOpen = !!open && open.el === ref.current;
  const z = SIZES[size];
  const pin = () => ref.current && set({ el: ref.current, via: "pin", align });
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  return (
    <button
      ref={ref}
      type="button"
      data-managed-badge=""
      aria-label={t("Managed by PitchSnack")}
      aria-describedby={MANAGED_TIP_ID}
      aria-expanded={isOpen}
      onPointerEnter={(e) => { if (e.pointerType === "mouse" && (!state || state.via !== "pin")) set({ el: e.currentTarget, via: "hover", align }); }}
      onPointerLeave={(e) => { if (e.pointerType === "mouse" && state?.el === e.currentTarget && state.via === "hover") set(null); }}
      onFocus={(e) => { if (e.currentTarget.matches(":focus-visible")) pin(); }}
      onBlur={(e) => { if (state?.el === e.currentTarget) set(null); }}
      onPointerDown={stop}
      onMouseDown={stop}
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); pin(); }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); e.preventDefault(); pin(); }
        else if (e.key === "Escape") { e.stopPropagation(); set(null); }
      }}
      className={cn(
        "managed-badge relative z-[2] inline-flex shrink-0 cursor-help items-center whitespace-nowrap rounded-full bg-white font-semibold leading-none text-[#151A28] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] dark:focus-visible:outline-[#8AB4FF]",
        border && "border border-[#E5E7EB] dark:border-[#3A4252]",
        shadow && "shadow-[0_1px_2px_rgba(16,24,40,.14)] dark:shadow-none",
        isOpen && "is-open",
        className,
      )}
      style={{ height: z.h, padding: `0 ${hatOnly ? 7 : z.px}px`, fontSize: z.fs, gap: 5 }}
    >
      {!hatOnly && <span aria-hidden="true">{t("Managed by")}</span>}
      <Hat width={z.hat} />
    </button>
  );
}

/** The single explanation, mounted once (root). */
export function ManagedTipHost() {
  const { t, lang } = useTranslation() as { t: (s: string) => string; lang?: string };
  const open = useOpen();
  const tip = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; arrow: number; above: boolean } | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const place = () => {
    const o = state; const el = tip.current;
    if (!o || !el || !o.el.isConnected) { if (o) set(null); return; }
    const r = o.el.getBoundingClientRect();
    // Closed once the badge leaves the window or any scrolling box around it.
    let out = r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth;
    for (let p = o.el.parentElement; p && !out; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (/(auto|scroll|hidden)/.test(cs.overflowY + cs.overflowX)) {
        const pr = p.getBoundingClientRect();
        if (r.bottom <= pr.top || r.top >= pr.bottom || r.right <= pr.left || r.left >= pr.right) out = true;
      }
    }
    if (out) { set(null); return; }
    const w = el.offsetWidth, h = el.offsetHeight;
    let left = o.align === "right" ? r.right - w : r.left;
    left = Math.max(12, Math.min(left, innerWidth - 12 - w));
    let top = r.bottom + 10, above = false;
    if (top + h > innerHeight - 12 && r.top - 10 - h >= 12) { top = r.top - 10 - h; above = true; }
    const mid = r.left + r.width / 2 - left;
    setPos({ top, left, arrow: Math.max(12, Math.min(mid, w - 12)), above });
  };

  useLayoutEffect(() => { if (open) place(); else setPos(null); }, [open]);
  useEffect(() => {
    if (!open) return;
    let w = innerWidth;
    const onScroll = () => place();
    const onResize = () => { if (innerWidth !== w) set(null); else place(); w = innerWidth; };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") set(null); };
    const onDown = (e: PointerEvent) => { if (state && !state.el.contains(e.target as Node)) set(null); };
    addEventListener("scroll", onScroll, true);
    addEventListener("resize", onResize);
    addEventListener("keydown", onKey);
    addEventListener("pointerdown", onDown, true);
    return () => { removeEventListener("scroll", onScroll, true); removeEventListener("resize", onResize); removeEventListener("keydown", onKey); removeEventListener("pointerdown", onDown, true); };
  }, [open]);

  if (!mounted) return null;
  const th = lang === "th";
  return createPortal(
    <div
      ref={tip}
      id={MANAGED_TIP_ID}
      role="tooltip"
      hidden={!open}
      className="managed-tip fixed z-[200] rounded-[10px] border border-[#151A28] bg-[#151A28] px-3 py-2.5 text-[12.5px] text-[#E5E7EB] shadow-[0_10px_24px_rgba(16,24,40,.24)] dark:border-[#3A4252] dark:bg-[#2A3142] dark:text-[#D7DBE3] dark:shadow-[0_10px_24px_rgba(0,0,0,.45)]"
      style={{ width: "min(280px, calc(100vw - 24px))", lineHeight: th ? 1.6 : 1.5, top: pos?.top ?? -9999, left: pos?.left ?? -9999, visibility: pos ? "visible" : "hidden" }}
    >
      <span aria-hidden="true" className={cn("absolute h-[10px] w-[10px] rotate-45 border-[#151A28] bg-[#151A28] dark:border-[#3A4252] dark:bg-[#2A3142]", pos?.above ? "-bottom-[6px] border-b border-r" : "-top-[6px] border-l border-t")} style={{ left: (pos?.arrow ?? 0) - 5 }} />
      <span className="mb-0.5 block font-semibold text-white">{t("Managed by PitchSnack")}</span>
      {t("A PitchSnack private client. PitchSnack set up this profile for them and manages it. NDAs and messages go through the PitchSnack team.")}
    </div>,
    document.body,
  );
}

/**
 * Narrow covers: steps up `level` until the badge keeps 8px from the left pill.
 * Resets on width change.
 */
export function useCoverFit(on: boolean, max: number) {
  const box = useRef<HTMLDivElement>(null);
  const left = useRef<HTMLElement>(null);
  const right = useRef<HTMLDivElement>(null);
  const [level, setLevel] = useState(0);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!on || !box.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(box.current);
    return () => ro.disconnect();
  }, [on]);
  useLayoutEffect(() => { setLevel(0); }, [w]);
  useLayoutEffect(() => {
    if (!on || !left.current || !right.current) return;
    const gap = right.current.getBoundingClientRect().left - left.current.getBoundingClientRect().right;
    if (gap < 8 && level < max) setLevel(level + 1);
  });
  return { box, left, right, level };
}
