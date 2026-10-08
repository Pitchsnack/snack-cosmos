import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Admin › Advisors Directory and Approvals › Advisors. Admin-only; reads and
 * writes with the service client after the Control check. Verification fields
 * are written only here (the DB guard keeps them away from everyone else).
 */

type Ctx = { supabase: any; userId: string };
async function assertAdmin(ctx: Ctx) {
  const { data } = await ctx.supabase.rpc("is_control", { _user_id: ctx.userId });
  if (!data) throw new Error("Admin only");
}
async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}
const fullName = (u: any) => (u ? [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email : null);

export const ADV_FIELDS = ["Legal name", "Registration number", "Business address", "Website", "Email and phone", "Licences and credentials", "Documents", "Services and fees"] as const;
export const ADV_REASONS = ["The registration doesn't match the firm", "The licences can't be verified", "The documents are missing or can't be read", "It isn't a professional firm", "Another reason"] as const;
const FIELDS_TH: Record<string, string> = {
  "Legal name": "ชื่อนิติบุคคล", "Registration number": "เลขทะเบียนนิติบุคคล", "Business address": "ที่อยู่สำนักงาน", Website: "เว็บไซต์",
  "Email and phone": "อีเมลและเบอร์โทรศัพท์", "Licences and credentials": "ใบอนุญาตและคุณวุฒิ", Documents: "เอกสาร", "Services and fees": "บริการและค่าบริการ",
};
void FIELDS_TH;

export type AdminFirm = {
  id: string; ref: string; name: string; firmType: string; city: string | null; country: string | null; description: string | null;
  logoUrl: string | null; status: string; services: string[]; sectors: string[]; sectorAgnostic: boolean; languages: string[];
  yearFounded: number | null; teamSize: number | null; dealBand: string | null; website: string | null; email: string | null; phone: string | null;
  legalName: string | null; thaiName: string | null; registrationNo: string | null; address: string;
  ownerId: string | null; ownerName: string | null; ownerEmail: string | null;
  createdAt: string; updatedAt: string; setupDone: boolean; answered: number;
  v: {
    state: "unverified" | "pending" | "verified" | "more_info" | "declined"; reason: "first_check" | "re_check" | null;
    requestedAt: string | null; assignedId: string | null; assignedName: string | null;
    verifiedAt: string | null; verifiedBy: string | null; snapshot: any;
    moreInfoNote: string | null; moreInfoFields: string[]; moreInfoAt: string | null; moreInfoBy: string | null;
    declineReason: string | null; declineNote: string | null; declinedAt: string | null; declinedBy: string | null;
    checklist: string[]; dbd: { name: string | null; status: string | null; registeredOn: string | null; capital: number | null; checkedAt: string | null };
  };
  fees: { service: string; fee: string }[];
  team: { name: string; role: string | null; email: string | null }[];
  credentials: { id: string; name: string; note: string | null; status: "pending" | "verified" | "rejected"; checkedAt: string | null }[];
  documents: { id: string; name: string; type: string | null; checkedAt: string | null; url: string | null }[];
  reviews: { stars: number; comment: string | null; role: string | null; at: string }[];
};

function addr(r: any) { return [r.addr_unit, r.addr_street, r.addr_subdistrict, r.addr_district, r.addr_province, r.addr_postal].filter(Boolean).join(", "); }

async function loadFirms(sb: any, ids?: string[]): Promise<{ firms: AdminFirm[]; names: Record<string, string> }> {
  let q = sb.from("advisor_firms").select("*").order("updated_at", { ascending: false });
  if (ids) q = q.in("id", ids);
  const { data: rows } = await q;
  const fIds = (rows ?? []).map((r: any) => r.id);
  if (!fIds.length) return { firms: [], names: {} };
  const [fees, team, creds, docs, reviews] = await Promise.all([
    sb.from("advisor_firm_fees").select("*").in("firm_id", fIds),
    sb.from("advisor_firm_team").select("*").in("firm_id", fIds),
    sb.from("advisor_firm_credentials").select("*").in("firm_id", fIds),
    sb.from("advisor_firm_documents").select("*").in("firm_id", fIds),
    sb.from("advisor_firm_reviews").select("*").in("firm_id", fIds),
  ]);
  const people = [...new Set((rows ?? []).flatMap((r: any) => [r.owner_user_id, r.assigned_admin_id, r.verified_by, r.more_info_by, r.declined_by]).filter(Boolean))];
  const { data: us } = people.length ? await sb.from("users").select("id, first_name, last_name, email").in("id", people) : { data: [] };
  const uMap = Object.fromEntries((us ?? []).map((u: any) => [u.id, u]));
  const names = Object.fromEntries((us ?? []).map((u: any) => [u.id, fullName(u)]));
  const paths = [...(rows ?? []).map((r: any) => r.logo_path), ...(docs.data ?? []).map((d: any) => d.file_path)].filter(Boolean);
  const urls: Record<string, string> = {};
  if (paths.length) {
    const { data: s } = await sb.storage.from("startup-media").createSignedUrls(paths, 3600);
    for (const x of s ?? []) if (x.path && x.signedUrl) urls[x.path] = x.signedUrl;
  }
  const of = (list: any[], id: string) => list.filter((x) => x.firm_id === id);
  const firms = (rows ?? []).map((r: any): AdminFirm => ({
    id: r.id, ref: r.ref_no, name: r.name || "Untitled firm", firmType: r.firm_type ?? "", city: r.city, country: r.country, description: r.description,
    logoUrl: r.logo_path ? urls[r.logo_path] ?? null : null, status: r.status, services: r.services ?? [], sectors: r.sectors ?? [], sectorAgnostic: !!r.sector_agnostic,
    languages: r.languages ?? [], yearFounded: r.year_founded, teamSize: r.team_size, dealBand: r.deal_size_band, website: r.website, email: r.email, phone: r.phone,
    legalName: r.legal_name, thaiName: r.thai_name, registrationNo: r.registration_no, address: addr(r),
    ownerId: r.owner_user_id ?? null, ownerName: fullName(uMap[r.owner_user_id]), ownerEmail: uMap[r.owner_user_id]?.email ?? null,
    createdAt: r.created_at, updatedAt: r.updated_at, setupDone: !!r.setup_done_at, answered: (r.setup_answered ?? []).length,
    v: {
      state: r.advisor_verification, reason: r.verification_reason, requestedAt: r.verification_requested_at,
      assignedId: r.assigned_admin_id, assignedName: names[r.assigned_admin_id] ?? null,
      verifiedAt: r.verified_at, verifiedBy: names[r.verified_by] ?? null, snapshot: r.verified_snapshot,
      moreInfoNote: r.more_info_note, moreInfoFields: r.more_info_fields ?? [], moreInfoAt: r.more_info_at, moreInfoBy: names[r.more_info_by] ?? null,
      declineReason: r.decline_reason, declineNote: r.decline_note, declinedAt: r.declined_at, declinedBy: names[r.declined_by] ?? null,
      checklist: r.review_checklist ?? [],
      dbd: { name: r.dbd_name, status: r.dbd_status, registeredOn: r.dbd_registered_on, capital: r.dbd_capital, checkedAt: r.dbd_checked_at },
    },
    fees: of(fees.data ?? [], r.id).filter((f) => (r.services ?? []).includes(f.service)).map((f) => ({ service: f.service, fee: f.fee })),
    team: of(team.data ?? [], r.id).sort((a, b) => a.sort_order - b.sort_order).map((t) => ({ name: t.name, role: t.role, email: t.email })),
    credentials: of(creds.data ?? [], r.id).sort((a, b) => a.sort_order - b.sort_order).map((c) => ({ id: c.id, name: c.name, note: c.note, status: c.status, checkedAt: c.checked_at })),
    documents: of(docs.data ?? [], r.id).map((d) => ({ id: d.id, name: d.name, type: d.doc_type, checkedAt: d.checked_at, url: urls[d.file_path] ?? null })),
    reviews: of(reviews.data ?? [], r.id).map((v) => ({ stars: v.stars, comment: v.comment, role: v.client_role, at: v.created_at })),
  }));
  return { firms, names };
}

/** Every firm profile, for Advisors Directory and Approvals › Advisors. */
export const listAdminAdvisorFirms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as Ctx);
    const sb = await admin();
    const { firms } = await loadFirms(sb);
    const { data: favs } = await sb.from("advisor_favourites").select("item_id").eq("user_id", context.userId).eq("view", "admin").eq("item_kind", "firm");
    return { firms, me: context.userId, favourites: (favs ?? []).map((f: any) => f.item_id) as string[] };
  });

