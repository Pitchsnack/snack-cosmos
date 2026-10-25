import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Seller setup wizard on a real Draft business (read/write scoped to the caller's own business). */
async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export type SellerSetup = {
  id: string; name: string; reg: string; web: string; year: string; city: string; rev: string | null; size: string | null;
  sector: string | null; pick: { type: string; kind?: string } | null; licences: { category: string; name: string; number?: string | null }[]; iso: string[];
  role: "owner" | "family_owner" | "agent" | null; fromSignup: string[]; setupDoneAt: string | null; reached: string | null;
  addr: { street: string; unit: string; district: string; province: string; postal: string };
  tenantId: string;
  /** The listing's answers (empty until the listing exists). */
  listing: { deal: string | null; stays: "yes" | "no" | null; months: number | null; price: number | null; name: string };
  media: { logoPath: string | null; logoUrl: string | null; slots: { slot: number; path: string; url: string | null }[] };
};

const AddrInput = z.object({
  street: z.string().max(120), unit: z.string().max(120), district: z.string().max(80), province: z.string().max(80), postal: z.string().max(5),
});
type AddrT = z.infer<typeof AddrInput>;
function addrPatch(a: AddrT) {
  const tail = [a.province.trim(), a.postal.trim()].filter(Boolean).join(" ");
  const line = [a.unit.trim(), a.street.trim(), a.district.trim(), tail].filter(Boolean).join(", ");
  return {
    address_line1: a.street.trim() || null, address_line2: a.unit.trim() || null, address_city_district: a.district.trim() || null,
    address_province_state: a.province || null, postal_code: a.postal || null, business_address: line || null,
  };
}

const ListingInput = z.object({
  deal: z.enum(["Full acquisition", "Majority stake (above 51%)", "Minority stake (below 49%)"]).nullable(),
  stays: z.enum(["yes", "no"]).nullable(),
  months: z.union([z.literal(1), z.literal(3), z.literal(6), z.literal(9), z.literal(12), z.literal(18), z.literal(24)]).nullable(),
  price: z.number().int().positive().max(999_999_999_999).nullable(),
  /** Sent only once it passed the name checks. */
  name: z.string().trim().max(80).nullable(),
});

/** The listing questions save to the business's listing (made here if it isn't there yet), as the seller. */
async function saveListingAnswers(userSb: any, startupId: string, userId: string, l: z.infer<typeof ListingInput>) {
  const { data: cur } = await userSb.from("hidden_profiles").select("id").eq("startup_id", startupId).maybeSingle();
  const patch: Record<string, unknown> = {
    deal_type: l.deal, owner_stays: l.stays, handover_months: l.stays === "yes" ? l.months ?? 6 : null,
    asking_price_thb: l.price, updated_by: userId,
  };
  if (!cur) {
    const { data: st } = await userSb.from("startups").select("tenant_id, city").eq("id", startupId).single();
    const { error } = await userSb.from("hidden_profiles").insert({
      startup_id: startupId, tenant_id: st.tenant_id, region: st.city ?? null, open_to: ["Private equity", "Family office", "Corporate"], nda_approver: "admin",
      created_by: userId, ...patch,
    });
    if (error) throw new Error(/code_name/.test(error.message) ? "NAME_TAKEN: That listing name is already used by another listing" : error.message);
    return;
  }
  const { error } = await userSb.from("hidden_profiles").update(patch).eq("startup_id", startupId);
  if (error) throw new Error(/code_name/.test(error.message) ? "NAME_TAKEN: That listing name is already used by another listing" : error.message);
}

export const getSellerSetup = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<SellerSetup> => {
    const { assertCanSetup } = await import("./seller-setup.server");
    const sb = await admin();
    await assertCanSetup(sb, context.supabase, context.userId, data.id);
    const [{ data: s }, { data: o }, { data: hp }, { data: med }] = await Promise.all([
      sb.from("startups").select("*").eq("id", data.id).single(),
      sb.from("startup_ownership").select("seller_relation").eq("startup_id", data.id).maybeSingle(),
      sb.from("hidden_profiles").select("deal_type, owner_stays, handover_months, asking_price, asking_price_thb, code_name").eq("startup_id", data.id).maybeSingle(),
      sb.from("startup_media").select("slot, image_url").eq("startup_id", data.id).order("slot"),
    ]);
    const paths = [s.logo_url, ...(med ?? []).map((m: any) => m.image_url)].filter((x: any): x is string => !!x && !/^https?:/.test(x));
    const signed = new Map<string, string>();
    if (paths.length) {
      const { data: su } = await sb.storage.from("startup-media").createSignedUrls(paths, 3600);
      for (const x of su ?? []) if (x.path && x.signedUrl) signed.set(x.path, x.signedUrl);
    }
    const { thbOf } = await import("./asking-price");
    const DEALS = ["Full acquisition", "Majority stake (above 51%)", "Minority stake (below 49%)"];
    return {
      id: s.id, name: s.startup_name ?? "", reg: s.registered_number ?? "", web: s.website_url ?? "",
      year: s.year_founded ? String(s.year_founded) : "", city: s.city ?? "", rev: s.last_year_revenue ?? null,
      size: s.company_size ?? null, sector: s.sector ?? null, pick: (s.sector_pick ?? null) as { type: string; kind?: string } | null, licences: s.regulatory_licenses ?? [], iso: s.iso_standards ?? [],
      addr: { street: s.address_line1 ?? "", unit: s.address_line2 ?? "", district: s.address_city_district ?? "", province: s.address_province_state ?? s.city ?? "", postal: s.postal_code ?? "" },
      role: o?.seller_relation ?? null, fromSignup: s.setup_from_signup ?? [], setupDoneAt: s.setup_done_at ?? null, reached: s.setup_reached ?? null,
      tenantId: s.tenant_id,
      listing: {
        deal: DEALS.includes(hp?.deal_type) ? hp.deal_type : null, stays: hp?.owner_stays ?? null, months: hp?.handover_months ?? null,
        price: thbOf(hp), name: hp?.code_name && !/^project\b/i.test(hp.code_name) ? hp.code_name : "",
      },
      media: {
        logoPath: s.logo_url ?? null, logoUrl: s.logo_url ? signed.get(s.logo_url) ?? (/^https?:/.test(s.logo_url) ? s.logo_url : null) : null,
        slots: (med ?? []).map((m: any) => ({ slot: m.slot, path: m.image_url, url: signed.get(m.image_url) ?? null })),
      },
    };
  });

