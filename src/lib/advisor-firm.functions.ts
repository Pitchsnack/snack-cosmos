import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AdvisorFirm } from "@/lib/advisor-firm";

/**
 * Advisor › My Company. Owners (and Control) read and edit their firm
 * profiles through the user's own client, so RLS applies. Verification,
 * credential status and document checks are Admin-only (DB triggers).
 * Files live under advisor/<user>/ in the private startup-media bucket.
 */
const BUCKET = "startup-media";

async function requireAdvisor(sb: any, userId: string) {
  const { data } = await sb.from("users").select("advisor_view").eq("id", userId).maybeSingle();
  if (!data?.advisor_view) throw new Error("The Advisor view is not turned on for your account.");
}

function toFirm(r: any, kids: { fees: any[]; team: any[]; creds: any[]; docs: any[]; reviews: any[] }, urls: Map<string, string>): AdvisorFirm {
  const mine = (rows: any[]) => rows.filter((x) => x.firm_id === r.id);
  const fees: Record<string, string> = {};
  for (const f of mine(kids.fees)) fees[f.service] = f.fee;
  return {
    id: r.id, refNo: r.ref_no, name: r.name, firmType: r.firm_type, logoPath: r.logo_path, logoUrl: r.logo_path ? urls.get(r.logo_path) ?? null : null,
    description: r.description, yearFounded: r.year_founded, city: r.city, country: r.country,
    services: r.services ?? [], fees,
    dealMinUsdM: r.deal_min_usd_m == null ? null : Number(r.deal_min_usd_m), dealMaxUsdM: r.deal_max_usd_m == null ? null : Number(r.deal_max_usd_m),
    teamSize: r.team_size, languages: r.languages ?? [], sectors: r.sectors ?? [],
    legalName: r.legal_name, thaiName: r.thai_name, registrationNo: r.registration_no,
    addrStreet: r.addr_street, addrUnit: r.addr_unit, addrSubdistrict: r.addr_subdistrict, addrDistrict: r.addr_district,
    addrProvince: r.addr_province, addrPostal: r.addr_postal,
    website: r.website, email: r.email, phone: r.phone,
    status: r.status, liveSince: r.live_since, verifiedAt: r.verified_at, updatedAt: r.updated_at,
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

const s = (max: number) => z.string().trim().max(max).nullable().optional().transform((v) => (v ? v : null));
const FirmInput = z.object({
  id: z.string().uuid().nullable(),
  name: z.string().trim().min(1).max(80),
  firmType: z.string().trim().min(1).max(60),
  logoPath: s(300),
  description: z.string().trim().min(1).max(300),
  yearFounded: z.number().int().min(1800).max(2100).nullable(),
  city: z.string().trim().min(1).max(100),
  country: z.string().trim().min(1).max(100),
  services: z.array(z.string().max(60)).min(1).max(10),
  fees: z.record(z.string(), z.string().max(80)),
  dealMinUsdM: z.number().min(0).nullable(),
  dealMaxUsdM: z.number().min(0).nullable(),
  teamSize: z.number().int().min(1).max(100000),
  languages: z.array(z.string().max(40)).max(20),
  sectors: z.array(z.string().max(80)).max(60),
  legalName: z.string().trim().min(1).max(200),
  thaiName: s(200),
  registrationNo: z.string().trim().regex(/^\d{13}$/).nullable().optional().or(z.literal("").transform(() => null)),
  addrStreet: s(200), addrUnit: s(120), addrSubdistrict: s(100), addrDistrict: s(100), addrProvince: s(100), addrPostal: s(10),
  website: s(255), email: z.string().trim().email().max(255), phone: s(40),
  team: z.array(z.object({ id: z.string().uuid().optional(), name: z.string().trim().min(1).max(120), role: s(120), email: s(255) })).max(100),
  credentials: z.array(z.object({ id: z.string().uuid().optional(), name: z.string().trim().min(1).max(160), note: s(300) })).max(100),
  documents: z.array(z.object({ id: z.string().uuid().optional(), path: z.string().max(300), name: z.string().trim().min(1).max(160), type: s(40) })).max(100),
});

export const saveAdvisorFirm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => FirmInput.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await requireAdvisor(sb, context.userId);
    const own = `advisor/${context.userId}/`;
    if (data.logoPath && !data.logoPath.startsWith(own)) throw new Error("Invalid logo file.");
    const row = {
      name: data.name, firm_type: data.firmType, logo_path: data.logoPath, description: data.description,
      year_founded: data.yearFounded, city: data.city, country: data.country, services: data.services,
      deal_min_usd_m: data.dealMinUsdM, deal_max_usd_m: data.dealMaxUsdM, team_size: data.teamSize,
      languages: data.languages, sectors: data.sectors, legal_name: data.legalName, thai_name: data.thaiName,
      registration_no: data.registrationNo ?? null, addr_street: data.addrStreet, addr_unit: data.addrUnit,
      addr_subdistrict: data.addrSubdistrict, addr_district: data.addrDistrict, addr_province: data.addrProvince,
      addr_postal: data.addrPostal, website: data.website, email: data.email, phone: data.phone,
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
    // fees
    await sb.from("advisor_firm_fees").delete().eq("firm_id", id);
    const fees = data.services.filter((sv) => data.fees[sv]?.trim()).map((sv) => ({ firm_id: id, service: sv, fee: data.fees[sv].trim() }));
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
    const { data: cur } = await sb.from("advisor_firms").select("status, live_since").eq("id", data.id).eq("owner_user_id", context.userId).maybeSingle();
    if (!cur) throw new Error("Firm profile not found.");
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

/** Maps Embed key (browser-visible by design). Null when not configured: the map is left out. */
export const getMapsEmbedKey = createServerFn({ method: "GET" }).handler(async () => {
  return { key: process.env.GOOGLE_MAPS_API_KEY ?? null };
});
