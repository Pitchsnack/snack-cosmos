import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import catalog from "@/config/report-catalog.json";
import {
  inTile, keysOfKind, matchesSearch, sortCompanies, PAGE_SIZE, PAID_ORDER,
  type DbdCell, type PaidCompany, type PaidOrder, type PaidTile, type OrderStatus,
} from "./paid-reports";
import type { HubKey } from "./reports-hub";

/**
 * Admin › Paid reports. Control Admin only. One row per company with paid
 * report_orders; filter, search, sort and page happen here on the server.
 * Nothing here fetches from DBD — Use stored data links, Extract uses extractDbd.
 */
type Ctx = { supabase: any; userId: string };
async function control(ctx: Ctx) {
  const { data } = await ctx.supabase.rpc("is_control", { _user_id: ctx.userId });
  if (!data) throw new Error("Control Admin only");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}
const norm = (s: unknown) => { const d = String(s ?? "").replace(/\D/g, ""); return /^\d{13}$/.test(d) ? d : null; };
const PRICES = catalog.prices as Record<string, number>;
const one = (x: any) => (Array.isArray(x) ? x[0] : x);

async function loadCompanies(sb: any): Promise<PaidCompany[]> {
  const { data: orders } = await sb.from("report_orders")
    .select("id, ref, kind, status, paid_at, amount, method, generated_at, delivered_at, startup_id, startups!inner(id, startup_name, registered_number, hidden_profiles(ref_no))")
    .in("status", ["paid", "generated", "delivered"]).neq("kind", "credit").order("paid_at", { ascending: true });
  const rows = (orders ?? []) as any[];
  const ids = [...new Set(rows.map((o) => o.startup_id))];
  if (!ids.length) return [];
  const regs = [...new Set(rows.map((o) => norm(o.startups?.registered_number)).filter(Boolean))] as string[];
  const [recs, cis, fss, logs, shares, records, sts, advs, invs] = await Promise.all([
    regs.length ? sb.from("dbd_company_records").select("registration_number, source, retrieved_at").in("registration_number", regs) : { data: [] },
    sb.from("company_info_th").select("startup_id, registration_number").in("startup_id", ids),
    sb.from("financial_statements").select("startup_id, registration_number").in("startup_id", ids),
    regs.length ? sb.from("dbd_fetch_logs").select("registration_number, action, startup_id, created_at").eq("result", "ok").in("registration_number", regs).order("created_at", { ascending: false }) : { data: [] },
    sb.from("report_shares").select("business_id, report_keys, financials, valuation").in("business_id", ids).is("revoked_at", null),
    sb.from("company_report_records").select("company_id, report_key, status").in("company_id", ids).in("status", ["generated", "ready"]),
    sb.from("startups").select("id, registered_number, hidden_profiles(ref_no)").not("registered_number", "is", null),
    sb.from("advisor_firms").select("ref_no, name, registration_no").not("registration_no", "is", null),
    sb.from("investors").select("investor_name, registration_no").not("registration_no", "is", null),
  ]);
  const rec = new Map<string, any>((recs.data ?? []).map((r: any) => [r.registration_number, r]));
  const linked = new Set<string>();
  for (const r of [...(cis.data ?? []), ...(fss.data ?? [])]) linked.add(`${r.startup_id}:${norm(r.registration_number) ?? ""}`);
  const usedBy = new Map<string, Set<string>>();
  const use = (reg: string | null, who: string | null | undefined) => { if (!reg || !who || !rec.has(reg)) return; if (!usedBy.has(reg)) usedBy.set(reg, new Set()); usedBy.get(reg)!.add(who); };
  for (const s of sts.data ?? []) use(norm(s.registered_number), one(s.hidden_profiles)?.ref_no ?? null);
  for (const a of advs.data ?? []) use(norm(a.registration_no), a.ref_no ?? a.name);
  for (const i of invs.data ?? []) use(norm(i.registration_no), i.investor_name);
  const produced = new Map<string, Set<HubKey>>();
  for (const r of records.data ?? []) { if (!produced.has(r.company_id)) produced.set(r.company_id, new Set()); produced.get(r.company_id)!.add(r.report_key); }

  const by = new Map<string, PaidCompany>();
  for (const o of rows) {
    const st = o.startups;
    const reg = norm(st?.registered_number);
    let c = by.get(o.startup_id);
    if (!c) {
      const r = reg ? rec.get(reg) : null;
      const isLinked = !!reg && !!r && linked.has(`${o.startup_id}:${reg}`);
      const myLogs = ((logs.data ?? []) as any[]).filter((l) => l.registration_number === reg);
      const last = myLogs.find((l) => ["extract", "refresh", "manual_save"].includes(l.action) || (l.action === "link_existing" && (l.startup_id === o.startup_id || !l.startup_id)));
      const how: DbdCell["how"] = !r ? null : r.source === "manual" ? "manual" : last?.action === "refresh" ? "refreshed" : last?.action === "link_existing" && last.startup_id === o.startup_id ? "linked" : "extracted";
      const dbd: DbdCell = { state: !reg ? "no_number" : !r ? "none" : isLinked ? "linked" : "stored", how, at: r?.retrieved_at ?? null, usedBy: [...(usedBy.get(reg ?? "") ?? [])] };
      c = { startupId: o.startup_id, name: st?.startup_name ?? "—", ref: one(st?.hidden_profiles)?.ref_no ?? null, reg, orders: [], dbd, latestPaid: o.paid_at, oldestOpen: null, produced: [...(produced.get(o.startup_id) ?? [])] };
      by.set(o.startup_id, c);
    }
    const sh = (shares.data ?? []).filter((s: any) => s.business_id === o.startup_id);
    for (const key of keysOfKind(o.kind)) {
      const n = sh.filter((s: any) => (s.report_keys ?? []).includes(key) || (key === "statements" && s.financials) || (key === "valuation" && s.valuation)).length;
      const po: PaidOrder = { id: o.id, ref: o.ref, kind: o.kind, key, status: o.status as OrderStatus, paidAt: o.paid_at, amount: o.amount != null ? Number(o.amount) : null, method: o.method, generatedAt: o.generated_at, deliveredAt: o.delivered_at, shares: n };
      c.orders.push(po);
    }
    if (o.paid_at > c.latestPaid) c.latestPaid = o.paid_at;
    if (o.status !== "delivered" && (!c.oldestOpen || o.paid_at < c.oldestOpen)) c.oldestOpen = o.paid_at;
  }
  for (const c of by.values()) c.orders.sort((a, b) => PAID_ORDER.indexOf(a.key) - PAID_ORDER.indexOf(b.key));
  return [...by.values()].filter((c) => c.orders.length);
}

