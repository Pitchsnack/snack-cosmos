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

/** Editable Company Profile block (mirrors the DBD profile page). */
export interface CompanyProfileDraft {
  registeredType: string | null;
  status: string | null;
  registeredDate: string | null;
  registeredCapital: string | null;
  businessSize: string | null;
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
  /** Company Profile values read from the profile page, when available. */
  profile?: CompanyProfileDraft;
  /** True when Thai Company Info was retrieved and stored by this run. */
  companyInfoSaved?: boolean;
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
      .select("id, tenant_id, startup_name, registered_name, registered_number")
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

    // Fetch once: read the shared store. Only a Control Admin can fill it (Extract data);
    // nothing here scrapes DBD again once data is stored.
    const store = await import("@/lib/dbd-store.server");
    const reg = store.normReg(registeredNumber);
    if (!reg) return { status: "missing_identity", message: "Add the 13-digit Registered Number before getting financials." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sbAdmin = supabaseAdmin as any;
    let { data: stored } = await sbAdmin.from("dbd_company_records").select("data, retrieved_at, source").eq("registration_number", reg).maybeSingle();
    if (!stored) {
      const { data: isCtl } = await supabase.rpc("is_control", { _user_id: context.userId });
      if (!isCtl) return { status: "unavailable", message: "PitchSnack fetches the DBD data when it reviews your company. Nothing has been changed." };
      const { lookupDbdFinancials } = await import("@/lib/financials/dbd-provider.server");
      const outcome = await lookupDbdFinancials({ registeredNumber: reg });
      if (outcome.status !== "ok" && outcome.status !== "no_financials") {
        await sbAdmin.from("dbd_fetch_logs").insert({ registration_number: reg, action: "extract", result: outcome.status === "not_found" ? "not_found" : "failed", error: outcome.status, actor_id: context.userId, source: "dbd" });
        return { status: outcome.status === "not_found" ? "not_found" : "unavailable", message: "Unable to retrieve data from DBD at this time. Existing data has not been changed." } as AutoEnrichFinancialsResult;
      }
      const { data: res, error: rpcErr } = await sbAdmin.rpc("dbd_store_save", { _actor: context.userId, _reg: reg, _action: "extract", _source: "dbd", _source_note: "DBD Data Warehouse", _data: store.outcomeToData(outcome), _raw: outcome, _actor_name: null });
      if (rpcErr) throw new Error(rpcErr.message);
      await store.produceSellerReports(context, sbAdmin, (res?.startup_ids ?? []) as string[], context.userId);
      ({ data: stored } = await sbAdmin.from("dbd_company_records").select("data, retrieved_at, source").eq("registration_number", reg).maybeSingle());
    }
    const toMap = (rows: any[], key = "amount") => Object.fromEntries((rows ?? []).filter((r) => r[key] != null).map((r) => [r.item_code ?? r.ratio_code, Number(r[key])]));
    const sts = (stored?.data?.statements ?? []) as any[];
    const info = stored?.data?.info ?? {};
    if (!sts.length) return { status: "no_financials", matchedBy: "registered_number", matchedRegisteredNumber: reg, matchedRegisteredName: info.legal_name_th ?? info.legal_name_en ?? null, companyInfoSaved: true, message: "The company is stored, but no financial statements are available." } as AutoEnrichFinancialsResult;
    return {
      status: "ok", matchedBy: "registered_number", matchedRegisteredNumber: reg, matchedRegisteredName: info.legal_name_th ?? info.legal_name_en ?? null,
      sourceReference: sts[0]?.source_reference ?? null, retrievedAt: stored!.retrieved_at, companyInfoSaved: true, warnings: [],
      years: sts.slice().sort((a, b) => a.fiscal_year - b.fiscal_year).map((st) => ({
        fiscalYear: st.fiscal_year, currency: st.currency ?? "THB", sourceName: stored!.source === "manual" ? "MANUAL" : "DBD_DATA_WAREHOUSE",
        income: toMap(st.income), position: toMap(st.position), cashFlow: toMap(st.cash_flow), ratios: toMap(st.ratios, "value"),
      })),
    } as AutoEnrichFinancialsResult;
  });

