import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Seller My Financials / Company Valuation: the seller's own companies with
 * one status per report, plus the per-user page settings (last picked company,
 * share panel closed). Only companies the caller owns or belongs to count.
 */
export type ReportStatus = { status: "ready" | "preparing" | "none"; at: string | null; ref: string | null };
export type MyReportCompany = {
  id: string;
  name: string;
  logoUrl: string | null;
  financials: ReportStatus;
  valuation: ReportStatus;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function myCompanyIds(sb: any, userId: string) {
  const { data: own } = await sb.from("startup_ownership").select("startup_id").eq("owning_agent_user_id", userId);
  const { data: su } = await sb.from("startup_users").select("startup_id").eq("user_id", userId);
  return [...new Set([...(own ?? []), ...(su ?? [])].map((x: any) => x.startup_id as string))];
}

function statusFor(orders: any[], kind: "financials" | "valuation"): ReportStatus {
  const mine = orders.filter((o) => o.kind === kind || o.kind === "bundle");
  const done = mine.filter((o) => o.status === "delivered").sort((a, b) => String(b.delivered_at).localeCompare(String(a.delivered_at)))[0];
  if (done) return { status: "ready", at: done.delivered_at, ref: done.ref ?? null };
  const open = mine.sort((a, b) => String(b.paid_at).localeCompare(String(a.paid_at)))[0];
  if (open) return { status: "preparing", at: open.paid_at ?? open.created_at ?? null, ref: open.ref ?? null };
  return { status: "none", at: null, ref: null };
}

export const getMyReportsState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = await admin();
    const ids = await myCompanyIds(sb, context.userId);
    const { data: sts } = ids.length
      ? await sb.from("startups").select("id, startup_name, logo_url, created_at").in("id", ids).order("created_at", { ascending: true })
      : { data: [] };
    const { data: orders } = ids.length
      ? await sb.from("report_orders").select("startup_id, kind, status, paid_at, created_at, delivered_at, ref").in("startup_id", ids).not("status", "in", "(cancelled,refunded)")
      : { data: [] };
    const paths = (sts ?? []).map((s: any) => s.logo_url).filter((p: any): p is string => !!p && !/^https?:\/\//.test(p));
    const signed: Record<string, string> = {};
    if (paths.length) {
      const { data } = await sb.storage.from("startup-media").createSignedUrls(paths, 3600);
      for (const d of data ?? []) if (d.path && d.signedUrl) signed[d.path] = d.signedUrl;
    }
    const companies: MyReportCompany[] = (sts ?? []).map((s: any) => {
      const o = (orders ?? []).filter((x: any) => x.startup_id === s.id);
      return {
        id: s.id,
        name: s.startup_name ?? "Company",
        logoUrl: s.logo_url ? signed[s.logo_url] ?? (/^https?:\/\//.test(s.logo_url) ? s.logo_url : null) : null,
        financials: statusFor(o, "financials"),
        valuation: statusFor(o, "valuation"),
      };
    });
    const { data: pref } = await context.supabase.from("seller_report_prefs").select("last_company_id, share_panel_hidden").eq("user_id", context.userId).maybeSingle();
    return {
      companies,
      lastCompanyId: pref?.last_company_id && ids.includes(pref.last_company_id) ? (pref.last_company_id as string) : null,
      sharePanelHidden: !!pref?.share_panel_hidden,
    };
  });

export const saveMyReportsPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ lastCompanyId: z.string().uuid().optional(), sharePanelHidden: z.boolean().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    if (data.lastCompanyId) {
      const ids = await myCompanyIds(await admin(), context.userId);
      if (!ids.includes(data.lastCompanyId)) throw new Error("Not your company");
    }
    const patch: { user_id: string; updated_at: string; last_company_id?: string; share_panel_hidden?: boolean } = { user_id: context.userId, updated_at: new Date().toISOString() };
    if (data.lastCompanyId) patch.last_company_id = data.lastCompanyId;
    if (data.sharePanelHidden !== undefined) patch.share_panel_hidden = data.sharePanelHidden;
    const { error } = await context.supabase.from("seller_report_prefs").upsert(patch, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