export const saveSellerSetup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    role: z.enum(["owner", "family_owner", "agent"]).nullable(),
    name: z.string().max(255), reg: z.string().max(13), web: z.string().max(2048), year: z.string().max(4),
    city: z.string().max(100), rev: z.string().max(60).nullable(), size: z.string().max(30).nullable(), sector: z.string().max(100).nullable(),
    pick: z.object({ type: z.string().max(30), kind: z.string().max(30).optional() }).nullable().optional(),
    licences: z.array(z.object({ category: z.string().max(40), name: z.string().max(160), number: z.string().max(120).nullable().optional() })).max(50),
    iso: z.array(z.string().max(80)).max(20),
    addr: AddrInput.optional(),
    done: z.boolean().optional(),
    reached: z.enum(["role", "name", "web", "year", "rev", "size", "sector", "lic", "photos", "deal", "handover", "price", "review"]).nullable().optional(),
    listing: ListingInput.optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { assertCanSetup } = await import("./seller-setup.server");
    const sb = await admin();
    await assertCanSetup(sb, context.supabase, context.userId, data.id);
    const y = /^\d{4}$/.test(data.year) ? Number(data.year) : null;
    const patch: Record<string, unknown> = {
      registered_number: data.reg || null, website_url: data.web.trim() || null, year_founded: y,
      city: data.city || null, headquarters: "Thailand", last_year_revenue: data.rev, company_size: data.size, sector: data.sector, sector_pick: data.pick ?? null,
      regulatory_licenses: data.licences, iso_standards: data.iso, updated_by: context.userId, updated_at: new Date().toISOString(),
    };
    if (data.addr) { Object.assign(patch, addrPatch(data.addr)); if (data.addr.province) patch.city = data.addr.province; }
    if (data.name.trim()) patch.startup_name = data.name.trim();
    if (data.done) patch.setup_done_at = new Date().toISOString();
    if (data.reached) {
      // Never moves back.
      const order = ["role", "name", "web", "year", "rev", "size", "sector", "lic", "photos", "deal", "handover", "price", "review"];
      const { data: cur } = await sb.from("startups").select("setup_reached").eq("id", data.id).single();
      if (order.indexOf(data.reached) > order.indexOf(cur?.setup_reached ?? "")) patch.setup_reached = data.reached;
    }
    const { error } = await sb.from("startups").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    if (data.role) await sb.from("startup_ownership").update({ seller_relation: data.role }).eq("startup_id", data.id);
    if (data.listing) await saveListingAnswers(context.supabase, data.id, context.userId, data.listing);
    return { ok: true };
  });

