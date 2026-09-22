/**
 * Valuation maths for the Financials → Valuation tab.
 *
 * Pure functions only: no data access, no formatting side effects. Every figure
 * comes from the filing or the matched peer set — nothing is invented and a
 * missing input blocks the method rather than being guessed.
 */

import { median, type Peer } from "@/lib/peer-comparables";
import type { RatioItem, StatementItem } from "@/lib/financials.functions";

/* ------------------------------------------------------------------ */
/* Assumptions                                                         */
/* ------------------------------------------------------------------ */

export interface Discounts {
  /** Percent discount for lack of marketability. */
  marketability: number;
  /** Percent discount for size. */
  size: number;
  /** Percent adjustment for growth differential; may be negative. */
  growth: number;
  /** Percent control premium, or null when not applied (the default). */
  control: number | null;
}

export const DEFAULT_DISCOUNTS: Discounts = {
  marketability: 25,
  size: 15,
  growth: 0,
  control: null,
};

/** Width of the band drawn either side of an adjusted multiple. */
export const BAND_PCT = 15;

export function ladderFactors(d: Discounts): {
  marketability: number;
  size: number;
  growth: number;
  control: number;
  total: number;
} {
  const marketability = 1 - d.marketability / 100;
  const size = 1 - d.size / 100;
  const growth = 1 + d.growth / 100;
  const control = 1 + (d.control ?? 0) / 100;
  return {
    marketability,
    size,
    growth,
    control,
    total: marketability * size * growth * control,
  };
}

/* ------------------------------------------------------------------ */
/* Inputs from the filing                                              */
/* ------------------------------------------------------------------ */

export interface FilingInputs {
  year: number | undefined;
  revenue: number | null;
  /** Sales revenue — the only safe margin denominator. */
  salesRevenue: number | null;
  totalRevenue: number | null;
  grossProfit: number | null;
  grossMarginPct: number | null;
  netProfit: number | null;
  equity: number | null;
  totalAssets: number | null;
  totalLiabilities: number | null;
  /** Reported D&A from the cash flow statement; usually absent. */
  da: number | null;
  ebit: number | null;
  ebitMarginPct: number | null;
  /** Only set when D&A is reported — an estimate must never feed a valuation. */
  ebitda: number | null;
  /** Bracketed D&A from the balance sheet, or the reported figure. */
  daLow: number | null;
  daHigh: number | null;
  ebitdaLow: number | null;
  ebitdaHigh: number | null;
  ebitdaMarginLowPct: number | null;
  ebitdaMarginHighPct: number | null;
  /** True when the bracket comes from the balance sheet rather than the filing. */
  ebitdaEstimated: boolean;
  netMarginPct: number | null;
  /** EBIT − (total revenue − total expenses), when it exceeds 0.1% of sales. */
  reconciliationDiff: number | null;
  /** Total revenue is below sales revenue in this filing. */
  revenueOrderNote: boolean;
}

