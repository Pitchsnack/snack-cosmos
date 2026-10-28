/**
 * Shared DBD store: one record per 13-digit registration number, fetched once.
 * Every write goes through the database functions dbd_store_save /
 * dbd_store_delete / dbd_apply_edit (Control Admin checked inside them, and a
 * trigger blocks every other writer). Readers only ever read the stored copy.
 */
import { CASH_FLOW_SECTIONS, INCOME_ROWS, POSITION_ROWS, RATIO_GROUPS } from "@/lib/financials";

export const normReg = (s: string | null | undefined) => {
  const d = String(s ?? "").replace(/\D/g, "");
  return /^\d{13}$/.test(d) ? d : null;
};

export type StoreData = {
  info: Record<string, unknown> | null;
  directors: string[];
  submission_years_be: number[];
  registered_business: Record<string, unknown> | null;
  latest_business: Record<string, unknown> | null;
  statements: {
    fiscal_year: number; currency: string; source_name: string | null; source_reference: string | null; retrieved_at: string | null;
    matched_registered_number: string | null; matched_registered_name: string | null;
    income: any[]; position: any[]; cash_flow: any[]; ratios: any[];
  }[];
};

const CASH_ROWS = CASH_FLOW_SECTIONS.flatMap((s) => s.rows.map((r) => ({ ...r, section: s.section })));
const RATIO_ROWS = RATIO_GROUPS.flatMap((g) => g.rows.map((r) => ({ ...r, category: g.category })));

function items(defs: { code: string; label: string; isTotal?: boolean; section?: string }[], vals: Record<string, number | null | undefined>) {
  return defs
    .map((d, i) => ({ item_code: d.code, item_label: d.label, amount: vals[d.code] ?? null, display_order: i + 1, is_total: !!d.isTotal, ...(d.section ? { section: d.section } : {}) }))
    .filter((r) => r.amount != null);
}

/** Withdraws percent changes year on year so stored rows match the old import. */
function withChanges(stmts: StoreData["statements"]) {
  const sorted = stmts.slice().sort((a, b) => a.fiscal_year - b.fiscal_year);
  for (let i = 1; i < sorted.length; i++) {
    for (const k of ["income", "position", "cash_flow"] as const) {
      for (const r of sorted[i][k]) {
        const p = sorted[i - 1][k].find((x: any) => x.item_code === r.item_code)?.amount;
        r.percent_change = p ? ((r.amount - p) / Math.abs(p)) * 100 : null;
      }
    }
  }
  return sorted;
}

/** DBD lookup outcome → store data. */
export function outcomeToData(outcome: any): StoreData {
  const c = outcome.company ?? {};
  const ci = c.companyInfo ?? {};
  const now = new Date().toISOString();
  const info = {
    legal_name_th: ci.legalNameTh ?? null, legal_name_en: ci.legalNameEn ?? c.registeredName ?? null,
    legal_entity_type_th: ci.legalEntityTypeTh ?? c.profile?.registeredType ?? null, legal_entity_status_th: ci.legalEntityStatusTh ?? c.profile?.status ?? null,
    registration_date: ci.registrationDate ?? null, registration_date_th_raw: ci.registrationDateThRaw ?? c.profile?.registeredDate ?? null,
    registered_capital_thb: ci.registeredCapitalThb ?? null, registered_capital_th_raw: ci.registeredCapitalThRaw ?? c.profile?.registeredCapital ?? null,
    previous_registration_number: ci.previousRegistrationNumber ?? null, business_group_th: ci.businessGroupTh ?? null,
    business_size: ci.businessSize ?? c.profile?.businessSize ?? null, head_office_address_th: ci.headOfficeAddressTh ?? null,
    website: ci.website ?? null, authorized_signatory_th: ci.authorizedSignatoryTh ?? null,
    source_name: "DBD Data Warehouse", source_url: "https://datawarehouse.dbd.go.th", retrieved_at: now,
  };
  const directors = (Array.isArray(ci.directors) ? ci.directors : []).map((d: any) => (typeof d === "string" ? d : d?.nameTh)).filter(Boolean);
  const statements = (outcome.statements ?? []).map((s: any) => ({
    fiscal_year: s.fiscalYear, currency: s.currency ?? "THB", source_name: "DBD Data Warehouse", source_reference: c.sourceReference ?? null,
    retrieved_at: now, matched_registered_number: c.registeredNumber ?? null, matched_registered_name: c.registeredName ?? null,
    income: items(INCOME_ROWS, s.income ?? {}), position: items(POSITION_ROWS, s.position ?? {}), cash_flow: items(CASH_ROWS, s.cashFlow ?? {}),
    ratios: RATIO_ROWS.filter((r) => s.ratios?.[r.code] != null).map((r, i) => ({ ratio_category: r.category, ratio_code: r.code, ratio_label: r.label, unit: r.unit, value: s.ratios[r.code], display_order: i + 1, calculation_source: "DBD_REPORTED" })),
  }));
  return {
    info, directors, submission_years_be: (ci.submissionYearsBe ?? []).filter((y: number) => y > 2400 && y < 2700).sort((a: number, b: number) => b - a),
    registered_business: ci.registeredBusiness ? { business_code: ci.registeredBusiness.code ?? null, business_description_th: ci.registeredBusiness.descriptionTh ?? null, business_objective_th: ci.registeredBusiness.objectiveTh ?? null } : null,
    latest_business: ci.latestBusiness ? { financial_year_be: ci.latestBusiness.financialYearBe ?? null, business_code: ci.latestBusiness.code ?? null, business_description_th: ci.latestBusiness.descriptionTh ?? null, business_objective_th: ci.latestBusiness.objectiveTh ?? null } : null,
    statements: withChanges(statements),
  };
}

