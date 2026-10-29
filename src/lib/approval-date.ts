import { dateEn, dateTh } from "@/lib/access-codes";
import type { Language } from "@/i18n/language";

/** Approval dates: Thai short months and the Buddhist year in Thai. */
export function approvalDate(iso: string | null | undefined, lang: Language): string {
  if (!iso) return "—";
  const parsed = new Date(iso);
  const day = Number.isFinite(parsed.getTime()) ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(parsed) : iso.slice(0, 10);
  return lang === "th" ? dateTh(day) : dateEn(day);
}


export function approvalWaitingDays(iso: string | null | undefined, now = new Date()): number {
  if (!iso || !Number.isFinite(Date.parse(iso))) return 0;
  const day = (d: Date) => new Intl.DateTimeFormat("en-CA", {timeZone:"Asia/Bangkok",year:"numeric",month:"2-digit",day:"2-digit"}).format(d);
  return Math.max(0, Math.round((Date.parse(day(now)) - Date.parse(day(new Date(iso)))) / 86400000));
}
export function approvalFullDate(value: string, lang: Language): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(lang === "th" ? "th-TH" : "en-GB", {timeZone:"Asia/Bangkok",day:"numeric",month:"long",year:"numeric"}).format(date) : value;
}