function pick(items: StatementItem[], code: string, year: number | undefined): number | null {
  if (!year) return null;
  const row = items.find((i) => i.item_code === code && i.fiscal_year === year);
  const v = row?.amount;
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Average of this year and last, or this year alone when no prior exists. */
function avg(cur: number | null, prior: number | null): number | null {
  if (cur === null) return null;
  return prior === null ? cur : (cur + prior) / 2;
}

export function readFilingInputs(
  year: number | undefined,
  income: StatementItem[],
  position: StatementItem[],
  cashFlow: StatementItem[],
  ratios: RatioItem[],
): FilingInputs {
  const prior = year ? year - 1 : undefined;
  const salesRevenue = pick(income, "revenue_sales_services", year);
  const totalRevenue = pick(income, "total_revenue", year);
  const revenue = salesRevenue ?? totalRevenue;
  const cogs = pick(income, "cost_of_goods_sold", year);
  const netProfit = pick(income, "net_profit_loss", year);
  const pbt = pick(income, "profit_loss_before_income_tax", year);
  const interest = pick(income, "interest_expenses", year);
  const totalExpenses = pick(income, "total_expenses", year);
  const da = pick(cashFlow, "cf_depreciation_amortization", year);
  const ebit = pbt === null ? null : pbt + (interest ?? 0);
  const ebitda = ebit === null || da === null ? null : ebit + Math.abs(da);

  const grossProfit =
    salesRevenue !== null && cogs !== null ? salesRevenue - cogs : null;
  const denom = salesRevenue ?? totalRevenue;
  const marginOf = (v: number | null) =>
    v === null || !denom ? null : (v / denom) * 100;

  // D&A is bracketed from the balance sheet when the cash flow statement is empty.
  const ppe = avg(
    pick(position, "property_plant_equipment", year),
    pick(position, "property_plant_equipment", prior),
  );
  const nca = (y: number | undefined) => {
    const total = pick(position, "total_non_current_assets", y);
    const p = pick(position, "property_plant_equipment", y);
    return total === null || p === null ? null : total - p;
  };
  const other = avg(nca(year), nca(prior));

  const estLow = ppe === null ? null : ppe / 5;
  const estHigh = ppe === null ? null : ppe / 3 + (other ?? 0) / 5;

  const reported = da !== null;
  const daLow = reported ? Math.abs(da!) : estLow;
  const daHigh = reported ? Math.abs(da!) : estHigh;
  const ebitdaLow = ebit === null || daLow === null ? null : ebit + daLow;
  const ebitdaHigh = ebit === null || daHigh === null ? null : ebit + daHigh;

  const netMarginPct =
    ratios.find((r) => r.ratio_code === "net_profit_margin" && r.fiscal_year === year)?.value ??
    (revenue && netProfit !== null ? (netProfit / revenue) * 100 : null);

  // Data checks — shown, never hidden.
  let reconciliationDiff: number | null = null;
  if (ebit !== null && totalRevenue !== null && totalExpenses !== null && salesRevenue) {
    const diff = ebit - (totalRevenue - totalExpenses);
    if (Math.abs(diff) > Math.abs(salesRevenue) * 0.001) reconciliationDiff = diff;
  }
  const revenueOrderNote =
    salesRevenue !== null && totalRevenue !== null && totalRevenue < salesRevenue;

  return {
    year,
    revenue,
    salesRevenue,
    totalRevenue,
    grossProfit,
    grossMarginPct: marginOf(grossProfit),
    netProfit,
    equity: pick(position, "equity", year),
    totalAssets: pick(position, "total_assets", year),
    totalLiabilities: pick(position, "total_liabilities", year),
    da,
    ebit,
    ebitMarginPct: marginOf(ebit),
    ebitda,
    daLow,
    daHigh,
    ebitdaLow,
    ebitdaHigh,
    ebitdaMarginLowPct: marginOf(ebitdaLow),
    ebitdaMarginHighPct: marginOf(ebitdaHigh),
    ebitdaEstimated: !reported && ebitdaLow !== null,
    netMarginPct,
    reconciliationDiff,
    revenueOrderNote,
  };
}


/* ------------------------------------------------------------------ */
/* Peer medians                                                        */
/* ------------------------------------------------------------------ */

export interface PeerMedians {
  pbv: number | null;
  pe: number | null;
  evEbitda: number | null;
  /** Derived: EV/EBITDA × EBITDA margin. */
  evSales: number | null;
  ebitdaMarginPct: number | null;
  revenueThbM: number | null;
}

export function peerMedians(peers: Peer[]): PeerMedians {
  const evSalesValues = peers.map((p) =>
    p.evEbitda !== null && p.ebitdaMarginPct !== null
      ? p.evEbitda * (p.ebitdaMarginPct / 100)
      : null,
  );
  return {
    pbv: median(peers.map((p) => p.pbv)),
    pe: median(peers.map((p) => p.pe)),
    evEbitda: median(peers.map((p) => p.evEbitda)),
    evSales: median(evSalesValues),
    ebitdaMarginPct: median(peers.map((p) => p.ebitdaMarginPct)),
    revenueThbM: median(peers.map((p) => p.revenueThbM)),
  };
}

/* ------------------------------------------------------------------ */
/* Methods                                                             */
/* ------------------------------------------------------------------ */

export type MethodStatus = "usable" | "low confidence" | "blocked" | "out of scope";

export interface MethodResult {
  key: string;
  name: string;
  status: MethodStatus;
  /** Plain-words reason, always present. */
  reason: string;
  /** "equity 887.33M × 0.70–1.15×" — only on usable rows. */
  input: string | null;
  low: number | null;
  high: number | null;
  /** Point estimates (book value) draw without a span. */
  point: boolean;
}

/** One candidate's place in the tail test. */
export interface CandidateInfo {
  key: string;
  name: string;
  midpoint: number;
  /** midpoint ÷ reference, when the rule ran. */
  ratio: number | null;
  tail: boolean;
  lowConfidence: boolean;
}

export interface ValuationResult {
  methods: MethodResult[];
  /** Methods drawn on the By method chart. */
  drawn: MethodResult[];
  /** Book value — a reference marker, never a candidate. */
  bookValue: number | null;
  /** Candidates that took part in the tail test. */
  candidates: CandidateInfo[];
  /** Candidates set aside as tails. */
  tails: CandidateInfo[];
  /** Candidates kept. */
  included: MethodResult[];
  /** True when 3 or more candidates existed, so the tail rule ran. */
  ruleRan: boolean;
  /** Median of all candidate midpoints, when the rule ran. */
  reference: number | null;
  /** Accepted zone: 0.5× to 2× the reference. */
  zone: { low: number; high: number } | null;
  /** Span of the included methods — the axis domain. */
  spread: { low: number; high: number } | null;
  /** Where the included methods agree. */
  indicative: { low: number; high: number } | null;
  /** Names of the methods behind the agreed range. */
  agreeNames: string[];
  /** The agreed range came from a single remaining method. */
  singleMethod: boolean;
  agreeCount: number;
  totalCount: number;
  /** First blocked method, if any — drives the notice and the tab dot. */
  blocked: MethodResult | null;
  lowConfidence: boolean;
  effective: { pbv: Range | null; evSales: Range | null; evEbitda: Range | null };
  adjusted: { pbv: number | null; evSales: number | null; evEbitda: number | null };
  medians: PeerMedians;
}


export interface Range {
  low: number;
  high: number;
}

function band(multiple: number | null): Range | null {
  if (multiple === null || !Number.isFinite(multiple)) return null;
  return { low: multiple * (1 - BAND_PCT / 100), high: multiple * (1 + BAND_PCT / 100) };
}

export function computeValuation(
  inputs: FilingInputs,
  peers: Peer[],
  discounts: Discounts,
  /** Normalised earnings from the Adjustments tab; only P/E uses them. */
  normalised?: { netProfit: number | null; revenue?: number | null; applied: boolean } | null,
): ValuationResult {
  const medians = peerMedians(peers);
  const f = ladderFactors(discounts).total;
  const usesNormalised =
    Boolean(normalised?.applied) &&
    normalised?.netProfit !== null &&
    normalised?.netProfit !== undefined;
  const peProfit = usesNormalised ? normalised!.netProfit! : inputs.netProfit;
  const usesNormalisedRevenue =
    Boolean(normalised?.applied) &&
    normalised?.revenue !== null &&
    normalised?.revenue !== undefined &&
    normalised.revenue !== inputs.revenue;
  const saleRevenue = usesNormalisedRevenue ? normalised!.revenue! : inputs.revenue;

  const adjusted = {
    pbv: medians.pbv === null ? null : medians.pbv * f,
    evSales: medians.evSales === null ? null : medians.evSales * f,
    evEbitda: medians.evEbitda === null ? null : medians.evEbitda * f,
  };
  const effective = {
    pbv: band(adjusted.pbv),
    evSales: band(adjusted.evSales),
    evEbitda: band(adjusted.evEbitda),
  };

  const methods: MethodResult[] = [];

  // Book value
  methods.push(
    inputs.equity !== null
      ? {
          key: "book",
          name: "Book value",
          status: "usable",
          reason: "Equity as filed. A floor, not a market price.",
          input: `equity ${fmtMoney(inputs.equity)} · reference only`,
          low: inputs.equity,
          high: inputs.equity,
          point: true,
        }
      : blockedMethod("book", "Book value", "equity not captured in the import"),
  );

  // P/BV
  methods.push(
    buildMultipleMethod({
      key: "pbv",
      name: "P/BV",
      base: inputs.equity,
      baseLabel: "equity",
      range: effective.pbv,
      missingBase: "equity not captured in the import",
      missingMultiple: "no P/BV figures in the peer set",
    }),
  );

  // Revenue multiple (EV/Sales)
  methods.push(
    buildMultipleMethod({
      key: "evsales",
      name: "Revenue multiple",
      base: saleRevenue,
      baseLabel: "revenue",
      baseSuffix: usesNormalisedRevenue ? " normalised" : "",
      range: effective.evSales,
      missingBase: "revenue not captured in the import",
      missingMultiple: "peers carry no EV/EBITDA and EBITDA margin, so EV/Sales cannot be derived",
      // It prices the whole enterprise, not the equity — worth saying on the row.
      note: "EV basis",
    }),
  );

  // P/E — suppression rules
  if (peProfit === null) {
    methods.push(blockedMethod("pe", "P/E", "net profit not captured in the import"));
  } else if (peProfit <= 0) {
    methods.push({
      key: "pe",
      name: "P/E",
      status: "blocked",
      reason: "Suppressed — the company is loss-making, so an earnings multiple has no meaning.",
      input: null,
      low: null,
      high: null,
      point: false,
    });
  } else if (medians.pe === null) {
    methods.push(blockedMethod("pe", "P/E", "no P/E figures in the peer set"));
  } else {
    const pe = band(medians.pe * f)!;
    const thin = inputs.netMarginPct !== null && inputs.netMarginPct < 2;
    methods.push({
      key: "pe",
      name: "P/E",
      status: thin ? "low confidence" : "usable",
      reason: thin
        ? `Net margin ${inputs.netMarginPct!.toFixed(2)}% — a small change in profit moves this range a long way.`
        : "Peer P/E median, with the assumptions applied.",
      input: `net profit ${fmtMoney(peProfit)}${
        usesNormalised ? " normalised" : ""
      } × ${fmtMult(pe.low)}–${fmtMult(pe.high)}`,
      low: peProfit * pe.low,
      high: peProfit * pe.high,
      point: false,
    });
  }


  // EV/EBITDA
  if (inputs.ebitda === null) {
    methods.push(
      blockedMethod(
        "evebitda",
        "EV/EBITDA",
        inputs.da === null
          ? "depreciation not captured in the import"
          : "operating profit not captured in the import",
      ),
    );
  } else {
    methods.push(
      buildMultipleMethod({
        key: "evebitda",
        name: "EV/EBITDA",
        base: inputs.ebitda,
        baseLabel: "EBITDA",
        range: effective.evEbitda,
        missingBase: "EBITDA cannot be derived",
        missingMultiple: "no EV/EBITDA figures in the peer set",
      }),
    );
  }

  methods.push({
    key: "dcf",
    name: "DCF",
    status: "out of scope",
    reason: "Requires forecasts the platform does not hold.",
    input: null,
    low: null,
    high: null,
    point: false,
  });

  const drawn = methods.filter(
    (m) => m.low !== null && m.high !== null && m.status !== "out of scope",
  );

  // Book value is a single reference point, not a range: it can't agree with
  // anything, so it never takes part.
  const bookRow = drawn.find((m) => m.point) ?? null;
  const candidateRows = drawn.filter((m) => !m.point);
  const mids = candidateRows.map((m) => (m.low! + m.high!) / 2);

  // With fewer than 3 candidates the "median" is just an average, and the rule
  // would throw out the credible method. It only runs at 3 or more.
  const ruleRan = candidateRows.length >= 3;
  // Rounded once, to the nearest million, so the reference reads the same in
  // the chart label, the reasoning table and the tail note.
  const rawReference = ruleRan ? median(mids) : null;
  const reference = rawReference === null ? null : Math.round(rawReference / 1e6) * 1e6;
  const zone = reference === null ? null : { low: reference * 0.5, high: reference * 2 };

  const candidates: CandidateInfo[] = candidateRows.map((m, i) => {
    const midpoint = mids[i]!;
    const ratio = reference ? midpoint / reference : null;
    return {
      key: m.key,
      name: m.name,
      midpoint,
      ratio,
      tail: zone !== null && (midpoint < zone.low || midpoint > zone.high),
      lowConfidence: m.status === "low confidence",
    };
  });

  const tails = candidates.filter((c) => c.tail);
  const tailKeys = new Set(tails.map((c) => c.key));
  const included = candidateRows.filter((m) => !tailKeys.has(m.key));

  const spread = included.length
    ? {
        low: Math.min(...included.map((m) => m.low!)),
        high: Math.max(...included.map((m) => m.high!)),
      }
    : null;

  let indicative: Range | null = null;
  let agreeNames: string[] = [];
  const singleMethod = included.length === 1;
  if (singleMethod) {
    indicative = { low: included[0]!.low!, high: included[0]!.high! };
    agreeNames = [included[0]!.name];
  } else if (included.length > 1) {
    const low = Math.max(...included.map((m) => m.low!));
    const high = Math.min(...included.map((m) => m.high!));
    // No overlap means the methods disagree; inventing a range would hide that.
    if (low <= high) {
      indicative = { low, high };
      agreeNames = included.map((m) => m.name);
    }
  }

  return {
    methods,
    drawn,
    bookValue: bookRow?.low ?? null,
    candidates,
    tails,
    included,
    ruleRan,
    reference,
    zone,
    spread,
    indicative,
    agreeNames,
    singleMethod,
    agreeCount: indicative ? included.length : 0,
    totalCount: candidates.length,
    blocked: methods.find((m) => m.status === "blocked") ?? null,
    lowConfidence: methods.some((m) => m.status === "low confidence"),
    effective,
    adjusted,
    medians,
  };
}

function blockedMethod(key: string, name: string, missing: string): MethodResult {
  return {
    key,
    name,
    status: "blocked",
    reason: `Unavailable — ${missing}.`,
    input: null,
    low: null,
    high: null,
    point: false,
  };
}

function buildMultipleMethod(a: {
  key: string;
  name: string;
  base: number | null;
  baseLabel: string;
  baseSuffix?: string;
  range: Range | null;
  missingBase: string;
  missingMultiple: string;
  note?: string;
}): MethodResult {
  if (a.base === null) return blockedMethod(a.key, a.name, a.missingBase);
  if (!a.range) return blockedMethod(a.key, a.name, a.missingMultiple);
  return {
    key: a.key,
    name: a.name,
    status: "usable",
    reason: "Peer median with the assumptions applied.",
    input: `${a.baseLabel} ${fmtMoney(a.base)}${a.baseSuffix ?? ""} × ${fmtMult(a.range.low)}–${fmtMult(a.range.high)}${
      a.note ? ` · ${a.note}` : ""
    }`,
    low: a.base * a.range.low,
    high: a.base * a.range.high,
    point: false,
  };
}

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

export function fmtMoney(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  if (abs >= 1e12) return `${(v / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(v / 1e6 >= 100 ? 0 : 2)}M`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return v.toFixed(0);
}

export function fmtMult(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return `${v.toFixed(2)}×`;
}

/** Round half away from zero, on the decimal value rather than the raw float. */
export function roundHalf(v: number, digits = 2): number {
  const f = 10 ** digits;
  const sign = v < 0 ? -1 : 1;
  return (sign * Math.round(Math.abs(v) * f + Number.EPSILON)) / f;
}

/** Formats a decimal with a true minus sign, never a hyphen. */
export function fmtSigned(v: number, digits = 2, suffix = ""): string {
  const r = roundHalf(v, digits);
  return `${r < 0 ? "−" : ""}${Math.abs(r).toFixed(digits)}${suffix}`;
}

export function fmtPct(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return fmtSigned(v, digits, "%");
}

/** Position of a value on a 0–100 scale between two bounds. */
export function scalePos(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v) || hi <= lo) return 0;
  return Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100));
}
