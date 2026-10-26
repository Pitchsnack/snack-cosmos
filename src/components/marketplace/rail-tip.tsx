import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { MousePointer2, MousePointerClick, PanelLeftOpen, X } from "lucide-react";
import { useTranslation } from "@/i18n/language";

/** Folded-menu copy (EN → TH). Menu item labels come from the app's own dictionary. */
const TH: Record<string, string> = {
  "The menu is folded": "เมนูถูกย่ออยู่",
  "Point at an icon to see its name.": "ชี้ที่ไอคอนเพื่อดูชื่อเมนู",
  "Got it": "เข้าใจแล้ว",
  Close: "ปิด",
  "Open the menu": "ขยายเมนู",
  "Fold the menu": "ย่อเมนู",
  "Seller view": "มุมมองผู้ขาย",
  "Buyer view": "มุมมองผู้ซื้อ",
  "Advisor view": "มุมมองที่ปรึกษา",
  "not on your account": "ไม่ใช่บัญชีของท่าน",
  locked: "ล็อกอยู่",
  Seller: "ผู้ขาย",
  Buyer: "ผู้ซื้อ",
  Advisor: "ที่ปรึกษา",
};
export function useRailCopy() {
  const { language } = useTranslation();
  const th = language === "th";
  return {
    th,
    c: (s: string) => (th ? TH[s] ?? s : s),
    fresh: (n: string) => (th ? `ใหม่ ${n}` : `${n} new`),
  };
}

/* ------------------------------- labels -------------------------------- */
let lastHidden = 0;
let showing = 0;

/**
 * Dark label beside a folded-menu icon (or under the logo). Hover after 250ms
 * (at once when moving between icons), keyboard focus at once; hides on leave,
 * blur, Escape and click. When the icon holds a count badge, adds "· n new".
 */
export function RailTip({ label, side = "right", disabled, children }: { label: string; side?: "right" | "bottom"; disabled?: boolean; children: ReactNode }) {
  const wrap = useRef<HTMLSpanElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [count, setCount] = useState<string | null>(null);
  const { fresh } = useRailCopy();
  const text = count ? `${label} · ${fresh(count)}` : label;

  const target = () => wrap.current?.firstElementChild as HTMLElement | null;
  // Keep the icon's accessible name equal to the label (including its live count).
  useLayoutEffect(() => {
    const el = target();
    if (!el) return;
    const read = () => setCount(el.querySelector<HTMLElement>("[data-count]")?.dataset.count ?? null);
    read();
    const mo = new MutationObserver(read);
    mo.observe(el, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-count"] });
    return () => mo.disconnect();
  }, []);
  useLayoutEffect(() => { target()?.setAttribute("aria-label", text); });

  const show = () => {
    const el = target();
    if (!el || disabled) return;
    const r = el.getBoundingClientRect();
    setPos(side === "right" ? { x: r.right + 12, y: r.top + r.height / 2 } : { x: r.left + r.width / 2, y: r.bottom + 8 });
  };
  const hide = () => {
    window.clearTimeout(timer.current);
    setPos((p) => { if (p) lastHidden = Date.now(); return null; });
  };
  useEffect(() => { if (pos) { showing++; return () => { showing--; }; } }, [pos]);
  useEffect(() => { if (disabled) hide(); }, [disabled]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    if (!pos) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopImmediatePropagation(); hide(); } };
    const away = () => hide();
    document.addEventListener("keydown", key, true);
    window.addEventListener("scroll", away, true);
    window.addEventListener("resize", away);
    return () => { document.removeEventListener("keydown", key, true); window.removeEventListener("scroll", away, true); window.removeEventListener("resize", away); };
  }, [pos]);

  return (
    <span
      ref={wrap}
      className="contents"
      onPointerOver={(e) => {
        if (e.pointerType === "touch" || pos || timer.current) return;
        const quick = showing > 0 || Date.now() - lastHidden < 500;
        if (quick) show();
        else timer.current = window.setTimeout(() => { timer.current = undefined; show(); }, 250);
      }}
      onPointerOut={(e) => {
        if (wrap.current?.firstElementChild?.contains(e.relatedTarget as Node)) return;
        window.clearTimeout(timer.current); timer.current = undefined; hide();
      }}
      onPointerDown={hide}
      onFocus={(e) => { if ((e.target as HTMLElement).matches(":focus-visible")) show(); }}
      onBlur={hide}
    >
      {children}
      {pos && typeof document !== "undefined" && createPortal(
        <div
          ref={(el) => {
            if (!el || side !== "bottom") return;
            const w = el.offsetWidth;
            const vw = document.documentElement.clientWidth;
            const left = Math.max(12, Math.min(pos.x - w / 2, vw - 12 - w));
            el.style.left = `${left}px`;
            el.style.transform = "none";
            const arrow = el.firstElementChild as HTMLElement | null;
            if (arrow) arrow.style.left = `${Math.max(10, Math.min(pos.x - left, w - 10))}px`;
          }}
          role="presentation"
          className="pointer-events-none fixed z-[48] whitespace-nowrap rounded-[8px] bg-[#151A28] px-[10px] py-[6px] text-[12.5px] font-semibold leading-[1.25] text-white shadow-[0_6px_18px_rgba(15,23,42,.22)]"
          style={side === "right"
            ? { left: pos.x, top: pos.y, transform: "translateY(-50%)" }
            : { left: pos.x, top: pos.y, transform: "translateX(-50%)" }}
        >
          <span aria-hidden className={side === "right"
            ? "absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2 rotate-45 rounded-[1px] bg-[#151A28]"
            : "absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 rounded-[1px] bg-[#151A28]"} />
          <span className="relative">{text}</span>
        </div>,
        document.body,
      )}
    </span>
  );
}

