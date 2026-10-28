/**
 * Browse advisors for sellers and buyers, and the firm's answers. Every status
 * change happens here, after checking who the caller is; the browser never
 * writes these tables directly.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AdvisorFirm, FeeDetail } from "@/lib/advisor-firm";
import { OPEN_STATUSES, proposalFeeWords, reasonText, timingLabel, type ClientSide, type EnquiryState, type Me } from "@/lib/advisor-enquiry";

async function srv() {
  const m = await import("@/lib/advisor-enquiries.server");
  return { ...m, sb: await m.admin() };
}

/** The caller's side and company. Admin may look at either tab but never acts. */
async function whoAmI(sb: any, userId: string, want?: ClientSide) {
  const { roleOf } = await import("@/lib/plan-access.server");
  const role = await roleOf(userId);
  const isAdmin = role === "admin";
  if (!isAdmin && role !== "seller" && role !== "buyer") throw new Error("This page isn't available for your account");
  const side: ClientSide = isAdmin ? (want ?? "seller") : (role as ClientSide);
  const { clientOrg } = await import("@/lib/advisor-enquiries.server");
  const orgId = isAdmin ? null : await clientOrg(sb, userId, side);
  return { isAdmin, side, orgId };
}

async function requireClient(sb: any, userId: string) {
  const w = await whoAmI(sb, userId);
  if (w.isAdmin) throw new Error("Admins can't send enquiries.");
  if (!w.orgId) throw new Error(w.side === "seller" ? "Add your business in My Company first." : "Add your company in My Company first.");
  return w as { isAdmin: false; side: ClientSide; orgId: string };
}

function publicFirm(f: AdvisorFirm): AdvisorFirm {
  // Owner-only parts never leave the server.
  return { ...f, verification: undefined, wizard: {} as any, setupAnswered: [], setupDoneAt: null };
}

/* ─────────────────────────── Browse advisors ─────────────────────────── */

export const browseAdvisors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ side: z.enum(["seller", "buyer"]).optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { sb, statesFor, people, orgInfo } = await srv();
    const w = await whoAmI(sb, context.userId, data.side);
    // One-step approval: only verified firms show in Browse advisors.
    const { data: live } = await sb.from("advisor_firms").select("id").eq("status", "live").eq("advisor_verification", "verified");
    const ids = (live ?? []).map((r: any) => r.id);
    const { loadFirmCards } = await import("@/lib/advisor-firm.functions");
    const { data: owners } = ids.length ? await sb.from("advisor_firms").select("id, owner_user_id").in("id", ids) : { data: [] };
    const managed = await (await import("@/lib/managed.server")).managedFirmIds(sb, owners ?? []);
    const firms = (await loadFirmCards(sb, ids, new Set(), { docs: true })).map(publicFirm).map((f) => ({ ...f, managed: managed.has(f.id) }));
    const states: Record<string, EnquiryState> = w.orgId ? await statesFor(sb, w.side, w.orgId) : {};
    // Your advisors also lists firms no longer live when engaged? Only live firms show on this page.
    const p = (await people(sb, [context.userId]))[context.userId];
    const org = w.orgId ? await orgInfo(sb, w.side, w.orgId) : null;
    const me: Me = { name: p?.name ?? "", first: p?.first ?? "", title: p?.title ?? null, company: org?.name ?? null, email: p?.email ?? null, phone: p?.phone ?? null, side: w.side };
    const { data: u } = await sb.from("users").select("advisors_intro_seen_at").eq("id", context.userId).maybeSingle();
    return { firms, states, me, isAdmin: w.isAdmin, side: w.side, introSeen: w.isAdmin || !!u?.advisors_intro_seen_at, orgDetail: org?.detail ?? null };
  });

export const markAdvisorsIntroSeen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { sb } = await srv();
    await sb.from("users").update({ advisors_intro_seen_at: new Date().toISOString() }).eq("id", context.userId).is("advisors_intro_seen_at", null);
    return { ok: true };
  });

