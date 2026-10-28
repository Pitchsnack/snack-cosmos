import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CompleteFirmInput, DraftFirmInput, advisorNeedsCompleteSave } from "@/lib/advisor-form-schema";
import { DEAL_BANDS, feeWords, parsePct, type AdvisorFirm, type FeeDetail, type FeeType } from "@/lib/advisor-firm";

/**
 * Advisor › My Company. Owners (and Control) read and edit their firm
 * profiles through the user's own client, so RLS applies. Verification,
 * credential status and document checks are Admin-only (DB triggers).
 * Files live under advisor/<user>/ in the private startup-media bucket.
 * The setup wizard and Edit profile both write this one record.
 */
const BUCKET = "startup-media";
const FEE_TYPES = ["fixed", "hourly", "retainer", "success", "retainer_success", "quote", "other"] as const;
const BAND_KEYS = DEAL_BANDS.map((b) => b.key) as [string, ...string[]];

async function requireAdvisor(sb: any, userId: string) {
  const { data: ctl } = await sb.rpc("is_control", { _user_id: userId });
  if (ctl) return;
  const { data } = await sb.from("users").select("advisor_view").eq("id", userId).maybeSingle();
  if (!data?.advisor_view) throw new Error("The Advisor view is not turned on for your account.");
}

export function rowToFee(f: any): FeeDetail {
  const pct = f.pct_min != null ? (f.pct_max != null ? `${Number(f.pct_min)}–${Number(f.pct_max)}` : `${Number(f.pct_min)}`) : "";
  return { type: (f.fee_type ?? "other") as FeeType, amount: f.amount_thb != null ? String(f.amount_thb) : "", pct, words: f.own_words ?? "" };
}
function feeToRow(firmId: string, service: string, d: FeeDetail) {
  const p = parsePct(d.pct);
  const amt = /^\d{1,12}$/.test(d.amount) ? Number(d.amount) : null;
  return {
    firm_id: firmId, service, fee_type: d.type, fee: feeWords(d) ?? "",
    amount_thb: ["fixed", "hourly", "retainer", "retainer_success"].includes(d.type) ? amt : null,
    pct_min: ["success", "retainer_success"].includes(d.type) && p ? p.min : null,
    pct_max: ["success", "retainer_success"].includes(d.type) && p ? p.max : null,
    own_words: d.type === "other" ? d.words.trim().slice(0, 80) || null : null,
  };
}

/** The contact email shown is the owner account's sign-in email (read live, not a copy); no owner keeps the stored one. */
async function withOwnerEmails(rows: any[]) {
  const owners = [...new Set(rows.map((r) => r.owner_user_id).filter(Boolean))];
  if (!owners.length) return rows;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin as any).from("users").select("id, email").in("id", owners);
  const by = new Map((data ?? []).map((u: any) => [u.id, u.email]));
  return rows.map((r) => (r.owner_user_id && by.get(r.owner_user_id) ? { ...r, email: by.get(r.owner_user_id) } : r));
}

