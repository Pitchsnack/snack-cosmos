import { fmtAmount, fmtPct, parsePct, type FeeDetail } from "./advisor-firm";

/** Split only the combined retainer in profile panels, never change stored fee words. */
export function panelFeeLines(detail: FeeDetail | undefined, words: string | undefined, thai: boolean): [string, string] | null {
  let amount: string | undefined;
  let percent: string | undefined;
  if (detail?.type === "retainer_success") {
    const pct = parsePct(detail.pct);
    if (!/^\d{1,12}$/.test(detail.amount) || Number(detail.amount) < 1 || !pct) return null;
    amount = fmtAmount(detail.amount); percent = fmtPct(pct);
  } else if (!detail) {
    // Admin's existing projection carries canonical words, not structured details.
    const match = words?.match(/^Retainer ฿([\d,]+) a month, then a ([\d.–-]+)% success fee$/);
    if (match) { amount = match[1]; percent = match[2]; }
  }
  if (!amount || !percent) return null;
  return thai ? [`ค่าบริการรายเดือน ฿${amount}`, `ค่าธรรมเนียมความสำเร็จ ${percent}%`]
    : [`Retainer ฿${amount}/month`, `${percent}% success fee`];
}