/** One view per user, firm and Bangkok day. */
export const recordFirmView = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ firmId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { sb } = await srv();
    const { data: f } = await sb.from("advisor_firms").select("id, owner_user_id, status").eq("id", data.firmId).maybeSingle();
    if (!f || f.status !== "live" || f.owner_user_id === context.userId) return { ok: false };
    await sb.from("firm_profile_views").upsert({ firm_profile_id: data.firmId, user_id: context.userId }, { onConflict: "firm_profile_id,user_id,day", ignoreDuplicates: true });
    return { ok: true };
  });

/** Advisor › My Company: views in the last 7 days, for the caller's own firms. */
export const myFirmViews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { sb } = await srv();
    const { data: firms } = await sb.from("advisor_firms").select("id").eq("owner_user_id", context.userId);
    const ids = (firms ?? []).map((f: any) => f.id);
    if (!ids.length) return {} as Record<string, number>;
    const since = new Date(Date.now() + 7 * 3600_000 - 6 * 86400_000).toISOString().slice(0, 10);
    const { data: v } = await sb.from("firm_profile_views").select("firm_profile_id").in("firm_profile_id", ids).gte("day", since);
    const out: Record<string, number> = {};
    for (const r of v ?? []) out[r.firm_profile_id] = (out[r.firm_profile_id] ?? 0) + 1;
    return out;
  });

/* ─────────────────────────── The client's moves ─────────────────────────── */

export const sendAdvisorEnquiry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    firmId: z.string().uuid(), service: z.string().min(1).max(60),
    text: z.string().trim().min(30).max(1000), timing: z.enum(["asap", "month", "quarter", "exploring"]).nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { sb, orgUsers, orgInfo, people, bell } = await srv();
    const w = await requireClient(sb, context.userId);
    const { data: firm } = await sb.from("advisor_firms").select("id, name, status, owner_user_id").eq("id", data.firmId).maybeSingle();
    if (!firm || firm.status !== "live") return { ok: false as const, error: `${firm?.name ?? "This firm"} isn't on PitchSnack right now.` };
    const { data: fees } = await sb.from("advisor_firm_fees").select("service").eq("firm_id", firm.id);
    const { data: fr } = await sb.from("advisor_firms").select("services").eq("id", firm.id).maybeSingle();
    const services: string[] = fr?.services?.length ? fr.services : (fees ?? []).map((x: any) => x.service);
    if (!services.includes(data.service)) return { ok: false as const, error: "Choose a service." };
    const { data: open } = await sb.from("advisor_enquiries").select("status").eq("firm_profile_id", firm.id)
      .eq("client_side", w.side).eq("client_org_id", w.orgId).in("status", OPEN_STATUSES).limit(1);
    if (open?.length) return { ok: false as const, error: open[0].status === "engaged" ? `${firm.name} is already your advisor.` : `You already have an open enquiry with ${firm.name}. Open it in Messages.` };
    let { data: conv } = await sb.from("advisor_conversations").select("id").eq("firm_profile_id", firm.id).eq("client_side", w.side).eq("client_org_id", w.orgId).maybeSingle();
    if (!conv) {
      const r = await sb.from("advisor_conversations").insert({ firm_profile_id: firm.id, client_side: w.side, client_org_id: w.orgId }).select("id").single();
      if (r.error) throw new Error(r.error.message);
      conv = r.data;
    }
    const ins = await sb.from("advisor_enquiries").insert({
      firm_profile_id: firm.id, client_org_id: w.orgId, client_side: w.side, sent_by: context.userId,
      service_key: data.service, need_text: data.text, timing: data.timing, status: "enquiry", conversation_id: conv.id,
    }).select("id, created_at").single();
    if (ins.error) {
      if (ins.error.code === "23505") return { ok: false as const, error: `You already have an open enquiry with ${firm.name}. Open it in Messages.` };
      throw new Error(ins.error.message);
    }
    await sb.from("advisor_enquiry_events").insert({ conversation_id: conv.id, enquiry_id: ins.data.id, kind: "enquiry", actor_user_id: context.userId });
    const org = await orgInfo(sb, w.side, w.orgId);
    const me = (await people(sb, [context.userId]))[context.userId];
    const key = `e:${conv.id}`;
    const link = `/advisor/messages?thread=${encodeURIComponent(key)}`;
    await bell(sb, [firm.owner_user_id].filter(Boolean) as string[], `New enquiry from a ${w.side}`, `${me?.name ?? "Someone"} at ${org.name} asked ${firm.name} about ${data.service}.`, link);
    const { sendAlert } = await import("@/lib/email-alerts.server");
    await sendAlert({
      alert: "advisor_new_enquiry", role: "advisor", userIds: [firm.owner_user_id].filter(Boolean) as string[], refKey: ins.data.id,
      vars: { "client company": org.name, "client name": me?.name ?? "", firm: firm.name, service: data.service, "seller | buyer": w.side, thread: key },
      details: [["Service", data.service], ["When", timingLabel(data.timing) ?? "Not said"], ["From", `${me?.name ?? ""} · ${org.name}`]], 
    });
    void orgUsers;
    return { ok: true as const, conversationKey: key, at: ins.data.created_at };
  });