const ListIn = z.object({
  tile: z.enum(["needs", "ready", "overdue", "authorised", "all"]).default("needs"),
  q: z.string().max(120).default(""),
  report: z.enum(["all", "verification", "shareholders", "statements", "valuation", "pnl", "risk"]).default("all"),
  sort: z.enum(["waiting", "newest", "az"]).default("waiting"),
  page: z.number().int().min(1).max(10_000).default(1),
});

export const listPaidReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => ListIn.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const sb = await control(context as Ctx);
    const all = await loadCompanies(sb);
    const now = new Date();
    const counts = Object.fromEntries((["needs", "ready", "overdue", "authorised", "all"] as PaidTile[]).map((t) => [t, all.filter((c) => inTile(c, t, now)).length])) as Record<PaidTile, number>;
    let list = all.filter((c) => inTile(c, data.tile, now) && matchesSearch(c, data.q) && (data.report === "all" || c.orders.some((o) => o.key === data.report)));
    list = sortCompanies(list, data.sort);
    const total = list.length;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const page = Math.min(data.page, pages);
    const { data: plan } = await sb.from("plans").select("verification_price_thb").eq("role", "seller").eq("status", "live").eq("verification_mode", "paid").order("sort").limit(1);
    const vp = Number(plan?.[0]?.verification_price_thb);
    const prices: Record<string, number | null> = { verification: vp > 0 ? vp : null, shareholders: PRICES.shareholders ?? null, statements: PRICES.financials ?? null, valuation: PRICES.valuation ?? null, pnl: PRICES.financials ?? null, risk: PRICES.risk ?? null, credit: null };
    return { rows: list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), total, page, pages, counts, prices };
  });

