import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import catalog from "@/config/report-catalog.json";

/**
 * Paid report orders: seller pays → Admin generates from DBD → Admin verifies
 * & publishes. Every step writes report_order_events (History feed).
 */

type Ctx = { supabase: any; userId: string };
const Kind = z.enum(["financials", "valuation", "bundle", "risk", "shareholders", "pnl", "credit"]);
export const DUE_BUSINESS_DAYS = 2;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}
async function isAdmin(ctx: Ctx) {
  const { data } = await ctx.supabase.rpc("is_control", { _user_id: ctx.userId });
  return !!data;
}
async function assertAdmin(ctx: Ctx) {
  if (!(await isAdmin(ctx))) throw new Error("Admin only");
}

export function addBusinessDays(from: Date, n: number) {
  const d = new Date(from);
  let left = n;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    const w = d.getDay();
    if (w !== 0 && w !== 6) left--;
  }
  return d;
}
const fmtD = (d: string | Date) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

async function names(sb: any, ids: string[]) {
  const out: Record<string, string> = {};
  const uniq = [...new Set(ids.filter(Boolean))];
  if (!uniq.length) return out;
  const { data } = await sb.from("users").select("id, first_name, last_name, email").in("id", uniq);
  for (const u of data ?? []) out[u.id] = [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email || "User";
  return out;
}

/** Seller "Pay" — payments not live yet, so this records a manual paid order. */
export const createMyReportOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ startupId: z.string().uuid(), kind: Kind }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const { data: ok } = await ctx.supabase.rpc("can_access_startup", { _user_id: ctx.userId, _startup_id: data.startupId });
    if (!ok) throw new Error("Not your business");
    const sb = await admin();
    const { data: existing } = await sb.from("report_orders").select("*").eq("startup_id", data.startupId).eq("kind", data.kind)
      .in("status", ["paid", "generated"]).order('paid_at',{ascending:false}).limit(1).maybeSingle();
    if (existing) return existing;
    const paid = new Date();
    const due = addBusinessDays(paid, DUE_BUSINESS_DAYS);
    const { data: row, error } = await sb.rpc('create_report_order',{_uid:ctx.userId,_company:data.startupId,_kind:data.kind,_due:due.toISOString()});
    if (error) throw new Error(error.message);
    await sb.from("report_order_events").insert({ order_id: row.id, event: "paid", actor_id: ctx.userId,
      note: `${row.method} · ${row.payment_ref} · due ${fmtD(due)}` });
    // Already produced from stored DBD data: the order goes straight to Authorise seller.
    const { producedKeys } = await import("./dbd-store.server");
    const made = await producedKeys(sb, data.startupId);
    const needs: Record<string, string[]> = { financials: ["statements"], pnl: ["pnl"], risk: ["risk"], valuation: ["valuation"], bundle: ["statements", "valuation"] };
    if (needs[data.kind]?.every((k) => made.has(k))) {
      const at = new Date().toISOString();
      await sb.from("report_orders").update({ status: "generated", generated_at: at }).eq("id", row.id).eq("status", "paid");
      await sb.from("report_order_events").insert({ order_id: row.id, event: "generated", actor_id: ctx.userId, note: "Already produced from stored DBD data · waiting for Authorise seller" });
      return { ...row, status: "generated", generated_at: at };
    }
    const { data: admins } = await sb.from("user_roles").select("user_id, roles!inner(role_code)").eq("roles.role_code", "CONTROL");
    for (const a of admins ?? []) await sb.from("notifications").insert({ user_id: a.user_id, notification_type: "approval",
      title: "Paid report waiting", message: `Order ${row.ref} paid — due ${fmtD(due)}` });
    return row;
  });

/** Orders for one startup (seller or admin). */
export const getStartupReportOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ startupId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const { data: rows, error } = await ctx.supabase.from("report_orders").select("*").eq("startup_id", data.startupId)
      .not("status", "in", "(cancelled,refunded)").order("paid_at", { ascending: false });
    if (error) throw new Error(error.message);
    const admin_ = await isAdmin(ctx);
    let extra: Record<string, string> = {};
    if (admin_ && rows?.length) {
      const sb = await admin();
      extra = await names(sb, rows.flatMap((r: any) => [r.ordered_by, r.analyst_id]));
    }
    return { orders: rows ?? [], names: extra };
  });

