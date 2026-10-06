import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
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
  const { data } = await sb.from("users").select("advisor_view").eq("id", userId).maybeSingle();
  if (!data?.advisor_view) throw new Error("The Advisor view is not turned on for your account.");
}

function rowToFee(f: any): FeeDetail {
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

function toFirm(r: any, kids: { fees: any[]; team: any[]; creds: any[]; docs: any[]; reviews: any[] }, urls: Map<string, string>): AdvisorFirm {
  const mine = (rows: any[]) => rows.filter((x) => x.firm_id === r.id);
  const fees: Record<string, string> = {};
  const feeDetails: Record<string, FeeDetail> = {};
  for (const f of mine(kids.fees)) { feeDetails[f.service] = rowToFee(f); if ((r.services ?? []).includes(f.service)) fees[f.service] = f.fee; }
  return {
    id: r.id, refNo: r.ref_no, name: r.name ?? "", firmType: r.firm_type ?? "", logoPath: r.logo_path, logoUrl: r.logo_path ? urls.get(r.logo_path) ?? null : null,
    logoSource: r.logo_source ?? null,
    description: r.description, yearFounded: r.year_founded, city: r.city, country: r.country,
    services: r.services ?? [], fees, feeDetails, dealBand: r.deal_size_band ?? null,
    teamSize: r.team_size, languages: r.languages ?? [], sectors: r.sectors ?? [],
    legalName: r.legal_name, thaiName: r.thai_name, registrationNo: r.registration_no,
    addrStreet: r.addr_street, addrUnit: r.addr_unit, addrDistrict: r.addr_district,
    addrProvince: r.addr_province, addrPostal: r.addr_postal,
    website: r.website, email: r.email, phone: r.phone,
    status: r.status, liveSince: r.live_since, verifiedAt: r.verified_at, updatedAt: r.updated_at,
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
    const paths = [...rows.map((r: any) => r.logo_path), ...(docs.data ?? []).map((d: any) => d.file_path)].filter(Boolean) as string[];
    const urls = new Map<string, string>();
    if (paths.length) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: signed } = await supabaseAdmin.storage.from(BUCKET).createSignedUrls(paths, 3600);
      for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
    }
    const kids = { fees: fees.data ?? [], team: team.data ?? [], creds: creds.data ?? [], docs: docs.data ?? [], reviews: reviews.data ?? [] };
    return rows.map((r: any) => toFirm(r, kids, urls));
  });

/** + Add Firm Profile: a new Draft with the next ADV reference. */
export const createAdvisorDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    await requireAdvisor(sb, context.userId);
    const { data, error } = await sb.from("advisor_firms")
      .insert({ owner_user_id: context.userId, status: "draft", name: "", firm_type: "", country: "Thailand" })
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
      languages: z.array(z.string().max(40)).max(20), email: nz(120), phone: nz(30), logo_path: nz(300), logo_source: z.enum(["upload", "enrich"]).nullable(),
      description: nz(300), setup_answered: z.array(z.string().max(20)).max(20), wizard_state: z.object({ feeVisited: z.boolean().optional(), enrichSig: z.string().optional(), enrich: z.any().optional() }),
    }).partial(),
    fees: z.record(z.string().max(60), FeeIn).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const own = `advisor/${context.userId}/`;
    if (data.patch.logo_path && !data.patch.logo_path.startsWith(own)) throw new Error("Invalid logo file.");
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

