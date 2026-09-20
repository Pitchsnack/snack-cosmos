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
  netProfit: number | null;
  equity: number | null;
  totalAssets: number | null;
  totalLiabilities: number | null;
  da: number | null;
  ebit: number | null;
  ebitda: number | null;
  netMarginPct: number | null;
}

function pick(items: StatementItem[], code: string, year: number | undefined): number | null {
  if (!year) return null;
  const row = items.find((i) => i.item_code === code && i.fiscal_year === year);
  const v = row?.amount;
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function readFilingInputs(
  year: number | undefined,
  income: StatementItem[],
  position: StatementItem[],
  cashFlow: StatementItem[],
  ratios: RatioItem[],
): FilingInputs {
  const revenue =
    pick(income, "revenue_sales_services", year) ?? pick(income, "total_revenue", year);
  const netProfit = pick(income, "net_profit_loss", year);
  const pbt = pick(income, "profit_loss_before_income_tax", year);
  const interest = pick(income, "interest_expenses", year);
  const da = pick(cashFlow, "cf_depreciation_amortization", year);
  const ebit = pbt === null ? null : pbt + (interest ?? 0);
  const ebitda = ebit === null || da === null ? null : ebit + Math.abs(da);
  const netMarginPct =
    ratios.find((r) => r.ratio_code === "net_profit_margin" && r.fiscal_year === year)?.value ??
    (revenue && netProfit !== null ? (netProfit / revenue) * 100 : null);

  return {
    year,
    revenue,
    netProfit,
    equity: pick(position, "equity", year),
    totalAssets: pick(position, "total_assets", year),
    totalLiabilities: pick(position, "total_liabilities", year),
    da,
    ebit,
    ebitda,
    netMarginPct,
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

export interface ValuationResult {
  methods: MethodResult[];
  /** Methods drawn on the By method chart. */
  drawn: MethodResult[];
  /** Full spread across every drawn method. */
  spread: { low: number; high: number } | null;
  /** Where the reliable methods agree. */
  indicative: { low: number; high: number } | null;
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
): ValuationResult {
  const medians = peerMedians(peers);
  const f = ladderFactors(discounts).total;

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
          input: `equity ${fmtMoney(inputs.equity)}`,
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
      base: inputs.revenue,
      baseLabel: "revenue",
      range: effective.evSales,
      missingBase: "revenue not captured in the import",
      missingMultiple: "peers carry no EV/EBITDA and EBITDA margin, so EV/Sales cannot be derived",
    }),
  );

  // P/E — suppression rules
  if (inputs.netProfit === null) {
    methods.push(blockedMethod("pe", "P/E", "net profit not captured in the import"));
  } else if (inputs.netProfit <= 0) {
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
      input: `net profit ${fmtMoney(inputs.netProfit)} × ${fmtMult(pe.low)}–${fmtMult(pe.high)}`,
      low: inputs.netProfit * pe.low,
      high: inputs.netProfit * pe.high,
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
  const reliable = drawn.filter((m) => m.status === "usable" && !m.point);

  const spread = drawn.length
    ? {
        low: Math.min(...drawn.map((m) => m.low!)),
        high: Math.max(...drawn.map((m) => m.high!)),
      }
    : null;

  let indicative: Range | null = null;
  if (reliable.length) {
    const low = Math.max(...reliable.map((m) => m.low!));
    const high = Math.min(...reliable.map((m) => m.high!));
    indicative =
      low <= high
        ? { low, high }
        : {
            low: Math.min(...reliable.map((m) => m.low!)),
            high: Math.max(...reliable.map((m) => m.high!)),
          };
  }

  const agreeCount = indicative
    ? drawn.filter((m) => m.high! >= indicative!.low && m.low! <= indicative!.high).length
    : 0;

  return {
    methods,
    drawn,
    spread,
    indicative,
    agreeCount,
    totalCount: methods.filter((m) => m.status !== "out of scope").length,
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
  range: Range | null;
  missingBase: string;
  missingMultiple: string;
}): MethodResult {
  if (a.base === null) return blockedMethod(a.key, a.name, a.missingBase);
  if (!a.range) return blockedMethod(a.key, a.name, a.missingMultiple);
  return {
    key: a.key,
    name: a.name,
    status: "usable",
    reason: "Peer median with the assumptions applied.",
    input: `${a.baseLabel} ${fmtMoney(a.base)} × ${fmtMult(a.range.low)}–${fmtMult(a.range.high)}`,
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

export function fmtPct(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return `${v.toFixed(digits)}%`;
}

/** Position of a value on a 0–100 scale between two bounds. */
export function scalePos(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v) || hi <= lo) return 0;
  return Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100));
}