/** + Add My Business for a seller account: makes the business from the wizard's answers. */
export const createMyBusiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    role: z.enum(["owner", "family_owner", "agent"]).nullable(),
    name: z.string().trim().min(1).max(255), reg: z.string().max(13), web: z.string().max(2048), year: z.string().max(4),
    city: z.string().max(100), rev: z.string().max(60).nullable(), size: z.string().max(30).nullable(), sector: z.string().max(100).nullable(),
    pick: z.object({ type: z.string().max(30), kind: z.string().max(30).optional() }).nullable().optional(),
    licences: z.array(z.object({ category: z.string().max(40), name: z.string().max(160), number: z.string().max(120).nullable().optional() })).max(50),
    iso: z.array(z.string().max(80)).max(20),
    addr: AddrInput.optional(),
    listing: ListingInput.optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { createSellerBusiness, sellerTenant } = await import("./seller-setup.server");
    const sb = await admin();
    if (!(await sellerTenant(sb, context.userId))) throw new Error("Only seller accounts can add a business here.");
    const id = await createSellerBusiness(sb, context.userId, {
      name: data.name, relation: data.role, website: data.web.trim() || null, year: /^\d{4}$/.test(data.year) ? Number(data.year) : null,
      size: data.size, regNo: data.reg || null, city: data.city || null, revenue: data.rev, sector: data.sector,
      licences: data.licences, iso: data.iso, setupDone: true,
    });
    if (data.addr) await sb.from("startups").update({ sector_pick: data.pick ?? null, ...addrPatch(data.addr), ...(data.addr.province ? { city: data.addr.province } : {}) }).eq("id", id);
    if (data.listing) await saveListingAnswers(context.supabase, id, context.userId, data.listing);
    return { id };
  });

/** Sellers who signed up before Drafts were made at sign-up: make it now from their answers. */
export const ensureMySellerDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { ensureSellerDraftFromSignup } = await import("./seller-setup.server");
    const sb = await admin();
    const { data: a } = await sb.from("signup_answers").select("*").eq("user_id", context.userId).maybeSingle();
    if (!a || a.role !== "seller" || !a.done_at) return { id: null as string | null };
    return { id: await ensureSellerDraftFromSignup(sb, context.userId, a) };
  });

/** Auto-fill after the seller wizard: writes what the website reader found into empty fields only, then the Public headline. */
export const applySellerEnrich = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    r: z.object({
      registeredName: z.string().max(255).optional().nullable(), yearFounded: z.number().int().min(1800).max(2100).optional().nullable(),
      email: z.string().max(255).optional().nullable(), city: z.string().max(100).optional().nullable(), linkedinUrl: z.string().max(2048).optional().nullable(),
      shortDescription: z.string().max(600).optional().nullable(), longDescription: z.string().max(3000).optional().nullable(),
      productTags: z.array(z.string().max(80)).max(10).optional().nullable(), marketTags: z.array(z.string().max(80)).max(10).optional().nullable(),
      isoStandards: z.array(z.string().max(80)).max(20).optional().nullable(),
      regulatoryLicenses: z.array(z.object({ category: z.string().max(40), name: z.string().max(160) })).max(20).optional().nullable(),
      founders: z.array(z.object({ full_name: z.string().max(160), position: z.string().max(160).optional().nullable(), linkedin_url: z.string().max(2048).optional().nullable() })).max(10).optional().nullable(),
    }),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { assertCanSetup } = await import("./seller-setup.server");
    const sb = await admin();
    await assertCanSetup(sb, context.supabase, context.userId, data.id);
    const { data: s } = await sb.from("startups").select("*").eq("id", data.id).single();
    const r = data.r;
    const empty = (v: unknown) => v == null || (typeof v === "string" ? !v.trim() : Array.isArray(v) ? v.length === 0 : false);
    const patch: Record<string, unknown> = {};
    const put = (col: string, v: unknown) => { if (!empty(v) && empty(s[col])) patch[col] = v; };
    put("registered_name", r.registeredName?.trim()); put("year_founded", r.yearFounded); put("email", r.email?.trim());
    put("city", r.city?.trim()); put("linkedin_url", r.linkedinUrl?.trim());
    put("short_description", r.shortDescription?.trim()); put("long_description", r.longDescription?.trim());
    put("product_tags", r.productTags?.slice(0, 5)); put("market_tags", r.marketTags?.slice(0, 5));
    // Licences and standards add to the wizard's answers, never replace them.
    if (r.isoStandards?.length) { const cur: string[] = s.iso_standards ?? []; const add = r.isoStandards.filter((x) => !cur.includes(x)); if (add.length) patch.iso_standards = [...cur, ...add]; }
    if (r.regulatoryLicenses?.length) {
      const cur: { name: string }[] = s.regulatory_licenses ?? [];
      const add = r.regulatoryLicenses.filter((x) => !cur.some((c) => c.name.toLowerCase() === x.name.toLowerCase()));
      if (add.length) patch.regulatory_licenses = [...cur, ...add];
    }
    let found = Object.keys(patch).length;
    if (found) {
      patch.updated_by = context.userId; patch.updated_at = new Date().toISOString();
      const { error } = await sb.from("startups").update(patch).eq("id", data.id);
      if (error) throw new Error(error.message);
    }
    if (r.founders?.length) {
      const { count } = await sb.from("startup_founders").select("id", { count: "exact", head: true }).eq("startup_id", data.id);
      if (!count) {
        const { error } = await sb.from("startup_founders").insert(r.founders.filter((f) => f.full_name.trim()).map((f) => ({
          startup_id: data.id, tenant_id: s.tenant_id, full_name: f.full_name.trim(), position: f.position ?? null, linkedin_url: f.linkedin_url ?? null,
        })));
        if (!error) found += 1;
      }
    }
    // Listing view: its description and tags come from the private fields; the headline is stored, so draft it when empty.
    const { data: hp } = await sb.from("hidden_profiles").select("id, headline").eq("startup_id", data.id).maybeSingle();
    if (hp && !String(hp.headline ?? "").trim()) {
      const { suggestHeadline } = await import("@/lib/public-listing");
      const { data: s2 } = await sb.from("startups").select("*").eq("id", data.id).single();
      const headline = suggestHeadline(s2).slice(0, 120);
      if (headline) await sb.from("hidden_profiles").update({ headline, updated_by: context.userId }).eq("id", hp.id);
    }
    return { found };
  });

