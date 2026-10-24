import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  AUM_KEYS, REV_KEYS, TICKET_KEYS, bandOf, descriptionError, sortActsFor, descriptionLeaks, regError, ticketColumns, yearError,
} from "@/lib/investor-bands";

/**
 * Buyer › My Company firm record. The buyer's firm IS the investor row in
 * Investors Directory (buyer_profiles.investor_id). Buyers are not tenant
 * members, so every read/write goes through the service client here, always
 * scoped to the caller's own linked investor row. Tenant, status, visibility
 * and ownership are never writable by the buyer.
 */

const BUCKET = "startup-media";
const TTL = 3600;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

const num = (s: string | null | undefined) => {
  if (!s) return null;
  const m = String(s).replace(/,/g, "").match(/([\d.]+)\s*([kmb])?/i);
  if (!m) return null;
  const mult = { k: 1e3, m: 1e6, b: 1e9 }[(m[2] ?? "").toLowerCase() as "k"] ?? 1;
  const n = Number(m[1]) * mult;
  return Number.isFinite(n) ? n : null;
};

export async function ensureLinked(userId: string) {
  const sb = await admin();
  let { data: p } = await sb.from("buyer_profiles").select("*").eq("user_id", userId).maybeSingle();
  if (!p) {
    const { data: made, error } = await sb.from("buyer_profiles").insert({ user_id: userId, code_name: "" }).select("*").single();
    if (error) throw new Error(error.message);
    p = made;
  }
  if (p.investor_id) return { sb, p, investorId: p.investor_id as string };

  const [{ data: bv }, { data: tenant }] = await Promise.all([
    (await import("./profile-verification.server")).verificationByUser(sb, userId, "company_name, buyer_type, website, linkedin, work_email").then((data: any) => ({ data })),
    sb.from("tenants").select("id").eq("tenant_code", "control").maybeSingle(),
  ]);
  const { data: me } = await sb.from("users").select("email").eq("id", userId).maybeSingle();
  if (!tenant) throw new Error("Control workspace not found.");
  const { data: inv, error } = await sb.from("investors").insert({
    tenant_id: tenant.id,
    investor_name: bv?.company_name || p.legal_name || p.code_name,
    legal_name: p.legal_name, firm_name: p.legal_name,
    investor_type: bv?.buyer_type ?? null, website_url: bv?.website ?? null, linkedin_url: bv?.linkedin ?? null,
    email: bv?.work_email || me?.email || null, country: p.country, business_address: p.address,
    aum: p.aum_exact, min_ticket_size: p.ticket_min?.toString() ?? null, max_ticket_size: p.ticket_max?.toString() ?? null,
    short_description: p.private_description || p.description, logo_url: null,
    preferred_stages: p.stages ?? [], preferred_industries: p.sectors ?? [],
    created_by: userId, updated_by: userId,
  }).select("id").single();
  if (error) throw new Error(error.message);
  await sb.from("buyer_profiles").update({ investor_id: inv.id }).eq("user_id", userId);
  return { sb, p: { ...p, investor_id: inv.id }, investorId: inv.id as string };
}

type Resolved = { sb: any; p: any; investorId: string; extra: boolean; bpUser?: string };

/**
 * The investor profile to work on: the caller's own linked one (no id, or its id),
 * Admin's extra investor profiles made with + Add Investor Profile, or — Admin only,
 * with the same check the Edit Investor page relies on (can_manage_investor on the
 * record's workspace) — any Directory investor. Admin is decided here from the
 * account's stored role, never from anything the browser sends.
 * Anyone else's profile throws "This profile isn't yours.".
 */
export async function resolveBuyer(userId: string, investorId?: string | null): Promise<Resolved> {
  if (!investorId) return { ...(await ensureLinked(userId)), extra: false };
  const sb = await admin();
  const { data: bp } = await sb.from("buyer_profiles").select("*").eq("user_id", userId).maybeSingle();
  if (bp?.investor_id === investorId) return { sb, p: bp, investorId, extra: false };
  const { roleOf } = await import("./plan-access.server");
  const [{ data: inv }, { data: linked }, role] = await Promise.all([
    sb.from("investors").select("id, created_by, wizard, tenant_id").eq("id", investorId).maybeSingle(),
    sb.from("buyer_profiles").select("*").eq("investor_id", investorId).maybeSingle(),
    roleOf(userId),
  ]);
  if (!inv || role !== "admin") throw new Error("This profile isn't yours.");
  const w = ((inv.wizard as any)?.bp ?? {}) as Record<string, unknown>;
  if (!linked && inv.created_by === userId && (inv.wizard as any)?.admin_profile) return { sb, p: { status: "draft", ...w }, investorId, extra: true };
  const { data: canManage } = await sb.rpc("can_manage_investor", { _user_id: userId, _tenant_id: inv.tenant_id });
  if (!canManage) throw new Error("This profile isn't yours.");
  if (linked) return { sb, p: linked, investorId, extra: false, bpUser: linked.user_id as string };
  return { sb, p: { status: "draft", ...w }, investorId, extra: true };
}