function toFirm(r: any, kids: { fees: any[]; team: any[]; creds: any[]; docs: any[]; reviews: any[] }, urls: Map<string, string>): AdvisorFirm {
  const mine = (rows: any[]) => rows.filter((x) => x.firm_id === r.id);
  const fees: Record<string, string> = {};
  const feeDetails: Record<string, FeeDetail> = {};
  for (const f of mine(kids.fees)) { feeDetails[f.service] = rowToFee(f); if ((r.services ?? []).includes(f.service)) fees[f.service] = f.fee; }
  return {
    id: r.id, refNo: r.ref_no, name: r.name ?? "", firmType: r.firm_type ?? "", logoPath: r.logo_path, logoUrl: r.logo_path ? urls.get(r.logo_path) ?? null : null,
    logoSource: r.logo_source ?? null,
    media: (Array.isArray(r.media) ? r.media : []).map((m: any) => ({ slot: m.slot, path: m.image_path, url: urls.get(m.image_path) ?? null })),
    description: r.description, yearFounded: r.year_founded, city: r.city, country: r.country,
    services: r.services ?? [], fees, feeDetails, dealBand: r.deal_size_band ?? null,
    teamSize: r.team_size, languages: r.languages ?? [], sectors: r.sectors ?? [], sectorAgnostic: !!r.sector_agnostic, sectorPicks: r.sector_picks ?? null,
    legalName: r.legal_name, thaiName: r.thai_name, registrationNo: r.registration_no,
    addrStreet: r.addr_street, addrUnit: r.addr_unit, addrDistrict: r.addr_district,
    addrProvince: r.addr_province, addrPostal: r.addr_postal,
    website: r.website, email: r.email, phone: r.phone,
    status: r.status, liveSince: r.live_since, verifiedAt: r.verified_at, updatedAt: r.updated_at,
    suggestedListingName: r.suggested_listing_name ?? null, suggestedHeadline: r.suggested_headline ?? null,
    publishedListingName: r.published_listing_name ?? null, publishedHeadline: r.published_headline ?? null,
    verification: { state: r.advisor_verification ?? "unverified", note: r.more_info_note ?? null, fields: r.more_info_fields ?? [], reason: r.decline_reason ?? null, declineNote: r.decline_note ?? null },
    setupAnswered: r.setup_answered ?? [], setupDoneAt: r.setup_done_at ?? null, wizard: r.wizard_state ?? {},
    team: mine(kids.team).sort((a, b) => a.sort_order - b.sort_order).map((t) => ({ id: t.id, name: t.name, role: t.role, email: t.email })),
    credentials: mine(kids.creds).sort((a, b) => a.sort_order - b.sort_order).map((c) => ({ id: c.id, name: c.name, note: c.note, status: c.status, checkedAt: c.checked_at })),
    documents: mine(kids.docs).map((d) => ({ id: d.id, path: d.file_path, name: d.name, type: d.doc_type, checkedAt: d.checked_at, validUntil: d.valid_until, url: urls.get(d.file_path) ?? null })),
    reviews: mine(kids.reviews).sort((a, b) => b.created_at.localeCompare(a.created_at)).map((v) => ({ id: v.id, role: v.client_role, detail: v.client_detail, service: v.service, stars: v.stars, comment: v.comment, at: v.created_at })),
  };
}

export const listMyAdvisorFirms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdvisorFirm[]> => {
    const sb = context.supabase as any;
    const { data: rows, error } = await sb.from("advisor_firms").select("*").eq("owner_user_id", context.userId).order("created_at");
    if (error) throw new Error(error.message);
    if (!rows?.length) return [];
    const ids = rows.map((r: any) => r.id);
    const [fees, team, creds, docs, reviews] = await Promise.all([
      sb.from("advisor_firm_fees").select("*").in("firm_id", ids),
      sb.from("advisor_firm_team").select("*").in("firm_id", ids),
      sb.from("advisor_firm_credentials").select("*").in("firm_id", ids),
      sb.from("advisor_firm_documents").select("*").in("firm_id", ids).order("created_at"),
      sb.from("advisor_firm_reviews").select("*").in("firm_id", ids),
    ]);
    const paths = [...rows.map((r: any) => r.logo_path), ...rows.flatMap((r: any) => (Array.isArray(r.media) ? r.media : []).map((m: any) => m.image_path)), ...(docs.data ?? []).map((d: any) => d.file_path)].filter(Boolean) as string[];
    const urls = new Map<string, string>();
    if (paths.length) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: signed } = await supabaseAdmin.storage.from(BUCKET).createSignedUrls(paths, 3600);
      for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
    }
    const kids = { fees: fees.data ?? [], team: team.data ?? [], creds: creds.data ?? [], docs: docs.data ?? [], reviews: reviews.data ?? [] };
    return (await withOwnerEmails(rows)).map((r: any) => toFirm(r, kids, urls));
  });