/**
 * + Add My Business: makes an empty Draft business on the server (no name, setup not done,
 * no sign-up answers) and returns its id; the caller then opens the seller wizard on it.
 * Seller accounts: their own business (one-company rule). Admin: in the active workspace, owned by Admin.
 */
export const addDraftBusiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ tenantId: z.string().uuid().nullable().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const sb = await admin();
    const { roleOf } = await import("./plan-access.server");
    const role = await roleOf(context.userId);
    if (role !== "admin") {
      const { createSellerBusiness, sellerTenant } = await import("./seller-setup.server");
      if (!(await sellerTenant(sb, context.userId))) throw new Error("Only seller accounts can add a business here.");
      const id = await createSellerBusiness(sb, context.userId, { name: "", relation: null, fromSignup: [], setupDone: false });
      return { id };
    }
    // Admin: the active workspace (else its primary one), checked as the caller.
    let tenantId = data.tenantId ?? null;
    const CONTROL = "9df87a29-e8ef-4dbc-9c63-28410d45b985";
    if (!tenantId || tenantId === CONTROL) {
      // Control view: default to the primary workspace, else the default/first real one.
      const { data: u } = await sb.from("users").select("primary_tenant_id").eq("id", context.userId).maybeSingle();
      tenantId = u?.primary_tenant_id && u.primary_tenant_id !== CONTROL ? u.primary_tenant_id : null;
      if (!tenantId) {
        const { data: ts } = await sb.from("user_tenants").select("tenant_id, is_default").eq("user_id", context.userId).neq("tenant_id", CONTROL).order("is_default", { ascending: false }).limit(1);
        tenantId = ts?.[0]?.tenant_id ?? null;
      }
    }
    if (!tenantId) throw new Error("Choose a workspace first.");
    const { data: ok } = await context.supabase.rpc("can_manage_startup", { _user_id: context.userId, _tenant_id: tenantId });
    if (!ok) throw new Error("You can't add a business in this workspace.");
    const { data: cfg } = await sb.from("default_intake_settings").select("default_startup_intake_ai_agent_id").eq("tenant_id", tenantId).maybeSingle();
    let ai = cfg?.default_startup_intake_ai_agent_id as string | undefined;
    if (!ai) { const { data: a } = await sb.from("ai_agents").select("id").eq("tenant_id", tenantId).limit(1).maybeSingle(); ai = a?.id; }
    const { data: me } = await sb.from("users").select("email").eq("id", context.userId).maybeSingle();
    const { data: st, error } = await sb.from("startups").insert({
      tenant_id: tenantId, startup_name: null, status: "Draft", visibility: "Tenant", company_type: "SME", email: me?.email || null,
      headquarters: "Thailand", regulatory_licenses: [], iso_standards: [], setup_from_signup: [], setup_done_at: null,
      created_by: context.userId, updated_by: context.userId,
    }).select("id").single();
    if (error) throw new Error(error.message);
    const id = st.id as string;
    const undo = async (msg: string) => { await sb.from("startups").delete().eq("id", id); throw new Error(msg); };
    const r1 = await sb.from("startup_ownership").insert({ startup_id: id, tenant_id: tenantId, owning_agent_user_id: context.userId, seller_relation: null });
    if (r1.error) await undo(r1.error.message);
    if (ai) { const r2 = await sb.from("startup_ai_ownership").insert({ startup_id: id, tenant_id: tenantId, owning_ai_agent_id: ai }); if (r2.error) await undo(r2.error.message); }
    await sb.from("startup_activity").insert({ startup_id: id, tenant_id: tenantId, activity_type: "STARTUP_CREATED", activity_details: { name: null, by: "admin" }, created_by: context.userId });
    return { id };
  });
