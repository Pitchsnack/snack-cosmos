/**
 * Shared definitions for the Startup Financials area.
 * Row structures follow the SnackPortal2 financial statement specification.
 */

export type StatementRowDef = {
  code: string;
  label: string;
  isTotal?: boolean;
};

export const INCOME_ROWS: StatementRowDef[] = [
  { code: "revenue_sales_services", label: "Revenue from Sales&Services" },
  { code: "total_revenue", label: "Total Revenue", isTotal: true },
  { code: "cost_of_goods_sold", label: "Cost of Goods Sold" },
  { code: "gross_profit_loss", label: "Gross Profit (Loss)", isTotal: true },
  { code: "selling_admin_expenses", label: "Selling&Admin Expenses" },
  { code: "total_expenses", label: "Total Expenses", isTotal: true },
  { code: "interest_expenses", label: "Interest Expenses" },
  { code: "profit_loss_before_income_tax", label: "Profit(Loss) before Income Tax", isTotal: true },
  { code: "income_tax_expense", label: "Income Tax Expense" },
  { code: "net_profit_loss", label: "Net Profit (Loss)", isTotal: true },
];

export const POSITION_ROWS: StatementRowDef[] = [
  { code: "accounts_receivable", label: "Accounts Receivable" },
  { code: "inventories", label: "Inventories" },
  { code: "total_current_assets", label: "Total Current Assets", isTotal: true },
  { code: "property_plant_equipment", label: "Property, Plant and Equipment" },
  { code: "total_non_current_assets", label: "Total Non-current Assets", isTotal: true },
  { code: "total_assets", label: "Total Assets", isTotal: true },
  { code: "total_current_liabilities", label: "Total Current Liabilities", isTotal: true },
  { code: "total_non_current_liabilities", label: "Total Non-current Liabilities", isTotal: true },
  { code: "total_liabilities", label: "Total Liabilities", isTotal: true },
  { code: "equity", label: "Equity", isTotal: true },
  { code: "total_liabilities_equity", label: "Total Liabilities and Equity", isTotal: true },
];

export type CashFlowSection = "operating" | "investing" | "financing" | "cash_movement";

export const CASH_FLOW_SECTIONS: {
  section: CashFlowSection;
  title: string;
  rows: StatementRowDef[];
}[] = [
  {
    section: "operating",
    title: "Operating Activities",
    rows: [
      { code: "cf_net_profit_loss", label: "Net Profit (Loss)" },
      { code: "cf_depreciation_amortization", label: "Depreciation & Amortization" },
      { code: "cf_change_accounts_receivable", label: "Change in Accounts Receivable" },
      { code: "cf_change_inventories", label: "Change in Inventories" },
      { code: "cf_change_accounts_payable", label: "Change in Accounts Payable" },
      { code: "cf_other_operating", label: "Other Operating Adjustments" },
      { code: "cf_net_operating", label: "Net Cash Flow from Operating Activities", isTotal: true },
    ],
  },
  {
    section: "investing",
    title: "Investing Activities",
    rows: [
      { code: "cf_purchase_ppe", label: "Purchase of Property, Plant & Equipment" },
      { code: "cf_sale_of_assets", label: "Proceeds from Sale of Assets" },
      { code: "cf_other_investing", label: "Investments / Other Investing Activities" },
      { code: "cf_net_investing", label: "Net Cash Flow from Investing Activities", isTotal: true },
    ],
  },
  {
    section: "financing",
    title: "Financing Activities",
    rows: [
      { code: "cf_borrowings", label: "Borrowings" },
      { code: "cf_debt_repayment", label: "Debt Repayment" },
      { code: "cf_capital_contribution", label: "Capital Contribution" },
      { code: "cf_dividend_payments", label: "Dividend Payments" },
      { code: "cf_other_financing", label: "Other Financing Activities" },
      { code: "cf_net_financing", label: "Net Cash Flow from Financing Activities", isTotal: true },
    ],
  },
  {
    section: "cash_movement",
    title: "Cash Movement",
    rows: [
      { code: "cf_net_change_cash", label: "Net Increase / (Decrease) in Cash", isTotal: true },
      { code: "cf_cash_beginning", label: "Cash at Beginning of Year" },
      { code: "cf_cash_end", label: "Cash at End of Year", isTotal: true },
    ],
  },
];

export type RatioCategory =
  | "profitability"
  | "liquidity"
  | "operation_efficiency"
  | "financial_position_proportion";

export const RATIO_GROUPS: {
  category: RatioCategory;
  title: string;
  rows: { code: string; label: string; unit: "percent" | "times" }[];
}[] = [
  {
    category: "profitability",
    title: "Profitability Ratio",
    rows: [
      { code: "return_on_assets", label: "Return on Assets (%)", unit: "percent" },
      { code: "return_on_equity", label: "Return on Equity (%)", unit: "percent" },
      { code: "gross_profit_margin", label: "Gross Profit Margin (%)", unit: "percent" },
      {
        code: "operating_income_on_revenue",
        label: "Operating Income on Revenue Ratio (%)",
        unit: "percent",
      },
      { code: "net_profit_margin", label: "Net Profit Margin (%)", unit: "percent" },
    ],
  },
  {
    category: "liquidity",
    title: "Liquidity Ratio",
    rows: [
      { code: "current_ratio", label: "Current Ratio (times)", unit: "times" },
      {
        code: "accounts_receivable_turnover",
        label: "Accounts Receivable Turnover (times)",
        unit: "times",
      },
      { code: "inventory_turnover", label: "Inventory Turnover (times)", unit: "times" },
      {
        code: "accounts_payable_turnover",
        label: "Accounts Payable Turnover (times)",
        unit: "times",
      },
    ],
  },
  {
    category: "operation_efficiency",
    title: "Operation Efficiency Ratio",
    rows: [
      { code: "total_assets_turnover", label: "Total Assets Turnover (times)", unit: "times" },
      {
        code: "operation_expense_to_revenue",
        label: "Operation Expense to Total Revenue Ratio (%)",
        unit: "percent",
      },
    ],
  },
  {
    category: "financial_position_proportion",
    title: "Financial Position Proportion Ratio",
    rows: [
      {
        code: "asset_to_equity",
        label: "Asset to Equity Ratio or Financial Leverage (times)",
        unit: "times",
      },
      { code: "debt_to_asset_ratio", label: "Debt to Asset Ratio (times)", unit: "times" },
      { code: "debt_to_equity_ratio", label: "Debt to Equity Ratio (times)", unit: "times" },
      { code: "debt_to_capital_ratio", label: "Debt to Capital Ratio (times)", unit: "times" },
    ],
  },
];

/** Missing values render as an em dash — never as 0. */
export const EMPTY = "—";

export function fmtAmount(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return EMPTY;
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtNumber(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return EMPTY;
  return value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return EMPTY;
  return `${value.toFixed(2)}%`;
}

/** Compact notation used by the Financial Overview KPI cards and charts. */
export function fmtCompact(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return EMPTY;
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  const unit =
    abs >= 1e12 ? ["T", 1e12] : abs >= 1e9 ? ["B", 1e9] : abs >= 1e6 ? ["M", 1e6] : abs >= 1e3 ? ["K", 1e3] : null;
  if (!unit) return `${sign}${abs.toFixed(digits)}`;
  return `${sign}${(abs / (unit[1] as number)).toFixed(digits)}${unit[0]}`;
}

export function pctChange(current?: number | null, previous?: number | null): number | null {
  if (current === null || current === undefined) return null;
  if (previous === null || previous === undefined || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}