/** Firm cards by id with the service client (callers check access first). Private files and documents are left out. */
export async function loadFirmCards(sb: any, ids: string[], fullAddressFor: Set<string> = new Set(), opts: { docs?: boolean } = {}): Promise<AdvisorFirm[]> {
  if (!ids.length) return [];
  const { data: rows } = await sb.from("advisor_firms").select("*").in("id", ids);
  if (!rows?.length) return [];
  const [fees, team, creds, reviews, docs] = await Promise.all([
    sb.from("advisor_firm_fees").select("*").in("firm_id", ids),
    sb.from("advisor_firm_team").select("*").in("firm_id", ids),
    sb.from("advisor_firm_credentials").select("*").in("firm_id", ids),
    sb.from("advisor_firm_reviews").select("*").in("firm_id", ids),
    opts.docs ? sb.from("advisor_firm_documents").select("*").in("firm_id", ids).order("created_at") : Promise.resolve({ data: [] }),
  ]);
  const paths = [...rows.map((r: any) => r.logo_path), ...rows.flatMap((r: any) => (Array.isArray(r.media) ? r.media : []).map((m: any) => m.image_path)), ...(docs.data ?? []).map((d: any) => d.file_path)].filter(Boolean) as string[];
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data: signed } = await sb.storage.from(BUCKET).createSignedUrls(paths, 3600);
    for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  }
  const kids = { fees: fees.data ?? [], team: team.data ?? [], creds: (creds.data ?? []).filter((c: any) => c.status !== "rejected"), docs: docs.data ?? [], reviews: reviews.data ?? [] };
  // The full address only for firms named in fullAddressFor; others show "{place}, {country}".
  return (await withOwnerEmails(rows)).map((r: any) => toFirm(fullAddressFor.has(r.id) ? r : {
    ...r, addr_street: null, addr_unit: null, addr_subdistrict: null, addr_district: null, addr_postal: null, registration_no: null,
  }, kids, urls));
}

/** Admin: one firm in the advisor's own shape, for Edit in Advisors Directory. */
export const getAdvisorFirmForAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<AdvisorFirm> => {
    const { data: ctl } = await (context.supabase as any).rpc("is_control", { _user_id: context.userId });
    if (!ctl) throw new Error("Admin only");
    const sb = context.supabase as any;
    const { data: r } = await sb.from("advisor_firms").select("*").eq("id", data.id).single();
    const [fees, team, creds, docs, reviews] = await Promise.all([
      sb.from("advisor_firm_fees").select("*").eq("firm_id", data.id),
      sb.from("advisor_firm_team").select("*").eq("firm_id", data.id),
      sb.from("advisor_firm_credentials").select("*").eq("firm_id", data.id),
      sb.from("advisor_firm_documents").select("*").eq("firm_id", data.id),
      sb.from("advisor_firm_reviews").select("*").eq("firm_id", data.id),
    ]);
    const paths = [r.logo_path, ...(Array.isArray(r.media) ? r.media : []).map((m: any) => m.image_path), ...(docs.data ?? []).map((d: any) => d.file_path)].filter(Boolean) as string[];
    const urls = new Map<string, string>();
    if (paths.length) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: signed } = await supabaseAdmin.storage.from(BUCKET).createSignedUrls(paths, 3600);
      for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
    }
    const [rr] = await withOwnerEmails([r]);
    return toFirm(rr, { fees: fees.data ?? [], team: team.data ?? [], creds: creds.data ?? [], docs: docs.data ?? [], reviews: reviews.data ?? [] }, urls);
  });

/**
 * Admin's Advisors Directory › Add advisor: an unverified Draft with only a firm name and no owner.
 * The only way to create a firm without an owner — the database function checks Admin itself,
 * and a trigger keeps ownerless firms out of verified/live unless Managed by PitchSnack.
 */
export const createAdvisorFirmForAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ name: z.string().trim().min(2).max(80) }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: ctl } = await sb.rpc("is_control", { _user_id: context.userId });
    if (!ctl) throw new Error("Admin only");
    const { data: id, error } = await sb.rpc("admin_create_ownerless_advisor_firm", { _name: data.name });
    if (error) throw new Error(error.message);
    return { id: id as string };
  });

/** + Add Firm Profile: a new Draft with the next ADV reference. */
export const createAdvisorDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    await requireAdvisor(sb, context.userId);
    const { assertCanAddCompany } = await import("./plan-access.server");
    await assertCanAddCompany(context.userId, "advisor");
    const { data, error } = await sb.from("advisor_firms")
      .insert({ owner_user_id: context.userId, status: "draft", name: "", firm_type: "", country: "Thailand", email: ((context.claims as any)?.email as string | undefined) || null })
      .select("id").single();
    if (error) throw new Error(error.message);
    return { id: data.id as string };
  });

