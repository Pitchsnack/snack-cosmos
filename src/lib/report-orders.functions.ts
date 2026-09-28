import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import catalog from "@/config/report-catalog.json";

/**
 * Paid report orders: seller pays → Admin generates from DBD → Admin verifies
 * & publishes. Every step writes report_order_events (History feed).
 */

type Ctx = { supabase: any; userId: string };
const Kind = z.enum(["financials", "valuation", "bundle"]);
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
      .not("status", "in", "(cancelled,refunded)").maybeSingle();
    if (existing) return existing;
    const paid = new Date();
    const due = addBusinessDays(paid, DUE_BUSINESS_DAYS);
    const amount = (catalog.prices as Record<string, number>)[data.kind] ?? 0;
    const { data: row, error } = await sb.from("report_orders").insert({
      startup_id: data.startupId, kind: data.kind, amount, currency: catalog.currency, status: "paid",
      paid_at: paid.toISOString(), due_at: due.toISOString(), method: "Manual", payment_ref: `MAN-${Date.now().toString().slice(-6)}`,
      ordered_by: ctx.userId,
    }).select("*").single();
    if (error) throw new Error(error.message);
    await sb.from("report_order_events").insert({ order_id: row.id, event: "paid", actor_id: ctx.userId,
      note: `${row.method} · ${row.payment_ref} · due ${fmtD(due)}` });
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
    return { orders };
  });

export const markReportGenerated = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ orderId: z.string().uuid(), years: z.array(z.number()).optional(), regNo: z.string().nullable().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await assertAdmin(ctx);
    const sb = await admin();
    const { data: o, error } = await sb.from("report_orders").update({ status: "generated", generated_at: new Date().toISOString(), analyst_id: ctx.userId })
      .eq("id", data.orderId).select("*").single();
    if (error) throw new Error(error.message);
    await sb.from("financial_statements").update({ verified_status: "draft" }).eq("startup_id", o.startup_id);
    const yrs = (data.years ?? []).slice().sort();
    await sb.from("report_order_events").insert({ order_id: o.id, event: "generated", actor_id: ctx.userId,
      note: ["DBD e-Filing", yrs.length ? `FY${yrs[0]}–${yrs[yrs.length - 1]}` : null, data.regNo ? `reg. ${data.regNo}` : null].filter(Boolean).join(" · ") });
    return o;
  });

export const publishReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await assertAdmin(ctx);
    const sb = await admin();
    const now = new Date().toISOString();
    const { data: o, error } = await sb.from("report_orders").update({ status: "delivered", delivered_at: now, delivered_by: ctx.userId,
      invoice_no: undefined }).eq("id", data.orderId).select("*").single();
    if (error) throw new Error(error.message);
    if (o.kind !== "valuation") await sb.from("financial_statements").update({ verified_status: "verified" }).eq("startup_id", o.startup_id);
    await sb.from("report_order_events").insert({ order_id: o.id, event: "published", actor_id: ctx.userId,
      note: o.kind === "valuation" ? "Valuation published · seller notified" : "verified_status = verified · badge added · seller notified" });
    if (o.ordered_by) await sb.from("notifications").insert({ user_id: o.ordered_by, notification_type: "approval",
      title: "Your report is ready", message: o.kind === "valuation" ? "Your company valuation is ready." : "Your verified financial report is ready in My Financials." });
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
