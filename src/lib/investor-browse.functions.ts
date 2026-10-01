import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseRange, rangeLabel, type PublicInvestor } from "@/lib/investor-browse";

/**
 * Seller › Browse investors. Returns the PUBLIC investor record only:
 * code name, type, location, ranges, sectors and the revenue minimum.
 * Real names, websites, people, exact AUM/ticket, portfolio and the
 * non-anonymous description never leave the server here.
 */

const BIRDS = ["Heron", "Kestrel", "Falcon", "Osprey", "Egret", "Ibis", "Crane", "Hornbill", "Kingfisher", "Sparrow",
  "Swift", "Plover", "Magpie", "Merlin", "Harrier", "Pelican", "Lark", "Wren", "Starling", "Tern", "Myna", "Bulbul"];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export const listBrowseInvestors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    // Like Buyer › Browse listings: only Admin-verified buyers whose profile is Live.
    // Directory/CRM investors without a verified, live buyer account never reach sellers.
    const { data: buyers } = await sb.from("buyer_profiles").select("*")
      .eq("status", "live").not("investor_id", "is", null).limit(500);
    const userIds = (buyers ?? []).map((b: any) => b.user_id as string);
    if (!userIds.length) return [] as PublicInvestor[];
    const { data: bvs } = await sb.from("buyer_verifications")
      .select("user_id, company_name, buyer_type, status").in("user_id", userIds).eq("status", "verified");
    const bvByUser = new Map<string, any>((bvs ?? []).map((b: any) => [b.user_id, b]));
    const buyerByInv = new Map<string, any>(
      (buyers ?? []).filter((b: any) => bvByUser.has(b.user_id)).map((b: any) => [b.investor_id, b]),
    );
    const ids = [...buyerByInv.keys()];
    if (!ids.length) return [] as PublicInvestor[];

    const { data: rows } = await sb.from("investors")
      .select("id, investor_name, investor_type, country, aum, min_ticket_size, max_ticket_size, short_description, preferred_stages, preferred_industries, revenue_min_m, revenue_max_m, created_at")
      .in("id", ids).order("created_at", { ascending: false });

    return (rows ?? []).map((r: any): PublicInvestor => {
      const bp = buyerByInv.get(r.id);
      const bv = bp ? bvByUser.get(bp.user_id) : null;
      const h = hash(r.id);
      const codeName = bp?.code_name || `Investor ${BIRDS[h % BIRDS.length]}`;
      const type = r.investor_type ?? bv?.buyer_type ?? null;
      const aum = parseRange(r.aum);
      const tMin = parseRange(r.min_ticket_size);
      const tMax = parseRange(r.max_ticket_size);
      const ticketLo = tMin?.lo ?? null;
      const ticketHi = tMax ? tMax.hi : tMin ? tMin.hi : null;
      // Directory text may carry the real name; mask it.
      let description: string | null = bp ? bp.description ?? null : r.short_description ?? null;
      if (description && r.investor_name) {
        const esc = String(r.investor_name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        description = description.replace(new RegExp(esc, "gi"), codeName);
      }
      return {
        id: r.id,
        refNo: bp?.ref_no || `INV-${String(h % 10000).padStart(4, "0")}`,
        codeName,
        name: bp?.show_name ? bv?.company_name || r.investor_name : null,
        type,
        city: bp?.city ?? null,
        country: r.country ?? bp?.country ?? null,
        description,
        sectors: (r.preferred_industries ?? bp?.sectors ?? []) as string[],
        stages: (r.preferred_stages ?? bp?.stages ?? []) as string[],
        dealTypes: (bp?.deal_types ?? []) as string[],
        geography: bp?.geography ?? null,
        verified: bv?.status === "approved",
        proofOfFunds: !!bp?.pof_verified_at,
        aumLo: aum?.lo ?? null,
        aumHi: aum?.hi ?? null,
        aumLabel: aum ? rangeLabel(aum.lo, aum.hi) : null,
        ticketLo,
        ticketHi: ticketLo == null && ticketHi == null ? null : ticketHi,
        ticketLabel: ticketLo == null && !tMax ? null : rangeLabel(ticketLo ?? 0, ticketHi),
        revenueMinM: r.revenue_min_m == null ? null : Number(r.revenue_min_m),
        revenueMaxM: r.revenue_max_m == null ? null : Number(r.revenue_max_m),
      };
    });
  });