/** Figures typed by hand (section 2.2) → the codes each report reads. */
export type ManualForm = {
  company: { nameTh?: string | null; nameEn?: string | null; registeredOn?: string | null; status?: string | null; capital?: number | null; address?: string | null; directors?: string[] };
  years: { year: number; revenue?: number | null; costOfSales?: number | null; grossProfit?: number | null; operatingExpenses?: number | null; ebitda?: number | null; netProfit?: number | null;
    totalAssets?: number | null; currentAssets?: number | null; totalLiabilities?: number | null; currentLiabilities?: number | null; equity?: number | null; cash?: number | null }[];
  source: string;
};

export function manualToData(f: ManualForm): StoreData {
  const now = new Date().toISOString();
  const statements = f.years.map((y) => {
    const inc: Record<string, number | null | undefined> = { total_revenue: y.revenue, cost_of_goods_sold: y.costOfSales, gross_profit_loss: y.grossProfit, selling_admin_expenses: y.operatingExpenses, net_profit_loss: y.netProfit };
    const income = items(INCOME_ROWS, inc);
    if (y.ebitda != null) income.push({ item_code: "ebitda", item_label: "EBITDA", amount: y.ebitda, display_order: 99, is_total: false });
    return {
      fiscal_year: y.year, currency: "THB", source_name: `Entered by hand · ${f.source}`, source_reference: f.source, retrieved_at: now,
      matched_registered_number: null, matched_registered_name: null, income,
      position: items(POSITION_ROWS, { total_assets: y.totalAssets, total_current_assets: y.currentAssets, total_liabilities: y.totalLiabilities, total_current_liabilities: y.currentLiabilities, equity: y.equity }),
      cash_flow: items(CASH_ROWS, { cf_cash_end: y.cash }), ratios: [],
    };
  }).filter((s) => s.income.length || s.position.length || s.cash_flow.length);
  return {
    info: { legal_name_th: f.company.nameTh || null, legal_name_en: f.company.nameEn || null, registration_date: f.company.registeredOn || null,
      legal_entity_status_th: f.company.status || null, registered_capital_thb: f.company.capital ?? null,
      registered_capital_th_raw: f.company.capital != null ? String(f.company.capital) : null, head_office_address_th: f.company.address || null,
      source_name: `Entered by hand · ${f.source}`, retrieved_at: now },
    directors: (f.company.directors ?? []).map((d) => d.trim()).filter(Boolean), submission_years_be: [], registered_business: null, latest_business: null,
    statements: withChanges(statements),
  };
}

export type DbdFacts = {
  nameTh: string | null; nameEn: string | null; address: string | null;
  registeredOn: string | null; directors: string[]; revenueM: number | null; revenueYear: number | null;
};

export function factsFromData(d: any): DbdFacts | null {
  if (!d?.info) return null;
  const latest = (d.statements ?? []).slice().sort((a: any, b: any) => b.fiscal_year - a.fiscal_year)[0];
  const rev = latest?.income?.find((i: any) => i.item_code === "total_revenue") ?? latest?.income?.find((i: any) => i.item_code === "revenue_sales_services");
  return {
    nameTh: d.info.legal_name_th ?? null, nameEn: d.info.legal_name_en ?? null, address: d.info.head_office_address_th ?? null,
    registeredOn: d.info.registration_date ?? d.info.registration_date_th_raw ?? null, directors: (d.directors ?? []).filter(Boolean),
    revenueM: rev?.amount != null && Number.isFinite(Number(rev.amount)) ? Number(rev.amount) / 1_000_000 : null, revenueYear: latest?.fiscal_year ?? null,
  };
}