const FeeIn = z.object({
  type: z.enum(FEE_TYPES), amount: z.string().max(12).regex(/^\d*$/), pct: z.string().max(12), words: z.string().max(80),
});
const nz = (max: number) => z.string().max(max).nullable();

/** Wizard autosave: each answer saves at once; the profile stays a Draft. */
export const saveAdvisorWizard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    patch: z.object({
      firm_type: z.string().max(60), country: nz(100), city: nz(80), name: z.string().max(80), year_founded: z.number().int().min(1000).max(3000).nullable(),
      registration_no: nz(50), addr_street: nz(120), addr_unit: nz(120), addr_district: nz(80), addr_province: nz(80), addr_postal: nz(12),
      website: nz(200), services: z.array(z.string().max(60)).max(10), deal_size_band: z.enum(BAND_KEYS).nullable(), team_size: z.number().int().min(1).max(99999).nullable(),
      languages: z.array(z.string().max(40)).max(20), sectors: z.array(z.string().max(80)).max(60), sector_agnostic: z.boolean(), sector_picks: z.object({ types: z.array(z.string().max(30)).max(5), kinds: z.record(z.string().max(20), z.array(z.string().max(30)).max(20)), other: z.array(z.string().max(80)).max(40) }).nullable(), email: nz(120), phone: nz(30), logo_path: nz(300), logo_source: z.enum(["upload", "enrich"]).nullable(),
      media: z.array(z.object({ slot: z.union([z.literal(1), z.literal(2), z.literal(3)]), image_path: z.string().min(1).max(300) })).max(3),
      description: nz(300), setup_answered: z.array(z.string().max(20)).max(20), wizard_state: z.object({ fromSignup: z.array(z.string().max(20)).max(10).optional(), feeVisited: z.boolean().optional(), enrichSig: z.string().optional(), enrich: z.any().optional() }),
    }).partial(),
    fees: z.record(z.string().max(60), FeeIn).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const own = `advisor/${context.userId}/`;
    if (data.patch.logo_path && !data.patch.logo_path.startsWith(own)) throw new Error("Invalid logo file.");
    if (data.patch.media?.some((m) => !m.image_path.startsWith(own))) throw new Error("Invalid photo file.");
    if (Object.keys(data.patch).length) {
      const { error } = await sb.from("advisor_firms").update(data.patch).eq("id", data.id).eq("owner_user_id", context.userId);
      if (error) throw new Error(error.message);
    }
    if (data.fees && Object.keys(data.fees).length) {
      const rows = Object.entries(data.fees).map(([s, f]) => feeToRow(data.id, s, f));
      const { error } = await sb.from("advisor_firm_fees").upsert(rows, { onConflict: "firm_id,service" });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

/** Save profile (Review & complete) and Save changes (Edit profile). Both mark the setup as done. */
export const saveAdvisorFirm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => DraftFirmInput.extend({
    // One-step approval: the advisor's suggested listing name and headline.
    suggested_listing_name: z.string().trim().max(200).nullable().optional(),
    suggested_headline: z.string().trim().max(300).nullable().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await requireAdvisor(sb, context.userId);
    const own = `advisor/${context.userId}/`;
    const { data: current, error: readError } = data.id
      ? await sb.from("advisor_firms").select("status, owner_user_id, logo_path, media").eq("id", data.id).maybeSingle()
      : { data: null, error: null };
    if (data.id && (readError || !current)) throw new Error("Firm profile not found.");
    if (!current || advisorNeedsCompleteSave(current.status)) CompleteFirmInput.parse(data);
    const existingPaths = new Set<string>([current?.logo_path, ...(current?.media ?? []).map((m: any) => m.image_path)].filter(Boolean));
    if (data.logoPath && !data.logoPath.startsWith(own) && !existingPaths.has(data.logoPath)) throw new Error("Invalid logo file.");
    if (data.media?.some((m) => !m.image_path.startsWith(own) && !existingPaths.has(m.image_path))) throw new Error("Invalid photo file.");
    const thai = data.country === "Thailand";
    const row = {
      ...(data.media ? { media: data.media } : {}),
      name: data.name, firm_type: data.firmType, logo_path: data.logoPath, logo_source: data.logoPath ? data.logoSource ?? "upload" : null,
      description: data.description, year_founded: data.yearFounded, city: data.city, country: data.country, services: data.services,
      deal_size_band: data.dealBand, team_size: data.teamSize,
      languages: data.languages, sectors: data.sectors, ...(data.sectorAgnostic === undefined ? {} : { sector_agnostic: data.sectorAgnostic }), legal_name: data.legalName, thai_name: data.thaiName,
      registration_no: data.registrationNo ?? null, addr_street: data.addrStreet, addr_unit: data.addrUnit,
      addr_district: thai ? data.addrDistrict : data.city, addr_province: data.addrProvince,
      addr_postal: data.addrPostal, website: data.website, email: data.email, phone: data.phone,
      ...(data.suggested_listing_name !== undefined ? { suggested_listing_name: data.suggested_listing_name || null } : {}),
      ...(data.suggested_headline !== undefined ? { suggested_headline: data.suggested_headline || null } : {}),
      ...(CompleteFirmInput.safeParse(data).success ? { setup_done_at: new Date().toISOString() } : {}),
    };
    if (data.id) { const { data: ctl0 } = await sb.rpc("is_control", { _user_id: context.userId }); if (ctl0) delete (row as Record<string, unknown>).setup_done_at; }
    let id = data.id;
    if (id) {
      const { error } = await sb.from("advisor_firms").update(row).eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { data: ins, error } = await sb.from("advisor_firms").insert({ ...row, email: row.email || ((context.claims as any)?.email as string | undefined) || null, owner_user_id: context.userId, status: "draft" }).select("id").single();
      if (error) throw new Error(error.message);
      id = ins.id as string;
    }
    if (!id) throw new Error("Firm profile not found.");
    // fees: only ticked services keep theirs
    await sb.from("advisor_firm_fees").delete().eq("firm_id", id);
    const fees = data.services.map((sv) => feeToRow(id, sv, data.fees[sv] ?? { type: "quote", amount: "", pct: "", words: "" }));
    if (fees.length) { const { error } = await sb.from("advisor_firm_fees").insert(fees); if (error) throw new Error(error.message); }
    // team
    await sb.from("advisor_firm_team").delete().eq("firm_id", id);
    if (data.team.length) {
      const { error } = await sb.from("advisor_firm_team").insert(data.team.map((t, i) => ({ firm_id: id, name: t.name, role: t.role, email: t.email, sort_order: i })));
      if (error) throw new Error(error.message);
    }
    // credentials: diff so unchanged items keep their check status
    const { data: oldCreds } = await sb.from("advisor_firm_credentials").select("id").eq("firm_id", id);
    const keepC = new Set(data.credentials.map((c) => c.id).filter(Boolean));
    const dropC = (oldCreds ?? []).map((c: any) => c.id).filter((x: string) => !keepC.has(x));
    if (dropC.length) await sb.from("advisor_firm_credentials").delete().in("id", dropC);
    for (const [i, c] of data.credentials.entries()) {
      if (c.id) await sb.from("advisor_firm_credentials").update({ name: c.name, note: c.note, sort_order: i }).eq("id", c.id).eq("firm_id", id);
      else { const { error } = await sb.from("advisor_firm_credentials").insert({ firm_id: id, name: c.name, note: c.note, sort_order: i }); if (error) throw new Error(error.message); }
    }
    // documents
    const { data: oldDocs } = await sb.from("advisor_firm_documents").select("id").eq("firm_id", id);
    const keepD = new Set(data.documents.map((d) => d.id).filter(Boolean));
    const dropD = (oldDocs ?? []).map((d: any) => d.id).filter((x: string) => !keepD.has(x));
    if (dropD.length) await sb.from("advisor_firm_documents").delete().in("id", dropD);
    for (const d of data.documents) {
      if (d.id) await sb.from("advisor_firm_documents").update({ name: d.name, doc_type: d.type }).eq("id", d.id).eq("firm_id", id);
      else {
        if (!d.path.startsWith(own)) throw new Error("Invalid document file.");
        const { error } = await sb.from("advisor_firm_documents").insert({ firm_id: id, file_path: d.path, name: d.name, doc_type: d.type });
        if (error) throw new Error(error.message);
      }
    }
    // Admin's Edit keeps the verified snapshot in step, so its own changes never show as the firm's.
    const { data: ctl } = await sb.rpc("is_control", { _user_id: context.userId });
    if (ctl) {
      const { data: f } = await sb.from("advisor_firms").select("verified_snapshot, legal_name, registration_no").eq("id", id).single();
      if (f?.verified_snapshot) {
        const [{ data: c }, { data: d }] = await Promise.all([
          sb.from("advisor_firm_credentials").select("id, name, note").eq("firm_id", id),
          sb.from("advisor_firm_documents").select("id, name, file_path").eq("firm_id", id),
        ]);
        await sb.from("advisor_firms").update({ verified_snapshot: { legal_name: f.legal_name, registration_no: f.registration_no, credentials: c ?? [], documents: d ?? [] } }).eq("id", id);
      }
    }
    return { id };
  });

export const saveAdvisorServices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), services: z.array(z.string().max(60)).min(1).max(10) }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { error } = await sb.from("advisor_firms").update({ services: data.services }).eq("id", data.id).eq("owner_user_id", context.userId);
    if (error) throw new Error(error.message);
    await sb.from("advisor_firm_fees").delete().eq("firm_id", data.id).not("service", "in", `(${data.services.map((x) => `"${x.replace(/"/g, "")}"`).join(",")})`);
    return { ok: true };
  });

