import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  INDUSTRY_TAGS,
  type Peer,
  type PeerSetDetail,
  type PeerSetSummary,
} from "@/lib/peer-comparables";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

type Ctx = { supabase: any; userId: string };

async function assertControl(ctx: Ctx) {
  const { data, error } = await ctx.supabase.rpc("is_control", { _user_id: ctx.userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Only Control administrators can maintain peer sets.");
}

async function ownerNames(ctx: Ctx, ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const { data } = await ctx.supabase
    .from("users")
    .select("id, first_name, last_name, email")
    .in("id", unique);
  const map = new Map<string, string>();
  for (const u of (data ?? []) as {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  }[]) {
    const name = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
    map.set(u.id, name || u.email || "—");
  }
  return map;
}

function rowToPeer(r: any): Peer {
  const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return {
    id: r.id,
    companyName: r.company_name,
    ticker: r.ticker ?? null,
    market: r.market,
    revenueThbM: n(r.revenue_thb_m),
    ebitdaMarginPct: n(r.ebitda_margin_pct),
    evEbitda: n(r.ev_ebitda),
    pe: n(r.pe),
    pbv: n(r.pbv),
  };
}

/* ------------------------------------------------------------------ */
/* List — every industry tag, whether or not a peer set exists         */
/* ------------------------------------------------------------------ */

export const listPeerSets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PeerSetSummary[]> => {
    const ctx = context as unknown as Ctx;

    const [{ data: sets, error: setErr }, { data: startups }] = await Promise.all([
      ctx.supabase.from("peer_sets").select("id, industry_tag, last_refreshed_at, owner_user_id"),
      ctx.supabase.from("startups").select("industry"),
    ]);
    if (setErr) throw new Error(setErr.message);

    const setRows = (sets ?? []) as {
      id: string;
      industry_tag: string;
      last_refreshed_at: string | null;
      owner_user_id: string | null;
    }[];

    const { data: peerRows } = await ctx.supabase.from("peers").select("peer_set_id, market");
    const counts = new Map<string, { total: number; set: number; mai: number }>();
    for (const p of (peerRows ?? []) as { peer_set_id: string; market: string }[]) {
      const c = counts.get(p.peer_set_id) ?? { total: 0, set: 0, mai: 0 };
      c.total += 1;
      if (p.market === "mai") c.mai += 1;
      else c.set += 1;
      counts.set(p.peer_set_id, c);
    }

    const names = await ownerNames(
      ctx,
      setRows.map((s) => s.owner_user_id).filter((v): v is string => !!v),
    );

    const tags = new Set<string>(INDUSTRY_TAGS);
    for (const s of (startups ?? []) as { industry: string[] | null }[]) {
      for (const t of s.industry ?? []) if (t.trim()) tags.add(t.trim());
    }
    for (const s of setRows) tags.add(s.industry_tag);

    return [...tags]
      .sort((a, b) => a.localeCompare(b))
      .map((tag) => {
        const row = setRows.find((s) => s.industry_tag === tag);
        const c = row ? counts.get(row.id) : undefined;
        return {
          industryTag: tag,
          exists: !!row,
          peerCount: c?.total ?? 0,
          setCount: c?.set ?? 0,
          maiCount: c?.mai ?? 0,
          lastRefreshedAt: row?.last_refreshed_at ?? null,
          ownerName: row?.owner_user_id ? (names.get(row.owner_user_id) ?? null) : null,
        };
      });
  });

/* ------------------------------------------------------------------ */
/* Detail                                                              */
/* ------------------------------------------------------------------ */

export const getPeerSet = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ industryTag: z.string().min(1).max(200) }).parse(input))
  .handler(async ({ context, data }): Promise<PeerSetDetail> => {
    const ctx = context as unknown as Ctx;

    const { data: row, error } = await ctx.supabase
      .from("peer_sets")
      .select("id, industry_tag, last_refreshed_at, owner_user_id")
      .eq("industry_tag", data.industryTag)
      .maybeSingle();
    if (error) throw new Error(error.message);

    if (!row) {
      return {
        exists: false,
        id: null,
        industryTag: data.industryTag,
        lastRefreshedAt: null,
        ownerName: null,
        peers: [],
      };
    }

    const [{ data: peers }, names] = await Promise.all([
      ctx.supabase
        .from("peers")
        .select("*")
        .eq("peer_set_id", row.id)
        .order("company_name"),
      ownerNames(ctx, row.owner_user_id ? [row.owner_user_id] : []),
    ]);

    return {
      exists: true,
      id: row.id,
      industryTag: row.industry_tag,
      lastRefreshedAt: row.last_refreshed_at,
      ownerName: row.owner_user_id ? (names.get(row.owner_user_id) ?? null) : null,
      peers: ((peers ?? []) as any[]).map(rowToPeer),
    };
  });

