import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  isStartupEntry,
  missingForPublish,
  pickDraft,
  runIdentityCheck,
  suggestCodeName,
  suggestRegion,
  moneyRange,
  staffRange,
  decadeOf,
  type EntryFacts,
  type HiddenDraft,
  type HiddenProfileRow,
} from "@/lib/hidden-profile";

const COLS =
  "id, startup_id, tenant_id, ref_no, status, published_at, unpublished_at, code_name, cover_art, region, headline, description, highlights, customers_summary, asking_price, stake_pct, deal_type, structure, reason, handover, process, open_to, nda_approver, live, has_unpublished_changes, views, ndas_approved, updated_at";

type Sb = SupabaseClient<Database>;

/** Every hidden profile the caller can read (drives chips, filters and hidden cards). */
export const listHiddenProfiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("hidden_profiles").select(COLS);
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as HiddenProfileRow[];
  });

async function loadFacts(sb: Sb, startupId: string): Promise<EntryFacts & { tenant_id: string }> {
  const { data: s, error } = await sb
    .from("startups")
    .select("tenant_id, startup_name, registered_name, website_url, city, headquarters, region, year_founded, company_size, last_year_revenue, company_type")
    .eq("id", startupId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!s) throw new Error("Entry not found");
  const { data: f } = await sb.from("startup_founders").select("full_name").eq("startup_id", startupId);
  return {
    ...s,
    people: ((f ?? []) as { full_name: string | null }[]).map((x) => x.full_name ?? "").filter(Boolean),
    customers: [],
  };
}

export const getHiddenProfileFacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ startupId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => loadFacts(context.supabase, data.startupId));

export const createHiddenProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ startupId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: existing } = await sb.from("hidden_profiles").select(COLS).eq("startup_id", data.startupId).maybeSingle();
    if (existing) return existing as unknown as HiddenProfileRow;
    const facts = await loadFacts(sb, data.startupId);
    if (isStartupEntry(facts.company_type)) throw new Error("Startups can't be listed in the Marketplace yet");
    for (let i = 0; i < 6; i++) {
      const { data: row, error } = await sb
        .from("hidden_profiles")
        .insert({
          startup_id: data.startupId,
          tenant_id: facts.tenant_id,
          code_name: suggestCodeName(),
          region: suggestRegion(facts),
          deal_type: "Full acquisition",
          stake_pct: 100,
          open_to: ["Private equity", "Family office", "Corporate"],
          nda_approver: "admin",
          created_by: context.userId,
          updated_by: context.userId,
        })
        .select(COLS)
        .single();
      if (!error) return row as unknown as HiddenProfileRow;
      if (/startup_id/.test(error.message)) {
        const { data: again } = await sb.from("hidden_profiles").select(COLS).eq("startup_id", data.startupId).maybeSingle();
        if (again) return again as unknown as HiddenProfileRow;
      }
      if (!/code_name/.test(error.message)) throw new Error(error.message);
    }
    throw new Error("Couldn't find a free code name — try again");
  });

const DraftSchema = z.object({
  code_name: z.string().trim().min(1).max(80),
  cover_art: z.string().nullable(),
  region: z.string().nullable(),
  headline: z.string().max(120),
  description: z.string().max(420),
  highlights: z.array(z.string().max(200)).max(4),
  customers_summary: z.string().max(400),
  asking_price: z.number().positive().nullable(),
  stake_pct: z.number().min(0).max(100).nullable(),
  deal_type: z.string().nullable(),
  structure: z.string().max(400).nullable(),
  reason: z.string().max(400).nullable(),
  handover: z.string().max(400).nullable(),
  process: z.string().max(400).nullable(),
  open_to: z.array(z.string()).max(5),
  nda_approver: z.enum(["seller", "admin"]),
});

function draftError(msg: string) {
  if (/hidden_profiles_code_name_uq/.test(msg)) return new Error("That code name is already used in the Marketplace");
  return new Error(msg);
}

