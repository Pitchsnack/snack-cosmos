import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type PublicInvestor } from "@/lib/investor-browse";
import { bandOf, bandText, sortActsFor, typeName } from "@/lib/investor-bands";

/**
 * Seller › Browse investors. Returns the PUBLIC investor record only:
 * code name, type, location, ranges, sectors and the revenue minimum.
 * Real names, websites, people, exact AUM/ticket, portfolio and the
 * non-anonymous description never leave the server here.
 */


function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Verified, live buyers as public investor cards. `onlyIds` narrows to given investor ids. */
export async function loadPublicInvestors(sb: any, onlyIds?: string[]): Promise<Array<PublicInvestor & { userId: string; liveSince: string | null }>> {
  let bq = sb.from("buyer_profiles").select("*").eq("status", "live").not("investor_id", "is", null);
  if (onlyIds) { if (!onlyIds.length) return []; bq = bq.in("investor_id", onlyIds); }
  const { data: buyers } = await bq.limit(500);
  const userIds = (buyers ?? []).map((b: any) => b.user_id as string);
  if (!userIds.length) return [];
  const { data: bvs } = await sb.from("buyer_verifications")
    .select("user_id, company_name, buyer_type, status").in("user_id", userIds).eq("status", "verified");
  const bvByUser = new Map<string, any>((bvs ?? []).map((b: any) => [b.user_id, b]));
  const buyerByInv = new Map<string, any>(
    (buyers ?? []).filter((b: any) => bvByUser.has(b.user_id)).map((b: any) => [b.investor_id, b]),
  );
  const ids = [...buyerByInv.keys()];
  if (!ids.length) return [];

  const { data: rows } = await sb.from("investors")
    .select("id, investor_name, investor_type, country, aum, min_ticket_size, max_ticket_size, short_description, preferred_stages, preferred_industries, revenue_min_m, revenue_max_m, aum_band, ticket_band, revenue_min_band, investment_focus, acts_for_types, created_at")
    .in("id", ids).order("created_at", { ascending: false });

  return (rows ?? []).map((r: any) => {
    const bp = buyerByInv.get(r.id);
    const bv = bp ? bvByUser.get(bp.user_id) : null;
    const h = hash(r.id);
    const type = r.investor_type ?? bv?.buyer_type ?? null;
    // No code names: before an NDA sellers see the investor type.
    const actsFor = bp?.buyer_relation === "agent" ? sortActsFor(r.acts_for_types) : [];
    const codeName = typeName(type, actsFor);
    let description: string | null = bp ? bp.description ?? null : null;
    if (description && r.investor_name) {
      const esc = String(r.investor_name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      description = description.replace(new RegExp(esc, "gi"), codeName);
    }
    const aum = bandOf(r.aum_band), tkt = bandOf(r.ticket_band), rev = bandOf(r.revenue_min_band);
    return {
      id: r.id,
      userId: bp.user_id,
      liveSince: (bp?.live_since ?? bp?.decided_at ?? bp?.created_at ?? null) as string | null,
      refNo: bp?.ref_no || `INV-${String(h % 10000).padStart(4, "0")}`,
      codeName,
      // Never the firm's name before an approved NDA.
      name: null,
      type,
      city: bp?.city ?? null,
      country: r.country ?? bp?.country ?? null,
      description,
      sectors: (r.preferred_industries ?? bp?.sectors ?? []) as string[],
      stages: (r.preferred_stages ?? bp?.stages ?? []) as string[],
      dealTypes: (bp?.deal_types ?? []) as string[],
      geography: bp?.geography || ((r.investment_focus ?? []) as string[]).join(", ") || null,
      verified: bv?.status === "approved",
      proofOfFunds: !!bp?.pof_verified_at,
      aumBand: aum?.key ?? null,
      ticketBand: tkt?.key ?? null,
      revBand: rev?.key ?? null,
      relation: (bp?.buyer_relation ?? null) as PublicInvestor["relation"],
      actsFor,
      aumLabel: bandText(r.aum_band),
      ticketLabel: bandText(r.ticket_band),
      revLabel: bandText(r.revenue_min_band),
    };
  });
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export const listBrowseInvestors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireRole } = await import("./plan-access.server");
    await requireRole(context.userId, ["seller"]);
    const list = await loadPublicInvestors(await admin());
    return list.map(({ userId: _u, liveSince: _l, ...i }) => i as PublicInvestor);
  });