/** Registration number when the startup's data lives in the shared DBD store. */
async function lockedStartup(startupId: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const sb = supabaseAdmin as any;
  const { data: st } = await sb.from("startups").select("registered_number").eq("id", startupId).maybeSingle();
  const { normReg } = await import("@/lib/dbd-store.server");
  const reg = normReg(st?.registered_number);
  if (!reg) return null;
  const { data } = await sb.from("dbd_company_records").select("registration_number").eq("registration_number", reg).maybeSingle();
  return data ? reg : null;
}

/* ------------------------------------------------------------------ */
/* Clear — removes every stored fiscal year for a startup.             */
/* ------------------------------------------------------------------ */

export const clearStartupFinancials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ startupId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    // Stored DBD data is never deleted from here (only Delete DBD data, by a Control Admin).
    if (await lockedStartup(data.startupId)) return { ok: true, kept: true };
    for (const table of [
      "income_statement_items",
      "financial_position_items",
      "cash_flow_items",
      "financial_ratios",
      "financial_statements",
    ] as const) {
      const d = await supabase.from(table).delete().eq("startup_id", data.startupId);
      if (d.error) throw new Error(d.error.message);
    }
    return { ok: true };
  });

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
        profile: z
          .object({
            registeredType: z.string().max(120).nullable().optional(),
            status: z.string().max(120).nullable().optional(),
            registeredDate: z.string().max(120).nullable().optional(),
            registeredCapital: z.string().max(120).nullable().optional(),
            businessSize: z.string().max(120).nullable().optional(),
          })
          .optional(),
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

    // Stored DBD data: only a Control Admin may change figures, and each change is
    // saved as an analyst edit on top of the stored data (kept through a Refresh).
    const lockedReg = await lockedStartup(startupId);
    if (lockedReg) {
      const { data: isCtl } = await supabase.rpc("is_control", { _user_id: context.userId });
      if (!isCtl) throw new Error("Stored DBD data is read-only. Only a Control Admin can change it.");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const sbA = supabaseAdmin as any;
      const cur = async (table: string, col = "amount", codeCol = "item_code") => {
        const { data: rows } = await sbA.from(table).select(`fiscal_year, ${codeCol}, ${col}`).eq("startup_id", startupId);
        return new Map((rows ?? []).map((r: any) => [`${r.fiscal_year}:${r[codeCol]}`, r[col] == null ? null : Number(r[col])]));
      };
      const maps = { income: await cur("income_statement_items"), position: await cur("financial_position_items"), cashFlow: await cur("cash_flow_items"), ratios: await cur("financial_ratios", "value", "ratio_code") };
      const stmt = { income: "income", position: "position", cashFlow: "cash_flow", ratios: "ratio" } as const;
      for (const y of data.years) {
        for (const k of ["income", "position", "cashFlow", "ratios"] as const) {
          for (const [code, v] of Object.entries(y[k] ?? {})) {
            const key = `${y.fiscalYear}:${code}`;
            if (!maps[k].has(key)) continue; // only lines that exist in the stored data
            if ((maps[k].get(key) ?? null) === (v ?? null)) continue;
            const r = await sbA.rpc("dbd_apply_edit", { _actor: context.userId, _reg: lockedReg, _year: y.fiscalYear, _statement: stmt[k], _code: code, _amount: v ?? null, _note: null });
            if (r.error) throw new Error(r.error.message);
          }
        }
      }
      return { ok: true, years: data.years.map((y) => y.fiscalYear).sort((a, b) => a - b) };
    }

    // Company Profile block lives on the startup record itself.
    if (data.profile) {
      const trim = (v: string | null | undefined) => (v?.trim() ? v.trim() : null);
      const upd = await supabase
        .from("startups")
        .update({
          registered_type: trim(data.profile.registeredType),
          registered_status: trim(data.profile.status),
          registered_date: trim(data.profile.registeredDate),
          registered_capital: trim(data.profile.registeredCapital),
          business_size: trim(data.profile.businessSize),
        } as never)
        .eq("id", startupId);
      if (upd.error) throw new Error(upd.error.message);
    }

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