/* -------------------------------- hint --------------------------------- */
export const MENU_HINT_KEY = "ps_menu_hint_done";
export const menuHintDone = () => { try { return localStorage.getItem(MENU_HINT_KEY) === "1"; } catch { return false; } };
export const markMenuHintDone = () => { try { localStorage.setItem(MENU_HINT_KEY, "1"); } catch { /* noop */ } };

/** Card under the logo while the menu is folded: the logo opens it, icons show names. */
export function FoldedMenuHint({ onClose }: { onClose: () => void }) {
  const { th, c } = useRailCopy();
  const id = useId();
  const [arrow, setArrow] = useState(40);
  const LEFT = 72; // folded menu 64px + 8px
  useLayoutEffect(() => {
    const place = () => {
      const r = document.querySelector<HTMLElement>("[data-ps-logo]")?.getBoundingClientRect();
      if (r) setArrow(Math.max(19, r.left + r.width / 2 - LEFT));
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  const brand = <b className="font-bold italic text-[#151A28] dark:text-[#F3F4F6]">PitchSnack</b>;
  const line = "flex items-start gap-[7px] text-[13px] leading-[1.45] text-[#434A5C] dark:text-[#C5CAD6]";
  const ic = "mt-[2px] h-3.5 w-3.5 shrink-0 text-[#B45309] dark:text-[#F6A823]";
  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby={`${id}-t`}
      aria-describedby={`${id}-a ${id}-b`}
      className="fixed z-[45] w-[340px] max-w-[calc(100vw-24px)] rounded-[14px] border border-[#E6E8ED] bg-white px-4 pb-3 pt-[14px] shadow-[0_18px_48px_rgba(15,23,42,.24),0_2px_6px_rgba(15,23,42,.10)] dark:border-[#323A4D] dark:bg-[#1E2433]"
      style={{ top: 66, left: LEFT, fontFamily: "'DM Sans', system-ui, sans-serif" }}
    >
      <span aria-hidden className="absolute -top-[7px] h-[14px] w-[14px] -translate-x-1/2 rotate-45 rounded-tl-[2px] border-l border-t border-[#E6E8ED] bg-white dark:border-[#323A4D] dark:bg-[#1E2433]" style={{ left: arrow }} />
      <button type="button" aria-label={c("Close")} onClick={onClose}
        className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-[8px] text-[#6A7181] hover:bg-[#F2F4F7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-[#A3ABBD] dark:hover:bg-white/[.06]">
        <X className="h-4 w-4" />
      </button>
      <div className="flex gap-[11px]">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-[#FEF3DE] dark:bg-[rgba(246,168,35,.16)]">
          <PanelLeftOpen className="h-[17px] w-[17px] text-[#B45309] dark:text-[#F6A823]" />
        </span>
        <div className="min-w-0 flex-1">
          <div id={`${id}-t`} className="pr-[22px] text-[14.5px] font-bold leading-[1.3] text-[#151A28] dark:text-[#F3F4F6]">{c("The menu is folded")}</div>
          <div className="mt-1.5 space-y-[5px]">
            <p id={`${id}-a`} className={line}><MousePointerClick aria-hidden className={ic} />
              <span>{th ? <>คลิกโลโก้ {brand} เพื่อขยายเมนู</> : <>Click the {brand} logo to open the full menu.</>}</span></p>
            <p id={`${id}-b`} className={line}><MousePointer2 aria-hidden className={ic} /><span>{c("Point at an icon to see its name.")}</span></p>
          </div>
        </div>
      </div>
      <div className="mt-[2px] flex justify-end">
        <button type="button" onClick={onClose}
          className="h-8 rounded-[8px] bg-[#1E2A4A] px-3 text-[13px] font-semibold text-white hover:bg-[#26355C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-[#F3F4F6] dark:text-[#151A28] dark:hover:bg-white">
          {c("Got it")}
        </button>
      </div>
    </div>
  );
}
