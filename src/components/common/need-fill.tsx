import { useEffect, type RefObject } from "react";

/**
 * Setup wizards: "fields still needed". A field still needed carries
 * data-need="1" and the .need-fill class (light blue). When a question opens
 * with at least one value and at least one field still needed, the cursor goes
 * into the first field still needed, caret at the end.
 */
export const needCls = (need: boolean) => (need ? "need-fill" : "");

export function useFocusNeeded(ref: RefObject<HTMLElement | null>, questionKey: string) {
  useEffect(() => {
    const t = window.setTimeout(() => {
      const root = ref.current;
      if (!root) return;
      const fields = Array.from(root.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
        "input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([disabled]), select:not([disabled]), textarea:not([disabled])",
      ));
      const hasValue = !!root.querySelector("[data-fixed]") || fields.some((f) => f.value.trim() !== "");
      const first = fields.find((f) => f.dataset.need === "1");
      if (!hasValue || !first) return;
      first.focus({ preventScroll: false });
      if (first instanceof HTMLInputElement || first instanceof HTMLTextAreaElement) {
        const n = first.value.length;
        try { first.setSelectionRange(n, n); } catch { /* number inputs */ }
      }
    }, 60);
    return () => window.clearTimeout(t);
  }, [questionKey]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** One-line address: "{unit}, {street}, {district}, {province} {postal}", empty parts left out. */
export function addressLine(p: { unit?: string | null; street?: string | null; district?: string | null; province?: string | null; postal?: string | null }) {
  const tail = [p.province?.trim(), p.postal?.trim()].filter(Boolean).join(" ");
  return [p.unit?.trim(), p.street?.trim(), p.district?.trim(), tail].filter(Boolean).join(", ");
}
