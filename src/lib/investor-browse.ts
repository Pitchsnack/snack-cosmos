/**
 * Seller › Browse investors — public investor card shape and filter rules.
 * Only US$ bands (never exact figures) and public buying criteria live here.
 */
import { AUM_BANDS, REV_BANDS, TICKET_BANDS, bandOf } from "@/lib/investor-bands";

export type PublicInvestor = {
  id: string;
  refNo: string;
  /** Seller-facing title before an NDA: the investor type ("Investor" when unset). */
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
  aumBand: string | null;
  ticketBand: string | null;
  revBand: string | null;
  aumLabel: string | null;
  ticketLabel: string | null;
  revLabel: string | null;
};

export const isCorporateBuyer = (type: string | null) => {
  const t = (type ?? "").toLowerCase();
  return (t.includes("corporate") && !t.includes("vc")) || t.includes("corporate buyer");
};

export function moneyTHB(n: number) {
  if (n >= 1e9) return `฿${+(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `฿${+(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `฿${Math.round(n / 1e3)}K`;
  return `฿${n}`;
}

// ---------- filters ----------
export type FilterOpt = { value: string; label: string; active?: string };

const usdShort = (m: number) => `US$${m}M`;
const BAHT_PLUS: Record<number, string> = { 50: "฿1.5B+", 100: "฿3B+", 250: "฿8B+", 500: "฿15B+" };

export const AUM_FILTER: FilterOpt[] = [
  { value: "", label: "Any AUM" },
  ...AUM_BANDS.filter((b) => b.lo > 0).map((b) => ({
    value: String(b.lo), label: `${usdShort(b.lo)} or more (${BAHT_PLUS[b.lo]})`, active: `AUM ${usdShort(b.lo)}+`,
  })),
];
export const TICKET_FILTER: FilterOpt[] = [
  { value: "", label: "Any ticket size" },
  ...TICKET_BANDS.map((b) => ({ value: b.key, label: `${b.label} (${b.baht})`, active: `Ticket ${b.label}` })),
];
export const REVENUE_FILTER: FilterOpt[] = [
  { value: "", label: "Any minimum" },
  ...REV_BANDS.map((b) => ({ value: b.key, label: `${b.label} (${b.baht})`, active: `Revenue ${b.label}` })),
];

export type InvestorFilters = { aum: string; ticket: string; revenue: string };

/** AUM (or group revenue) band bottom at or above the pick. */
export function matchAum(i: PublicInvestor, v: string) {
  if (!v) return true;
  const b = bandOf(i.aumBand);
  return !!b && b.lo >= Number(v);
}
/** Average investment band is the pick. */
export function matchTicket(i: PublicInvestor, v: string) {
  if (!v) return true;
  return i.ticketBand === v;
}
/** Investor's revenue minimum bottom at or below the picked band. */
export function matchRevenue(i: PublicInvestor, v: string) {
  if (!v) return true;
  const mine = bandOf(i.revBand);
  const pick = bandOf(v);
  return !!mine && !!pick && mine.lo <= pick.lo;
}