export const advisorVerificationCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: ok } = await (context.supabase as any).rpc("is_control", { _user_id: context.userId });
    if (!ok) return 0;
    const sb = await admin();
    const { count } = await sb.from("advisor_firms").select("id", { count: "exact", head: true }).eq("advisor_verification", "pending");
    return count ?? 0;
  });

async function log(sb: any, firm: any, action: string, actor: string, note?: string | null, extra: Record<string, unknown> = {}) {
  await sb.from("approval_events").insert({ item_type: "advisor", item_id: firm.id, subject_user_id: firm.owner_user_id ?? null, action, actor_id: actor, note: note ?? null, ...extra });
}

async function snapshot(sb: any, f: any) {
  const [{ data: c }, { data: d }] = await Promise.all([
    sb.from("advisor_firm_credentials").select("id, name, note").eq("firm_id", f.id),
    sb.from("advisor_firm_documents").select("id, name, file_path").eq("firm_id", f.id),
  ]);
  return { legal_name: f.legal_name, registration_no: f.registration_no, credentials: c ?? [], documents: d ?? [] };
}

/** Verify · Request more info · Decline · Reopen · Send to verification. */
export const decideAdvisor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    action: z.enum(["verify", "more_info", "decline", "reopen", "send"]),
    note: z.string().max(2000).optional(),
    fields: z.array(z.enum(ADV_FIELDS)).max(8).optional(),
    reason: z.enum(ADV_REASONS).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const sb = await admin();
    const { data: f } = await sb.from("advisor_firms").select("*").eq("id", data.id).single();
    if (!f) throw new Error("Firm not found");
    const now = new Date().toISOString();
    let patch: Record<string, unknown> = {};
    if (data.action === "verify") {
      patch = { advisor_verification: "verified", verification_reason: null, verified_at: now, verified_by: context.userId, verified_snapshot: await snapshot(sb, f), assigned_admin_id: null, more_info_note: null, more_info_fields: [], review_checklist: [] };
    } else if (data.action === "more_info") {
      if (!data.note?.trim()) throw new Error("Write what the firm should fix.");
      if (!data.fields?.length) throw new Error("Pick at least one field to fix.");
      patch = { advisor_verification: "more_info", more_info_note: data.note.trim(), more_info_fields: data.fields, more_info_at: now, more_info_by: context.userId };
    } else if (data.action === "decline") {
      if (!data.reason) throw new Error("Choose a reason.");
      if (data.reason === "Another reason" && !data.note?.trim()) throw new Error("Write the reason in the note.");
      patch = { advisor_verification: "declined", verification_reason: null, decline_reason: data.reason, decline_note: data.note?.trim() || null, declined_at: now, declined_by: context.userId,
        verified_at: null, verified_by: null, verified_snapshot: null, assigned_admin_id: null, review_checklist: [], status: f.status === "live" ? "paused" : f.status };
    } else {
      if (data.action === "reopen" && f.advisor_verification !== "declined") throw new Error("Only a declined firm can be reopened.");
      if (data.action === "send" && f.advisor_verification !== "unverified") throw new Error("Only a firm not verified yet can be sent.");
      patch = { advisor_verification: "pending", verification_reason: "first_check", verification_requested_at: now, decline_reason: null, decline_note: null, declined_at: null, declined_by: null };
    }
    const { error } = await sb.from("advisor_firms").update(patch).eq("id", f.id);
    if (error) throw new Error(error.message);
    const act = { verify: "verified", more_info: "more_info", decline: "declined", reopen: "reopened", send: "sent_to_verification" }[data.action];
    await log(sb, f, act, context.userId, data.action === "decline" ? [data.reason, data.note].filter(Boolean).join(" · ") : data.note, { fields: data.fields ?? [], reasons: data.reason ? [data.reason] : [] });
    if (f.owner_user_id && ["verify", "more_info", "decline"].includes(data.action)) {
      const { sendAlert } = await import("./email-alerts.server");
      const other = data.reason === "Another reason";
      await sendAlert({
        alert: data.action === "verify" ? "approved" : data.action === "more_info" ? "changes_requested" : "declined",
        role: "advisor", userIds: [f.owner_user_id],
        vars: { firm: f.name, fields: (data.fields ?? []).join(", "), reason: other ? (data.note ?? "") : (data.reason ?? "") },
        quote: data.action === "verify" ? null : other ? null : data.note ?? null,
        refKey: `advisor:${f.id}:${act}:${now}`,
      });
      const msg = { verify: ["Your firm is verified", `${f.name} now shows the Verified advisor badge.`], more_info: ["PitchSnack needs more information", data.note ?? ""], decline: ["PitchSnack couldn't verify your firm", data.note || data.reason || ""] }[data.action as "verify"]!;
      await sb.from("notifications").insert({ user_id: f.owner_user_id, notification_type: "approval", title: msg[0], message: msg[1], link_url: "/marketplace/my-company" });
    }
    return { ok: true, hasOwner: !!f.owner_user_id };
  });

