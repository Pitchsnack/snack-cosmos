import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ListedCompany } from "@/lib/listed-companies";
import { peerSetLabel } from "@/lib/peer-comparables";

type Ctx = { supabase: any; userId: string };

async function assertControl(ctx: Ctx) {
  const { data, error } = await ctx.supabase.rpc("is_control", { _user_id: ctx.userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Only Control administrators can maintain listed companies.");
}

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

const metric = z.number().finite().nullable().optional();

const companyInput = z.object({
  id: z.string().uuid().nullable().optional(),
  ticker: z.string().min(1).max(40),
  name: z.string().min(1).max(200),
  market: z.enum(["SET", "mai"]),
  exchangeGroup: z.string().max(120).nullable().optional(),
  sector: z.string().max(200).nullable().optional(),

  revenueThbM: metric,
  ebitdaMarginPct: metric,
  evEbitda: metric,
  pe: metric,
  pbv: metric,
  grossMarginPct: metric,
  netMarginPct: metric,
  roePct: metric,
  debtEquity: metric,
  revenueGrowthPct: metric,
  statementPeriod: z.string().max(40).nullable().optional(),
  tag: z.string().max(120).nullable().optional(),
  asAt: z.string().max(20).nullable().optional(),
});

function toRow(c: z.infer<typeof companyInput>) {
  return {
    ticker: c.ticker.trim(),
    name: c.name.trim(),
    market: c.market,
    exchange_group: c.exchangeGroup?.trim() || null,
    sector: c.sector?.trim() || null,

    revenue_thb_m: c.revenueThbM ?? null,
    ebitda_margin_pct: c.ebitdaMarginPct ?? null,
    ev_ebitda: c.evEbitda ?? null,
    pe: c.pe ?? null,
    pbv: c.pbv ?? null,
    gross_margin_pct: c.grossMarginPct ?? null,
    net_margin_pct: c.netMarginPct ?? null,
    roe_pct: c.roePct ?? null,
    debt_equity: c.debtEquity ?? null,
    revenue_growth_pct: c.revenueGrowthPct ?? null,
    statement_period: c.statementPeriod?.trim() || null,
    tag: c.tag?.trim() || null,
    as_at: c.asAt?.trim() || null,
    updated_at: new Date().toISOString(),
  };
}


/* ------------------------------------------------------------------ */
/* List — the master table, with peer-set usage                        */
/* ------------------------------------------------------------------ */

export const listListedCompanies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ListedCompany[]> => {
    const ctx = context as unknown as Ctx;

    const [{ data: companies, error }, { data: members }, { data: sets }] = await Promise.all([
      ctx.supabase.from("listed_companies").select("*").order("ticker"),
      ctx.supabase.from("peer_set_members").select("peer_set_id, listed_company_id"),
      ctx.supabase.from("peer_sets").select("id, sector, business_model"),
    ]);
    if (error) throw new Error(error.message);

    const setLabels = new Map<string, string>();
    for (const s of (sets ?? []) as {
      id: string;
      sector: string | null;
      business_model: string | null;
    }[]) {
      setLabels.set(s.id, s.sector ? peerSetLabel(s.sector, s.business_model) : "Untitled set");
    }

    const usage = new Map<string, string[]>();
    for (const m of (members ?? []) as {
      peer_set_id: string;
      listed_company_id: string;
    }[]) {
      const list = usage.get(m.listed_company_id) ?? [];
      list.push(setLabels.get(m.peer_set_id) ?? "Untitled set");
      usage.set(m.listed_company_id, list);
    }

    return ((companies ?? []) as any[]).map((r) => ({
      id: r.id,
      ticker: r.ticker,
      name: r.name,
      market: r.market,
      exchangeGroup: r.exchange_group ?? null,
      sector: r.sector ?? null,

      revenueThbM: num(r.revenue_thb_m),
      ebitdaMarginPct: num(r.ebitda_margin_pct),
      evEbitda: num(r.ev_ebitda),
      pe: num(r.pe),
      pbv: num(r.pbv),
      grossMarginPct: num(r.gross_margin_pct),
      netMarginPct: num(r.net_margin_pct),
      roePct: num(r.roe_pct),
      debtEquity: num(r.debt_equity),
      revenueGrowthPct: num(r.revenue_growth_pct),
      statementPeriod: r.statement_period ?? null,
      tag: r.tag ?? null,
      asAt: r.as_at ?? null,

      usedIn: usage.get(r.id)?.length ?? 0,
      usedInSets: usage.get(r.id) ?? [],
    }));
  });

/* ------------------------------------------------------------------ */
/* Save one                                                            */
/* ------------------------------------------------------------------ */

export const saveListedCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => companyInput.parse(input))
  .handler(async ({ context, data }): Promise<{ id: string }> => {
    const ctx = context as unknown as Ctx;
    await assertControl(ctx);

    const ticker = data.ticker.trim();
    const { data: clash } = await ctx.supabase
      .from("listed_companies")
      .select("id, ticker")
      .ilike("ticker", ticker)
      .maybeSingle();
    if (clash && clash.id !== data.id) {
      throw new Error(`Ticker "${ticker}" is already on the listed companies table.`);
    }

    if (data.id) {
      const { data: before } = await ctx.supabase
        .from("listed_companies")
        .select("*")
        .eq("id", data.id)
        .maybeSingle();

      const next = toRow(data);
      const { error } = await ctx.supabase
        .from("listed_companies")
        .update(next)
        .eq("id", data.id);
      if (error) throw new Error(error.message);

      // Audit: only the fields that actually changed, old and new.
      if (before) {
        const oldValue: Record<string, unknown> = {};
        const newValue: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(next)) {
          if (k === "updated_at") continue;
          const prev = (before as Record<string, unknown>)[k] ?? null;
          const now = v ?? null;
          if (String(prev) !== String(now)) {
            oldValue[k] = prev;
            newValue[k] = now;
          }
        }
        if (Object.keys(newValue).length > 0) {
          await ctx.supabase.from("audit_logs").insert({
            tenant_id: null,
            entity_type: "listed_company",
            entity_id: data.id,
            action: "UPDATE",
            old_value: { ticker: before.ticker, ...oldValue } as never,
            new_value: { ticker: next.ticker, ...newValue } as never,
          });
        }
      }

      return { id: data.id };
    }

    const { data: created, error } = await ctx.supabase
      .from("listed_companies")
      .insert(toRow(data))
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id as string };
  });