export type SellerFavStatus = "approved" | "requested" | "saved";
export type SellerFavourite = PublicInvestor & { status: SellerFavStatus; saved: boolean; at: string; listingCode: string | null };

/** Seller Favourites: starred investors plus buyers with an NDA requested/approved on the seller's listings. */
export const listSellerFavourites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireRole } = await import("./plan-access.server");
    await requireRole(context.userId, ["seller"]);
    const sb = await admin();
    const { ndaState } = await import("@/lib/favourites.functions");
    const [{ data: saves }, { data: own }, { data: su }] = await Promise.all([
      sb.from("saved_investors").select("investor_id, created_at").eq("user_id", context.userId),
      sb.from("startup_ownership").select("startup_id").eq("owning_agent_user_id", context.userId),
      sb.from("startup_users").select("startup_id").eq("user_id", context.userId),
    ]);
    const stIds = [...new Set([...(own ?? []), ...(su ?? [])].map((x: any) => x.startup_id))];
    const { data: pipes } = stIds.length
      ? await sb.from("deal_pipelines").select("buyer_user_id, hidden_profile_id, status, nda_requested_at, nda_approved_at, nda_expires_at").in("startup_id", stIds)
      : { data: [] };
    const savedAt = new Map<string, string>((saves ?? []).map((s: any) => [s.investor_id, s.created_at]));
    // Best NDA state per buyer (approved beats requested).
    const pipeByUser = new Map<string, any>();
    for (const p of pipes ?? []) {
      const st = ndaState(p);
      if (!st) continue;
      const prev = pipeByUser.get(p.buyer_user_id);
      if (!prev || (st === "approved" && prev._st !== "approved")) pipeByUser.set(p.buyer_user_id, { ...p, _st: st });
    }
    let invIdsFromPipes: string[] = [];
    if (pipeByUser.size) {
      const { data: bps } = await sb.from("buyer_profiles").select("investor_id").in("user_id", [...pipeByUser.keys()]).not("investor_id", "is", null);
      invIdsFromPipes = (bps ?? []).map((b: any) => b.investor_id);
    }
    const ids = [...new Set([...savedAt.keys(), ...invIdsFromPipes])];
    const list = await loadPublicInvestors(sb, ids);
    const hpIds = [...new Set([...pipeByUser.values()].map((p) => p.hidden_profile_id))];
    const { data: hps } = hpIds.length ? await sb.from("hidden_profiles").select("id, ref_no").in("id", hpIds) : { data: [] };
    const refBy = new Map<string, string>((hps ?? []).map((h: any) => [h.id, h.ref_no]));
    const out: SellerFavourite[] = list.flatMap(({ userId, ...i }) => {
      const p = pipeByUser.get(userId);
      const status: SellerFavStatus = p?._st ?? "saved";
      if (status === "saved" && !savedAt.has(i.id)) return [];
      const at = status === "approved" ? p.nda_approved_at : status === "requested" ? p.nda_requested_at : savedAt.get(i.id)!;
      return [{ ...(i as PublicInvestor), status, saved: savedAt.has(i.id), at, listingCode: p ? refBy.get(p.hidden_profile_id) ?? null : null }];
    });
    const rank = { approved: 0, requested: 1, saved: 2 } as const;
    out.sort((a, b) => rank[a.status] - rank[b.status] || (b.at ?? "").localeCompare(a.at ?? ""));
    return out;
  });

export const mySavedInvestorIds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await (context.supabase as any).from("saved_investors").select("investor_id").eq("user_id", context.userId);
    return (data ?? []).map((r: any) => r.investor_id as string);
  });

export const toggleSavedInvestor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), saved: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { error } = data.saved
      ? await sb.from("saved_investors").upsert({ user_id: context.userId, investor_id: data.id }, { onConflict: "user_id,investor_id", ignoreDuplicates: true })
      : await sb.from("saved_investors").delete().eq("user_id", context.userId).eq("investor_id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