/** Buyer-side fields: the account's buyer profile, or (Admin's extra profiles) kept on the investor record. */
async function writeBp(r: Resolved, userId: string, bp: Record<string, unknown>) {
  if (!r.extra) return r.sb.from("buyer_profiles").update(bp).eq("user_id", r.bpUser ?? userId);
  const { data: cur } = await r.sb.from("investors").select("wizard").eq("id", r.investorId).single();
  const w = (cur?.wizard ?? {}) as Record<string, any>;
  return r.sb.from("investors").update({ wizard: { ...w, bp: { ...(w.bp ?? {}), ...bp } } }).eq("id", r.investorId);
}

async function loadBuyerData(context: { userId: string }, r: Resolved) {
    const { sb, p, investorId } = r;
    const [{ data: inv }, { data: bv }, { data: links }, { data: up }, { data: au }] = await Promise.all([
      sb.from("investors").select("*").eq("id", investorId).single(),
      (await import("./profile-verification.server")).verificationByInvestor(sb, investorId, "status, decision_note, submitted_at").then((data: any) => ({ data })),
      sb.from("startup_investors").select("startups(id, startup_name)").eq("investor_id", investorId),
      sb.from("user_profiles").select("title").eq("user_id", r.bpUser ?? context.userId).maybeSingle(),
      sb.auth.admin.getUserById(r.bpUser ?? context.userId),
    ]);
    const meta = (au?.user?.user_metadata ?? {}) as Record<string, string>;
    const media = (Array.isArray(inv.media) ? inv.media : []) as { slot: number; image_path: string }[];
    const paths = [inv.logo_url, ...media.map((m) => m.image_path)].filter((x): x is string => !!x && !/^https?:/.test(x));
    const signed: Record<string, string> = {};
    if (paths.length) {
      const { data } = await sb.storage.from(BUCKET).createSignedUrls(paths, TTL);
      for (const d of data ?? []) if (d.path && d.signedUrl) signed[d.path] = d.signedUrl;
    }
    const sign = (x: string | null) => (!x ? null : /^https?:/.test(x) ? x : signed[x] ?? null);
    const dirStartups = (links ?? []).map((l: any) => l.startups?.startup_name).filter(Boolean) as string[];
    const extra = (Array.isArray(p.portfolio) ? p.portfolio : []).map((h: any) => h.name).filter(Boolean) as string[];
    return {
      investor: {
        id: inv.id as string,
        investor_name: inv.investor_name as string,
        legal_name: inv.legal_name as string | null,
        firm_name: inv.firm_name as string | null,
        investor_type: inv.investor_type as string | null,
        acts_for_types: (inv.acts_for_types ?? []) as string[],
        year_founded: inv.year_founded as number | null,
        company_size_band: (inv.company_size_band ?? null) as string | null,
        country: inv.country as string | null,
        city: p.city as string | null,
        email: inv.email as string | null,
        website_url: inv.website_url as string | null,
        linkedin_url: inv.linkedin_url as string | null,
        business_address: inv.business_address as string | null,
        address_line1: (inv.address_line1 ?? null) as string | null,
        address_line2: (inv.address_line2 ?? null) as string | null,
        address_city_district: (inv.address_city_district ?? null) as string | null,
        address_province_state: (inv.address_province_state ?? null) as string | null,
        postal_code: (inv.postal_code ?? null) as string | null,
        aum: inv.aum as string | null,
        min_ticket_size: inv.min_ticket_size as string | null,
        max_ticket_size: inv.max_ticket_size as string | null,
        revenue_min_m: inv.revenue_min_m == null ? null : Number(inv.revenue_min_m),
        revenue_max_m: inv.revenue_max_m == null ? null : Number(inv.revenue_max_m),
        short_description: inv.short_description as string | null,
        keywords: (inv.keywords ?? []) as string[],
        investment_focus: (inv.investment_focus ?? []) as string[],
        preferred_stages: (inv.preferred_stages ?? []) as string[],
        preferred_industries: (inv.preferred_industries ?? []) as string[],
        logo_path: inv.logo_url as string | null,
        logo_signed_url: sign(inv.logo_url),
        media: media.map((m) => ({ slot: m.slot, image_path: m.image_path, url: sign(m.image_path) })),
        portfolio: Array.from(new Set([...dirStartups, ...extra])),
        portfolio_extra: extra,
        portfolio_links: [
          ...(links ?? []).map((l: any) => l.startups).filter(Boolean).map((x: any) => ({ id: x.id as string, name: x.startup_name as string })),
          ...extra.map((n) => ({ id: `extra:${n}`, name: n })),
        ],
        updated_at: inv.updated_at as string,
        aum_band: inv.aum_band as string | null,
        ticket_band: inv.ticket_band as string | null,
        revenue_min_band: inv.revenue_min_band as string | null,
        aum_exact_usd: inv.aum_exact_usd == null ? null : Number(inv.aum_exact_usd),
        registration_no: inv.registration_no as string | null,
        company_type: (inv.company_type ?? null) as string | null,
        company_type_source: (inv.company_type_source ?? "account") as string,
        setup_done_at: inv.setup_done_at as string | null,
        wizard: (inv.wizard ?? {}) as { answered?: string[]; pe_ticked?: boolean; from_signup?: string[] },
        investment_focus_raw: (inv.investment_focus ?? []) as string[],
        sector_picks: (inv.sector_picks ?? null) as { types: string[]; kinds: Record<string, string[]>; other: string[] } | null,
      },
      buyer: {
        relation: (p.buyer_relation ?? null) as "individual" | "corporate" | "agent" | null,
        status: p.status as string,
        description: (p.description ?? "") as string,
        deal_types: (p.deal_types ?? []) as string[],
        ref_no: p.ref_no as string,
      },
      account: { name: (meta.full_name || meta.name || "") as string, title: (up?.title ?? "") as string },
      people: (p.people ?? []) as { name: string; role: string; email: string; phone: string }[],
      verification: {
        status: (bv?.status === "unverified" || !bv?.status ? "none" : bv.status) as "none" | "pending" | "verified" | "more_info" | "declined",
        note: bv?.decision_note as string | null,
      },
      extra: r.extra,
    };
}