export const saveHiddenProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ startupId: z.string().uuid(), draft: DraftSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: cur, error: e1 } = await sb.from("hidden_profiles").select("status").eq("startup_id", data.startupId).maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!cur) throw new Error("No hidden profile");
    const { data: row, error } = await sb
      .from("hidden_profiles")
      .update({
        ...data.draft,
        highlights: data.draft.highlights,
        has_unpublished_changes: cur.status === "live",
        updated_by: context.userId,
      })
      .eq("startup_id", data.startupId)
      .select(COLS)
      .single();
    if (error) throw draftError(error.message);
    return row as unknown as HiddenProfileRow;
  });

export const publishHiddenProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ startupId: z.string().uuid(), draft: DraftSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const facts = await loadFacts(sb, data.startupId);
    const draft = pickDraft(data.draft as HiddenDraft);
    const findings = runIdentityCheck(draft, facts);
    if (findings.length) throw new Error(`Identity check failed: ${findings.length} detail(s) could name the company`);
    const missing = missingForPublish(draft);
    if (missing.length) throw new Error(`Missing: ${missing.join(", ")}`);
    const { data: cur } = await sb.from("hidden_profiles").select("status, published_at").eq("startup_id", data.startupId).maybeSingle();
    const firstPublish = !cur || cur.status !== "live";
    const now = new Date().toISOString();
    const cleaned = { ...draft, highlights: draft.highlights.filter((h) => h.trim()) };
    const { data: row, error } = await sb
      .from("hidden_profiles")
      .update({
        ...cleaned,
        status: "live",
        live: cleaned as never,
        has_unpublished_changes: false,
        published_at: firstPublish ? now : cur?.published_at ?? now,
        published_by: context.userId,
        updated_by: context.userId,
      })
      .eq("startup_id", data.startupId)
      .select(COLS)
      .single();
    if (error) throw draftError(error.message);
    return row as unknown as HiddenProfileRow;
  });

export const unpublishHiddenProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ startupId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("hidden_profiles")
      .update({ status: "draft", live: null, has_unpublished_changes: false, unpublished_at: new Date().toISOString(), updated_by: context.userId })
      .eq("startup_id", data.startupId)
      .select(COLS)
      .single();
    if (error) throw new Error(error.message);
    return row as unknown as HiddenProfileRow;
  });

export const discardHiddenChanges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ startupId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: cur, error: e1 } = await sb.from("hidden_profiles").select("live").eq("startup_id", data.startupId).maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!cur?.live) throw new Error("Nothing published to go back to");
    const { data: row, error } = await sb
      .from("hidden_profiles")
      .update({ ...pickDraft(cur.live as unknown as HiddenDraft), has_unpublished_changes: false, updated_by: context.userId })
      .eq("startup_id", data.startupId)
      .select(COLS)
      .single();
    if (error) throw new Error(error.message);
    return row as unknown as HiddenProfileRow;
  });

/**
 * Buyer read model: ONLY the published copy plus computed ranges. No
 * full-profile-only fields, exact figures or draft text leave the server.
 */
export const listMarketplaceTeasers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("hidden_profiles")
      .select("id, ref_no, published_at, live, startups!inner(industry, sector, company_size, last_year_revenue, year_founded)")
      .eq("status", "live");
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => {
      const live = (r.live ?? {}) as unknown as HiddenDraft;
      const st = (Array.isArray(r.startups) ? r.startups[0] : r.startups) as {
        industry: string[] | null; sector: string | null; company_size: string | null; last_year_revenue: string | null; year_founded: number | null;
      };
      const industry = st?.sector || st?.industry?.[0] || "SME";
      return {
        id: r.id,
        ref: r.ref_no,
        codeName: live.code_name,
        region: live.region ?? "",
        headline: live.headline,
        coverArt: live.cover_art,
        industry,
        dealType: live.deal_type,
        revenueRange: moneyRange(st?.last_year_revenue),
        staffRange: staffRange(st?.company_size),
        founded: decadeOf(st?.year_founded),
        askingPrice: live.asking_price,
        stakePct: live.stake_pct,
        publishedAt: r.published_at,
      };
    });
  });
