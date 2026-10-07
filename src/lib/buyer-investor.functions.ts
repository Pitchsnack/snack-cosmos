import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  AUM_KEYS, REV_KEYS, TICKET_KEYS, bandOf, descriptionError, descriptionLeaks, regError, ticketColumns, yearError,
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
    sb.from("buyer_verifications").select("company_name, buyer_type, website, linkedin, work_email").eq("user_id", userId).maybeSingle(),
    sb.from("tenants").select("id").eq("tenant_code", "control").maybeSingle(),
  ]);
  if (!tenant) throw new Error("Control workspace not found.");
  const { data: inv, error } = await sb.from("investors").insert({
    tenant_id: tenant.id,
    investor_name: bv?.company_name || p.legal_name || p.code_name,
    legal_name: p.legal_name, firm_name: p.legal_name,
    investor_type: bv?.buyer_type ?? null, website_url: bv?.website ?? null, linkedin_url: bv?.linkedin ?? null,
    email: bv?.work_email ?? null, country: p.country, business_address: p.address,
    aum: p.aum_exact, min_ticket_size: p.ticket_min?.toString() ?? null, max_ticket_size: p.ticket_max?.toString() ?? null,
    short_description: p.private_description || p.description, logo_url: null,
    preferred_stages: p.stages ?? [], preferred_industries: p.sectors ?? [],
    created_by: userId, updated_by: userId,
  }).select("id").single();
  if (error) throw new Error(error.message);
  await sb.from("buyer_profiles").update({ investor_id: inv.id }).eq("user_id", userId);
  return { sb, p: { ...p, investor_id: inv.id }, investorId: inv.id as string };
}

export const getMyBuyerInvestor = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { sb, p, investorId } = await ensureLinked(context.userId);
    const [{ data: inv }, { data: bv }, { data: links }, { data: up }, { data: au }] = await Promise.all([
      sb.from("investors").select("*").eq("id", investorId).single(),
      sb.from("buyer_verifications").select("status, decision_note, submitted_at").eq("user_id", context.userId).maybeSingle(),
      sb.from("startup_investors").select("startups(id, startup_name)").eq("investor_id", investorId),
      sb.from("user_profiles").select("title").eq("user_id", context.userId).maybeSingle(),
      sb.auth.admin.getUserById(context.userId),
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
        setup_done_at: inv.setup_done_at as string | null,
        wizard: (inv.wizard ?? {}) as { answered?: string[]; pe_ticked?: boolean; from_signup?: string[] },
        investment_focus_raw: (inv.investment_focus ?? []) as string[],
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
        status: (bv?.status ?? "none") as "none" | "pending" | "verified" | "more_info" | "declined",
        note: bv?.decision_note as string | null,
      },
    };
  });

const txt = (n: number) => z.string().trim().max(n).nullable().optional();
const arr = (max: number) => z.array(z.string().trim().min(1).max(80)).max(max).optional();
const Patch = z.object({
  investor_name: z.string().trim().min(1).max(200),
  investor_type: txt(80), year_founded: z.number().int().min(1800).max(2100).nullable().optional(),
  company_size_band: z.enum(["1-10", "11-50", "51-200", "201-500", "500+"]).nullable().optional(),
  country: txt(120), city: txt(120), email: txt(255), website_url: txt(500), linkedin_url: txt(500),
  firm_name: txt(200), business_address: txt(1000), aum: txt(120), min_ticket_size: txt(60), max_ticket_size: txt(60),
  short_description: txt(4000), keywords: arr(5), investment_focus: arr(10), preferred_stages: arr(12), preferred_industries: arr(20),
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
  .inputValidator((d) => Patch.parse(d))
  .handler(async ({ data, context }) => {
    const { sb, investorId } = await ensureLinked(context.userId);
    const relation = await relationOf(sb, context.userId);
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
    const { error: e2 } = await sb.from("buyer_profiles").update(bp).eq("user_id", context.userId);
    if (e2) throw new Error(e2.message);
    await sb.from("investor_activity").insert({ investor_id: investorId, tenant_id: (await sb.from("investors").select("tenant_id").eq("id", investorId).single()).data.tenant_id, activity_type: "buyer_profile_updated", activity_details: {}, created_by: context.userId });
    return { ok: true };
  });

export const createMyBuyerUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ kind: z.enum(["logo", "slot-1", "slot-2", "slot-3"]), ext: z.string().regex(/^[a-z0-9]{2,5}$/i) }).parse(d))
  .handler(async ({ data, context }) => {
    const { sb, investorId } = await ensureLinked(context.userId);
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
    const { data: existing } = await sb.from("buyer_verifications").select("id, status, work_email").eq("user_id", context.userId).maybeSingle();
    if (existing?.status === "verified" || existing?.status === "pending") return { ok: true };
    const email = existing?.work_email || inv.email || (context.claims as any)?.email || "";
    const domain = email.split("@")[1]?.toLowerCase();
    const site = (inv.website_url ?? "").replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase();
    const row = {
      user_id: context.userId, company_name: inv.investor_name, buyer_type: inv.investor_type, website: inv.website_url, registration_no: inv.registration_no,
      linkedin: inv.linkedin_url, work_email: email, status: "pending", email_domain_match: !!domain && !!site && domain === site,
      submitted_at: new Date().toISOString(), updated_at: new Date().toISOString(), decision_note: null,
    };
    const { error } = existing
      ? await sb.from("buyer_verifications").update(row).eq("id", existing.id)
      : await sb.from("buyer_verifications").insert(row);
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
  aum_band: z.enum(AUM_KEYS).nullable().optional(),
  ticket_band: z.enum(TICKET_KEYS).nullable().optional(),
  revenue_min_band: z.enum(REV_KEYS).nullable().optional(),
  deal_types: arr(12), preferred_stages: arr(12), geography: arr(12), preferred_industries: arr(20),
  description: z.string().trim().max(140).optional(),
  answered: z.array(z.string().max(20)).max(20).optional(),
  pe_ticked: z.boolean().optional(),
  acts_for_types: arr(7),
});

export const saveBuyerWizard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Wizard.parse(d))
  .handler(async ({ data, context }) => {
    const { sb, p, investorId } = await ensureLinked(context.userId);
    if (data.investor_id !== investorId) throw new Error("Not your profile.");
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
    if (has("description")) { bp.description = data.description || null; bp.headline = data.description || null; }
    if (data.answered || data.pe_ticked !== undefined) {
      inv.wizard = { ...(cur.wizard ?? {}), ...(data.answered ? { answered: data.answered } : {}), ...(data.pe_ticked !== undefined ? { pe_ticked: data.pe_ticked } : {}) };
    }
    const { error } = await sb.from("investors").update(inv).eq("id", investorId);
    if (error) throw new Error(error.message);
    const { error: e2 } = await sb.from("buyer_profiles").update(bp).eq("user_id", context.userId);
    if (e2) throw new Error(e2.message);
    return { ok: true };
  });
