/** Asking price (Estimate): whole baht, and the six price ranges buyers see before an approved NDA. */
export type PriceBandKey = "under_50m" | "50m_100m" | "100m_250m" | "250m_500m" | "500m_1b" | "over_1b";
export type PriceBand = { key: PriceBandKey; label: string; th: string; from: number; to: number | null };

export const PRICE_BANDS: PriceBand[] = [
  { key: "under_50m", label: "Under ฿50M", th: "ต่ำกว่า ฿50M", from: 1, to: 50_000_000 },
  { key: "50m_100m", label: "฿50M – 100M", th: "฿50M – 100M", from: 50_000_000, to: 100_000_000 },
  { key: "100m_250m", label: "฿100M – 250M", th: "฿100M – 250M", from: 100_000_000, to: 250_000_000 },
  { key: "250m_500m", label: "฿250M – 500M", th: "฿250M – 500M", from: 250_000_000, to: 500_000_000 },
  { key: "500m_1b", label: "฿500M – 1B", th: "฿500M – 1B", from: 500_000_000, to: 1_000_000_000 },
  { key: "over_1b", label: "Over ฿1B", th: "฿1B +", from: 1_000_000_000, to: null },
];

/** Same rule as the database's asking_price_band(): lower edge included. */
export function bandOf(thb: number | null | undefined): PriceBand | null {
  if (thb == null || !(thb > 0)) return null;
  return PRICE_BANDS.find((b) => thb >= b.from && (b.to == null || thb < b.to)) ?? null;
}

/** A listing or approved snapshot's amount in baht: asking_price_thb, else the old millions column × 1,000,000. */
export function thbOf(row: { asking_price_thb?: number | string | null; asking_price?: number | string | null } | null | undefined): number | null {
  if (!row) return null;
  if (row.asking_price_thb != null && Number(row.asking_price_thb) > 0) return Math.round(Number(row.asking_price_thb));
  if (row.asking_price != null && Number(row.asking_price) > 0) return Math.round(Number(row.asking_price) * 1_000_000);
  return null;
}

/** What leaves the server: the exact amount only when `exact` is allowed, otherwise the range only. */
export function priceFor(row: Parameters<typeof thbOf>[0], exact: boolean): { askingPrice: number | null; priceBand: { key: PriceBandKey; label: string; th: string } | null } {
  const thb = thbOf(row);
  const b = bandOf(thb);
  return { askingPrice: exact ? thb : null, priceBand: b ? { key: b.key, label: b.label, th: b.th } : null };
}

/** Running text: first and last labels start lower-case. */
export function bandInText(label: string) {
  return label.startsWith("Under") || label.startsWith("Over") ? label[0].toLowerCase() + label.slice(1) : label;
}

export const fmtThb = (n: number) => `฿ ${Math.round(n).toLocaleString("en-US")}`;

const ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
function under1000(n: number): string {
  const h = Math.floor(n / 100), r = n % 100;
  const rest = r < 20 ? ONES[r] : TENS[Math.floor(r / 10)] + (r % 10 ? "-" + ONES[r % 10] : "");
  return [h ? `${ONES[h]} hundred` : "", rest].filter(Boolean).join(" and ");
}
/** "One hundred and twenty million" */
export function thbWords(n: number): string {
  n = Math.floor(n);
  if (n <= 0) return "";
  const scales: [number, string][] = [[1e12, "trillion"], [1e9, "billion"], [1e6, "million"], [1e3, "thousand"], [1, ""]];
  const parts: string[] = [];
  for (const [v, w] of scales) {
    const c = Math.floor(n / v) % 1000;
    if (c) parts.push(`${under1000(c)}${w ? " " + w : ""}`);
  }
  const s = parts.join(" ");
  return s[0].toUpperCase() + s.slice(1);
}

const TH_D = ["", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const TH_P = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];
function thUnderMillion(n: number): string {
  const ds = String(n).split("").map(Number);
  let out = "";
  ds.forEach((d, i) => {
    const pos = ds.length - 1 - i;
    if (!d) return;
    if (pos === 1 && d === 1) out += "สิบ";
    else if (pos === 1 && d === 2) out += "ยี่สิบ";
    else if (pos === 0 && d === 1 && ds.length > 1) out += "เอ็ด";
    else out += TH_D[d] + TH_P[pos];
  });
  return out;
}
/** "หนึ่งร้อยยี่สิบล้าน" */
export function thbWordsTh(n: number): string {
  n = Math.floor(n);
  if (n <= 0) return "";
  const m = Math.floor(n / 1e6), r = n % 1e6;
  return (m ? (m >= 1e6 ? thbWordsTh(m) : thUnderMillion(m)) + "ล้าน" : "") + (r ? thUnderMillion(r) : "");
}
