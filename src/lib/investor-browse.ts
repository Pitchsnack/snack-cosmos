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
  /** Baht millions. null = not set, 0 = no minimum. */
  revenueMinM: number | null;
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

export function revenueMinLabel(m: number | null) {
  if (m == null) return null;
  if (m === 0) return "No minimum";
  return moneyTHB(m * 1e6);
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
  { value: "", label: "Any minimum" },
  { value: "0", label: "No minimum", active: "No revenue minimum" },
  ...[10, 50, 100, 250, 500, 1000].map((m) => {
    const l = m >= 1000 ? `฿${m / 1000}B` : `฿${m}M`;
    return { value: String(m), label: `Up to ${l}`, active: `Revenue min. up to ${l}` };
  }),
];

export const REVENUE_MIN_OPTIONS = [
  { value: "0", label: "No minimum" },
  ...[10, 50, 100, 250, 500, 1000].map((m) => ({ value: String(m), label: m >= 1000 ? "฿1B" : `฿${m}M` })),
];

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
export function matchRevenue(i: PublicInvestor, v: string) {
  if (!v) return true;
  if (i.revenueMinM == null) return false;
  return i.revenueMinM <= Number(v);
}
