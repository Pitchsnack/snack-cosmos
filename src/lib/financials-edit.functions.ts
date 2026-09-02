import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  CASH_FLOW_SECTIONS,
  INCOME_ROWS,
  POSITION_ROWS,
  RATIO_GROUPS,
  type StatementRowDef,
} from "@/lib/financials";

/* ------------------------------------------------------------------ */
/* Shared shapes                                                       */
/* ------------------------------------------------------------------ */

/** A single fiscal year of editable values. `null` means "no value" — never 0. */
export interface FinancialYearDraft {
  fiscalYear: number;
  currency: string;
  sourceName?: string | null;
  income: Record<string, number | null>;
  position: Record<string, number | null>;
  cashFlow: Record<string, number | null>;
  ratios: Record<string, number | null>;
}

export interface AutoEnrichFinancialsResult {
  status:
    | "ok"
    | "missing_identity"
    | "not_configured"
    | "unavailable"
    | "not_found"
    | "ambiguous"
    | "no_financials";
  message?: string;
  matchedBy?: "registered_number" | "registered_name";
  matchedRegisteredNumber?: string | null;
  matchedRegisteredName?: string | null;
  sourceReference?: string | null;
  retrievedAt?: string;
  candidates?: { registeredNumber: string | null; registeredName: string | null }[];
  years?: FinancialYearDraft[];
  warnings?: string[];
}

const CASH_FLOW_ROWS: (StatementRowDef & { section: string })[] = CASH_FLOW_SECTIONS.flatMap((s) =>
  s.rows.map((r) => ({ ...r, section: s.section })),
);
const RATIO_ROWS = RATIO_GROUPS.flatMap((g) =>
  g.rows.map((r) => ({ ...r, category: g.category })),
);

const valueMap = z.record(z.string(), z.number().nullable());

const yearSchema = z.object({
  fiscalYear: z.number().int().min(1900).max(2999),
  currency: z.string().min(1).max(8).default("THB"),
  sourceName: z.string().max(255).nullable().optional(),
  income: valueMap.default({}),
  position: valueMap.default({}),
  cashFlow: valueMap.default({}),
  ratios: valueMap.default({}),
});

/* ------------------------------------------------------------------ */
/* Auto Enrich — proposes values only, never writes to the database.   */
/* ------------------------------------------------------------------ */

export const autoEnrichFinancials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ startupId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<AutoEnrichFinancialsResult> => {
    const { supabase } = context;
    const { data: startup, error } = await supabase
      .from("startups")
      .select("id, startup_name, registered_name, registered_number")
      .eq("id", data.startupId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!startup) throw new Error("Startup not found");

    const registeredNumber = ((startup as Record<string, unknown>).registered_number as
      | string
      | null) ?? null;
    const registeredName = startup.registered_name ?? null;

    if (!registeredNumber?.trim() && !registeredName?.trim()) {
      return {
        status: "missing_identity",
        message: "Add a Registered Number or Registered Name before using Auto Enrich.",
      };
    }

    const { lookupDbdFinancials } = await import("@/lib/financials/dbd-provider.server");
    const outcome = await lookupDbdFinancials({ registeredNumber, registeredName });

    switch (outcome.status) {
      case "not_configured":
        return {
          status: "not_configured",
          message:
            "Unable to retrieve financial data from DBD at this time. Existing SnackPortal2 data has not been changed.",
        };
      case "unavailable":
        return {
          status: "unavailable",
          message:
            "Unable to retrieve financial data from DBD at this time. Existing SnackPortal2 data has not been changed.",
        };
      case "not_found":
        return {
          status: "not_found",
          message:
            "No matching company was found using the available Registered Number or Registered Name.",
        };
      case "ambiguous":
        return {
          status: "ambiguous",
          message:
            "Several companies matched the Registered Name. Add the Registered Number to resolve the match.",
          candidates: outcome.candidates.map((c) => ({
            registeredNumber: c.registeredNumber,
            registeredName: c.registeredName,
          })),
        };
      case "no_financials":
        return {
          status: "no_financials",
          matchedBy: outcome.matchedBy,
          matchedRegisteredNumber: outcome.company.registeredNumber,
          matchedRegisteredName: outcome.company.registeredName,
          message: "The company was found, but no financial data was available for enrichment.",
        };
      case "ok": {
        const years: FinancialYearDraft[] = outcome.statements
          .sort((a, b) => a.fiscalYear - b.fiscalYear)
          .map((s) => ({
            fiscalYear: s.fiscalYear,
            currency: s.currency,
            sourceName: "DBD_DATA_WAREHOUSE",
            income: pick(s.income, INCOME_ROWS),
            position: pick(s.position, POSITION_ROWS),
            cashFlow: pick(s.cashFlow, CASH_FLOW_ROWS),
            ratios: pick(s.ratios, RATIO_ROWS),
          }));
        return {
          status: "ok",
          matchedBy: outcome.matchedBy,
          matchedRegisteredNumber: outcome.company.registeredNumber,
          matchedRegisteredName: outcome.company.registeredName,
          sourceReference: outcome.company.sourceReference,
          retrievedAt: new Date().toISOString(),
          years,
          warnings: outcome.warnings,
        };
      }
    }
  });

