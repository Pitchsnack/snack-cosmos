import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type PublicInvestor } from "@/lib/investor-browse";
import { bandOf, bandText, sortActsFor, typeName } from "@/lib/investor-bands";
import { newCardDays } from "@/lib/standard-card";

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

/** Admin-approved, live buyers as public investor cards. `onlyIds` narrows to given investor ids. */
export async function loadPublicInvestors(sb: any, onlyIds?: string[]): Promise<Array<PublicInvestor & { userId: string; liveSince: string | null }>> {
  let bq = sb.from("buyer_profiles").select("*").eq("status", "live").not("investor_id", "is", null);
  if (onlyIds) { if (!onlyIds.length) return []; bq = bq.in("investor_id", onlyIds); }
  const { data: buyers } = await bq.limit(500);
  const userIds = (buyers ?? []).map((b: any) => b.user_id as string);
  if (!userIds.length) return [];
  // Admin approval (status "live") is what publishes; verification only adds the badge.
  const buyerByInv = new Map<string, any>((buyers ?? []).map((b: any) => [b.investor_id, b]));
  const ids = [...buyerByInv.keys()];
  if (!ids.length) return [];

  const { data: rows } = await sb.from("investors")
    .select("id, investor_name, investor_type, country, aum, min_ticket_size, max_ticket_size, short_description, preferred_stages, preferred_industries, revenue_min_m, revenue_max_m, aum_band, ticket_band, revenue_min_band, investment_focus, acts_for_types, created_at")
    .in("id", ids).order("created_at", { ascending: false });

  // Sellers get only "verified or not" for published profiles (DB function), never the entry itself.
  const { data: vrows } = await sb.rpc("investor_is_verified", { _ids: ids });
  const verifiedIds = new Set(((vrows ?? []) as any[]).filter((v) => v.verified).map((v) => v.investor_id));
  const managed = await (await import("@/lib/managed.server")).managedInvestorIds(sb, (rows ?? []).map((r: any) => r.id));
  return (rows ?? []).map((r: any) => {
    const bp = buyerByInv.get(r.id);
    const h = hash(r.id);
    const type = r.investor_type ?? null;
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
      newDays: newCardDays(bp?.live_since ?? bp?.decided_at ?? null),
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
      verified: verifiedIds.has(r.id),
      proofOfFunds: !!bp?.pof_verified_at,
      aumBand: aum?.key ?? null,
      ticketBand: tkt?.key ?? null,
      revBand: rev?.key ?? null,
      relation: (bp?.buyer_relation ?? null) as PublicInvestor["relation"],
      actsFor,
      aumLabel: bandText(r.aum_band),
      ticketLabel: bandText(r.ticket_band),
      revLabel: bandText(r.revenue_min_band),
      managed: managed.has(r.id),
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
    const [list, cover] = await Promise.all([
      loadPublicInvestors(await admin()),
      import("./cover-urls.server").then((m) => m.investorCoverResolver()),
    ]);
    // One-step approval: Browse investors shows only verified AND approved profiles.
    // (The watchlist reuses loadPublicInvestors and keeps saved investors regardless.)
    return Promise.all(list.filter((i) => i.verified).map(async ({ userId: _u, liveSince: _l, ...i }) => ({ ...(i as PublicInvestor), coverUrl: await cover(i.type) })));
  });

export type SellerFavStatus = "approved" | "requested" | "saved";
/** Private investor fields: sent only for this seller's approved, still-valid NDA with the buyer. */
export type SellerFavPrivate = {
  investor_name: string; investor_type: string | null; acts_for_types: string[]; country: string | null; city: string | null;
  website_url: string | null; linkedin_url: string | null; email: string | null; year_founded: number | null;
  aum: string | null; min_ticket_size: string | null; max_ticket_size: string | null; revenue_min_m: number | null; revenue_max_m: number | null;
  short_description: string | null; long_description: string | null; keywords: string[]; investment_focus: string[];
  preferred_stages: string[]; preferred_industries: string[]; logo_signed_url: string | null;
  aum_band: string | null; ticket_band: string | null; revenue_min_band: string | null;
  people: { name: string; role: string; email: string; phone: string }[];
  media: { slot: number; image_signed_url: string | null }[];
  linked_startups: { id: string; startup_name: string; logo_signed_url: string | null }[];
  ndaApprovedAt: string; ndaValidUntil: string;
};
export type SellerFavourite = PublicInvestor & { status: SellerFavStatus; saved: boolean; at: string; listingCode: string | null; ndaRequestedAt: string | null; priv: SellerFavPrivate | null };

/** Seller Favourites: starred investors plus buyers with an NDA requested/approved on the seller's listings. */
export const listSellerFavourites = createServerFn({method:"GET"}).middleware([requireSupabaseAuth]).handler(async({context})=>loadSellerFavourites(context.userId));
export async function loadSellerFavourites(userId:string) {
    const { requireRole } = await import("./plan-access.server");
    await requireRole(userId, ["seller"]);
    const sb = await admin();
    const { ndaState } = await import("@/lib/favourites.functions");
    const [{ data: saves }, { data: own }, { data: su }] = await Promise.all([
      sb.from("saved_investors").select("investor_id, created_at").eq("user_id", userId),
      sb.from("startup_ownership").select("startup_id").eq("owning_agent_user_id", userId),
      sb.from("startup_users").select("startup_id").eq("user_id", userId),
    ]);
    const stIds = await (await import("@/lib/workspace-scope.server")).scopeStartupIds(userId, [...new Set([...(own ?? []), ...(su ?? [])].map((x: any) => x.startup_id as string))]);
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
    // Private fields only for approved, still-valid NDAs (ndaState already drops expired/closed ones).
    const approvedInv = list.filter((i) => pipeByUser.get(i.userId)?._st === "approved");
    const privBy = new Map<string, SellerFavPrivate>();
    if (approvedInv.length) {
      const invIds = approvedInv.map((i) => i.id);
      const [{ data: invs }, { data: bps }, { data: links }] = await Promise.all([
        sb.from("investors").select("*").in("id", invIds),
        sb.from("buyer_profiles").select("investor_id, city, description, people").in("investor_id", invIds),
        sb.from("startup_investors").select("investor_id, startups:startup_id(id, startup_name)").in("investor_id", invIds),
      ]);
      const linksBy = new Map<string, { id: string; startup_name: string; logo_signed_url: null }[]>();
      for (const l of (links ?? []) as any[]) if (l.startups) linksBy.set(l.investor_id, [...(linksBy.get(l.investor_id) ?? []), { id: l.startups.id, startup_name: l.startups.startup_name, logo_signed_url: null }]);
      const mediaOf = (r: any) => (Array.isArray(r.media) ? r.media : []).filter((m: any) => m && [1, 2, 3].includes(m.slot) && typeof m.image_path === "string" && m.image_path) as { slot: number; image_path: string }[];
      const bpBy = new Map<string, any>((bps ?? []).map((b: any) => [b.investor_id, b]));
      const paths = (invs ?? []).flatMap((r: any) => [r.logo_url, ...mediaOf(r).map((m) => m.image_path)]).filter((x: any): x is string => !!x && !/^https?:/.test(x));
      const signed: Record<string, string> = {};
      if (paths.length) {
        const { data: su } = await sb.storage.from("startup-media").createSignedUrls(paths, 3600);
        for (const d of su ?? []) if (d.path && d.signedUrl) signed[d.path] = d.signedUrl;
      }
      const TWO_YEARS = 730 * 86_400_000;
      for (const r of invs ?? []) {
        const inv = approvedInv.find((x) => x.id === r.id)!;
        const p = pipeByUser.get(inv.userId);
        const bp = bpBy.get(r.id) ?? {};
        privBy.set(r.id, {
          investor_name: r.investor_name ?? inv.codeName, investor_type: r.investor_type ?? null, acts_for_types: r.acts_for_types ?? [],
          country: r.country ?? null, city: bp.city ?? null, website_url: r.website_url ?? null, linkedin_url: r.linkedin_url ?? null,
          email: r.email ?? null, year_founded: r.year_founded ?? null, aum: r.aum ?? null,
          min_ticket_size: r.min_ticket_size ?? null, max_ticket_size: r.max_ticket_size ?? null,
          revenue_min_m: r.revenue_min_m == null ? null : Number(r.revenue_min_m), revenue_max_m: r.revenue_max_m == null ? null : Number(r.revenue_max_m),
          short_description: r.short_description ?? null, long_description: r.long_description ?? null,
          keywords: r.keywords ?? [], investment_focus: r.investment_focus ?? [], preferred_stages: r.preferred_stages ?? [], preferred_industries: r.preferred_industries ?? [],
          logo_signed_url: !r.logo_url ? null : /^https?:/.test(r.logo_url) ? r.logo_url : signed[r.logo_url] ?? null,
          aum_band: r.aum_band ?? null, ticket_band: r.ticket_band ?? null, revenue_min_band: r.revenue_min_band ?? null,
          people: Array.isArray(bp.people) ? bp.people : [],
          media: mediaOf(r).map((m) => ({ slot: m.slot, image_signed_url: /^https?:/.test(m.image_path) ? m.image_path : signed[m.image_path] ?? null })),
          linked_startups: linksBy.get(r.id) ?? [],
          ndaApprovedAt: p.nda_approved_at,
          ndaValidUntil: p.nda_expires_at ?? new Date(new Date(p.nda_approved_at).getTime() + TWO_YEARS).toISOString(),
        });
      }
    }
    const out: SellerFavourite[] = list.flatMap(({ userId, ...i }) => {
      const p = pipeByUser.get(userId);
      const status: SellerFavStatus = p?._st ?? "saved";
      if (status === "saved" && !savedAt.has(i.id)) return [];
      const at = status === "approved" ? p.nda_approved_at : status === "requested" ? p.nda_requested_at : savedAt.get(i.id)!;
      return [{ ...(i as PublicInvestor), status, saved: savedAt.has(i.id), at, listingCode: p ? refBy.get(p.hidden_profile_id) ?? null : null,
        ndaRequestedAt: p?.nda_requested_at ?? null, priv: status === "approved" ? privBy.get(i.id) ?? null : null }];
    });
    const rank = { approved: 0, requested: 1, saved: 2 } as const;
    out.sort((a, b) => rank[a.status] - rank[b.status] || (b.at ?? "").localeCompare(a.at ?? ""));
    return out;
}


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