async function clientEnquiry(sb: any, userId: string, enquiryId: string) {
  const w = await requireClient(sb, userId);
  const { data: e } = await sb.from("advisor_enquiries").select("*").eq("id", enquiryId).maybeSingle();
  if (!e || e.client_side !== w.side || e.client_org_id !== w.orgId) throw new Error("This enquiry isn't available");
  const { data: firm } = await sb.from("advisor_firms").select("id, name, owner_user_id").eq("id", e.firm_profile_id).maybeSingle();
  return { w, e, firm };
}

export const acceptAdvisorProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ proposalId: z.string().uuid(), consent: z.literal(true) }).parse(d))
  .handler(async ({ data, context }) => {
    const { sb, sweepExpired, orgInfo, people, bell } = await srv();
    const { data: p } = await sb.from("advisor_proposals").select("*").eq("id", data.proposalId).maybeSingle();
    if (!p) throw new Error("This proposal isn't available");
    const { e, firm, w } = await clientEnquiry(sb, context.userId, p.enquiry_id);
    await sweepExpired(sb, [e.id]);
    const { data: p2 } = await sb.from("advisor_proposals").select("status").eq("id", p.id).single();
    if (p2.status !== "open" || e.status !== "proposal") return { ok: false as const, error: p2.status === "expired" ? "This proposal has expired." : "This proposal can't be accepted any more." };
    const org = await orgInfo(sb, w.side, w.orgId);
    const me = (await people(sb, [context.userId]))[context.userId];
    const consent = `I accept this proposal on behalf of ${org.name}. Accepting as ${[me?.name, me?.title].filter(Boolean).join(", ")}.`;
    const now = new Date().toISOString();
    const up = await sb.from("advisor_proposals").update({ status: "accepted", answered_by: context.userId, answered_at: now, consent_text: consent }).eq("id", p.id).eq("status", "open").select("id");
    if (!up.data?.length) return { ok: false as const, error: "This proposal can't be accepted any more." };
    await sb.from("advisor_enquiries").update({ status: "engaged", engaged_at: now }).eq("id", e.id);
    await sb.from("advisor_enquiry_events").insert({ conversation_id: e.conversation_id, enquiry_id: e.id, kind: "accepted", ref_id: p.id, actor_user_id: context.userId, data: { consent, by: me?.name ?? null } });
    const link = `/advisor/messages?thread=${encodeURIComponent(`e:${e.conversation_id}`)}`;
    await bell(sb, [firm.owner_user_id].filter(Boolean) as string[], "Your proposal was accepted", `${org.name} accepted your proposal for ${p.service_key}. You're now their advisor.`, link);
    const { sendAlert } = await import("@/lib/email-alerts.server");
    await sendAlert({
      alert: "advisor_proposal_accepted", role: "advisor", userIds: [firm.owner_user_id].filter(Boolean) as string[], refKey: p.id,
      vars: { "client company": org.name, service: p.service_key, firm: firm.name, fee: p.fee_text, thread: `e:${e.conversation_id}` },
      details: [["Client", `${org.name} · ${w.side}`], ["Fee", p.fee_text]], 
    });
    return { ok: true as const, firm: firm.name };
  });

