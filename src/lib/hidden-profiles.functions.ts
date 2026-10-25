import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { cardAllowsExact } from "@/lib/standard-card";
import {
  BUYER_VISIBLE,
  isBuyerVisible,
  missingForPublish,
  pickDraft,
  runIdentityCheck,
  suggestCodeName,
  handoverLine,
  suggestRegion,
  type EntryFacts,
  type HiddenDraft,
  type HiddenProfileRow,
} from "@/lib/hidden-profile";

const COLS =
  "id, startup_id, tenant_id, ref_no, status, published_at, unpublished_at, code_name, cover_art, region, headline, description, highlights, customers_summary, asking_price, asking_price_thb, asking_price_band, stake_pct, deal_type, structure, reason, handover, process, open_to, nda_approver, owner_stays, handover_months, live, has_unpublished_changes, views, ndas_approved, updated_at, product_tags, market_tags, cover_image_url, approval_status, version, pending_cover, new_until, featured, directory_category, submitted_at, decided_at, decision_note, decision_reasons, decision_fields";

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
    ...s, startup_name: s.startup_name ?? "",
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
    // Save the suggested headline so the listing can be submitted without a manual save.
    let headline = "";
    try {
      const { suggestHeadline } = await import("@/lib/public-listing");
      const { data: src } = await sb
        .from("startups")
        .select("startup_name, registered_name, website_url, email, city, headquarters, company_type, year_founded, company_size, last_year_revenue, sector, business_model, industry, product_tags, market_tags, long_description, short_description, regulatory_licenses, iso_standards")
        .eq("id", data.startupId)
        .maybeSingle();
      if (src) headline = suggestHeadline(src as any).slice(0, 120);
    } catch {
      headline = "";
    }
    for (let i = 0; i < 6; i++) {
      const { data: row, error } = await sb
        .from("hidden_profiles")
        .insert({
          startup_id: data.startupId,
          tenant_id: facts.tenant_id,
          region: suggestRegion(facts),
          headline,
          deal_type: null,
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
  code_name: z.string().trim().max(80).nullable().optional().transform((v) => v || null),
  cover_art: z.string().nullable(),
  region: z.string().nullable(),
  headline: z.string().max(120),
  description: z.string().max(420),
  highlights: z.array(z.string().max(200)).max(4),
  customers_summary: z.string().max(400),
  asking_price: z.number().positive().nullable(),
  asking_price_thb: z.number().int().positive().max(1e13).nullable().optional(),
  stake_pct: z.number().min(0).max(100).nullable(),
  deal_type: z.string().nullable(),
  structure: z.string().max(400).nullable(),
  reason: z.string().max(400).nullable(),
  handover: z.string().max(400).nullable(),
  process: z.string().max(400).nullable(),
  open_to: z.array(z.string()).max(5),
  nda_approver: z.enum(["seller", "admin"]),
  owner_stays: z.enum(["yes", "no"]).nullable().optional(),
  handover_months: z.union([z.literal(1), z.literal(3), z.literal(6), z.literal(9), z.literal(12), z.literal(18), z.literal(24)]).nullable().optional(),
  product_tags: z.array(z.string().max(60)).max(20).nullable().optional(),
  market_tags: z.array(z.string().max(60)).max(20).nullable().optional(),
  cover_image_url: z.string().max(500).nullable().optional(),
});

function draftError(msg: string) {
  if (/hidden_profiles_code_name_uq/.test(msg)) return new Error("NAME_TAKEN: That listing name is already used by another listing");
  return new Error(msg);
}

export const saveHiddenProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ startupId: z.string().uuid(), draft: DraftSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: cur, error: e1 } = await sb.from("hidden_profiles").select("*").eq("startup_id", data.startupId).maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!cur) throw new Error("No hidden profile");
    // Public image is Admin-only (set via setPublicImage); never written from the draft.
    const { cover_image_url: _c, ...draftNoCover0 } = data.draft;
    void _c;
    const { data: isAdmin } = await (sb as any).rpc("is_control", { _user_id: context.userId });
    // Only Admin sets or changes a listing name.
    const { code_name: _n, ...noName } = draftNoCover0;
    const draftNoCover = isAdmin ? draftNoCover0 : noName;
    const adminReview = !!isAdmin && ["in_review", "changes_requested"].includes((cur as any).approval_status);
    if (adminReview) {
      const { recordAdminEdits } = await import("@/lib/approvals.functions");
      await recordAdminEdits(cur, draftNoCover as Record<string, unknown>, context.userId);
    }
    const approvalPatch = !adminReview && (cur as { approval_status?: string }).approval_status === "live" ? { approval_status: "live_edits_pending" } : {};
    const { data: row, error } = await sb
      .from("hidden_profiles")
      .update({
        ...draftNoCover,
        highlights: data.draft.highlights,
        has_unpublished_changes: isBuyerVisible(cur as { approval_status?: string | null }),
        ...approvalPatch,
        updated_by: context.userId,
      })
      .eq("startup_id", data.startupId)
      .select(COLS)
      .single();
    if (error) throw draftError(error.message);
    return row as unknown as HiddenProfileRow;
  });

