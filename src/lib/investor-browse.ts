/**
 * Seller › Browse investors — public investor card shape and filter rules.
 * Only ranges (never exact figures) and public buying criteria live here.
 */

export type PublicInvestor = {
  id: string;
  refNo: string;
  codeName: string;
  /** Real name only when the investor turned on "Show my name to sellers". */
  name: string | null;
  type: string | null;
  city: string | null;
  country: string | null;
  description: string | null;
  sectors: string[];
  stages: string[];
  dealTypes: string[];
  geography: string | null;
  verified: boolean;
  proofOfFunds: boolean;
  /** Public AUM range (group revenue for corporate buyers), in baht. */
  aumLo: number | null;
  aumHi: number | null;
  aumLabel: string | null;
  /** Public ticket range, in baht. hi null = open-ended. */
  ticketLo: number | null;
  ticketHi: number | null;
  ticketLabel: string | null;
  /** Buying revenue band, baht millions. hi null = open-ended (legacy rows hold a single minimum). */
  revenueMinM: number | null;
  revenueMaxM: number | null;
};

export const isCorporateBuyer = (type: string | null) => {
  const t = (type ?? "").toLowerCase();
  return t.includes("corporate") && !t.includes("vc");
};

export function moneyTHB(n: number) {
  if (n >= 1e9) return `฿${+(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `฿${+(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `฿${Math.round(n / 1e3)}K`;
  return `฿${n}`;
}

// ---------- revenue bands ----------
export const REVENUE_BANDS: [number, number | null, string][] = [
  [0, 100, "Below ฿100M"],
  [100, 250, "฿100M – ฿250M"],
  [250, 500, "฿250M – ฿500M"],
  [500, 850, "฿500M – ฿850M"],
  [850, 1000, "฿850M – ฿1B"],
  [1000, null, "฿1B and above"],
];

export const bandValue = (lo: number, hi: number | null) => `${lo}:${hi ?? ""}`;

/** Parse a stored selector value ("0:100", "1000:", or a legacy plain "50"). */
export function parseRevenueBandValue(v: string): { lo: number; hi: number | null } | null {
  if (!v) return null;
  const parts = v.split(":");
  const lo = Number(parts[0]);
  if (!Number.isFinite(lo)) return null;
  return { lo, hi: parts.length > 1 && parts[1] !== "" ? Number(parts[1]) : null };
}

/** The band matching a stored pair, or null for a legacy single minimum. */
export function findRevenueBand(lo: number | null, hi: number | null): (typeof REVENUE_BANDS)[number] | null {
  if (lo == null) return null;
  return REVENUE_BANDS.find((b) => b[0] === lo && (b[1] ?? null) === (hi ?? null)) ?? null;
}

export const revenueBandLabel = (lo: number | null, hi: number | null) => {
  if (lo == null) return null;
  if (lo === 0 && hi == null) return "No minimum";
  if (hi == null) return `${moneyTHB(lo * 1e6)}+`;
  if (lo === 0) return `Below ${moneyTHB(hi * 1e6)}`;
  return hi === lo ? moneyTHB(lo * 1e6) : `${moneyTHB(lo * 1e6)} – ${moneyTHB(hi * 1e6)}`;
};

/** Card/list line for the buying revenue band; null = not set. */
export function revenueCardText(lo: number | null, hi: number | null): string | null {
  if (lo == null) return null;
  const label = revenueBandLabel(lo, hi);
  if (!label) return null;
  return label === "No minimum" ? "No revenue minimum" : `Revenue ${label}`;
}

const unit = (s: string) => {
  const m = s.replace(/,/g, "").match(/([\d.]+)\s*([kmb])?/i);
  if (!m) return null;
  const mult = { k: 1e3, m: 1e6, b: 1e9 }[(m[2] ?? "").toLowerCase() as "k"] ?? 1;
  const n = Number(m[1]) * mult;
  return Number.isFinite(n) ? n : null;
};

/** Parse a stored range like "50M-100M", "500M+" or "1M". */
export function parseRange(s: string | null | undefined): { lo: number | null; hi: number | null } | null {
  if (!s || !s.trim()) return null;
  const parts = s.split(/\s*[-–]\s*/);
  const lo = unit(parts[0]);
  if (lo == null) return null;
  if (s.trim().endsWith("+")) return { lo, hi: null };
  const hi = parts[1] ? unit(parts[1]) : lo;
  return { lo, hi };
}

export const rangeLabel = (lo: number | null, hi: number | null) =>
  lo == null ? null : hi == null ? `${moneyTHB(lo)}+` : hi === lo ? moneyTHB(lo) : `${moneyTHB(lo)} – ${moneyTHB(hi)}`;

// ---------- filters ----------
export type FilterOpt = { value: string; label: string; active?: string };

export const AUM_FILTER: FilterOpt[] = [
  { value: "", label: "Any AUM" },
  ...[[100e6, "฿100M"], [500e6, "฿500M"], [1e9, "฿1B"], [5e9, "฿5B"], [10e9, "฿10B"]].map(([v, l]) => ({
    value: String(v), label: `${l} or more`, active: `AUM ${l}+`,
  })),
];

const TICKET_BANDS: [number, number | null, string][] = [
  [0, 50e6, "Under ฿50M"], [50e6, 100e6, "฿50M – 100M"], [100e6, 250e6, "฿100M – 250M"],
  [250e6, 500e6, "฿250M – 500M"], [500e6, 1e9, "฿500M – 1B"], [1e9, null, "฿1B and over"],
];
export const TICKET_FILTER: FilterOpt[] = [
  { value: "", label: "Any ticket size" },
  ...TICKET_BANDS.map(([lo, hi, l]) => ({ value: `${lo}:${hi ?? ""}`, label: l, active: `Ticket ${l}` })),
];

export const REVENUE_FILTER: FilterOpt[] = [
  { value: "", label: "Any revenue" },
  ...REVENUE_BANDS.map(([lo, hi, l]) => ({ value: bandValue(lo, hi), label: l, active: `Revenue ${l}` })),
];

/** Buying-requirement selector options: revenue bands, in baht millions. */
export const REVENUE_MIN_OPTIONS: FilterOpt[] = REVENUE_BANDS.map(([lo, hi, l]) => ({
  value: bandValue(lo, hi),
  label: l,
}));

export type InvestorFilters = { aum: string; ticket: string; revenue: string };

export function matchAum(i: PublicInvestor, v: string) {
  if (!v) return true;
  return i.aumLo != null && i.aumLo >= Number(v);
}
export function matchTicket(i: PublicInvestor, v: string) {
  if (!v) return true;
  if (i.ticketLo == null && i.ticketHi == null) return false;
  const [a, b] = v.split(":");
  const bandLo = Number(a);
  const bandHi = b ? Number(b) : Infinity;
  const tMin = i.ticketLo ?? 0;
  const tMax = i.ticketHi ?? Infinity;
  return tMin < bandHi && tMax >= bandLo;
}
/** True when the investor's buying revenue band overlaps the picked band. */
export function matchRevenue(i: PublicInvestor, v: string) {
  if (!v) return true;
  if (i.revenueMinM == null) return false;
  const [a, b] = v.split(":");
  const slo = Number(a);
  const shi = b ? Number(b) : Infinity;
  const blo = i.revenueMinM;
  const bhi = i.revenueMaxM == null ? Infinity : i.revenueMaxM;
  return blo < shi && bhi > slo;
}