/* ------------------------------------------------------------------ */
/* Import many (CSV) — matched on ticker, existing rows updated        */
/* ------------------------------------------------------------------ */

export const importListedCompanies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ rows: z.array(companyInput).max(1000) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const ctx = context as unknown as Ctx;
    await assertControl(ctx);

    const { data: existing } = await ctx.supabase
      .from("listed_companies")
      .select("id, ticker");
    const byTicker = new Map<string, string>();
    for (const r of (existing ?? []) as { id: string; ticker: string }[]) {
      byTicker.set(r.ticker.trim().toUpperCase(), r.id);
    }

    let created = 0;
    let updated = 0;
    const ids: string[] = [];
    const seen = new Set<string>();

    for (const row of data.rows) {
      const key = row.ticker.trim().toUpperCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const id = byTicker.get(key);
      if (id) {
        const { error } = await ctx.supabase
          .from("listed_companies")
          .update(toRow(row))
          .eq("id", id);
        if (error) throw new Error(error.message);
        updated += 1;
        ids.push(id);
      } else {
        const { data: ins, error } = await ctx.supabase
          .from("listed_companies")
          .insert(toRow(row))
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        created += 1;
        ids.push(ins.id as string);
        byTicker.set(key, ins.id as string);
      }
    }

    // The baseline sets always reflect the latest SET listings.
    const { generateBaselineSets } = await import("@/lib/baseline-sets.server");
    const baseline = await generateBaselineSets(ctx.supabase, ctx.userId);

    return { created, updated, ids, baseline };
  });

/* ------------------------------------------------------------------ */
/* Delete                                                              */
/* ------------------------------------------------------------------ */

export const deleteListedCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const ctx = context as unknown as Ctx;
    await assertControl(ctx);

    const { data: before } = await ctx.supabase
      .from("listed_companies")
      .select("ticker, name")
      .eq("id", data.id)
      .maybeSingle();

    const { error } = await ctx.supabase.from("listed_companies").delete().eq("id", data.id);
    if (error) throw new Error(error.message);

    await ctx.supabase.from("audit_logs").insert({
      tenant_id: null,
      entity_type: "listed_company",
      entity_id: data.id,
      action: "DELETE",
      old_value: (before ?? null) as never,
      new_value: null,
    });

    return { ok: true };
  });