/** Mark a licence (verified / rejected / pending) or a document (checked / not). Keeps the snapshot untouched. */
export const markAdvisorItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ kind: z.enum(["credential", "document"]), id: z.string().uuid(), status: z.enum(["pending", "verified", "rejected", "checked", "unchecked"]) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const sb = await admin();
    const now = new Date().toISOString();
    if (data.kind === "credential") {
      const st = data.status === "verified" || data.status === "rejected" ? data.status : "pending";
      await sb.from("advisor_firm_credentials").update({ status: st, checked_at: st === "pending" ? null : now, checked_by: st === "pending" ? null : context.userId }).eq("id", data.id);
    } else {
      const on = data.status === "checked";
      await sb.from("advisor_firm_documents").update({ checked_at: on ? now : null, checked_by: on ? context.userId : null }).eq("id", data.id);
    }
    return { ok: true };
  });

export const assignAdvisorReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const sb = await admin();
    const { data: f } = await sb.from("advisor_firms").update({ assigned_admin_id: context.userId }).eq("id", data.id).select("id, owner_user_id").single();
    await log(sb, f, "assigned", context.userId);
    return { ok: true };
  });

export const saveAdvisorChecklist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), ticks: z.array(z.string().max(120)).max(8) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const sb = await admin();
    await sb.from("advisor_firms").update({ review_checklist: data.ticks }).eq("id", data.id);
    return { ok: true };
  });