export const getMyBuyerInvestor = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => loadBuyerData(context, { ...(await ensureLinked(context.userId)), extra: false }));

/** The buyer wizard and Buyer › My Company: one investor profile by id, owner checked here. */
export const getBuyerInvestorById = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    try { return { ok: true as const, data: await loadBuyerData(context, await resolveBuyer(context.userId, data.id)) }; }
    catch (e) { if ((e as Error).message === "This profile isn't yours.") return { ok: false as const, data: null }; throw e; }
  });

/** Ids of the investor profiles this account holds: its own, plus Admin's extra ones (newest first). */
export const listMyInvestorProfileIds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = await admin();
    const { roleOf } = await import("./plan-access.server");
    const [{ data: bp }, role] = await Promise.all([sb.from("buyer_profiles").select("investor_id").eq("user_id", context.userId).maybeSingle(), roleOf(context.userId)]);
    const ids: string[] = [];
    if (role === "admin") {
      const { data } = await sb.from("investors").select("id").eq("created_by", context.userId).eq("wizard->>admin_profile", "true").order("created_at", { ascending: false });
      for (const x of data ?? []) ids.push(x.id);
    }
    if (bp?.investor_id) ids.push(bp.investor_id);
    return { ids, admin: role === "admin" };
  });

/**
 * + Add Investor Profile: a new Draft investor profile made at once (setup not done).
 * Admin: no limit, each one owned by Admin. Buyer accounts: only while they have none.
 */
