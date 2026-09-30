import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { BUYER_VISIBLE } from "@/lib/hidden-profile";
import type { PublicListing } from "@/lib/public-listing";

/**
 * Buyer Favourites: saved listings plus listings with an NDA requested or
 * approved. Private fields are added server-side only for the caller's own
 * approved, still-valid NDAs; everything else gets the public listing.
 */

export type FavStatus = "approved" | "requested" | "saved";
export type FavPrivate = {
  companyName: string;
  logoPath: string | null;
  description: string | null;
  employees: string | null;
  legalNameEn: string | null;
  legalNameTh: string | null;
  regNo: string | null;
  website: string | null;
  location: string | null;
  founded: string | null;
  fy: number | null;
  revenue: number | null;
  netProfit: number | null;
  growthPct: number | null;
  ndaApprovedAt: string;
  ndaValidUntil: string;
};
export type Favourite = {
  id: string;
  status: FavStatus;
  saved: boolean;
  at: string;
  pipelineId: string | null;
  ndaRequestedAt: string | null;
  listing: PublicListing;
  dealType?: string | null;
  askingPrice?: number | null;
  stakePct?: number | null;
  priv: FavPrivate | null;
};

const TWO_YEARS = 730 * 86_400_000;
const CLOSED = ["declined", "withdrawn", "revoked"];

/** Active NDA state for a pipeline row, or null when it no longer counts. */
export function ndaState(r: { status: string; nda_approved_at: string | null; nda_expires_at?: string | null }): "approved" | "requested" | null {
  if (CLOSED.includes(r.status)) return null;
  if (!r.nda_approved_at) return "requested";
  const until = r.nda_expires_at ? new Date(r.nda_expires_at).getTime() : new Date(r.nda_approved_at).getTime() + TWO_YEARS;
  return until > Date.now() ? "approved" : null;
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

/** Listing ids the caller has an active NDA for (requested or approved). */
export async function activeNdaIds(userId: string): Promise<Set<string>> {
  const sb = await admin();
  const { data } = await sb.from("deal_pipelines").select("hidden_profile_id, status, nda_approved_at, nda_expires_at").eq("buyer_user_id", userId);
  return new Set((data ?? []).filter((r: any) => ndaState(r)).map((r: any) => r.hidden_profile_id));
}

export const listFavourites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = await admin();
    const { buildPublicListing } = await import("@/lib/public-listing");
    const [{ data: saves }, { data: pipes }] = await Promise.all([
      sb.from("saved_listings").select("hidden_profile_id, created_at").eq("user_id", context.userId),
      sb.from("deal_pipelines").select("id, hidden_profile_id, startup_id, status, nda_requested_at, nda_approved_at, nda_expires_at").eq("buyer_user_id", context.userId),
    ]);
    const savedAt = new Map<string, string>((saves ?? []).map((s: any) => [s.hidden_profile_id, s.created_at]));
    const pipeBy = new Map<string, any>();
    for (const p of pipes ?? []) if (ndaState(p)) pipeBy.set(p.hidden_profile_id, p);
    const ids = [...new Set([...savedAt.keys(), ...pipeBy.keys()])];
    if (!ids.length) return [] as Favourite[];

    const { data: hps } = await sb
      .from("hidden_profiles")
      .select("id, startup_id, ref_no, published_at, live, approval_status, startups!inner(startup_name, registered_name, website_url, email, city, region, headquarters, company_type, year_founded, company_size, last_year_revenue, sector, business_model, industry, product_tags, market_tags, long_description, short_description, regulatory_licenses, iso_standards, logo_url)")
      .in("id", ids)
      .in("approval_status", [...BUYER_VISIBLE])
      .not("live", "is", null);
    const rows = hps ?? [];
    const stIds = rows.map((r: any) => r.startup_id);
    const approvedSt = rows.filter((r: any) => pipeBy.get(r.id) && ndaState(pipeBy.get(r.id)) === "approved").map((r: any) => r.startup_id);
    const [{ data: fin }, { data: inc }, { data: ci }] = await Promise.all([
      stIds.length ? sb.from("financial_statements").select("startup_id").in("startup_id", stIds) : { data: [] },
      approvedSt.length ? sb.from("income_statement_items").select("startup_id, fiscal_year, item_code, amount").in("startup_id", approvedSt).in("item_code", ["total_revenue", "revenue_sales_services", "net_profit_loss"]) : { data: [] },
      approvedSt.length ? sb.from("company_info_th").select("startup_id, legal_name_th, legal_name_en, registration_number, website").in("startup_id", approvedSt) : { data: [] },
    ]);
    const withFin = new Set((fin ?? []).map((f: any) => f.startup_id));
    const ciBy = new Map<string, any>((ci ?? []).map((c: any) => [c.startup_id, c]));

    const figures = (startupId: string) => {
      const m: Record<number, { rev?: number; tr?: number; net?: number }> = {};
      for (const i of inc ?? []) {
        if (i.startup_id !== startupId || i.amount == null) continue;
        const y = Number(i.fiscal_year);
        m[y] ??= {};
        if (i.item_code === "total_revenue") m[y].tr = Number(i.amount);
        if (i.item_code === "revenue_sales_services") m[y].rev = Number(i.amount);
        if (i.item_code === "net_profit_loss") m[y].net = Number(i.amount);
      }
      const years = Object.keys(m).map(Number).sort((a, b) => b - a);
      const y = years[0];
      if (y == null) return { fy: null, revenue: null, netProfit: null, growthPct: null };
      const rev = (yr: number) => m[yr]?.tr ?? m[yr]?.rev ?? null;
      const r0 = rev(y), r1 = m[y - 1] ? rev(y - 1) : null;
      return { fy: y, revenue: r0, netProfit: m[y].net ?? null, growthPct: r0 != null && r1 ? ((r0 - r1) / Math.abs(r1)) * 100 : null };
    };

    const out: Favourite[] = rows.map((r: any) => {
      const live = (r.live ?? {}) as any;
      const st = Array.isArray(r.startups) ? r.startups[0] : r.startups;
      const listing = buildPublicListing(st, { ...live, ref_no: r.ref_no, live: true, published_at: r.published_at }, withFin.has(r.startup_id));
      const p = pipeBy.get(r.id);
      const state = p ? ndaState(p) : null;
      const status: FavStatus = state ?? "saved";
      let priv: FavPrivate | null = null;
      if (state === "approved") {
        const c = ciBy.get(r.startup_id) ?? {};
        const until = p.nda_expires_at ?? new Date(new Date(p.nda_approved_at).getTime() + TWO_YEARS).toISOString();
        priv = {
          companyName: st.startup_name || c.legal_name_en || c.legal_name_th || live.code_name || "Company",
          logoPath: st.logo_url ?? null,
          description: st.long_description || st.short_description || null,
          employees: st.company_size ?? null,
          legalNameEn: c.legal_name_en ?? null,
          legalNameTh: c.legal_name_th ?? st.registered_name ?? null,
          regNo: c.registration_number ?? null,
          website: st.website_url || c.website || null,
          location: [st.city, st.region].filter(Boolean).join(", ") || st.headquarters || null,
          founded: st.year_founded ? String(st.year_founded) : null,
          ...figures(r.startup_id),
          ndaApprovedAt: p.nda_approved_at,
          ndaValidUntil: until,
        };
      }
      const at = state === "approved" ? p.nda_approved_at : state === "requested" ? p.nda_requested_at : savedAt.get(r.id)!;
      return {
        id: r.id, status, saved: savedAt.has(r.id), at, pipelineId: p?.id ?? null, ndaRequestedAt: p?.nda_requested_at ?? null,
        listing, dealType: live.deal_type, askingPrice: live.asking_price, stakePct: live.stake_pct, priv,
      };
    });
    const rank = { approved: 0, requested: 1, saved: 2 } as const;
    out.sort((a, b) => rank[a.status] - rank[b.status] || (b.at ?? "").localeCompare(a.at ?? ""));
    return out;
  });

