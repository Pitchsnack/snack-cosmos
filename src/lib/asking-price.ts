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