export const addInvestorProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = await admin();
    const { roleOf, ONE_COMPANY_MSG } = await import("./plan-access.server");
    const role = await roleOf(context.userId);
    const { data: bp } = await sb.from("buyer_profiles").select("investor_id").eq("user_id", context.userId).maybeSingle();
    if (role !== "admin") {
      if (bp?.investor_id) throw new Error(ONE_COMPANY_MSG);
      const r = await ensureLinked(context.userId);
      return { id: r.investorId };
    }
    // Admin's first buyer-side profile is its own linked one; later ones are extra profiles.
    if (!bp?.investor_id) { const r = await ensureLinked(context.userId); return { id: r.investorId }; }
    const [{ data: tenant }, { data: ref }, { data: me }] = await Promise.all([
      sb.from("tenants").select("id").eq("tenant_code", "control").maybeSingle(),
      sb.rpc("next_inv_ref"),
      sb.from("users").select("email").eq("id", context.userId).maybeSingle(),
    ]);
    if (!tenant) throw new Error("Control workspace not found.");
    const { data: inv, error } = await sb.from("investors").insert({
      tenant_id: tenant.id, investor_name: "", email: me?.email ?? null, logo_url: null, media: [],
      wizard: { admin_profile: true, answered: [], bp: { ref_no: ref, status: "draft" } },
      created_by: context.userId, updated_by: context.userId,
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: inv.id as string };
  });

const txt = (n: number) => z.string().trim().max(n).nullable().optional();
const arr = (max: number) => z.array(z.string().trim().min(1).max(80)).max(max).optional();
const Patch = z.object({
  investor_name: z.string().trim().min(1).max(200),
  investor_type: txt(80), year_founded: z.number().int().min(1800).max(2100).nullable().optional(),
  company_size_band: z.enum(["1-10", "11-50", "51-200", "201-500", "500+"]).nullable().optional(),
  country: txt(120), city: txt(120), email: txt(255), website_url: txt(500), linkedin_url: txt(500),
  firm_name: txt(200), business_address: txt(1000), aum: txt(120), min_ticket_size: txt(60), max_ticket_size: txt(60),
  short_description: txt(4000), keywords: arr(5), investment_focus: arr(10), preferred_stages: arr(12), preferred_industries: arr(40),
  portfolio_extra: arr(50), logo_path: txt(1000),
  revenue_min_m: z.number().min(0).max(100000).nullable().optional(),
  revenue_max_m: z.number().min(0).max(100000).nullable().optional(),
  media: z.array(z.object({ slot: z.union([z.literal(1), z.literal(2), z.literal(3)]), image_path: z.string().min(1).max(1000) })).max(3).optional(),
  people: z.array(z.object({ name: z.string().max(120), role: z.string().max(120).default(""), email: z.string().max(200).default(""), phone: z.string().max(60).default("") })).max(20).optional(),
  aum_band: z.enum(AUM_KEYS).nullable().optional(),
  ticket_band: z.enum(TICKET_KEYS).nullable().optional(),
  revenue_min_band: z.enum(REV_KEYS).nullable().optional(),
  aum_exact_usd: z.number().min(0).max(1e13).nullable().optional(),
  registration_no: txt(50),
  address_line1: txt(120), address_line2: txt(120), address_city_district: txt(80), address_province_state: txt(80), postal_code: txt(12),
  description: z.string().trim().max(140).optional(),
  deal_types: arr(12),
  acts_for_types: arr(7),
});

async function relationOf(sb: any, userId: string) {
  const { data } = await sb.from("buyer_profiles").select("buyer_relation").eq("user_id", userId).maybeSingle();
  return (data?.buyer_relation ?? null) as string | null;
}