export const declineAdvisorProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ proposalId: z.string().uuid(), note: z.string().trim().max(500).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { sb, sweepExpired, orgInfo, bell } = await srv();
    const { data: p } = await sb.from("advisor_proposals").select("*").eq("id", data.proposalId).maybeSingle();
    if (!p) throw new Error("This proposal isn't available");
    const { e, firm, w } = await clientEnquiry(sb, context.userId, p.enquiry_id);
    await sweepExpired(sb, [e.id]);
    const now = new Date().toISOString();
    const up = await sb.from("advisor_proposals").update({ status: "declined", answered_by: context.userId, answered_at: now }).eq("id", p.id).eq("status", "open").select("id");
    if (!up.data?.length) return { ok: false as const, error: "This proposal can't be declined any more." };
    await sb.from("advisor_enquiries").update({ status: "talking" }).eq("id", e.id).eq("status", "proposal");
    await sb.from("advisor_enquiry_events").insert({ conversation_id: e.conversation_id, enquiry_id: e.id, kind: "proposal_declined", ref_id: p.id, actor_user_id: context.userId });
    const key = `e:${e.conversation_id}`;
    if (data.note) await sb.from("marketplace_messages").insert({ thread_key: key, sender_id: context.userId, body: data.note, created_at: new Date(Date.now() + 5).toISOString() });
    const org = await orgInfo(sb, w.side, w.orgId);
    await bell(sb, [firm.owner_user_id].filter(Boolean) as string[], "Proposal declined", `${org.name} declined your proposal for ${p.service_key}.`, `/advisor/messages?thread=${encodeURIComponent(key)}`);
    return { ok: true as const, firm: firm.name };
  });

export const completeAdvisorWork = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ enquiryId: z.string().uuid(), stars: z.number().int().min(1).max(5), comment: z.string().trim().max(500).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { sb, orgInfo, bell } = await srv();
    const { e, firm, w } = await clientEnquiry(sb, context.userId, data.enquiryId);
    if (e.status !== "engaged") return { ok: false as const, error: "This work can't be marked as done." };
    const org = await orgInfo(sb, w.side, w.orgId);
    const now = new Date().toISOString();
    const up = await sb.from("advisor_enquiries").update({ status: "done", done_at: now }).eq("id", e.id).eq("status", "engaged").select("id");
    if (!up.data?.length) return { ok: false as const, error: "This work can't be marked as done." };
    const r = await sb.from("advisor_firm_reviews").insert({
      firm_id: e.firm_profile_id, client_user_id: context.userId, client_role: w.side, client_detail: org.detail,
      service: e.service_key, stars: data.stars, comment: data.comment || null, enquiry_id: e.id,
    });
    if (r.error) throw new Error(r.error.code === "23505" ? "This engagement already has a review." : r.error.message);
    await sb.from("advisor_enquiry_events").insert({ conversation_id: e.conversation_id, enquiry_id: e.id, kind: "done", actor_user_id: context.userId, data: { stars: data.stars } });
    await bell(sb, [firm.owner_user_id].filter(Boolean) as string[], "New client review", `${org.name} rated your work ${data.stars} ★.`, "/marketplace/my-company");
    return { ok: true as const, firm: firm.name };
  });

/** Engaged / done firms of the caller's company, for Introduce advisor. */
export const myEngagedAdvisors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { sb } = await srv();
    let w;
    try { w = await requireClient(sb, context.userId); } catch { return []; }
    const { data: es } = await sb.from("advisor_enquiries").select("firm_profile_id, status, service_key, engaged_at, created_at")
      .eq("client_side", w.side).eq("client_org_id", w.orgId).in("status", ["engaged", "done"]).order("created_at", { ascending: false });
    const by = new Map<string, any>();
    for (const e of es ?? []) { const cur = by.get(e.firm_profile_id); if (!cur || (cur.status !== "engaged" && e.status === "engaged")) by.set(e.firm_profile_id, e); }
    if (!by.size) return [];
    const { data: fs } = await sb.from("advisor_firms").select("id, name, ref_no, logo_path, verified_at, status").in("id", [...by.keys()]).eq("status", "live");
    const paths = (fs ?? []).map((f: any) => f.logo_path).filter(Boolean);
    const urls = new Map<string, string>();
    if (paths.length) {
      const { data: s } = await sb.storage.from("startup-media").createSignedUrls(paths, 3600);
      for (const x of s ?? []) if (x.path && x.signedUrl) urls.set(x.path, x.signedUrl);
    }
    return (fs ?? []).map((f: any) => {
      const e = by.get(f.id);
      return { id: f.id, name: f.name, refNo: f.ref_no, logoUrl: f.logo_path ? urls.get(f.logo_path) ?? null : null, verified: !!f.verified_at, status: e.status as "engaged" | "done", service: e.service_key as string, since: e.engaged_at as string | null };
    }).sort((a: any, b: any) => (a.status === b.status ? a.name.localeCompare(b.name) : a.status === "engaged" ? -1 : 1));
  });

