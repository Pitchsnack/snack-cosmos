/**
 * Earnings normalisation — pure types and maths for the Valuation → Adjustments
 * tab. Nothing here reads data or formats side effects.
 *
 * The type sets the direction, so an entry can never contradict itself, and
 * unrecorded income is recorded but never enters a calculation.
 *
 * Revenue types are entered as what the user knows — sales, a discount, the
 * costs behind them — and their effect on revenue and profit is computed here.
 */

export type AdjustmentType =
  | "booked_expense"
  | "one_off_expense"
  | "missing_cost"
  | "unrecorded_income"
  | "below_market_related_party"
  | "revenue_elsewhere"
  | "one_off_income";

export type FilingLine =
  | "cost_of_goods_sold"
  | "selling_admin"
  | "other_expenses"
  | "revenue"
  | "other_income";

export type Recurs = "yearly" | "one_off";

export type Stake = "minority" | "controlling";

export interface Adjustment {
  id: string;
  description: string;
  type: AdjustmentType;
  filingLine: FilingLine | null;
  /**
   * THB per year, pre-tax, always positive. For revenue types this is the
   * input the user knows: sales at the related-party price, sales booked
   * elsewhere, or the one-off income received.
   */
  amount: number;
  /** Below-market related-party sales: discount to market price, percent. */
  discountPct: number | null;
  /** Revenue booked elsewhere: the costs behind those sales. */
  costsAmount: number | null;
  recurs: Recurs;
}

export interface ValuationSettings {
  stake: Stake;
  /** Percent. */
  taxRate: number;
  /** The one listed company chosen for the Benchmark, if any. */
  benchmarkPeerId?: string | null;
}

export const DEFAULT_VALUATION_SETTINGS: ValuationSettings = {
  stake: "minority",
  taxRate: 20,
  benchmarkPeerId: null,
};

export const REVENUE_TYPES: AdjustmentType[] = [
  "below_market_related_party",
  "revenue_elsewhere",
  "one_off_income",
];

export const EXPENSE_TYPES: AdjustmentType[] = [
  "booked_expense",
  "one_off_expense",
  "missing_cost",
  "unrecorded_income",
];

export function isRevenueType(type: AdjustmentType): boolean {
  return REVENUE_TYPES.includes(type);
}

export const ADJUSTMENT_TYPE_LABELS: Record<AdjustmentType, string> = {
  booked_expense: "Booked expense",
  one_off_expense: "One-off expense",
  missing_cost: "Missing cost",
  unrecorded_income: "Unrecorded income",
  below_market_related_party: "Below-market related-party sales",
  revenue_elsewhere: "Revenue booked elsewhere",
  one_off_income: "One-off income",
};

export const FILING_LINE_LABELS: Record<FilingLine, string> = {
  cost_of_goods_sold: "Cost of goods sold",
  selling_admin: "Selling & admin",
  other_expenses: "Other expenses",
  revenue: "Revenue from Sales & Services",
  other_income: "Other income",
};

/** The filing line a revenue type always sits on. */
export function revenueFilingLine(type: AdjustmentType): FilingLine | null {
  if (type === "below_market_related_party" || type === "revenue_elsewhere") return "revenue";
  if (type === "one_off_income") return "other_income";
  return null;
}

export type Direction = "add_back" | "deduct" | "none";

/** The type alone decides the direction. */
export function direction(type: AdjustmentType): Direction {
  switch (type) {
    case "booked_expense":
    case "one_off_expense":
    case "below_market_related_party":
    case "revenue_elsewhere":
      return "add_back";
    case "missing_cost":
    case "one_off_income":
      return "deduct";
    case "unrecorded_income":
      return "none";
  }
}

export interface Effects {
  /** Effect on reported revenue, signed. */
  revenue: number;
  /** Effect on profit before tax, signed. */
  profit: number;
}

/**
 * What an entry does to revenue and to pre-tax profit, worked out from the
 * inputs the user gave — never typed in directly.
 */
export function effects(a: Adjustment): Effects {
  switch (a.type) {
    case "below_market_related_party": {
      const disc = (a.discountPct ?? 0) / 100;
      if (disc <= 0 || disc >= 1) return { revenue: 0, profit: 0 };
      const gap = a.amount / (1 - disc) - a.amount;
      return { revenue: gap, profit: gap };
    }
    case "revenue_elsewhere":
      return { revenue: a.amount, profit: a.amount - (a.costsAmount ?? 0) };
    case "one_off_income":
      return { revenue: 0, profit: -a.amount };
    case "booked_expense":
    case "one_off_expense":
      return { revenue: 0, profit: a.amount };
    case "missing_cost":
      return { revenue: 0, profit: -a.amount };
    case "unrecorded_income":
      return { revenue: 0, profit: 0 };
  }
}

export interface Normalisation {
  /** True only under a controlling stake with at least one usable adjustment. */
  applied: boolean;
  appliedCount: number;
  savedCount: number;
  unrecordedCount: number;
  addBacks: number;
  deductions: number;
  netPreTax: number;
  tax: number;
  netEffect: number;
  reportedNetProfit: number | null;
  normalisedNetProfit: number | null;
  /** Revenue side. */
  revenueAdjustment: number;
  reportedRevenue: number | null;
  normalisedRevenue: number | null;
}

/**
 * Adjustments only reach a buyer who can change how the company spends, so
 * they are applied under a controlling stake and never under a minority one.
 */
export function normalise(
  adjustments: Adjustment[],
  settings: ValuationSettings,
  reportedNetProfit: number | null,
  reportedRevenue: number | null = null,
): Normalisation {
  const usable = adjustments.filter((a) => direction(a.type) !== "none");
  const unrecordedCount = adjustments.length - usable.length;

  let addBacks = 0;
  let deductions = 0;
  let revenueAdjustment = 0;
  for (const a of usable) {
    const e = effects(a);
    if (e.profit >= 0) addBacks += e.profit;
    else deductions += -e.profit;
    revenueAdjustment += e.revenue;
  }

  const controlling = settings.stake === "controlling";
  const netPreTax = controlling ? addBacks - deductions : 0;
  const tax = netPreTax * (settings.taxRate / 100);
  const netEffect = netPreTax - tax;
  const applied = controlling && usable.length > 0;
  const revAdj = controlling ? revenueAdjustment : 0;

  return {
    applied,
    appliedCount: controlling ? usable.length : 0,
    savedCount: adjustments.length,
    unrecordedCount,
    addBacks: controlling ? addBacks : 0,
    deductions: controlling ? deductions : 0,
    netPreTax,
    tax,
    netEffect,
    reportedNetProfit,
    normalisedNetProfit:
      reportedNetProfit === null ? null : reportedNetProfit + netEffect,
    revenueAdjustment: revAdj,
    reportedRevenue,
    normalisedRevenue: reportedRevenue === null ? null : reportedRevenue + revAdj,
  };
}

/** Signed profit effect as it reads in the table; null when never applied. */
export function signedAmount(a: Adjustment): number | null {
  if (direction(a.type) === "none") return null;
  return effects(a).profit;
}
