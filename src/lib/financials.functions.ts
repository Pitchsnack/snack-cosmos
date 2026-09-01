import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type StatementItem = {
  fiscal_year: number;
  item_code: string;
  item_label: string;
  amount: number | null;
  percent_change: number | null;
  display_order: number;
  is_total: boolean;
  section?: string | null;
};

export type RatioItem = {
  fiscal_year: number;
  ratio_category: string;
  ratio_code: string;
  ratio_label: string;
  value: number | null;
  unit: string;
  display_order: number;
};

export type StartupFinancials = {
  startupId: string;
  startupName: string;
  registeredName: string | null;
  currency: string;
  years: number[];
  statements: {
    fiscal_year: number;
    currency: string;
    source_name: string | null;
    verified_status: string | null;
  }[];
  income: StatementItem[];
  position: StatementItem[];
  cashFlow: StatementItem[];
  ratios: RatioItem[];
};

const num = (v: unknown): number | null =>
  v === null || v === undefined ? null : Number(v);

export const getStartupFinancials = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ startupId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<StartupFinancials> => {
    const { supabase } = context;
    const { startupId } = data;

    const { data: startup, error: sErr } = await supabase
      .from("startups")
      .select("id, startup_name, registered_name")
      .eq("id", startupId)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!startup) throw new Error("Startup not found");

    const [stmts, income, position, cash, ratios] = await Promise.all([
      supabase
        .from("financial_statements")
        .select("fiscal_year, currency, source_name, verified_status")
        .eq("startup_id", startupId)
        .order("fiscal_year"),
      supabase
        .from("income_statement_items")
        .select("fiscal_year, item_code, item_label, amount, percent_change, display_order, is_total")
        .eq("startup_id", startupId),
      supabase
        .from("financial_position_items")
        .select("fiscal_year, item_code, item_label, amount, percent_change, display_order, is_total")
        .eq("startup_id", startupId),
      supabase
        .from("cash_flow_items")
        .select(
          "fiscal_year, item_code, item_label, amount, percent_change, display_order, is_total, section",
        )
        .eq("startup_id", startupId),
      supabase
        .from("financial_ratios")
        .select("fiscal_year, ratio_category, ratio_code, ratio_label, value, unit, display_order")
        .eq("startup_id", startupId),
    ]);

    const statements = (stmts.data ?? []).map((r) => ({
      fiscal_year: r.fiscal_year,
      currency: r.currency,
      source_name: r.source_name,
      verified_status: r.verified_status,
    }));

    const mapItems = (rows: Record<string, unknown>[] | null): StatementItem[] =>
      (rows ?? []).map((r) => ({
        fiscal_year: r.fiscal_year as number,
        item_code: r.item_code as string,
        item_label: r.item_label as string,
        amount: num(r.amount),
        percent_change: num(r.percent_change),
        display_order: (r.display_order as number) ?? 0,
        is_total: Boolean(r.is_total),
        section: (r.section as string | undefined) ?? null,
      }));

    return {
      startupId,
      startupName: startup.startup_name,
      registeredName: startup.registered_name ?? null,
      currency: statements[0]?.currency ?? "THB",
      years: statements.map((s) => s.fiscal_year),
      statements,
      income: mapItems(income.data as Record<string, unknown>[] | null),
      position: mapItems(position.data as Record<string, unknown>[] | null),
      cashFlow: mapItems(cash.data as Record<string, unknown>[] | null),
      ratios: (ratios.data ?? []).map((r) => ({
        fiscal_year: r.fiscal_year,
        ratio_category: r.ratio_category,
        ratio_code: r.ratio_code,
        ratio_label: r.ratio_label,
        value: num(r.value),
        unit: r.unit,
        display_order: r.display_order ?? 0,
      })),
    };
  });

/* ------------------------------------------------------------------ */
/* Sample dataset loader — explicitly user triggered, never automatic. */
/* ------------------------------------------------------------------ */

const SAMPLE_INCOME: [string, string, number, number][] = [
  ["revenue_sales_services", "Revenue from Sales&Services", 124111.3, 251290.33],
  ["total_revenue", "Total Revenue", 125937.34, 251290.33],
  ["cost_of_goods_sold", "Cost of Goods Sold", 87755.87, 167118.41],
  ["gross_profit_loss", "Gross Profit (Loss)", 36355.43, 84171.92],
  ["selling_admin_expenses", "Selling&Admin Expenses", 212748.69, 519249.15],
  ["total_expenses", "Total Expenses", 300504.56, 686367.56],
  ["interest_expenses", "Interest Expenses", 0, 0],
  ["profit_loss_before_income_tax", "Profit(Loss) before Income Tax", -174567.22, -435077.23],
  ["income_tax_expense", "Income Tax Expense", 0, 0],
  ["net_profit_loss", "Net Profit (Loss)", -174567.22, -435077.23],
];

const SAMPLE_POSITION: [string, string, number, number][] = [
  ["accounts_receivable", "Accounts Receivable", 46475.0, 94516.67],
  ["inventories", "Inventories", 243444.48, 361603.67],
  ["total_current_assets", "Total Current Assets", 1686176.18, 1252978.05],
  ["property_plant_equipment", "Property, Plant and Equipment", 168779.11, 174494.5],
  ["total_non_current_assets", "Total Non-current Assets", 168779.11, 174494.5],
  ["total_assets", "Total Assets", 1854955.29, 1427472.55],
  ["total_current_liabilities", "Total Current Liabilities", 29522.51, 37117.0],
  ["total_non_current_liabilities", "Total Non-current Liabilities", 0, 0],
  ["total_liabilities", "Total Liabilities", 29522.51, 37117.0],
  ["equity", "Equity", 1825432.78, 1390355.55],
  ["total_liabilities_equity", "Total Liabilities and Equity", 1854955.29, 1427472.55],
];

