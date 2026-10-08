import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PublicInvestor } from "@/lib/investor-browse";
import type { PublicListing } from "@/lib/public-listing";

/**
 * Advisor view (Marketplace › I'm Advisor). Returns only public records:
 * listings exactly as buyers get them in Browse listings, investor profiles
 * exactly as sellers get them in Browse investors. Requires users.advisor_view.
 */

export type AdvisorTeaser = { id: string; listing: PublicListing; dealType?: string | null; askingPrice?: number | null; stakePct?: number | null };
export type AdvisorInvestor = PublicInvestor & { liveSince: string | null };
export type AdvisorFav = { kind: "listing" | "investor"; id: string; at: string };

async function requireAdvisor(_sb: any, userId: string) {
  const { requireRole } = await import("@/lib/plan-access.server");
  await requireRole(userId, ["advisor"]);
}

export const listAdvisorMarketplace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdvisor(context.supabase, context.userId);
    const { loadMarketplaceTeasers } = await import("@/lib/hidden-profiles.functions");
    const { loadPublicInvestors } = await import("@/lib/investor-browse.functions");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [teasers, invs] = await Promise.all([
      loadMarketplaceTeasers({ excludeNda: false }, context.userId, true),
      loadPublicInvestors(supabaseAdmin),
    ]);
    return {
      listings: (teasers as any[]).filter((t) => !t.closed) as unknown as AdvisorTeaser[],
      investors: invs.map(({ userId: _u, ...i }) => i) as AdvisorInvestor[],
    };
  });

export const listAdvisorFavourites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any)
      .from("advisor_favourites").select("item_kind, item_id, created_at")
      .eq("user_id", context.userId).eq("view", "advisor").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({ kind: r.item_kind, id: r.item_id, at: r.created_at })) as AdvisorFav[];
  });

export const toggleAdvisorFavourite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ kind: z.enum(["listing", "investor"]), id: z.string().uuid(), saved: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await requireAdvisor(sb, context.userId);
    if (data.saved) {
      const { error } = await sb.from("advisor_favourites").upsert(
        { user_id: context.userId, item_kind: data.kind, item_id: data.id, view: "advisor" },
        { onConflict: "user_id,item_kind,item_id", ignoreDuplicates: true },
      );
      if (error) throw new Error(error.message);
    } else {
      const { error } = await sb.from("advisor_favourites").delete()
        .eq("user_id", context.userId).eq("item_kind", data.kind).eq("item_id", data.id);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