export const saveMyBuyerInvestor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Patch.extend({ investor_id: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const r = await resolveBuyer(context.userId, data.investor_id);
    const { sb, investorId } = r;
    const relation = r.extra ? ((r.p.buyer_relation ?? null) as string | null) : await relationOf(sb, r.bpUser ?? context.userId);
    // Same checks as Review & complete (section 5); the buyer can't save past them.
    const problem =
      (relation !== "individual" && yearError(data.year_founded?.toString() ?? "")) ||
      (!/^(https?:\/\/)?[\w-]+(\.[\w-]+)+/i.test(data.website_url ?? "") && "Enter a valid website address, e.g. www.yourfirm.com") ||
      (data.description && (descriptionError(data.description) ||
        (descriptionLeaks(data.description, data.investor_name, data.website_url ?? "").length ? "Your description mentions names, websites or contact details." : null))) ||
      (relation !== "individual" && regError(data.registration_no ?? "", data.country ?? ""));
    if (problem) throw new Error(problem);
    const own = (x?: string | null) => !x || /^https?:/.test(x) || x.includes(`/${investorId}/`);
    if (!own(data.logo_path) || (data.media ?? []).some((m) => !own(m.image_path))) throw new Error("Invalid file.");
    const n = (v?: string | null) => (v === undefined ? undefined : v || null);
    const inv: Record<string, unknown> = {
      investor_name: data.investor_name, investor_type: n(data.investor_type), year_founded: data.year_founded ?? null,
      ...(data.company_size_band !== undefined ? { company_size_band: data.company_size_band } : {}),
      country: n(data.country), email: n(data.email), website_url: n(data.website_url), linkedin_url: n(data.linkedin_url),
      firm_name: n(data.firm_name), business_address: n(data.business_address), aum: n(data.aum),
      min_ticket_size: n(data.min_ticket_size), max_ticket_size: n(data.max_ticket_size), short_description: n(data.short_description),
      updated_by: context.userId, updated_at: new Date().toISOString(),
    };
    for (const k of ["address_line1", "address_line2", "address_city_district", "address_province_state", "postal_code"] as const) if (data[k] !== undefined) inv[k] = data[k] || null;
    if (data.revenue_min_m !== undefined) inv.revenue_min_m = data.revenue_min_m;
    if (data.revenue_max_m !== undefined) inv.revenue_max_m = data.revenue_max_m;
    if (data.keywords) inv.keywords = data.keywords;
    if (data.investment_focus) inv.investment_focus = data.investment_focus;
    if (data.preferred_stages) inv.preferred_stages = data.preferred_stages;
    if (data.preferred_industries) inv.preferred_industries = data.preferred_industries;
    if (data.logo_path !== undefined) inv.logo_url = data.logo_path || null;
    if (data.media) inv.media = data.media;
    if (data.aum_band !== undefined) { inv.aum_band = data.aum_band; inv.aum = bandOf(data.aum_band)?.label ?? null; }
    if (data.ticket_band !== undefined) {
      inv.ticket_band = data.ticket_band;
      const t = ticketColumns(data.ticket_band);
      inv.min_ticket_size = t.min; inv.max_ticket_size = t.max;
    }
    if (data.revenue_min_band !== undefined) inv.revenue_min_band = data.revenue_min_band;
    if (data.aum_exact_usd !== undefined) inv.aum_exact_usd = data.aum_exact_usd;
    if (data.registration_no !== undefined) inv.registration_no = relation === "individual" ? null : n(data.registration_no);
    if (data.investment_focus) inv.investment_focus = data.investment_focus;
    if (relation === "agent") {
      const acts = sortActsFor(data.acts_for_types ?? []);
      if (data.acts_for_types !== undefined) {
        if (!acts.length) throw new Error("Pick at least one investor type you act for.");
        inv.acts_for_types = acts; inv.investor_type = acts[0];
      }
    } else inv.acts_for_types = [];
    inv.setup_done_at = new Date().toISOString();
    const { error } = await sb.from("investors").update(inv).eq("id", investorId);
    if (error) throw new Error(error.message);

    // Mirror the mandate into the buyer's seller-facing (Public view) fields.
    const bp: Record<string, unknown> = {
      legal_name: n(data.firm_name), city: n(data.city), country: n(data.country), address: n(data.business_address),
      aum_exact: n(data.aum), aum_value: num(data.aum), ticket_min: num(data.min_ticket_size), ticket_max: num(data.max_ticket_size),
      ticket_exact: [data.min_ticket_size, data.max_ticket_size].filter(Boolean).join(" – ") || null,
      private_description: n(data.short_description), updated_at: new Date().toISOString(),
    };
    if (data.preferred_stages) bp.stages = data.preferred_stages;
    if (data.preferred_industries) bp.sectors = data.preferred_industries;
    if (data.portfolio_extra) bp.portfolio = data.portfolio_extra.map((name) => ({ name, note: "" }));
    if (data.people) bp.people = data.people.filter((m) => m.name.trim());
    if (data.description !== undefined) { bp.description = data.description || null; bp.headline = data.description || null; }
    if (data.deal_types) bp.deal_types = data.deal_types;
    if (data.investment_focus) bp.geography = data.investment_focus.join(", ") || null;
    if (data.ticket_band !== undefined) { const b = bandOf(data.ticket_band); bp.ticket_min = b ? b.lo * 1e6 : null; bp.ticket_max = b?.hi != null ? b.hi * 1e6 : null; }
    if (data.logo_path !== undefined && !r.extra) bp.logo_url = data.logo_path || null;
    const { error: e2 } = await writeBp(r, context.userId, bp);
    if (e2) throw new Error(e2.message);
    await sb.from("investor_activity").insert({ investor_id: investorId, tenant_id: (await sb.from("investors").select("tenant_id").eq("id", investorId).single()).data.tenant_id, activity_type: "buyer_profile_updated", activity_details: {}, created_by: context.userId });
    return { ok: true };
  });

