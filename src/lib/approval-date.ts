import { dateEn, dateTh } from "@/lib/access-codes";
import type { Language } from "@/i18n/language";

/** Approval dates: Thai short months and the Buddhist year in Thai. */
export function approvalDate(iso: string | null | undefined, lang: Language): string {
  if (!iso) return "—";
  const day = iso.slice(0, 10);
  return lang === "th" ? dateTh(day) : dateEn(day);
}
