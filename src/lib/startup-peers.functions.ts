/**
 * Per-startup chosen peer companies.
 *
 * A selection belongs to one startup. It never creates, changes or appears
 * among the admin's shared peer sets — figures are read from Listed Companies,
 * exactly as a peer set does, so an import refreshes them.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Peer } from "@/lib/peer-comparables";

type Ctx = { supabase: any; userId: string };

export type PeerBasis = "sector" | "chosen";

export interface PeerCandidate extends Peer {
  sector: string | null;
}

export interface StartupPeerSelection {
  basis: PeerBasis;
  peers: Peer[];
  chosenByName: string | null;
  chosenAt: string | null;
}

const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));

function toPeer(r: any): PeerCandidate {
  return {
    id: r.id,
    listedCompanyId: r.id,
    companyName: r.name,
    ticker: r.ticker ?? null,
    market: r.market,
    sector: r.sector ?? null,
    revenueThbM: n(r.revenue_thb_m),
    ebitdaMarginPct: n(r.ebitda_margin_pct),
    evEbitda: n(r.ev_ebitda),
    pe: n(r.pe),
    pbv: n(r.pbv),
    grossMarginPct: n(r.gross_margin_pct),
    netMarginPct: n(r.net_margin_pct),
    roePct: n(r.roe_pct),
    debtEquity: n(r.debt_equity),
    revenueGrowthPct: n(r.revenue_growth_pct),
    statementPeriod: r.statement_period ?? null,
  };
}

async function userName(ctx: Ctx, id: string | null): Promise<string | null> {
  if (!id) return null;
  const { data } = await ctx.supabase
    .from("users")
    .select("first_name, last_name, email")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const name = [data.first_name, data.last_name].filter(Boolean).join(" ").trim();
  return name || data.email || null;
}

/** Every listed company, for the picker. Not limited to one sector. */
export const listPeerCandidates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PeerCandidate[]> => {
    const ctx = context as unknown as Ctx;
    const { data, error } = await ctx.supabase.from("listed_companies").select("*").order("ticker");
    if (error) throw new Error(error.message);
    return ((data ?? []) as any[]).map(toPeer);
  });

/** The startup's basis and its chosen companies, with provenance. */
export const getStartupPeers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ startupId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<StartupPeerSelection> => {
    const ctx = context as unknown as Ctx;
    const [startup, sel] = await Promise.all([
      ctx.supabase.from("startups").select("peer_basis").eq("id", data.startupId).maybeSingle(),
      ctx.supabase
        .from("startup_peer_selections")
        .select("chosen_by, chosen_at, listed_companies(*)")
        .eq("startup_id", data.startupId),
    ]);
    if (sel.error) throw new Error(sel.error.message);

    const rows = (sel.data ?? []) as any[];
    const peers = rows
      .map((r) => r.listed_companies)
      .filter(Boolean)
      .map(toPeer)
      .sort((a, b) => (b.revenueThbM ?? 0) - (a.revenueThbM ?? 0));

    const first = rows[0] ?? null;
    return {
      basis: ((startup.data?.peer_basis as PeerBasis | undefined) ?? "sector") as PeerBasis,
      peers,
      chosenByName: await userName(ctx, first?.chosen_by ?? null),
      chosenAt: first?.chosen_at ?? null,
    };
  });

/** Replace the selection. Switching basis alone leaves the selection intact. */
export const saveStartupPeers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        startupId: z.string().uuid(),
        listedCompanyIds: z.array(z.string().uuid()).min(3).max(60),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const ctx = context as unknown as Ctx;
    const del = await ctx.supabase
      .from("startup_peer_selections")
      .delete()
      .eq("startup_id", data.startupId);
    if (del.error) throw new Error(del.error.message);

    const now = new Date().toISOString();
    const ins = await ctx.supabase.from("startup_peer_selections").insert(
      data.listedCompanyIds.map((id) => ({
        startup_id: data.startupId,
        listed_company_id: id,
        chosen_by: ctx.userId,
        chosen_at: now,
      })),
    );
    if (ins.error) throw new Error(ins.error.message);

    const upd = await ctx.supabase
      .from("startups")
      .update({ peer_basis: "chosen" })
      .eq("id", data.startupId);
    if (upd.error) throw new Error(upd.error.message);
    return { ok: true, count: data.listedCompanyIds.length };
  });

/** Sector or chosen. The selection is kept either way. */
export const setStartupPeerBasis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ startupId: z.string().uuid(), basis: z.enum(["sector", "chosen"]) })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const ctx = context as unknown as Ctx;
    const { error } = await ctx.supabase
      .from("startups")
      .update({ peer_basis: data.basis })
      .eq("id", data.startupId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
