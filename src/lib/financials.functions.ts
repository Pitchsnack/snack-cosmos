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
  profile: {
    registeredType: string | null;
    status: string | null;
    registeredDate: string | null;
    registeredCapital: string | null;
    registeredNumber: string | null;
    businessSize: string | null;
  };
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
      .select(
        "id, startup_name, registered_name, registered_number, company_type, company_size, status, year_founded, registered_type, registered_status, registered_date, registered_capital, business_size",
      )
      .eq("id", startupId)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!startup) throw new Error("Startup not found");
    const s = startup as unknown as Record<string, string | number | null>;

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
      profile: {
        registeredType: (s.registered_type as string | null) ?? startup.company_type ?? null,
        status: (s.registered_status as string | null) ?? startup.status ?? null,
        registeredDate:
          (s.registered_date as string | null) ??
          (startup.year_founded ? String(startup.year_founded) : null),
        registeredCapital: (s.registered_capital as string | null) ?? null,
        registeredNumber: startup.registered_number ?? null,
        businessSize: (s.business_size as string | null) ?? startup.company_size ?? null,
      },
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