/** Admin: every active order with startup info (Approvals + Directory). */
export const listReportOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as Ctx;
    if (!(await isAdmin(ctx))) return { orders: [] as any[] };
    const sb = await admin();
    const { data } = await sb.from("report_orders")
      .select("*, startups!inner(id, startup_name, registered_number, hidden_profiles(code_name, ref_no))")
      .not("status", "in", "(cancelled,refunded)").order("paid_at", { ascending: true });
    const orders = data ?? [];
    // Overdue: one System event per order past due and not delivered.
    const now = Date.now();
    const late = orders.filter((o: any) => o.status !== "delivered" && o.due_at && new Date(o.due_at).getTime() < now);
    if (late.length) {
      const { data: seen } = await sb.from("report_order_events").select("order_id").eq("event", "overdue").in("order_id", late.map((o: any) => o.id));
      const have = new Set((seen ?? []).map((e: any) => e.order_id));
      const fresh = late.filter((o: any) => !have.has(o.id));
      if (fresh.length) await sb.from("report_order_events").insert(fresh.map((o: any) => ({ order_id: o.id, event: "overdue", actor_id: null,
        note: `Due ${fmtD(o.due_at)} · not published` })));
    }
    // Report ready is per company: one generated DBD report serves the
    // financial report and the estimated valuation alike.
    const ids = [...new Set(orders.map((o: any) => o.startup_id))];
    const ready: Record<string, string | null> = {};
    const keep = (id: string, at: string | null | undefined) => {
      if (!at) return;
      if (!ready[id] || at > ready[id]!) ready[id] = at;
    };
    if (ids.length) {
      const { data: fs } = await sb.from("financial_statements").select("startup_id, created_at, retrieved_at").in("startup_id", ids);
      for (const r of fs ?? []) { keep(r.startup_id, r.created_at); keep(r.startup_id, r.retrieved_at); }
    }
    for (const o of orders) keep(o.startup_id, o.generated_at);
    const n = await names(sb, orders.map((o: any) => o.delivered_by));
    return {
      orders: orders.map((o: any) => ({
        ...o,
        ready_at: ready[o.startup_id] ?? null,
        delivered_by_name: o.delivered_by ? n[o.delivered_by] ?? null : null,
      })),
    };
  });

/** Admin: Authorise seller — the order becomes delivered. Notification + History wait for finalise (after Undo window). */
export const authoriseSeller = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await assertAdmin(ctx);
    const sb = await admin();
    const { data: prev } = await sb.from("report_orders").select("*").eq("id", data.orderId).single();
    if(prev?.status==='delivered')return {prevStatus:'delivered'};
    if(!prev||!['paid','generated'].includes(prev.status))throw new Error('Active paid order required');
    if(!prev.generated_at)throw new Error('Generate and review the report before authorising');
    if(['valuation','bundle'].includes(prev.kind)){const {hubContent}=await import('./reports-hub.server');const {valuationCanGenerate}=await import('./reports-hub');if(!valuationCanGenerate(await hubContent(context,'admin',prev.startup_id,undefined,'valuation',true)))throw new Error('Valuation needs usable peer-based inputs before authorisation');}
    if(['shareholders','credit'].includes(prev.kind)){const {data:r}=await sb.from('company_report_records').select('generated_at,content').eq('company_id',prev.startup_id).eq('report_key',prev.kind).maybeSingle();if(!r?.generated_at||!r?.content)throw new Error('The real analyst report must be recorded first');}
    const now = new Date().toISOString();
    const { data: o, error } = await sb.from("report_orders").update({ status: "delivered", delivered_at: now, delivered_by: ctx.userId,
      generated_at: prev.generated_at ?? now, analyst_id: prev.analyst_id ?? ctx.userId }).eq("id", data.orderId).in('status',['paid','generated']).select("*").single();
    if (error) throw new Error(error.message);
    if (o.kind === "financials" || o.kind === "bundle") await sb.from("financial_statements").update({ verified_status: "verified" }).eq("startup_id", o.startup_id);
    return { prevStatus: prev.status as string };
  });

export const undoAuthorise = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ orderId: z.string().uuid(), prevStatus: z.enum(["paid", "generated"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await assertAdmin(ctx);
    const sb = await admin();
    const { data: o, error } = await sb.from("report_orders").update({ status: data.prevStatus, delivered_at: null, delivered_by: null })
      .eq("id", data.orderId).select("*").single();
    if (error) throw new Error(error.message);
    if (o.kind === "financials" || o.kind === "bundle") await sb.from("financial_statements").update({ verified_status: "draft" }).eq("startup_id", o.startup_id);
    return { ok: true };
  });

/** After the Undo window: History event + seller notification (once). */
export const finaliseAuthorise = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await assertAdmin(ctx);
    const sb = await admin();
    const { data: o } = await sb.from("report_orders").select("*").eq("id", data.orderId).single();
    if (o?.status !== "delivered") return { ok: false };
    const { data: seen } = await sb.from("report_order_events").select("id").eq("order_id", o.id).eq("event", "published").maybeSingle();
    if (seen) return { ok: true };
    await sb.from("report_order_events").insert({ order_id: o.id, event: "published", actor_id: ctx.userId,
      note: o.kind === "valuation" ? "Seller can see the valuation · seller notified" : "verified_status = verified · badge added · seller notified" });
    if (o.ordered_by) await notifyReady(sb, o);
    return { ok: true };
  });

