/**
 * Earnings normalisation — pure types and maths for the Valuation → Adjustments
 * tab. Nothing here reads data or formats side effects.
 *
 * The type sets the direction, so an entry can never contradict itself, and
 * unrecorded income is recorded but never enters a calculation.
 */

export type AdjustmentType =
  | "booked_expense"
  | "one_off_expense"
  | "missing_cost"
  | "unrecorded_income";

export type FilingLine = "cost_of_goods_sold" | "selling_admin" | "other_expenses";

export type Recurs = "yearly" | "one_off";

export type Stake = "minority" | "controlling";

export interface Adjustment {
  id: string;
  description: string;
  type: AdjustmentType;
  filingLine: FilingLine | null;
  /** THB per year, pre-tax, always positive. */
  amount: number;
  recurs: Recurs;
}

export interface ValuationSettings {
  stake: Stake;
  /** Percent. */
  taxRate: number;
}

export const DEFAULT_VALUATION_SETTINGS: ValuationSettings = {
  stake: "minority",
  taxRate: 20,
};

export const ADJUSTMENT_TYPE_LABELS: Record<AdjustmentType, string> = {
  booked_expense: "Booked expense",
  one_off_expense: "One-off expense",
  missing_cost: "Missing cost",
  unrecorded_income: "Unrecorded income",
};

export const FILING_LINE_LABELS: Record<FilingLine, string> = {
  cost_of_goods_sold: "Cost of goods sold",
  selling_admin: "Selling & admin",
  other_expenses: "Other expenses",
};

export type Direction = "add_back" | "deduct" | "none";

/** The type alone decides the direction. */
export function direction(type: AdjustmentType): Direction {
  switch (type) {
    case "booked_expense":
    case "one_off_expense":
      return "add_back";
    case "missing_cost":
      return "deduct";
    case "unrecorded_income":
      return "none";
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
}

/**
 * Adjustments only reach a buyer who can change how the company spends, so
 * they are applied under a controlling stake and never under a minority one.
 */
export function normalise(
  adjustments: Adjustment[],
  settings: ValuationSettings,
  reportedNetProfit: number | null,
): Normalisation {
  const usable = adjustments.filter((a) => direction(a.type) !== "none");
  const unrecordedCount = adjustments.length - usable.length;
  const addBacks = usable
    .filter((a) => direction(a.type) === "add_back")
    .reduce((s, a) => s + a.amount, 0);
  const deductions = usable
    .filter((a) => direction(a.type) === "deduct")
    .reduce((s, a) => s + a.amount, 0);

  const controlling = settings.stake === "controlling";
  const netPreTax = controlling ? addBacks - deductions : 0;
  const tax = netPreTax * (settings.taxRate / 100);
  const netEffect = netPreTax - tax;
  const applied = controlling && usable.length > 0;

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
  };
}

/** Signed amount as it reads in the table: deductions negative, income neutral. */
export function signedAmount(a: Adjustment): number | null {
  const d = direction(a.type);
  if (d === "none") return null;
  return d === "add_back" ? a.amount : -a.amount;
}
