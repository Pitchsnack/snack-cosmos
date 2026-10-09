import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared "Edit opens the form at its section" helper for Advisor, Buyer and
 * Seller. The section key lives in the URL (?section=…); the form wraps each
 * section in <EditSec> and calls useOpenAtSection once its data has loaded.
 */

export type EditTone = "seller" | "buyer";

/** Marks one form section. Draws the coloured box behind it when active, without moving anything. */
export function EditSec({ id, active, tone, className, children }: { id: string; active?: boolean; tone: EditTone; className?: string; children: ReactNode }) {
  return (
    <div data-edit-sec={id} className={cn("relative", className)}>
      {active && <div aria-hidden="true" className={cn("edit-sec-box", tone === "seller" ? "is-seller" : "is-buyer")} />}
      <div className="relative">{children}</div>
    </div>
  );
}

function pinnedBottom(): number {
  let max = 0;
  document.querySelectorAll<HTMLElement>("header, [data-pinned-top]").forEach((el) => {
    const pos = getComputedStyle(el).position;
    if (pos !== "sticky" && pos !== "fixed") return;
    const r = el.getBoundingClientRect();
    if (r.top <= 1 && r.bottom > max && r.height < window.innerHeight / 2) max = r.bottom;
  });
  return max;
}

/** Scrolls the section's box to 16px under the pinned bar, then focuses its first field. */
export function useOpenAtSection(section: string | undefined, ready = true, opts?: { focusSelector?: string }) {
  useEffect(() => {
    if (!section || !ready) return;
    const t = setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-edit-sec="${section}"]`);
      if (!el) return;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      let sc: HTMLElement | null = el.parentElement;
      while (sc && !(/(auto|scroll)/.test(getComputedStyle(sc).overflowY) && sc.scrollHeight > sc.clientHeight)) sc = sc.parentElement;
      const behavior = reduce ? "auto" : "smooth";
      const pin = pinnedBottom();
      if (sc?.hasAttribute("data-edit-info-body")) {
        // Edit information pop-up: 16px under its header, or under the sticky tab row.
        const tabs = sc.querySelector<HTMLElement>("[data-sticky-tabs]");
        const top = el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - (tabs?.offsetHeight ?? 0) - 16 - 10;
        sc.scrollTo({ top: Math.max(0, top), behavior });
      } else if (sc) {
        const top = el.getBoundingClientRect().top - Math.max(sc.getBoundingClientRect().top, pin) + sc.scrollTop - 16 - 10;
        sc.scrollTo({ top: Math.max(0, top), behavior });
      } else {
        window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - pin - 16 - 10), behavior });
      }
      const target = el.querySelector<HTMLElement>(opts?.focusSelector ?? "[data-edit-focus]")
        ?? el.querySelector<HTMLElement>("input:not([type=hidden]):not([disabled]), textarea, select, [role=combobox], button:not([disabled])");
      target?.focus({ preventScroll: true });
    }, 80);
    return () => clearTimeout(t);
  }, [section, ready]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** The small Edit link at the right end of a panel section's heading. */
export function SectionEditLink({ onClick, tone, label = "Edit" }: { onClick: () => void; tone: EditTone; label?: string }) {
  return (
    <button type="button" onClick={onClick}
      className={cn("text-[12.5px] font-medium normal-case tracking-normal hover:underline",
        tone === "seller" ? "text-[#8A4B06] dark:text-[#F6A823]" : "text-[#4338CA] dark:text-[#A5ADFF]")}>
      {label}
    </button>
  );
}
