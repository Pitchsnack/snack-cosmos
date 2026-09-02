/**
 * Deterministic DBD fixtures (server-only).
 *
 * Used by `DBD_PROVIDER_MODE=fixture` so the Financial Auto Enrich UX can be
 * exercised without DBD availability, internet access or scraping. Values are
 * clearly synthetic and never reach the database unless the user clicks Save.
 */
import type { DbdOutcome } from "./dbd-provider.server";

export type DbdFixtureCase =
  | "success"
  | "partial_data"
  | "multi_year"
  | "no_match"
  | "ambiguous"
  | "error"
  | "no_financials";

const SOURCE_URL = "https://datawarehouse.dbd.go.th/";

const company = (name: string | null, number: string | null) => ({
  registeredNumber: number,
  registeredName: name,
  sourceReference: SOURCE_URL,
});

function successStatement(year: number, scale: number) {
  return {
    fiscalYear: year,
    currency: "THB",
    income: {
      revenue_sales_services: 118_000_000 * scale,
      total_revenue: 120_000_000 * scale,
      cost_of_goods_sold: 82_000_000 * scale,
      gross_profit_loss: 36_000_000 * scale,
      selling_admin_expenses: 24_500_000 * scale,
      total_expenses: 106_500_000 * scale,
      interest_expenses: 1_200_000 * scale,
      profit_loss_before_income_tax: 12_300_000 * scale,
      income_tax_expense: 2_460_000 * scale,
      net_profit_loss: 8_500_000 * scale,
    },
    position: {
      accounts_receivable: 21_000_000 * scale,
      inventories: 14_500_000 * scale,
      total_current_assets: 52_000_000 * scale,
      property_plant_equipment: 31_000_000 * scale,
      total_non_current_assets: 38_000_000 * scale,
      total_assets: 90_000_000 * scale,
      total_current_liabilities: 26_000_000 * scale,
      total_non_current_liabilities: 14_000_000 * scale,
      total_liabilities: 40_000_000 * scale,
      equity: 50_000_000 * scale,
      total_liabilities_equity: 90_000_000 * scale,
    },
    cashFlow: {},
    ratios: {
      gross_profit_margin: 30,
      net_profit_margin: 7.08,
      current_ratio: 2,
      debt_to_equity_ratio: 0.8,
    },
  };
}

export function dbdFixtureOutcome(
  fixtureCase: DbdFixtureCase,
  input: { registeredNumber?: string | null; registeredName?: string | null },
): DbdOutcome {
  const matchedBy = input.registeredNumber?.trim() ? "registered_number" : "registered_name";
  const matched = company(
    input.registeredName?.trim() || "EXAMPLE COMPANY LIMITED",
    input.registeredNumber?.trim() || "0105555078063",
  );

  switch (fixtureCase) {
    case "no_match":
      return { status: "not_found" };
    case "error":
      return { status: "unavailable", detail: "fixture: DBD_ACCESS_RESTRICTED" };
    case "no_financials":
      return { status: "no_financials", company: matched, matchedBy };
    case "ambiguous":
      return {
        status: "ambiguous",
        candidates: [
          company("EXAMPLE COMPANY LIMITED", "0105555078063"),
          company("EXAMPLE COMPANY (THAILAND) LIMITED", "0105548111222"),
          company("EXAMPLE COMPANY HOLDING LIMITED", "0105561004455"),
        ],
      };
    case "partial_data": {
      const s = successStatement(2025, 1);
      return {
        status: "ok",
        company: matched,
        matchedBy,
        statements: [
          {
            ...s,
            income: {
              total_revenue: s.income.total_revenue,
              net_profit_loss: s.income.net_profit_loss,
            },
            position: {
              total_assets: s.position.total_assets,
              total_liabilities: s.position.total_liabilities,
            },
            ratios: {},
          },
        ],
        warnings: ["Fixture: partial DBD disclosure — several concepts were not reported."],
      };
    }
    case "multi_year":
      return {
        status: "ok",
        company: matched,
        matchedBy,
        statements: [
          successStatement(2023, 0.78),
          successStatement(2024, 0.9),
          successStatement(2025, 1),
        ],
        warnings: [],
      };
    case "success":
    default:
      return {
        status: "ok",
        company: matched,
        matchedBy,
        statements: [successStatement(2025, 1)],
        warnings: [],
      };
  }
}

/** Resolves the fixture case from configuration, with a per-lookup override. */
export function resolveFixtureCase(registeredName?: string | null): DbdFixtureCase {
  const hint = String(registeredName ?? "").toLowerCase();
  if (hint.includes("ambiguous")) return "ambiguous";
  if (hint.includes("notfound") || hint.includes("no match")) return "no_match";
  if (hint.includes("partial")) return "partial_data";
  if (hint.includes("multiyear") || hint.includes("multi-year")) return "multi_year";
  if (hint.includes("nofinancial")) return "no_financials";
  if (hint.includes("dbderror")) return "error";
  const env = (process.env.DBD_FIXTURE_CASE ?? "success") as DbdFixtureCase;
  return env;
}