/** Company registration check against the DBD registry; the result is stored on the firm. */
export const checkAdvisorDbd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const sb = await admin();
    const { data: f } = await sb.from("advisor_firms").select("id, country, registration_no").eq("id", data.id).single();
    if (f.country && f.country !== "Thailand") return { status: "abroad" as const };
    if (!/^\d{13}$/.test(f.registration_no ?? "")) return { status: "not_found" as const };
    try {
      const { lookupDbdFinancials } = await import("@/lib/financials/dbd-provider.server");
      const r: any = await lookupDbdFinancials({ registeredNumber: f.registration_no });
      const c = r?.company;
      if (!c) return { status: r?.status === "not_found" ? ("not_found" as const) : ("unavailable" as const) };
      const ci = c.companyInfo ?? {};
      await sb.from("advisor_firms").update({
        dbd_name: ci.legalNameEn || ci.legalNameTh || c.registeredName, dbd_status: ci.legalEntityStatusTh ?? c.profile?.status ?? null,
        dbd_registered_on: ci.registrationDate ?? null, dbd_capital: ci.registeredCapitalThb ?? null, dbd_checked_at: new Date().toISOString(),
      }).eq("id", f.id);
      return { status: "ok" as const };
    } catch { return { status: "unavailable" as const }; }
  });

/** Advisor history rows for Approvals › History. */
export const advisorHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as Ctx);
    const sb = await admin();
    const { data } = await sb.from("approval_events").select("*").eq("item_type", "advisor").order("created_at", { ascending: false }).limit(200);
    return data ?? [];
  });