/* ------------------------------------------------------------------ */
/* Save                                                                */
/* ------------------------------------------------------------------ */

const metric = z.number().finite().nullable().optional();

export const savePeerSet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        industryTag: z.string().min(1).max(200),
        peers: z
          .array(
            z.object({
              companyName: z.string().min(1).max(200),
              ticker: z.string().max(40).nullable().optional(),
              market: z.enum(["SET", "mai"]),
              revenueThbM: metric,
              ebitdaMarginPct: metric,
              evEbitda: metric,
              pe: metric,
              pbv: metric,
            }),
          )
          .max(100),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const ctx = context as unknown as Ctx;
    await assertControl(ctx);

    const seen = new Set<string>();
    for (const p of data.peers) {
      const key = p.companyName.trim().toLowerCase();
      if (seen.has(key)) throw new Error(`"${p.companyName}" appears twice in this peer set.`);
      seen.add(key);
    }

    const { data: existing } = await ctx.supabase
      .from("peer_sets")
      .select("id")
      .eq("industry_tag", data.industryTag)
      .maybeSingle();

    let setId = existing?.id as string | undefined;
    let action: "CREATE" | "UPDATE" = "UPDATE";

    const now = new Date().toISOString();
    if (!setId) {
      action = "CREATE";
      const { data: created, error } = await ctx.supabase
        .from("peer_sets")
        .insert({
          industry_tag: data.industryTag,
          last_refreshed_at: now,
          owner_user_id: ctx.userId,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      setId = created.id as string;
    } else {
      const { error } = await ctx.supabase
        .from("peer_sets")
        .update({ last_refreshed_at: now, owner_user_id: ctx.userId, updated_at: now })
        .eq("id", setId);
      if (error) throw new Error(error.message);
    }

    const { data: before } = await ctx.supabase
      .from("peers")
      .select("company_name, market, revenue_thb_m, ebitda_margin_pct, ev_ebitda, pe, pbv")
      .eq("peer_set_id", setId);

    const { error: delErr } = await ctx.supabase.from("peers").delete().eq("peer_set_id", setId);
    if (delErr) throw new Error(delErr.message);

    if (data.peers.length > 0) {
      const { error: insErr } = await ctx.supabase.from("peers").insert(
        data.peers.map((p) => ({
          peer_set_id: setId,
          company_name: p.companyName.trim(),
          ticker: p.ticker?.trim() || null,
          market: p.market,
          revenue_thb_m: p.revenueThbM ?? null,
          ebitda_margin_pct: p.ebitdaMarginPct ?? null,
          ev_ebitda: p.evEbitda ?? null,
          pe: p.pe ?? null,
          pbv: p.pbv ?? null,
        })),
      );
      if (insErr) throw new Error(insErr.message);
    }

    await ctx.supabase.from("audit_logs").insert({
      tenant_id: null,
      entity_type: "peer_set",
      entity_id: setId,
      action,
      old_value: { industry_tag: data.industryTag, peers: before ?? [] } as never,
      new_value: { industry_tag: data.industryTag, peers: data.peers } as never,
    });

    return { ok: true, lastRefreshedAt: now };
  });

/* ------------------------------------------------------------------ */
/* Delete                                                              */
/* ------------------------------------------------------------------ */

export const deletePeerSet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ industryTag: z.string().min(1).max(200) }).parse(input))
  .handler(async ({ context, data }) => {
    const ctx = context as unknown as Ctx;
    await assertControl(ctx);

    const { data: row } = await ctx.supabase
      .from("peer_sets")
      .select("id")
      .eq("industry_tag", data.industryTag)
      .maybeSingle();
    if (!row) return { ok: true };

    const { data: before } = await ctx.supabase
      .from("peers")
      .select("company_name, market")
      .eq("peer_set_id", row.id);

    const { error } = await ctx.supabase.from("peer_sets").delete().eq("id", row.id);
    if (error) throw new Error(error.message);

    await ctx.supabase.from("audit_logs").insert({
      tenant_id: null,
      entity_type: "peer_set",
      entity_id: row.id,
      action: "DELETE",
      old_value: { industry_tag: data.industryTag, peers: before ?? [] } as never,
      new_value: null,
    });

    return { ok: true };
  });