/** One company (side panel / Admin view refresh). */
export const getPaidCompany = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ startupId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = await control(context as Ctx);
    const all = await loadCompanies(sb);
    return all.find((c) => c.startupId === data.startupId) ?? null;
  });

/** Sidebar count: companies with at least one order not yet authorised. */
export const paidReportsCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as Ctx;
    const { data: ok } = await ctx.supabase.rpc("is_control", { _user_id: ctx.userId });
    if (!ok) return 0;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as any).from("report_orders").select("startup_id").in("status", ["paid", "generated"]).neq("kind", "credit");
    return new Set((data ?? []).map((r: any) => r.startup_id)).size;
  });

/** Use stored data: links the company to the stored record. No DBD fetch; logged as a link. */
export const linkStoredDbd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ startupId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const sb = await control(ctx);
    const { data: res, error } = await sb.rpc("dbd_link_startup", { _actor: ctx.userId, _sid: data.startupId });
    if (error) return { ok: false as const, error: error.message };
    const { produceSellerReports } = await import("./dbd-store.server");
    await produceSellerReports(context, sb, [data.startupId], ctx.userId);
    return { ok: true as const, retrievedAt: res?.retrieved_at as string };
  });

/** View data: the stored record, read-only, and who uses it. */
export const viewStoredDbd = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ reg: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = await control(context as Ctx);
    const reg = norm(data.reg);
    if (!reg) return null;
    const { data: r } = await sb.from("dbd_company_records").select("source, retrieved_at, data").eq("registration_number", reg).maybeSingle();
    if (!r) return null;
    const d = r.data ?? {};
    const info = d.info ?? {};
    const [sts, advs, invs] = await Promise.all([
      sb.from("startups").select("startup_name, registered_number, hidden_profiles(ref_no)").not("registered_number", "is", null),
      sb.from("advisor_firms").select("ref_no, name, registration_no").not("registration_no", "is", null),
      sb.from("investors").select("investor_name, registration_no").not("registration_no", "is", null),
    ]);
    const usedBy = [
      ...(sts.data ?? []).filter((s: any) => norm(s.registered_number) === reg).map((s: any) => one(s.hidden_profiles)?.ref_no ?? s.startup_name),
      ...(advs.data ?? []).filter((a: any) => norm(a.registration_no) === reg).map((a: any) => a.ref_no ?? a.name),
      ...(invs.data ?? []).filter((i: any) => norm(i.registration_no) === reg).map((i: any) => i.investor_name),
    ].filter(Boolean);
    const years = (d.statements ?? []).map((s: any) => s.fiscal_year).sort();
    const tsic = d.latest_business?.business_code ?? d.registered_business?.business_code ?? null;
    return {
      reg, source: r.source as string, retrievedAt: r.retrieved_at as string, usedBy,
      rows: [
        ["Registration no.", reg],
        ["Legal name (Thai)", info.legal_name_th ?? "—"],
        ["Status", info.legal_entity_status_th ?? "—"],
        ["Registered capital", info.registered_capital_thb != null ? `฿${Number(info.registered_capital_thb).toLocaleString("en-US")}` : info.registered_capital_th_raw ?? "—"],
        ["Registered date", info.registration_date ?? info.registration_date_th_raw ?? "—"],
        ["Directors", (d.directors ?? []).length ? `${(d.directors ?? []).length}${info.authorized_signatory_th ? ` · ${info.authorized_signatory_th}` : ""}` : "—"],
        ["Shareholders", "Not in DBD data · analyst report"],
        ["Fiscal years filed", years.length ? `${years.length} · FY${years[0]}–${years[years.length - 1]}` : "—"],
        ["TSIC", tsic ?? "—"],
      ] as [string, string][],
    };
  });