export const createMyBuyerUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ kind: z.enum(["logo", "slot-1", "slot-2", "slot-3"]), ext: z.string().regex(/^[a-z0-9]{2,5}$/i), investor_id: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { sb, investorId } = await resolveBuyer(context.userId, data.investor_id);
    const { data: inv } = await sb.from("investors").select("tenant_id").eq("id", investorId).single();
    const file = `${data.kind}-${Date.now()}.${data.ext.toLowerCase()}`;
    const path = `${inv.tenant_id}/${investorId}/${file}`;
    const { data: s, error } = await sb.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    return { path, token: s.token as string };
  });

/** Required before "Submit for verification": ticket size, About, Fund's AUM. */
export const submitMyBuyerForVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { sb, investorId } = await ensureLinked(context.userId);
    const { data: inv } = await sb.from("investors").select("*").eq("id", investorId).single();
    const missing = [
      !inv.ticket_band && !inv.min_ticket_size && !inv.max_ticket_size && "Average investment",
    ].filter(Boolean);
    if (missing.length) throw new Error(`Add ${missing.join(", ")} first.`);
    const { data: existing } = await (await import("./profile-verification.server")).verificationByInvestor(sb, investorId, "id, status, work_email").then((data: any) => ({ data }));
    if (existing?.status === "verified" || existing?.status === "pending") return { ok: true };
    const email = existing?.work_email || inv.email || (context.claims as any)?.email || "";
    const domain = email.split("@")[1]?.toLowerCase();
    const site = (inv.website_url ?? "").replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase();
    const row = {
      user_id: context.userId, company_name: inv.investor_name, buyer_type: inv.investor_type, website: inv.website_url, registration_no: inv.registration_no,
      linkedin: inv.linkedin_url, work_email: email, status: "pending", email_domain_match: !!domain && !!site && domain === site,
      submitted_at: new Date().toISOString(), updated_at: new Date().toISOString(), decision_note: null,
    };
    const { error } = await sb.from("investor_profile_verifications").upsert({ ...row, investor_id: investorId }, { onConflict: "investor_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Wizard autosave: any subset of answers, written straight to the investor record. */
const Wizard = z.object({
  investor_id: z.string().uuid(),
  buyer_relation: z.enum(["individual", "corporate", "agent"]).nullable().optional(),
  investor_type: txt(80), country: txt(120), city: txt(120),
  investor_name: z.string().trim().max(120).optional(),
  year_founded: z.number().int().min(1800).max(2100).nullable().optional(),
  registration_no: txt(50), website_url: txt(500),
  address_line1: txt(120), address_line2: txt(120), address_city_district: txt(80), address_province_state: txt(80), postal_code: txt(12),
  aum_band: z.enum(AUM_KEYS).nullable().optional(),
  ticket_band: z.enum(TICKET_KEYS).nullable().optional(),
  revenue_min_band: z.enum(REV_KEYS).nullable().optional(),
  deal_types: arr(12), preferred_stages: arr(12), geography: arr(12), preferred_industries: arr(40),
  sector_picks: z.object({ types: z.array(z.string().max(30)).max(5), kinds: z.record(z.string().max(20), z.array(z.string().max(30)).max(20)), other: z.array(z.string().max(80)).max(40) }).nullable().optional(),
  description: z.string().trim().max(140).optional(),
  answered: z.array(z.string().max(20)).max(20).optional(),
  pe_ticked: z.boolean().optional(),
  acts_for_types: arr(7),
});

export const saveBuyerWizard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Wizard.parse(d))
  .handler(async ({ data, context }) => {
    const r = await resolveBuyer(context.userId, data.investor_id);
    const { sb, p, investorId } = r;
    const { data: cur } = await sb.from("investors").select("investor_name, website_url, wizard").eq("id", investorId).single();
    if (data.description && p.status === "live") {
      const bad = descriptionError(data.description) || descriptionLeaks(data.description, data.investor_name ?? cur.investor_name ?? "", data.website_url ?? cur.website_url ?? "").length;
      if (bad) throw new Error("Description not saved: it needs a fix.");
    }
    const inv: Record<string, unknown> = { updated_by: context.userId, updated_at: new Date().toISOString() };
    const bp: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const has = (k: keyof typeof data) => data[k] !== undefined;
    if (has("buyer_relation")) bp.buyer_relation = data.buyer_relation;
    if (has("investor_type")) inv.investor_type = data.investor_type || null;
    // A representative's types: Investor Classification is the first. Everyone else has none.
    if (has("acts_for_types")) {
      const acts = sortActsFor(data.acts_for_types);
      inv.acts_for_types = acts;
      if (acts.length) inv.investor_type = acts[0];
    }
    if (has("buyer_relation") && data.buyer_relation !== "agent") inv.acts_for_types = [];
    if (has("country")) { inv.country = data.country || null; bp.country = data.country || null; }
    if (has("city")) bp.city = data.city || null;
    if (data.investor_name?.trim()) inv.investor_name = data.investor_name.trim();
    if (has("year_founded")) inv.year_founded = data.year_founded;
    if (has("registration_no")) inv.registration_no = data.registration_no || null;
    if (has("website_url")) inv.website_url = data.website_url || null;
    for (const k of ["address_line1", "address_line2", "address_city_district", "address_province_state", "postal_code"] as const) if (has(k)) inv[k] = data[k] || null;
    if (has("aum_band")) { inv.aum_band = data.aum_band; inv.aum = bandOf(data.aum_band)?.label ?? null; }
    if (has("ticket_band")) {
      inv.ticket_band = data.ticket_band;
      const t = ticketColumns(data.ticket_band);
      inv.min_ticket_size = t.min; inv.max_ticket_size = t.max;
      const b = bandOf(data.ticket_band);
      bp.ticket_min = b ? b.lo * 1e6 : null; bp.ticket_max = b?.hi != null ? b.hi * 1e6 : null;
    }
    if (has("revenue_min_band")) inv.revenue_min_band = data.revenue_min_band;
    if (data.deal_types) bp.deal_types = data.deal_types;
    if (data.preferred_stages) { inv.preferred_stages = data.preferred_stages; bp.stages = data.preferred_stages; }
    if (data.geography) { inv.investment_focus = data.geography; bp.geography = data.geography.join(", ") || null; }
    if (data.preferred_industries) { inv.preferred_industries = data.preferred_industries; bp.sectors = data.preferred_industries; }
    if (has("sector_picks")) inv.sector_picks = data.sector_picks;
    if (has("description")) { bp.description = data.description || null; bp.headline = data.description || null; }
    if (data.answered || data.pe_ticked !== undefined) {
      inv.wizard = { ...(cur.wizard ?? {}), ...(data.answered ? { answered: data.answered } : {}), ...(data.pe_ticked !== undefined ? { pe_ticked: data.pe_ticked } : {}) };
    }
    const { error } = await sb.from("investors").update(inv).eq("id", investorId);
    if (error) throw new Error(error.message);
    const { error: e2 } = await writeBp(r, context.userId, bp);
    if (e2) throw new Error(e2.message);
    return { ok: true };
  });

/** Wizard Logo and photos: saves the investor record's Logo and Media as each upload finishes. */
export const saveBuyerMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    investor_id: z.string().uuid(), logo_path: z.string().max(1000).nullable(),
    media: z.array(z.object({ slot: z.union([z.literal(1), z.literal(2), z.literal(3)]), image_path: z.string().min(1).max(1000) })).max(3),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const r = await resolveBuyer(context.userId, data.investor_id);
    const own = (x?: string | null) => !x || /^https?:/.test(x) || x.includes(`/${r.investorId}/`);
    if (!own(data.logo_path) || data.media.some((m) => !own(m.image_path))) throw new Error("Invalid file.");
    const { error } = await r.sb.from("investors").update({ logo_url: data.logo_path, media: data.media, updated_by: context.userId, updated_at: new Date().toISOString() }).eq("id", r.investorId);
    if (error) throw new Error(error.message);
    if (!r.extra) await r.sb.from("buyer_profiles").update({ logo_url: data.logo_path }).eq("user_id", r.bpUser ?? context.userId);
    return { ok: true };
  });