export const mySavedListingIds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("saved_listings").select("hidden_profile_id").eq("user_id", context.userId);
    return (data ?? []).map((r: any) => r.hidden_profile_id as string);
  });

export const toggleSavedListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), saved: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    if (data.saved) {
      const { error } = await sb.from("saved_listings").upsert({ user_id: context.userId, hidden_profile_id: data.id }, { onConflict: "user_id,hidden_profile_id", ignoreDuplicates: true });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await sb.from("saved_listings").delete().eq("user_id", context.userId).eq("hidden_profile_id", data.id);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

/** Buyer withdraws an NDA request that the seller has not approved yet. */
export const withdrawNdaRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = await admin();
    const { data: p } = await sb.from("deal_pipelines").select("id, buyer_user_id, nda_approved_at, status").eq("hidden_profile_id", data.id).eq("buyer_user_id", context.userId).maybeSingle();
    if (!p) throw new Error("No NDA request for this listing");
    if (p.nda_approved_at) throw new Error("The seller has already approved this NDA");
    const { error } = await sb.from("deal_pipelines").update({ status: "withdrawn" }).eq("id", p.id);
    if (error) throw new Error(error.message);
    await sb.from("deal_pipeline_events").insert({ pipeline_id: p.id, event: "nda_withdrawn", actor_id: context.userId });
    return { ok: true };
  });

/** Browse listings: how many live listings the buyer has an active NDA for. */
export const favouritesNdaCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ids = [...(await activeNdaIds(context.userId))];
    if (!ids.length) return 0;
    const sb = await admin();
    const { count } = await sb.from("hidden_profiles").select("id", { count: "exact", head: true }).in("id", ids).in("approval_status", [...BUYER_VISIBLE]).not("live", "is", null);
    return count ?? 0;
  });