/** Keeps only known codes with a real numeric value; unknown/absent stay out. */
function pick(
  source: Record<string, number>,
  rows: { code: string }[],
): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const row of rows) {
    const v = source[row.code];
    if (typeof v === "number" && Number.isFinite(v)) out[row.code] = v;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Save — the only path that writes financial data.                    */
/* ------------------------------------------------------------------ */

export const saveStartupFinancials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        startupId: z.string().uuid(),
        years: z.array(yearSchema).max(30),
        removedYears: z.array(z.number().int()).optional(),
        provenance: z
          .object({
            source: z.string().max(64).nullable().optional(),
            sourceReference: z.string().max(500).nullable().optional(),
            matchedRegisteredNumber: z.string().max(64).nullable().optional(),
            matchedRegisteredName: z.string().max(255).nullable().optional(),
            retrievedAt: z.string().nullable().optional(),
          })
          .optional(),
      })
      .parse(input),
  )
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

    // Remove fiscal years the user deleted. Items cascade with the statement.
    for (const year of data.removedYears ?? []) {
      const del = await supabase
        .from("financial_statements")
        .delete()
        .eq("startup_id", startupId)
        .eq("fiscal_year", year);
      if (del.error) throw new Error(del.error.message);
      for (const table of [
        "income_statement_items",
        "financial_position_items",
        "cash_flow_items",
        "financial_ratios",
      ] as const) {
        const d = await supabase
          .from(table)
          .delete()
          .eq("startup_id", startupId)
          .eq("fiscal_year", year);
        if (d.error) throw new Error(d.error.message);
      }
    }

    const sortedYears = [...data.years].sort((a, b) => a.fiscalYear - b.fiscalYear);
    const statementIds: Record<number, string> = {};

    for (const y of sortedYears) {
      const header: Record<string, unknown> = {
        startup_id: startupId,
        tenant_id: tenantId,
        fiscal_year: y.fiscalYear,
        currency: y.currency || "THB",
        statement_basis: "standalone",
        source_name: y.sourceName ?? data.provenance?.source ?? null,
        source_reference: data.provenance?.sourceReference ?? null,
        matched_registered_number: data.provenance?.matchedRegisteredNumber ?? null,
        matched_registered_name: data.provenance?.matchedRegisteredName ?? null,
        retrieved_at: data.provenance?.retrievedAt ?? null,
      };
      const { data: row, error } = await supabase
        .from("financial_statements")
        .upsert(header as never, { onConflict: "startup_id,fiscal_year,statement_basis" })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      statementIds[y.fiscalYear] = row.id;
    }

    const valueFor = (y: FinancialYearDraft, group: keyof FinancialYearDraft, code: string) => {
      const map = y[group] as Record<string, number | null>;
      const v = map?.[code];
      return typeof v === "number" && Number.isFinite(v) ? v : null;
    };

    const change = (curr: number | null, prev: number | null) =>
      curr === null || prev === null || prev === 0
        ? null
        : Number((((curr - prev) / Math.abs(prev)) * 100).toFixed(4));

    const buildItems = (
      rows: (StatementRowDef & { section?: string })[],
      group: "income" | "position" | "cashFlow",
    ) =>
      sortedYears.flatMap((y, yi) =>
        rows.map((row, idx) => {
          const amount = valueFor(y, group, row.code);
          const prev = yi > 0 ? valueFor(sortedYears[yi - 1], group, row.code) : null;
          const base: Record<string, unknown> = {
            financial_statement_id: statementIds[y.fiscalYear],
            startup_id: startupId,
            tenant_id: tenantId,
            fiscal_year: y.fiscalYear,
            item_code: row.code,
            item_label: row.label,
            amount,
            percent_change: change(amount, prev),
            display_order: idx + 1,
            is_total: Boolean(row.isTotal),
            source_reference: data.provenance?.sourceReference ?? null,
          };
          if (row.section) base.section = row.section;
          return base;
        }),
      );

    const incomeRows = buildItems(INCOME_ROWS, "income");
    const positionRows = buildItems(POSITION_ROWS, "position");
    const cashRows = buildItems(CASH_FLOW_ROWS, "cashFlow");

    const ratioRows = sortedYears.flatMap((y) =>
      RATIO_ROWS.map((row, idx) => ({
        financial_statement_id: statementIds[y.fiscalYear],
        startup_id: startupId,
        tenant_id: tenantId,
        fiscal_year: y.fiscalYear,
        ratio_category: row.category,
        ratio_code: row.code,
        ratio_label: row.label,
        unit: row.unit,
        value: valueFor(y, "ratios", row.code),
        display_order: idx + 1,
        calculation_source:
          data.provenance?.source === "DBD_DATA_WAREHOUSE" ? "DBD_REPORTED" : "manual",
        source_reference: data.provenance?.sourceReference ?? null,
      })),
    );

    if (incomeRows.length) {
      const r = await supabase
        .from("income_statement_items")
        .upsert(incomeRows as never, { onConflict: "financial_statement_id,item_code" });
      if (r.error) throw new Error(r.error.message);
    }
    if (positionRows.length) {
      const r = await supabase
        .from("financial_position_items")
        .upsert(positionRows as never, { onConflict: "financial_statement_id,item_code" });
      if (r.error) throw new Error(r.error.message);
    }
    if (cashRows.length) {
      const r = await supabase
        .from("cash_flow_items")
        .upsert(cashRows as never, { onConflict: "financial_statement_id,item_code" });
      if (r.error) throw new Error(r.error.message);
    }
    if (ratioRows.length) {
      const r = await supabase
        .from("financial_ratios")
        .upsert(ratioRows as never, { onConflict: "startup_id,fiscal_year,ratio_code" });
      if (r.error) throw new Error(r.error.message);
    }

    return { ok: true, years: sortedYears.map((y) => y.fiscalYear) };
  });
