import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SECTOR_AGNOSTIC } from "@/lib/investor-bands";

/**
 * One match rule for both sides of Browse: an investor's mandate fits a business when
 * its sectors include the business's sector (or it is Sector Agnostic) and, when both
 * sides name a deal type, the deal type is one the investor does.
 * Returns id → the criteria that matched ("sector", "deal type").
 */
type Mandate = { sectors: string[]; dealTypes: string[] };
type Biz = { sectors: string[]; dealType: string | null };

function fits(m: Mandate, b: Biz): string[] | null {
  const low = (x: string) => x.trim().toLowerCase();
  const ms = m.sectors.map(low);
  const sectorOk = ms.includes(low(SECTOR_AGNOSTIC)) || b.sectors.some((s) => ms.includes(low(s)));
  if (!sectorOk || !b.sectors.length && !ms.includes(low(SECTOR_AGNOSTIC))) return null;
  const crit = ["sector"];
  if (b.dealType && m.dealTypes.length) {
    if (!m.dealTypes.map(low).includes(low(b.dealType))) return null;
    crit.push("deal type");
  }
  return crit;
}

const bizSectors = (s: { sector?: string | null; industry?: string | null } | null) =>
  [s?.sector, s?.industry].filter((x): x is string => !!x && !!x.trim());

export const myBrowseMatches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const uid = context.userId;
    const out: Record<string, string[]> = {};

    // Buyer: listings that fit my mandate.
    const { data: me } = await sb.from("buyer_profiles").select("sectors, deal_types").eq("user_id", uid).maybeSingle();
    if (me) {
      const m: Mandate = { sectors: me.sectors ?? [], dealTypes: me.deal_types ?? [] };
      if (!m.sectors.length) return { role: "buyer" as const, matches: out };
      const { data: rows } = await sb.from("hidden_profiles").select("id, live, startups!inner(sector, industry)").eq("approval_status", "approved").not("live", "is", null);
      for (const r of rows ?? []) {
        const c = fits(m, { sectors: bizSectors(r.startups), dealType: r.live?.deal_type ?? null });
        if (c) out[r.id] = c;
      }
      return { role: "buyer" as const, matches: out };
    }

    // Seller: investors whose mandate fits my business.
    const { data: su } = await sb.from("startup_users").select("startup_id").eq("user_id", uid).limit(1);
    const sid = su?.[0]?.startup_id;
    if (!sid) return { role: "seller" as const, matches: out };
    const [{ data: st }, { data: hp }] = await Promise.all([
      sb.from("startups").select("sector, industry").eq("id", sid).maybeSingle(),
      sb.from("hidden_profiles").select("deal_type, live").eq("startup_id", sid).maybeSingle(),
    ]);
    const biz: Biz = { sectors: bizSectors(st), dealType: hp?.live?.deal_type ?? hp?.deal_type ?? null };
    const { data: bps } = await sb.from("buyer_profiles").select("investor_id, sectors, deal_types").eq("status", "live").not("investor_id", "is", null);
    for (const b of bps ?? []) {
      const c = fits({ sectors: b.sectors ?? [], dealTypes: b.deal_types ?? [] }, biz);
      if (c) out[b.investor_id] = c;
    }
    return { role: "seller" as const, matches: out };
  });

export const myDismissedHints = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as any).from("users").select("dismissed_hints").eq("id", context.userId).maybeSingle();
    return (data?.dismissed_hints ?? []) as string[];
  });

export const setDismissedHint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { hint: string | null }) => ({ hint: typeof d?.hint === "string" && /^[a-z_]{2,40}$/.test(d.hint) ? d.hint : null }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    if (!data.hint) { await sb.from("users").update({ dismissed_hints: [] }).eq("id", context.userId); return { ok: true }; }
    const { data: cur } = await sb.from("users").select("dismissed_hints").eq("id", context.userId).maybeSingle();
    const next = Array.from(new Set([...(cur?.dismissed_hints ?? []), data.hint]));
    await sb.from("users").update({ dismissed_hints: next }).eq("id", context.userId);
    return { ok: true };
  });
