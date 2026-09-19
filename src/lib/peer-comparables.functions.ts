import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  peerSetLabel,
  type Peer,
  type PeerMatchResult,
  type PeerSetDetail,
  type PeerSetSummary,
} from "@/lib/peer-comparables";
import { businessModelLabel } from "@/lib/sectors";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

type Ctx = { supabase: any; userId: string };

async function assertControl(ctx: Ctx) {
  const { data, error } = await ctx.supabase.rpc("is_control", { _user_id: ctx.userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Only Control administrators can maintain peer sets.");
}

/** peer_sets.industry_tag predates sector keying; it stays as a stable unique key. */
function legacyKey(sector: string, businessModel: string | null) {
  return `${sector}::${businessModel ?? "all"}`;
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

/** A member row carries no figures of its own — they come from the master table. */
function companyToPeer(r: any): Peer {
  const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return {
    id: r.id,
    listedCompanyId: r.id,
    companyName: r.name,
    ticker: r.ticker ?? null,
    market: r.market,
    revenueThbM: n(r.revenue_thb_m),
    ebitdaMarginPct: n(r.ebitda_margin_pct),
    evEbitda: n(r.ev_ebitda),
    pe: n(r.pe),
    pbv: n(r.pbv),
  };
}

const keyInput = z.object({
  sector: z.string().min(1).max(200),
  businessModel: z.string().min(1).max(60).nullable().optional(),
});

/* ------------------------------------------------------------------ */
/* List — every peer set that exists, keyed on sector + model          */
/* ------------------------------------------------------------------ */

export const listPeerSets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PeerSetSummary[]> => {
    const ctx = context as unknown as Ctx;

    const { data: sets, error } = await ctx.supabase
      .from("peer_sets")
      .select("id, sector, business_model, last_refreshed_at, owner_user_id")
      .not("sector", "is", null);
    if (error) throw new Error(error.message);

    const setRows = (sets ?? []) as {
      id: string;
      sector: string;
      business_model: string | null;
      last_refreshed_at: string | null;
      owner_user_id: string | null;
    }[];

    const { data: memberRows } = await ctx.supabase
      .from("peer_set_members")
      .select("peer_set_id, listed_companies(market)");
    const counts = new Map<string, { total: number; set: number; mai: number }>();
    for (const p of (memberRows ?? []) as {
      peer_set_id: string;
      listed_companies: { market: string } | null;
    }[]) {
      const c = counts.get(p.peer_set_id) ?? { total: 0, set: 0, mai: 0 };
      c.total += 1;
      if (p.listed_companies?.market === "mai") c.mai += 1;
      else c.set += 1;
      counts.set(p.peer_set_id, c);
    }

    const names = await ownerNames(
      ctx,
      setRows.map((s) => s.owner_user_id).filter((v): v is string => !!v),
    );

    return setRows
      .map((row) => {
        const c = counts.get(row.id);
        return {
          sector: row.sector,
          businessModel: row.business_model,
          exists: true,
          peerCount: c?.total ?? 0,
          setCount: c?.set ?? 0,
          maiCount: c?.mai ?? 0,
          lastRefreshedAt: row.last_refreshed_at,
          ownerName: row.owner_user_id ? (names.get(row.owner_user_id) ?? null) : null,
        };
      })
      .sort(
        (a, b) =>
          a.sector.localeCompare(b.sector) ||
          (a.businessModel ?? "").localeCompare(b.businessModel ?? ""),
      );
  });

/* ------------------------------------------------------------------ */
/* Detail                                                              */
/* ------------------------------------------------------------------ */

async function findSet(ctx: Ctx, sector: string, businessModel: string | null) {
  let q = ctx.supabase
    .from("peer_sets")
    .select("id, sector, business_model, last_refreshed_at, owner_user_id")
    .eq("sector", sector);
  q = businessModel ? q.eq("business_model", businessModel) : q.is("business_model", null);
  const { data, error } = await q.maybeSingle();
  if (error) throw new Error(error.message);
  return data as {
    id: string;
    sector: string;
    business_model: string | null;
    last_refreshed_at: string | null;
    owner_user_id: string | null;
  } | null;
}

export const getPeerSet = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => keyInput.parse(input))
  .handler(async ({ context, data }): Promise<PeerSetDetail> => {
    const ctx = context as unknown as Ctx;
    const model = data.businessModel ?? null;
    const row = await findSet(ctx, data.sector, model);

    if (!row) {
      return {
        exists: false,
        id: null,
        sector: data.sector,
        businessModel: model,
        lastRefreshedAt: null,
        ownerName: null,
        peers: [],
      };
    }

    const [{ data: members }, names] = await Promise.all([
      ctx.supabase
        .from("peer_set_members")
        .select("listed_companies(*)")
        .eq("peer_set_id", row.id),
      ownerNames(ctx, row.owner_user_id ? [row.owner_user_id] : []),
    ]);

    const peers = ((members ?? []) as any[])
      .map((m) => m.listed_companies)
      .filter(Boolean)
      .map(companyToPeer)
      .sort((a, b) => a.companyName.localeCompare(b.companyName));

    return {
      exists: true,
      id: row.id,
      sector: row.sector,
      businessModel: row.business_model,
      lastRefreshedAt: row.last_refreshed_at,
      ownerName: row.owner_user_id ? (names.get(row.owner_user_id) ?? null) : null,
      peers,
    };
  });

/* ------------------------------------------------------------------ */
/* Save                                                                */
/* ------------------------------------------------------------------ */

export const savePeerSet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    keyInput
      .extend({
        listedCompanyIds: z.array(z.string().uuid()).max(100),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const ctx = context as unknown as Ctx;
    await assertControl(ctx);
    const model = data.businessModel ?? null;

    const seen = new Set<string>();
    for (const id of data.listedCompanyIds) {
      if (seen.has(id)) throw new Error("A company cannot appear twice in the same peer set.");
      seen.add(id);
    }
    const ids = [...seen];

    const existing = await findSet(ctx, data.sector, model);
    let setId = existing?.id;
    let action: "CREATE" | "UPDATE" = "UPDATE";

    const now = new Date().toISOString();
    if (!setId) {
      action = "CREATE";
      const { data: created, error } = await ctx.supabase
        .from("peer_sets")
        .insert({
          industry_tag: legacyKey(data.sector, model),
          sector: data.sector,
          business_model: model,
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
      .from("peer_set_members")
      .select("listed_companies(ticker, name)")
      .eq("peer_set_id", setId);

    const { error: delErr } = await ctx.supabase
      .from("peer_set_members")
      .delete()
      .eq("peer_set_id", setId);
    if (delErr) throw new Error(delErr.message);

    if (ids.length > 0) {
      const { error: insErr } = await ctx.supabase
        .from("peer_set_members")
        .insert(ids.map((id) => ({ peer_set_id: setId, listed_company_id: id })));
      if (insErr) throw new Error(insErr.message);
    }

    await ctx.supabase.from("audit_logs").insert({
      tenant_id: null,
      entity_type: "peer_set",
      entity_id: setId,
      action,
      old_value: { key: peerSetLabel(data.sector, model), peers: before ?? [] } as never,
      new_value: { key: peerSetLabel(data.sector, model), peers: ids } as never,
    });

    return { ok: true, lastRefreshedAt: now };
  });

/* ------------------------------------------------------------------ */
/* Delete                                                              */
/* ------------------------------------------------------------------ */

export const deletePeerSet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => keyInput.parse(input))
  .handler(async ({ context, data }) => {
    const ctx = context as unknown as Ctx;
    await assertControl(ctx);
    const model = data.businessModel ?? null;

    const row = await findSet(ctx, data.sector, model);
    if (!row) return { ok: true };

    const { data: before } = await ctx.supabase
      .from("peer_set_members")
      .select("listed_companies(ticker, name)")
      .eq("peer_set_id", row.id);

    const { error } = await ctx.supabase.from("peer_sets").delete().eq("id", row.id);
    if (error) throw new Error(error.message);

    await ctx.supabase.from("audit_logs").insert({
      tenant_id: null,
      entity_type: "peer_set",
      entity_id: row.id,
      action: "DELETE",
      old_value: { key: peerSetLabel(data.sector, model), peers: before ?? [] } as never,
      new_value: null,
    });

    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Valuation matching — Sector and Business model ONLY                 */
/* ------------------------------------------------------------------ */

export const getPeerMatch = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ startupId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<PeerMatchResult> => {
    const ctx = context as unknown as Ctx;

    const { data: startup, error } = await ctx.supabase
      .from("startups")
      .select("sector, business_model")
      .eq("id", data.startupId)
      .maybeSingle();
    if (error) throw new Error(error.message);

    const sector: string | null = startup?.sector ?? null;
    const businessModel: string | null = startup?.business_model ?? null;

    if (!sector) {
      return { state: "no-sector", sector: null, businessModel, applied: null, narrower: null };
    }

    const { data: sets } = await ctx.supabase
      .from("peer_sets")
      .select("id, sector, business_model, last_refreshed_at")
      .eq("sector", sector);

    const rows = (sets ?? []) as {
      id: string;
      sector: string;
      business_model: string | null;
      last_refreshed_at: string | null;
    }[];

    const counts = new Map<string, number>();
    if (rows.length > 0) {
      const { data: peerRows } = await ctx.supabase
        .from("peer_set_members")
        .select("peer_set_id")
        .in(
          "peer_set_id",
          rows.map((r) => r.id),
        );
      for (const p of (peerRows ?? []) as { peer_set_id: string }[]) {
        counts.set(p.peer_set_id, (counts.get(p.peer_set_id) ?? 0) + 1);
      }
    }

    const exact = businessModel
      ? rows.find((r) => r.business_model === businessModel)
      : undefined;
    const wide = rows.find((r) => r.business_model === null);

    if (exact) {
      return {
        state: "exact",
        sector,
        businessModel,
        applied: {
          sector,
          businessModel,
          peerCount: counts.get(exact.id) ?? 0,
          lastRefreshedAt: exact.last_refreshed_at,
        },
        narrower: null,
      };
    }

    if (wide) {
      // Only suggest a business model when a narrower set really exists.
      const candidates = rows.filter((r) => r.business_model !== null);
      const best = candidates.sort(
        (a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0),
      )[0];
      const narrower =
        !businessModel && best
          ? {
              businessModel: best.business_model as string,
              label: peerSetLabel(sector, best.business_model),
              peerCount: counts.get(best.id) ?? 0,
            }
          : null;
      return {
        state: "sector-only",
        sector,
        businessModel,
        applied: {
          sector,
          businessModel: null,
          peerCount: counts.get(wide.id) ?? 0,
          lastRefreshedAt: wide.last_refreshed_at,
        },
        narrower,
      };
    }

    return {
      state: "no-peer-set",
      sector,
      businessModel: businessModel
        ? (businessModelLabel(businessModel) ?? businessModel)
        : null,
      applied: null,
      narrower: null,
    };
  });