const s = (max: number) => z.string().trim().max(max).nullable().optional().transform((v) => (v ? v : null));
const FirmInput = z.object({
  id: z.string().uuid().nullable(),
  name: z.string().trim().min(2).max(80),
  firmType: z.string().trim().min(1).max(60),
  logoPath: s(300),
  logoSource: z.enum(["upload", "enrich"]).nullable(),
  description: z.string().trim().min(30).max(300),
  yearFounded: z.number().int().min(1800).max(new Date().getFullYear()),
  city: z.string().trim().min(2).max(100),
  country: z.string().trim().min(1).max(100),
  services: z.array(z.string().max(60)).min(1).max(10),
  fees: z.record(z.string(), FeeIn),
  dealBand: z.enum(BAND_KEYS).nullable(),
  teamSize: z.number().int().min(1).max(99999),
  languages: z.array(z.string().max(40)).max(20),
  sectors: z.array(z.string().max(80)).max(60),
  legalName: z.string().trim().min(1).max(200),
  thaiName: s(200),
  registrationNo: s(50),
  addrStreet: s(120), addrUnit: s(120), addrDistrict: s(80), addrProvince: s(80), addrPostal: s(12),
  website: z.string().trim().min(3).max(200), email: z.string().trim().email().max(120), phone: z.string().trim().min(9).max(30),
  team: z.array(z.object({ id: z.string().uuid().optional(), name: z.string().trim().min(1).max(120), role: s(120), email: s(255) })).max(100),
  credentials: z.array(z.object({ id: z.string().uuid().optional(), name: z.string().trim().min(1).max(160), note: s(300) })).max(100),
  documents: z.array(z.object({ id: z.string().uuid().optional(), path: z.string().max(300), name: z.string().trim().min(1).max(160), type: s(40) })).max(100),
}).refine((d) => d.country !== "Thailand" || /^\d{13}$/.test(d.registrationNo ?? ""), { message: "The registration number has 13 digits." });

/** Save profile (Review & complete) and Save changes (Edit profile). Both mark the setup as done. */
export const saveAdvisorFirm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => FirmInput.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await requireAdvisor(sb, context.userId);
    const own = `advisor/${context.userId}/`;
    if (data.logoPath && !data.logoPath.startsWith(own)) throw new Error("Invalid logo file.");
    const thai = data.country === "Thailand";
    const row = {
      name: data.name, firm_type: data.firmType, logo_path: data.logoPath, logo_source: data.logoPath ? data.logoSource ?? "upload" : null,
      description: data.description, year_founded: data.yearFounded, city: data.city, country: data.country, services: data.services,
      deal_size_band: data.dealBand, team_size: data.teamSize,
      languages: data.languages, sectors: data.sectors, legal_name: data.legalName, thai_name: data.thaiName,
      registration_no: data.registrationNo ?? null, addr_street: data.addrStreet, addr_unit: data.addrUnit,
      addr_district: thai ? data.addrDistrict : data.city, addr_province: data.addrProvince,
      addr_postal: data.addrPostal, website: data.website, email: data.email, phone: data.phone,
      setup_done_at: new Date().toISOString(),
    };
    let id = data.id;
    if (id) {
      const { error } = await sb.from("advisor_firms").update(row).eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { data: ins, error } = await sb.from("advisor_firms").insert({ ...row, owner_user_id: context.userId, status: "draft" }).select("id").single();
      if (error) throw new Error(error.message);
      id = ins.id as string;
    }
    // fees: only ticked services keep theirs
    await sb.from("advisor_firm_fees").delete().eq("firm_id", id);
    const fees = data.services.map((sv) => feeToRow(id!, sv, data.fees[sv] ?? { type: "quote", amount: "", pct: "", words: "" }));
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
  .inputValidator((d) => z.object({ kind: z.enum(["logo", "doc"]), ext: z.string().regex(/^[a-z0-9]{2,5}$/i) }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdvisor(context.supabase, context.userId);
    const ext = data.ext.toLowerCase();
    const allowed = data.kind === "logo" ? ["png", "jpg", "jpeg", "webp", "svg"] : ["pdf", "docx", "doc", "png", "jpg", "jpeg", "webp"];
    if (!allowed.includes(ext)) throw new Error("This file type isn't allowed.");
    const path = `advisor/${context.userId}/${data.kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: s2, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    return { path, url: s2.signedUrl as string };
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