/* ─────────────────────────── The firm's moves ─────────────────────────── */

async function firmEnquiry(sb: any, userId: string, enquiryId: string) {
  const { data: e } = await sb.from("advisor_enquiries").select("*").eq("id", enquiryId).maybeSingle();
  if (!e) throw new Error("This enquiry isn't available");
  const { data: firm } = await sb.from("advisor_firms").select("id, name, owner_user_id, services").eq("id", e.firm_profile_id).maybeSingle();
  if (!firm || firm.owner_user_id !== userId) throw new Error("This enquiry isn't available");
  return { e, firm };
}

const feeSchema = z.object({ type: z.enum(["fixed", "hourly", "retainer", "success", "retainer_success", "other"]), amount: z.string().max(12), pct: z.string().max(12), words: z.string().max(80) });

export const sendAdvisorProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    enquiryId: z.string().uuid(), service: z.string().min(1).max(60), scope: z.string().trim().min(30).max(1000),
    fee: feeSchema, timing: z.string().trim().max(60).optional(), validDays: z.union([z.literal(7), z.literal(14), z.literal(30)]),
    letter: z.object({ path: z.string().max(400), name: z.string().max(200), size: z.number().int().min(1).max(10 * 1024 * 1024) }).nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { sb, orgUsers, orgInfo, bell, sweepExpired } = await srv();
    const { e, firm } = await firmEnquiry(sb, context.userId, data.enquiryId);
    await sweepExpired(sb, [e.id]);
    const { data: e2 } = await sb.from("advisor_enquiries").select("status").eq("id", e.id).single();
    if (!["enquiry", "talking", "proposal"].includes(e2.status)) return { ok: false as const, error: "This enquiry is closed." };
    if (!(firm.services ?? []).includes(data.service)) return { ok: false as const, error: "Choose a service." };
    const words = proposalFeeWords(data.fee as FeeDetail);
    if (!words) return { ok: false as const, error: "Add how you charge." };
    if (data.letter && !data.letter.path.startsWith(`${firm.id}/proposals/`)) throw new Error("Invalid file");
    const { parsePct } = await import("@/lib/advisor-firm");
    const pct = parsePct(data.fee.pct);
    const valid = new Date(Date.now() + 7 * 3600_000 + data.validDays * 86400_000).toISOString().slice(0, 10);
    await sb.from("advisor_proposals").update({ status: "replaced" }).eq("enquiry_id", e.id).eq("status", "open");
    const ins = await sb.from("advisor_proposals").insert({
      enquiry_id: e.id, service_key: data.service, scope: data.scope, fee_type: data.fee.type,
      amount_thb: /^\d+$/.test(data.fee.amount) ? Number(data.fee.amount) : null, pct_min: pct?.min ?? null, pct_max: pct?.max ?? null,
      own_words: data.fee.type === "other" ? data.fee.words.trim() : null, fee_text: words, timing: data.timing || null,
      valid_until: valid, letter_file: data.letter, sent_by: context.userId,
    }).select("id").single();
    if (ins.error) throw new Error(ins.error.message);
    await sb.from("advisor_enquiries").update({ status: "proposal" }).eq("id", e.id);
    await sb.from("advisor_enquiry_events").insert({ conversation_id: e.conversation_id, enquiry_id: e.id, kind: "proposal", ref_id: ins.data.id, actor_user_id: context.userId });
    const users = await orgUsers(sb, e.client_side, e.client_org_id);
    const org = await orgInfo(sb, e.client_side, e.client_org_id);
    const link = `/marketplace/advisors?firm=${firm.id}`;
    await bell(sb, users, `You have a proposal from ${firm.name}`, `${firm.name} sent you a proposal for ${data.service}.`, link);
    const { sendAlert } = await import("@/lib/email-alerts.server");
    await sendAlert({
      alert: "advisor_proposal", role: e.client_side, userIds: users, refKey: ins.data.id,
      vars: { firm: firm.name, service: data.service, fee: words, date: valid, firmId: firm.id },
      details: [["Service", data.service], ["Fee", words], ["Valid until", valid]], 
    });
    return { ok: true as const, client: org.name };
  });