export const markReportGenerated = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ orderId: z.string().uuid(), years: z.array(z.number()).optional(), regNo: z.string().nullable().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await assertAdmin(ctx);
    const sb = await admin();
    const { data: base } = await sb.from("report_orders").select("startup_id,kind").eq("id", data.orderId).single();
    if (!base) throw new Error("Order not found");
    // Financial imports generate financial-derived reports; valuation additionally needs usable peer inputs.
    const {hubContent}=await import("./reports-hub.server");const {valuationCanGenerate}=await import("./reports-hub");
    const valuationReady=valuationCanGenerate(await hubContent(context,"admin",base.startup_id,undefined,"valuation",true));
    if(["valuation","bundle"].includes(base.kind)&&!valuationReady)throw new Error("Valuation needs matched peers and sufficient financial inputs");
    const { data: rows, error } = await sb.from("report_orders")
      .update({ status: "generated", generated_at: new Date().toISOString(), analyst_id: ctx.userId })
      .eq("startup_id", base.startup_id).eq("status", "paid").in("kind",valuationReady?["financials","valuation","bundle","pnl","risk"]:["financials","pnl","risk"]).select("*");
    if (error) throw new Error(error.message);
    await sb.from("financial_statements").update({ verified_status: "draft" }).eq("startup_id", base.startup_id);
    const yrs = (data.years ?? []).slice().sort();
    const note = ["DBD e-Filing", yrs.length ? `FY${yrs[0]}–${yrs[yrs.length - 1]}` : null, data.regNo ? `reg. ${data.regNo}` : null].filter(Boolean).join(" · ");
    if (rows?.length) await sb.from("report_order_events").insert(rows.map((r: any) => ({ order_id: r.id, event: "generated", actor_id: ctx.userId, note })));
    return (rows ?? []).find((r: any) => r.id === data.orderId) ?? rows?.[0] ?? null;
  });

export const publishReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await assertAdmin(ctx);
    const sb = await admin();
    const {data:prev}=await sb.from('report_orders').select('*').eq('id',data.orderId).single();
    if(prev?.status==='delivered')return prev;
    if(!prev||!['paid','generated'].includes(prev.status))throw new Error('Active paid order required');
    if(!prev.generated_at)throw new Error('Generate and review the report before authorising');
    if(['valuation','bundle'].includes(prev.kind)){const {hubContent}=await import('./reports-hub.server');const {valuationCanGenerate}=await import('./reports-hub');if(!valuationCanGenerate(await hubContent(context,'admin',prev.startup_id,undefined,'valuation',true)))throw new Error('Valuation needs usable peer-based inputs before authorisation');}
    if(['shareholders','credit'].includes(prev.kind)){const {data:r}=await sb.from('company_report_records').select('generated_at,content').eq('company_id',prev.startup_id).eq('report_key',prev.kind).maybeSingle();if(!r?.generated_at||!r?.content)throw new Error('The real analyst report must be recorded first');}
    const now = new Date().toISOString();
    const { data: o, error } = await sb.from("report_orders").update({ status: "delivered", delivered_at: now, delivered_by: ctx.userId,
      invoice_no: undefined }).eq("id", data.orderId).in('status',['paid','generated']).select("*").single();
    if (error) throw new Error(error.message);
    if (o.kind === "financials" || o.kind === "bundle") await sb.from("financial_statements").update({ verified_status: "verified" }).eq("startup_id", o.startup_id);
    await sb.from("report_order_events").insert({ order_id: o.id, event: "published", actor_id: ctx.userId,
      note: o.kind === "valuation" ? "Valuation published · seller notified" : "verified_status = verified · badge added · seller notified" });
    if (o.ordered_by) await notifyReady(sb, o);
    return o;
  });

/** Admin: report events for the History feed. */
export const listReportEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as Ctx;
    await assertAdmin(ctx);
    const sb = await admin();
    const { data } = await sb.from("report_order_events")
      .select("*, report_orders!inner(ref, kind, startup_id, startups!inner(startup_name, hidden_profiles(code_name, ref_no)))")
      .order("created_at", { ascending: false }).limit(500);
    const n = await names(sb, (data ?? []).map((e: any) => e.actor_id));
    return { events: data ?? [], names: n };
  });

/** Pending-count helper used by the Approvals menu badge. */
export async function countOpenOrders() {
  const sb = await admin();
  const { count } = await sb.from("report_orders").select("id", { count: "exact", head: true }).in("status", ["paid", "generated"]);
  return count ?? 0;
}

/** "Report ready" notification: names the company and links to that report's tab. */
async function notifyReady(sb: any, o: any) {
  const { data: st } = await sb.from("startups").select("startup_name").eq("id", o.startup_id).maybeSingle();
  const company = st?.startup_name ?? "your company";
  const key=o.kind==='financials'||o.kind==='bundle'?'statements':o.kind;
  const {HUB_NAMES}=await import('./reports-hub');
  const report=HUB_NAMES[key as keyof typeof HUB_NAMES]??'estimated valuation';
  await sb.from("notifications").insert({ user_id: o.ordered_by, notification_type: "approval", title: "Your report is ready",
    message: `Your ${report} for ${company} is ready. View it and share it with buyers whose NDA you approved.`,
    link_url: `/my-reports?company=${o.startup_id}&report=${key}` });
  {const {sendAlert}=await import('./email-alerts.server');await sendAlert({alert:'report_ready',role:'seller',userIds:[o.ordered_by],vars:{company,report,companyId:o.startup_id,key},refKey:o.id});}
}
