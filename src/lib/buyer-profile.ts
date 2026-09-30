export type BuyerPerson = { name: string; role: string; email: string; phone: string };
export type BuyerHolding = { name: string; note: string };

export type BuyerProfile = {
  user_id: string; ref_no: string; code_name: string;
  headline: string | null; description: string | null; show_name: boolean;
  status: "draft" | "live" | "paused"; live_since: string | null;
  legal_name: string | null; address: string | null; city: string | null; country: string | null;
  logo_url: string | null; private_description: string | null;
  aum_exact: string | null; ticket_exact: string | null;
  ticket_min: number | null; ticket_max: number | null; aum_value: number | null;
  track_record: string | null; decision_process: string | null; pof_verified_at: string | null;
  sectors: string[]; stages: string[]; deal_types: string[];
  target_size: string | null; geography: string | null;
  people: BuyerPerson[]; portfolio: BuyerHolding[];
  profile_views_month: number;
};

export type BuyerOrg = {
  name: string | null; type: string | null; website: string | null; registrationNo: string | null;
  verified: boolean; ndas: number; lois: number;
};

export type PublicBuyer = {
  id: string; refNo: string; codeName: string; name: string | null; type: string | null;
  city: string | null; country: string | null; headline: string | null; description: string | null;
  ticket: string | null; aum: string | null; sectors: string[]; stages: string[]; dealTypes: string[];
  verified: boolean; proofOfFunds: boolean; status: string; liveSince: string | null;
};

const BANDS = [1e6, 5e6, 10e6, 25e6, 50e6, 100e6, 250e6, 500e6, 1e9, 5e9];
function money(n: number) {
  if (n >= 1e9) return `$${+(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${+(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${Math.round(n / 1e3)}K`;
  return `$${n}`;
}
function band(n: number): [number, number | null] {
  let lo = 0;
  for (const b of BANDS) { if (n < b) return [lo, b]; lo = b; }
  return [lo, null];
}
export function aumRange(v: number | null) {
  if (v == null) return null;
  const [lo, hi] = band(v);
  return hi == null ? `${money(lo)}+` : `${money(lo)} – ${money(hi)}`;
}
export function ticketRange(min: number | null, max: number | null) {
  if (min == null && max == null) return null;
  const lo = min != null ? band(min)[0] : null;
  const hi = max != null ? band(max)[1] : null;
  if (lo != null && hi != null) return `${money(lo)} – ${money(hi)}`;
  if (lo != null) return `${money(lo)}+`;
  return `Up to ${money(hi ?? max!)}`;
}

export type BuyerTone = { bg: string; fg: string };
/** Cover colour by investor type. */
export function typeTone(type: string | null): BuyerTone {
  const t = (type ?? "").toLowerCase();
  if (t.includes("family")) return { bg: "bg-amber-100 dark:bg-amber-950/50", fg: "text-amber-700 dark:text-amber-300" };
  if (t.includes("private equity") || t === "pe" || t.includes("pe ")) return { bg: "bg-indigo-100 dark:bg-indigo-950/50", fg: "text-indigo-700 dark:text-indigo-300" };
  if (t.includes("corporate vc") || t.includes("cvc")) return { bg: "bg-blue-100 dark:bg-blue-950/50", fg: "text-blue-700 dark:text-blue-300" };
  if (t.includes("venture") || t === "vc") return { bg: "bg-violet-100 dark:bg-violet-950/50", fg: "text-violet-700 dark:text-violet-300" };
  if (t.includes("incubat") || t.includes("accelerat")) return { bg: "bg-green-100 dark:bg-green-950/50", fg: "text-green-700 dark:text-green-300" };
  return { bg: "bg-slate-100 dark:bg-slate-800/60", fg: "text-slate-700 dark:text-slate-300" };
}

export type BuyerItemKey = "mandate" | "headline" | "people" | "company" | "portfolio";
export function buyerCompleteness(p: BuyerProfile | null, org: BuyerOrg | null) {
  const items: { key: BuyerItemKey; label: string; weight: number; required: boolean; done: boolean }[] = [
    { key: "mandate", label: "Mandate", weight: 35, required: true, done: !!p && (p.ticket_min != null || p.ticket_max != null) && p.sectors.length > 0 && p.stages.length > 0 && p.deal_types.length > 0 },
    { key: "headline", label: "Public headline", weight: 30, required: true, done: !!p?.headline?.trim() },
    { key: "people", label: "Decision makers", weight: 15, required: false, done: (p?.people.length ?? 0) > 0 },
    { key: "company", label: "Company details", weight: 10, required: false, done: !!org?.name && !!p?.address && !!org?.website },
    { key: "portfolio", label: "Portfolio", weight: 10, required: false, done: (p?.portfolio.length ?? 0) > 0 },
  ];
  const pct = items.reduce((a, i) => a + (i.done ? i.weight : 0), 0);
  return { items, pct, missingRequired: items.filter((i) => i.required && !i.done).length };
}