const SAMPLE_RATIOS: [string, string, string, "percent" | "times", number, number][] = [
  ["profitability", "return_on_assets", "Return on Assets (%)", "percent", -9.41, -26.51],
  ["profitability", "return_on_equity", "Return on Equity (%)", "percent", -9.56, -27.06],
  ["profitability", "gross_profit_margin", "Gross Profit Margin (%)", "percent", 28.87, 33.5],
  [
    "profitability",
    "operating_income_on_revenue",
    "Operating Income on Revenue Ratio (%)",
    "percent",
    -138.61,
    -173.14,
  ],
  ["profitability", "net_profit_margin", "Net Profit Margin (%)", "percent", -138.61, -173.14],
  ["liquidity", "current_ratio", "Current Ratio (times)", "times", 57.11, 33.76],
  [
    "liquidity",
    "accounts_receivable_turnover",
    "Accounts Receivable Turnover (times)",
    "times",
    2.71,
    3.56,
  ],
  ["liquidity", "inventory_turnover", "Inventory Turnover (times)", "times", 0.36, 0.55],
  ["liquidity", "accounts_payable_turnover", "Accounts Payable Turnover (times)", "times", 2.97, 5.02],
  [
    "operation_efficiency",
    "total_assets_turnover",
    "Total Assets Turnover (times)",
    "times",
    0.07,
    0.15,
  ],
  [
    "operation_efficiency",
    "operation_expense_to_revenue",
    "Operation Expense to Total Revenue Ratio (%)",
    "percent",
    238.61,
    273.14,
  ],
  [
    "financial_position_proportion",
    "asset_to_equity",
    "Asset to Equity Ratio or Financial Leverage (times)",
    "times",
    1.02,
    1.03,
  ],
  ["financial_position_proportion", "debt_to_asset_ratio", "Debt to Asset Ratio (times)", "times", 0.02, 0.03],
  ["financial_position_proportion", "debt_to_equity_ratio", "Debt to Equity Ratio (times)", "times", 0.02, 0.03],
  ["financial_position_proportion", "debt_to_capital_ratio", "Debt to Capital Ratio (times)", "times", 0.02, 0.03],
];

const YEARS = [2025, 2026] as const;

function change(curr: number, prev: number): number | null {
  if (!prev) return null;
  return Number((((curr - prev) / Math.abs(prev)) * 100).toFixed(4));
}

/**
 * Loads a demonstration financial dataset for a startup that has none yet.
 * Values mirror the reference statement sample and are marked as such.
 */
export const loadSampleFinancials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ startupId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { startupId } = data;

    const { data: startup, error: sErr } = await supabase
      .from("startups")
      .select("id, tenant_id")
      .eq("id", startupId)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!startup) throw new Error("Startup not found");
    const tenantId = startup.tenant_id as string;

    const statementIds: Record<number, string> = {};
    for (const year of YEARS) {
      const { data: row, error } = await supabase
        .from("financial_statements")
        .upsert(
          {
            startup_id: startupId,
            tenant_id: tenantId,
            fiscal_year: year,
            currency: "THB",
            statement_basis: "standalone",
            source_name: "Sample dataset",
            verified_status: "unverified",
          },
          { onConflict: "startup_id,fiscal_year,statement_basis" },
        )
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      statementIds[year] = row.id;
    }

    const incomeRows = SAMPLE_INCOME.flatMap(([code, label, y25, y26], idx) =>
      YEARS.map((year) => ({
        financial_statement_id: statementIds[year],
        startup_id: startupId,
        tenant_id: tenantId,
        fiscal_year: year,
        item_code: code,
        item_label: label,
        amount: year === 2025 ? y25 : y26,
        percent_change: year === 2025 ? null : change(y26, y25),
        display_order: idx + 1,
        is_total: ["total_revenue", "gross_profit_loss", "total_expenses", "profit_loss_before_income_tax", "net_profit_loss"].includes(code),
        source_reference: "sample",
      })),
    );

    const positionRows = SAMPLE_POSITION.flatMap(([code, label, y25, y26], idx) =>
      YEARS.map((year) => ({
        financial_statement_id: statementIds[year],
        startup_id: startupId,
        tenant_id: tenantId,
        fiscal_year: year,
        item_code: code,
        item_label: label,
        amount: year === 2025 ? y25 : y26,
        percent_change: year === 2025 ? null : change(y26, y25),
        display_order: idx + 1,
        is_total: code.startsWith("total") || code === "equity",
        source_reference: "sample",
      })),
    );

    const ratioRows = SAMPLE_RATIOS.flatMap(([cat, code, label, unit, y25, y26], idx) =>
      YEARS.map((year) => ({
        financial_statement_id: statementIds[year],
        startup_id: startupId,
        tenant_id: tenantId,
        fiscal_year: year,
        ratio_category: cat,
        ratio_code: code,
        ratio_label: label,
        value: year === 2025 ? y25 : y26,
        unit,
        display_order: idx + 1,
        calculation_source: "imported",
        source_reference: "sample",
      })),
    );

    const r1 = await supabase
      .from("income_statement_items")
      .upsert(incomeRows, { onConflict: "financial_statement_id,item_code" });
    if (r1.error) throw new Error(r1.error.message);
    const r2 = await supabase
      .from("financial_position_items")
      .upsert(positionRows, { onConflict: "financial_statement_id,item_code" });
    if (r2.error) throw new Error(r2.error.message);
    const r3 = await supabase
      .from("financial_ratios")
      .upsert(ratioRows, { onConflict: "startup_id,fiscal_year,ratio_code" });
    if (r3.error) throw new Error(r3.error.message);

    return { ok: true, years: [...YEARS] };
  });