/**
 * Save-only. Only Admin approval (decideListing) can make a listing live, so
 * this never touches status, approval_status or the published snapshot.
 */
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
    const { data: cur } = await sb.from("hidden_profiles").select("approval_status").eq("startup_id", data.startupId).maybeSingle();
    const wasLive = isBuyerVisible(cur as { approval_status?: string | null } | null);
    const { data: isAdm } = await (sb as any).rpc("is_control", { _user_id: context.userId });
    const cleaned: Record<string, unknown> = { ...draft, highlights: draft.highlights.filter((h) => h.trim()) };
    if (!isAdm) delete cleaned.code_name;
    const { data: row, error } = await sb
      .from("hidden_profiles")
      .update({
        ...cleaned,
        has_unpublished_changes: wasLive,
        ...(wasLive ? { approval_status: "live_edits_pending" } : {}),
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
      .update({ approval_status: "unpublished", status: "draft", live: null, has_unpublished_changes: false, unpublished_at: new Date().toISOString(), updated_by: context.userId })
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
  .inputValidator((d?: { excludeNda?: boolean }) => ({ excludeNda: !!d?.excludeNda }))
  .handler(async ({ data: input, context }) => loadMarketplaceTeasers(input, context.userId));

/** A listing above the caller's plan cap: only its id and the plan needed leave the server. */
export type ClosedTeaser = { id: string; closed: true; needPlan: string; sector: string | null; region: string | null; refNo: string | null; priceBand: string; capM: number };

/** Live listings as buyer teasers (public listing only). Shared by Browse listings and Advisor Browse. */
export async function loadMarketplaceTeasers(input: { excludeNda: boolean }, userId: string, roleChecked = false) {
    const { roleOf, planAccess, valueCap } = await import("@/lib/plan-access.server");
    const role = await roleOf(userId);
    // Sellers only ever see their own listings here; buyers, advisors and admins see the marketplace.
    if (!roleChecked && role !== "buyer" && role !== "admin" && role !== "seller") throw new Error("This page isn't available for your account");
    const cap = role === "seller" ? null : valueCap(await planAccess(userId));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { buildPublicListing } = await import("@/lib/public-listing");
    const { data, error } = await supabaseAdmin
      .from("hidden_profiles")
      .select("id, startup_id, ref_no, published_at, live, approval_status, public_image_id, startups!inner(startup_name, registered_name, website_url, email, city, headquarters, company_type, year_founded, company_size, last_year_revenue, sector, business_model, industry, product_tags, market_tags, long_description, short_description, regulatory_licenses, iso_standards, registration_verified_at)")
      // Approval is the only source of truth, and only the approved snapshot is served.
      .in("approval_status", [...BUYER_VISIBLE, "in_review"])
      .not("live", "is", null);
    if (error) throw new Error(error.message);
    const ids = (data ?? []).map((r) => r.startup_id);
    const { data: fin } = ids.length
      ? await supabaseAdmin.from("financial_statements").select("startup_id").in("startup_id", ids)
      : { data: [] as { startup_id: string }[] };
    const withFin = new Set((fin ?? []).map((f) => f.startup_id));
    // Private fields are used here only to strip names; only the public listing leaves the server.
    // Buyer Browse: listings with an active NDA live in Favourites instead.
    let rowsIn = data ?? [];
    if (role === "seller") {
      const [{ data: su }, { data: own }] = await Promise.all([
        supabaseAdmin.from("startup_users").select("startup_id").eq("user_id", userId),
        supabaseAdmin.from("startup_ownership").select("startup_id").eq("owning_agent_user_id", userId),
      ]);
      const mine = new Set([...(su ?? []), ...(own ?? [])].map((x: { startup_id: string }) => x.startup_id));
      rowsIn = rowsIn.filter((r) => mine.has(r.startup_id));
    }
    if (input.excludeNda) {
      const { activeNdaIds } = await import("@/lib/favourites.functions");
      const nda = await activeNdaIds(userId);
      rowsIn = rowsIn.filter((r) => !nda.has(r.id));
    }
    const nda = role === "buyer" || cap !== null ? await (await import("@/lib/favourites.functions")).activeNdaIds(userId) : new Set<string>();
    const { ndaState } = await import("@/lib/favourites.functions");
    const { data: viewerNdas } = role === "buyer" ? await supabaseAdmin.from("deal_pipelines").select("hidden_profile_id, status, nda_approved_at, nda_expires_at").eq("buyer_user_id", userId) : { data: [] };
    const approvedNdaIds = new Set((viewerNdas ?? []).filter((p) => ndaState(p) === "approved").map((p) => p.hidden_profile_id));
    const invited = role === "buyer" ? await (await import("@/lib/invitations.server")).invitedListingIds(userId) : new Set<string>();
    const { thbOf, priceFor, bandOf } = await import("@/lib/asking-price");
    const cover = await (await import("@/lib/cover-urls.server")).sectorCoverResolver();
    const managed = await (await import("@/lib/managed.server")).managedStartupIds(supabaseAdmin, rowsIn.map((r) => r.startup_id));
    return Promise.all(rowsIn.map(async (r) => {
      const live = (r.live ?? {}) as unknown as HiddenDraft;
      // Above the plan's price cap (and no NDA yet): the card stays closed and no details are sent.
      const thb = thbOf(live as never);
      if (cap !== null && thb != null && thb / 1_000_000 > cap && !nda.has(r.id) && !invited.has(r.id)) {
        // Only four safe fields: sector, region, ref and the price band. No picture.
        const o = open(r, live);
        const priceBand = `Asking ${bandOf(thb)?.label ?? ""}`.trim();
        return { id: r.id, closed: true as const, needPlan: cap < 200 ? "Investor" : "Institutional", sector: o.listing.sector, region: o.listing.location || null, refNo: o.listing.refNo || null, priceBand, capM: cap } as unknown as ReturnType<typeof open>;
      }
      const o = open(r, live);
      o.listing.coverUrl = await cover(o.listing.sector, o.listing.publicImageId);
      return o;
    }));
    function open(r: (typeof rowsIn)[number], live: HiddenDraft) {
      const st = (Array.isArray(r.startups) ? r.startups[0] : r.startups) as never;
      const listing = buildPublicListing(st, { ...live, ref_no: r.ref_no, public_image_id: (r as { public_image_id?: string | null }).public_image_id ?? null, live: true, published_at: r.published_at }, withFin.has(r.startup_id));
      (listing as { certified?: boolean }).certified = !!(st as { registration_verified_at?: string | null }).registration_verified_at;
      listing.managed = managed.has(r.startup_id);
      // Exact amount only for Admin or an approved NDA; everyone else (sellers' own previews too) gets the range.
      const price = priceFor(live as never, cardAllowsExact(role, approvedNdaIds.has(r.id)));
      return { id: r.id, listing, dealType: live.deal_type, ...price, handover: handoverLine(live.owner_stays, live.handover_months) };
    }
}

/** Is a listing name free? Trimmed, case-insensitive, against every other listing in any status. */
export const checkListingName = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ name: z.string().max(80), startupId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const name = data.name.trim();
    if (!name) return { available: false };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.from("hidden_profiles").select("startup_id, code_name").ilike("code_name", name.replace(/[\\%_]/g, (c) => `\\${c}`));
    if (error) throw new Error(error.message);
    const taken = (rows ?? []).some((r) => r.startup_id !== data.startupId && (r.code_name ?? "").trim().toLowerCase() === name.toLowerCase());
    return { available: !taken };
  });