export type DbdStoreState = {
  registrationNo: string | null;
  status: "no_number" | "none" | "failed" | "stored";
  source: "dbd" | "manual" | null;
  sourceNote: string | null;
  retrievedAt: string | null;
  enteredBy: string | null;
  years: number[];
  lastError: string | null;
  edits: number;
};

/** Reads the stored record + the last failed attempt; never fetches. */
export async function storeState(sb: any, rawReg: string | null | undefined): Promise<{ state: DbdStoreState; data: any | null }> {
  const reg = normReg(rawReg);
  const empty: DbdStoreState = { registrationNo: reg, status: reg ? "none" : "no_number", source: null, sourceNote: null, retrievedAt: null, enteredBy: null, years: [], lastError: null, edits: 0 };
  if (!reg) return { state: empty, data: null };
  const [{ data: rec }, { data: logs }, { count }] = await Promise.all([
    sb.from("dbd_company_records").select("source, source_note, data, retrieved_at, entered_by_name").eq("registration_number", reg).maybeSingle(),
    sb.from("dbd_fetch_logs").select("result, error, created_at").eq("registration_number", reg).order("created_at", { ascending: false }).limit(1),
    sb.from("analyst_statement_edits").select("id", { count: "exact", head: true }).eq("registration_number", reg),
  ]);
  const last = logs?.[0];
  if (!rec) return { state: { ...empty, status: last && last.result !== "ok" ? "failed" : "none", lastError: last && last.result !== "ok" ? last.error ?? "DBD did not answer" : null }, data: null };
  return {
    state: { ...empty, status: "stored", source: rec.source, sourceNote: rec.source_note, retrievedAt: rec.retrieved_at, enteredBy: rec.entered_by_name,
      years: (rec.data?.statements ?? []).map((s: any) => s.fiscal_year).sort(), edits: count ?? 0,
      lastError: last && last.result !== "ok" ? last.error ?? null : null },
    data: rec.data,
  };
}

/**
 * After data is stored for a seller: produce Financial statements, P&L, Company
 * Risk and (when peers allow) Valuation, and move paid orders to Generated so
 * they wait for Authorise seller. Never authorises anything.
 */
export async function produceSellerReports(context: any, sb: any, startupIds: string[], actorId: string) {
  const { hubContent } = await import("./reports-hub.server");
  const { valuationCanGenerate } = await import("./reports-hub");
  const now = new Date().toISOString();
  for (const sid of startupIds) {
    const { data: fs } = await sb.from("financial_statements").select("id").eq("startup_id", sid).limit(1);
    if (!fs?.length) continue;
    let valuationReady = false;
    try { valuationReady = valuationCanGenerate(await hubContent(context, "admin", sid, undefined, "valuation", true)); } catch { valuationReady = false; }
    const keys = ["statements", "pnl", "risk", ...(valuationReady ? ["valuation"] : [])];
    const { data: cur } = await sb.from("company_report_records").select("report_key, status").eq("company_id", sid).in("report_key", keys);
    const ready = new Set((cur ?? []).filter((r: any) => r.status === "ready").map((r: any) => r.report_key));
    const rows = keys.filter((k) => !ready.has(k)).map((k) => ({ company_id: sid, report_key: k, status: "generated", generated_at: now }));
    if (rows.length) await sb.from("company_report_records").upsert(rows, { onConflict: "company_id,report_key" });
    const { data: moved } = await sb.from("report_orders").update({ status: "generated", generated_at: now, analyst_id: actorId })
      .eq("startup_id", sid).eq("status", "paid").in("kind", valuationReady ? ["financials", "valuation", "bundle", "pnl", "risk"] : ["financials", "pnl", "risk"]).select("id");
    if (moved?.length) await sb.from("report_order_events").insert(moved.map((r: any) => ({ order_id: r.id, event: "generated", actor_id: actorId, note: "Produced from stored DBD data" })));
  }
}

/** Report keys already produced for a company (used to file later orders as Generated). */
export async function producedKeys(sb: any, sid: string): Promise<Set<string>> {
  const { data } = await sb.from("company_report_records").select("report_key, status").eq("company_id", sid).in("status", ["generated", "ready"]);
  return new Set((data ?? []).map((r: any) => r.report_key));
}