export const setAdvisorFirmStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), status: z.enum(["live", "paused"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await requireAdvisor(sb, context.userId);
    const { data: cur } = await sb.from("advisor_firms").select("status, live_since, setup_done_at").eq("id", data.id).eq("owner_user_id", context.userId).maybeSingle();
    if (!cur) throw new Error("Firm profile not found.");
    if (data.status === "live" && !cur.setup_done_at) throw new Error("Finish the setup first.");
    const patch: Record<string, unknown> = { status: data.status };
    if (data.status === "live" && cur.status !== "live") patch.live_since = new Date().toISOString();
    const { error } = await sb.from("advisor_firms").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createAdvisorUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ kind: z.enum(["logo", "doc", "slot-1", "slot-2", "slot-3"]), ext: z.string().regex(/^[a-z0-9]{2,5}$/i) }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdvisor(context.supabase, context.userId);
    const ext = data.ext.toLowerCase();
    const allowed = data.kind === "logo" ? ["png", "jpg", "jpeg", "webp", "svg"] : data.kind.startsWith("slot") ? ["png", "jpg", "jpeg", "webp", "gif"] : ["pdf", "docx", "doc", "png", "jpg", "jpeg", "webp"];
    if (!allowed.includes(ext)) throw new Error("This file type isn't allowed.");
    const path = `advisor/${context.userId}/${data.kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: s2, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    return { path, url: s2.signedUrl as string, token: s2.token as string };
  });

/** Signed URL for a freshly uploaded file, so the wizard can show it. */
export const signAdvisorFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ path: z.string().max(300) }).parse(d))
  .handler(async ({ data, context }) => {
    if (!data.path.startsWith(`advisor/${context.userId}/`)) throw new Error("Invalid file.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: s2 } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(data.path, 3600);
    return { url: s2?.signedUrl ?? null };
  });

export type AdvisorEnrichResult = { logo: boolean; legalName: string | null; thaiName: string | null; teamAdded: boolean; found: number };

async function findLogo(site: string): Promise<{ bytes: ArrayBuffer; ext: string } | null> {
  const ctl = AbortSignal.timeout(8000);
  const res = await fetch(site, { signal: ctl, headers: { "user-agent": "Mozilla/5.0 PitchSnackBot" }, redirect: "follow" });
  if (!res.ok) return null;
  const html = (await res.text()).slice(0, 400_000);
  const base = res.url || site;
  const cands: string[] = [];
  const tag = (re: RegExp) => { for (const m of html.matchAll(re)) { const href = m[0].match(/(?:href|content)=["']([^"']+)["']/i)?.[1]; if (href) cands.push(href); } };
  tag(/<link[^>]+rel=["'][^"']*apple-touch-icon[^"']*["'][^>]*>/gi);
  tag(/<img[^>]+(?:class|id|alt)=["'][^"']*logo[^"']*["'][^>]*>/gi);
  for (const m of html.matchAll(/<img[^>]+(?:class|id|alt)=["'][^"']*logo[^"']*["'][^>]*>/gi)) { const src = m[0].match(/src=["']([^"']+)["']/i)?.[1]; if (src) cands.push(src); }
  tag(/<meta[^>]+property=["']og:logo["'][^>]*>/gi);
  tag(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]*>/gi);
  for (const c of cands) {
    try {
      const u = new URL(c, base).toString();
      const r = await fetch(u, { signal: AbortSignal.timeout(6000) });
      const ct = r.headers.get("content-type") ?? "";
      if (!r.ok) continue;
      const ext = ct.includes("png") ? "png" : ct.includes("jpeg") || ct.includes("jpg") ? "jpg" : ct.includes("webp") ? "webp" : null;
      if (!ext) continue; // SVG and ICO skipped: SVG may carry scripts
      const bytes = await r.arrayBuffer();
      if (bytes.byteLength < 400 || bytes.byteLength > 2 * 1024 * 1024) continue;
      return { bytes, ext };
    } catch { /* try next */ }
  }
  return null;
}

/** Auto Enrich for a firm profile: never overwrites an answer. */
export const enrichAdvisorFirm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<AdvisorEnrichResult> => {
    const sb = context.supabase as any;
    const { data: f } = await sb.from("advisor_firms").select("*").eq("id", data.id).eq("owner_user_id", context.userId).maybeSingle();
    if (!f) throw new Error("Firm profile not found.");
    const out: AdvisorEnrichResult = { logo: false, legalName: null, thaiName: null, teamAdded: false, found: 0 };
    const patch: Record<string, unknown> = {};
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!f.logo_path && f.website) {
      try {
        const site = /^https?:\/\//i.test(f.website) ? f.website : `https://${f.website}`;
        const logo = await findLogo(site);
        if (logo) {
          const path = `advisor/${context.userId}/logo-${Date.now()}-auto.${logo.ext}`;
          const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, logo.bytes, { contentType: `image/${logo.ext === "jpg" ? "jpeg" : logo.ext}` });
          if (!error) { patch.logo_path = path; patch.logo_source = "enrich"; out.logo = true; }
        }
      } catch { /* nothing found */ }
    }
    if (f.country === "Thailand" && /^\d{13}$/.test(f.registration_no ?? "") && (!f.legal_name || !f.thai_name)) {
      try {
        const { lookupDbdFinancials } = await import("@/lib/financials/dbd-provider.server");
        const r: any = await lookupDbdFinancials({ registeredNumber: f.registration_no });
        const c = r?.company;
        const en = c?.companyInfo?.legalNameEn ?? null;
        const th = c?.companyInfo?.legalNameTh ?? c?.registeredName ?? null;
        if (!f.legal_name && (en || th)) { patch.legal_name = en || th; out.legalName = en || th; }
        if (!f.thai_name && th) { patch.thai_name = th; out.thaiName = th; }
      } catch { /* registry unavailable */ }
    }
    const { count } = await sb.from("advisor_firm_team").select("id", { count: "exact", head: true }).eq("firm_id", data.id);
    if (!count) {
      const [{ data: u }, { data: p }] = await Promise.all([
        sb.from("users").select("first_name,last_name,email").eq("id", context.userId).maybeSingle(),
        sb.from("user_profiles").select("title").eq("user_id", context.userId).maybeSingle(),
      ]);
      const name = [u?.first_name, u?.last_name].filter(Boolean).join(" ") || u?.email?.split("@")[0];
      if (name) { await sb.from("advisor_firm_team").insert({ firm_id: data.id, name, role: p?.title ?? null, email: u?.email ?? null, sort_order: 0 }); out.teamAdded = true; }
    }
    out.found = (out.logo ? 1 : 0) + (out.legalName ? 1 : 0) + (out.thaiName ? 1 : 0);
    patch.wizard_state = { ...(f.wizard_state ?? {}), enrichSig: `${f.website}|${f.registration_no}|${f.name}`, enrich: out };
    await sb.from("advisor_firms").update(patch).eq("id", data.id);
    return out;
  });

/** Maps Embed key (browser-visible by design). Null when not configured: the map is left out. */
export const getMapsEmbedKey = createServerFn({ method: "GET" }).handler(async () => {
  return { key: process.env.GOOGLE_MAPS_API_KEY ?? null };
});