export const declineAdvisorEnquiry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ enquiryId: z.string().uuid(), reason: z.enum(["no_service", "booked", "deal_size", "other"]), note: z.string().trim().max(500).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { sb, orgUsers, orgInfo, bell, sweepExpired } = await srv();
    const { e, firm } = await firmEnquiry(sb, context.userId, data.enquiryId);
    await sweepExpired(sb, [e.id]);
    const now = new Date().toISOString();
    const up = await sb.from("advisor_enquiries").update({ status: "declined", declined_reason: data.reason, declined_at: now })
      .eq("id", e.id).in("status", ["enquiry", "talking", "proposal"]).select("id");
    if (!up.data?.length) return { ok: false as const, error: "This enquiry can't be declined any more." };
    await sb.from("advisor_proposals").update({ status: "replaced" }).eq("enquiry_id", e.id).eq("status", "open");
    await sb.from("advisor_enquiry_events").insert({ conversation_id: e.conversation_id, enquiry_id: e.id, kind: "declined", actor_user_id: context.userId, data: { reason: data.reason } });
    const key = `e:${e.conversation_id}`;
    if (data.note) await sb.from("marketplace_messages").insert({ thread_key: key, sender_id: context.userId, body: data.note, created_at: new Date(Date.now() + 5).toISOString() });
    const users = await orgUsers(sb, e.client_side, e.client_org_id);
    const org = await orgInfo(sb, e.client_side, e.client_org_id);
    const reason = reasonText(data.reason).toLowerCase();
    await bell(sb, users, `${firm.name} declined your enquiry`, `${firm.name} declined your enquiry about ${e.service_key}: ${reason}.`, "/marketplace/advisors");
    const { sendAlert } = await import("@/lib/email-alerts.server");
    await sendAlert({
      alert: "advisor_enquiry_declined", role: e.client_side, userIds: users, refKey: e.id,
      vars: { firm: firm.name, service: e.service_key, reason },
      details: [["Firm", firm.name], ["Service", e.service_key]],
    });
    return { ok: true as const, client: org.name };
  });

/** Upload URL for a proposal's engagement letter (PDF, firm owner only). */
export const createProposalLetterUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ enquiryId: z.string().uuid(), size: z.number().int().min(1).max(10 * 1024 * 1024) }).parse(d))
  .handler(async ({ data, context }) => {
    const { sb } = await srv();
    const { firm } = await firmEnquiry(sb, context.userId, data.enquiryId);
    const path = `${firm.id}/proposals/${crypto.randomUUID()}.pdf`;
    const { data: s, error } = await sb.storage.from("startup-media").createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    return { path, url: s.signedUrl as string, token: s.token as string };
  });

/** Signed link to a proposal's letter, for either side of the conversation. */
export const openProposalLetter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ proposalId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { sb, enquiryMember } = await srv();
    const { data: p } = await sb.from("advisor_proposals").select("enquiry_id, letter_file").eq("id", data.proposalId).maybeSingle();
    if (!p?.letter_file) throw new Error("No letter");
    const { data: e } = await sb.from("advisor_enquiries").select("conversation_id").eq("id", p.enquiry_id).single();
    const m = await enquiryMember(sb, context.userId, `e:${e.conversation_id}`);
    if (!m) throw new Error("Not available");
    const { data: s } = await sb.storage.from("startup-media").createSignedUrl(p.letter_file.path, 600);
    return { url: s?.signedUrl ?? null };
  });

