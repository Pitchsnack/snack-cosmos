import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Advisor › My Pipeline, and the seller's/buyer's side of it (Introduce
 * advisor, the advisor NDA, Advisor profile). Reads use the service client
 * only after the caller's role on the deal is checked; advisors get dates,
 * names and step texts only.
 */
const Side = z.enum(["seller", "buyer"]);
type Side = z.infer<typeof Side>;

async function srv() { return import("./advisor-pipeline.server"); }

async function requireAdvisorView(sb: any, userId: string) {
  const { data } = await sb.from("users").select("advisor_view").eq("id", userId).maybeSingle();
  if (!data?.advisor_view) throw new Error("The Advisor view is not turned on for your account.");
}
async function myFirmIds(sb: any, userId: string) {
  const { data } = await sb.from("advisor_firms").select("id, name, ref_no").eq("owner_user_id", userId);
  return (data ?? []) as { id: string; name: string; ref_no: string | null }[];
}

export type AdvClient = { key: string; name: string; side: Side };
export type AdvOther = { name: string; sub: string };
export type AdvInvitation = {
  id: string; dealId: string; side: Side; client: AdvClient; other: AdvOther; firm: { id: string; name: string };
  invitedBy: string; invitedAt: string; ndaAt: string | null; reportAt: string | null; loiAt: string | null; exclusivityUntil: string | null;
};
export type AdvDeal = AdvInvitation & {
  joinedAt: string; legalAt: string | null; spaAt: string | null; paymentAt: string | null; updatedAt: string;
  buyerName: string; wait: { who: "you" | "client" | "other"; what: string } | null; legalTask: string | null;
};

/** Advisor: every waiting invitation and joined deal across the caller's firm profiles. */
export const listAdvisorPipeline = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const S = await srv();
    const sb = await S.admin();
    await requireAdvisorView(sb, context.userId);
    const firms = await myFirmIds(sb, context.userId);
    const me = (await S.userNames(sb, [context.userId]))[context.userId] ?? { name: "You", title: null };
    if (!firms.length) return { me, invitations: [] as AdvInvitation[], deals: [] as AdvDeal[] };
    const fIds = firms.map((f) => f.id);
    const fMap = Object.fromEntries(firms.map((f) => [f.id, f]));
    const [{ data: invs }, { data: das }] = await Promise.all([
      sb.from("advisor_invitations").select("*").in("firm_profile_id", fIds).eq("status", "waiting").order("invited_at", { ascending: false }),
      sb.from("deal_advisors").select("*").in("firm_profile_id", fIds),
    ]);
    const dealIds = [...new Set([...(invs ?? []), ...(das ?? [])].map((x: any) => x.deal_id))];
    if (!dealIds.length) return { me, invitations: [], deals: [] };
    const { data: deals } = await sb.from("deal_pipelines").select("id, hidden_profile_id, startup_id, buyer_user_id, status, nda_approved_at, report_shared_at, loi_accepted_at, exclusivity_until, contact_at, legal_at, spa_at, payment_at, updated_at, wait_kind, wait_task").in("id", dealIds);
    const dMap = Object.fromEntries((deals ?? []).map((d: any) => [d.id, d]));
    // First report shared date only (never which report or its contents).
    const { data: shares } = await sb.from("report_shares").select("pipeline_id, shared_at").in("pipeline_id", dealIds).order("shared_at");
    const firstShare: Record<string, string> = {};
    for (const s of shares ?? []) if (!firstShare[s.pipeline_id]) firstShare[s.pipeline_id] = s.shared_at;
    const parties = await S.dealParties(sb, deals ?? []);
    const allInv = [...(invs ?? [])];
    const invIdsForDeals = (das ?? []).map((x: any) => x.invitation_id).filter(Boolean);
    const { data: joinedInvs } = invIdsForDeals.length ? await sb.from("advisor_invitations").select("id, invited_by").in("id", invIdsForDeals) : { data: [] };
    const names = await S.userNames(sb, [...new Set([...allInv.map((i: any) => i.invited_by), ...(joinedInvs ?? []).map((i: any) => i.invited_by)])] as string[]);
    const invBy = Object.fromEntries((joinedInvs ?? []).map((i: any) => [i.id, i.invited_by]));

    const base = (dealId: string, side: Side, firmId: string, invitedBy: string, invitedAt: string, id: string): AdvInvitation | null => {
      const d = dMap[dealId]; if (!d) return null;
      const pp = parties[dealId]!;
      const c = pp[side], o = pp[side === "seller" ? "buyer" : "seller"];
      return {
        id, dealId, side, client: { key: c.key, name: c.name, side }, other: { name: o.name, sub: o.sub },
        firm: { id: firmId, name: fMap[firmId]?.name ?? "Your firm" },
        invitedBy: names[invitedBy]?.name ?? "Someone", invitedAt,
        ndaAt: d.nda_approved_at, reportAt: firstShare[dealId] ?? null, loiAt: d.loi_accepted_at, exclusivityUntil: d.exclusivity_until,
      };
    };
    const invitations = (invs ?? []).map((i: any) => base(i.deal_id, i.side, i.firm_profile_id, i.invited_by, i.invited_at, i.id)).filter(Boolean) as AdvInvitation[];
    const deals2: AdvDeal[] = [];
    for (const a of das ?? []) {
      const b = base(a.deal_id, a.side, a.firm_profile_id, invBy[a.invitation_id] ?? "", a.joined_at, a.invitation_id ?? a.id);
      const d = dMap[a.deal_id];
      if (!b || !d || ["declined", "withdrawn"].includes(d.status)) continue;
      const w = S.dealWait(d);
      const wait = !w ? null : w.side === a.side
        ? { who: (w.kind === "work" ? "you" : "client") as "you" | "client", what: w.kind === "work" ? w.own : w.own.replace(/\byour\b/g, "their") }
        : { who: "other" as const, what: w.others };
      deals2.push({
        ...b, joinedAt: a.joined_at, legalAt: d.legal_at, spaAt: d.spa_at, paymentAt: d.payment_at, updatedAt: d.updated_at,
        buyerName: parties[a.deal_id]!.buyer.name, wait, legalTask: d.wait_task ?? null,
      });
    }
    return { me, invitations, deals: deals2 };
  });

/** Advisor menu badge: invitations + deals, across every client. */
export const advisorPipelineCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const S = await srv();
    const sb = await S.admin();
    const firms = await myFirmIds(sb, context.userId);
    if (!firms.length) return 0;
    const ids = firms.map((f) => f.id);
    const [{ count: a }, { count: b }] = await Promise.all([
      sb.from("advisor_invitations").select("id", { count: "exact", head: true }).in("firm_profile_id", ids).eq("status", "waiting"),
      sb.from("deal_advisors").select("id", { count: "exact", head: true }).in("firm_profile_id", ids),
    ]);
    return (a ?? 0) + (b ?? 0);
  });

/** Advisor: what an invitation link should open. */
export const advisorInvitationStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const S = await srv();
    const sb = await S.admin();
    const ids = (await myFirmIds(sb, context.userId)).map((f) => f.id);
    const { data: inv } = await sb.from("advisor_invitations").select("status, deal_id, firm_profile_id").eq("id", data.id).maybeSingle();
    if (!inv || !ids.includes(inv.firm_profile_id)) return { status: "gone" as const, dealId: null };
    return { status: inv.status as string, dealId: inv.status === "joined" ? inv.deal_id : null };
  });

async function loadInvitationForAdvisor(sb: any, userId: string, id: string) {
  const { data: inv } = await sb.from("advisor_invitations").select("*").eq("id", id).maybeSingle();
  if (!inv) throw new Error("Invitation not found");
  const { data: firm } = await sb.from("advisor_firms").select("id, name, ref_no, owner_user_id").eq("id", inv.firm_profile_id).maybeSingle();
  if (!firm || firm.owner_user_id !== userId) throw new Error("Not your invitation");
  const { data: deal } = await sb.from("deal_pipelines").select("*").eq("id", inv.deal_id).single();
  return { inv, firm, deal };
}

/** Advisor signs the advisor NDA and joins the deal. */
export const joinAdvisorDeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), consent: z.string().min(10).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    const S = await srv();
    const sb = await S.admin();
    const { inv, firm, deal } = await loadInvitationForAdvisor(sb, context.userId, data.id);
    const parties = (await S.dealParties(sb, [deal]))[deal.id]!;
    const side = inv.side as Side, other = S.otherSide(side);
    const client = parties[side].name, otherName = parties[other].name;
    if (inv.status !== "waiting") return { ok: false as const, reason: "withdrawn" as const, client };
    const { data: onDeal } = await sb.from("deal_advisors").select("side, firm_profile_id").eq("deal_id", deal.id);
    if ((onDeal ?? []).some((x: any) => x.firm_profile_id === firm.id)) return { ok: false as const, reason: "other_side" as const, client, other: otherName };
    const me = (await S.userNames(sb, [context.userId]))[context.userId];
    const now = new Date();
    const exp = new Date(now.getTime() + 730 * 86_400_000);
    const { advisorNdaText } = await import("@/config/advisor-nda");
    const text = advisorNdaText({ firm: firm.name, firmRef: firm.ref_no, seller: parties.seller.name, buyer: parties.buyer.name, client, signer: [me?.name, me?.title].filter(Boolean).join(", "), signedAt: now, expiresAt: exp });
    const { data: nda, error: e1 } = await sb.from("advisor_ndas").insert({
      deal_id: deal.id, firm_profile_id: firm.id, client_side: side, seller_org_id: deal.startup_id, buyer_org_id: deal.buyer_user_id,
      signed_by: context.userId, signer_name: me?.name ?? null, signer_title: me?.title ?? null, consent_text: data.consent,
      signed_at: now.toISOString(), expires_at: exp.toISOString(), nda_text: text,
    }).select("id").single();
    if (e1) throw new Error(e1.message);
    // Claim the invitation only if it is still waiting (a withdrawal in between wins).
    const { data: claimed } = await sb.from("advisor_invitations").update({ status: "joined", answered_by: context.userId, answered_at: now.toISOString() }).eq("id", inv.id).eq("status", "waiting").select("id");
    if (!claimed?.length) { await sb.from("advisor_ndas").delete().eq("id", nda.id); return { ok: false as const, reason: "withdrawn" as const, client }; }
    const { error: e2 } = await sb.from("deal_advisors").insert({ deal_id: deal.id, side, firm_profile_id: firm.id, advisor_user_id: context.userId, joined_at: now.toISOString(), invitation_id: inv.id, advisor_nda_id: nda.id });
    if (e2) {
      await sb.from("advisor_invitations").update({ status: "waiting", answered_by: null, answered_at: null }).eq("id", inv.id);
      await sb.from("advisor_ndas").delete().eq("id", nda.id);
      return { ok: false as const, reason: "other_side" as const, client, other: otherName };
    }
    // First advisor on a deal at Contact M&A: Contact M&A is done today, Legal starts with the buyer's questions.
    if (!(onDeal ?? []).length && deal.contact_at && !deal.legal_at) {
      await sb.from("deal_pipelines").update({ contact_at: now.toISOString(), wait_task: "legal_questions", wait_kind: "work" }).eq("id", deal.id);
    }
    await sb.from("deal_pipeline_events").insert({ pipeline_id: deal.id, event: "advisor_joined", actor_id: context.userId, note: `${firm.name} for ${client}` });
    // The same firm's invitation from the other side is declined at once.
    const { data: dup } = await sb.from("advisor_invitations").update({ status: "declined", answered_by: context.userId, answered_at: now.toISOString() })
      .eq("deal_id", deal.id).eq("firm_profile_id", firm.id).eq("side", other).eq("status", "waiting").select("id");
    const { sendAlert } = await import("./email-alerts.server");
    const [clientUsers, otherUsers] = await Promise.all([S.sideUsers(sb, deal, side), S.sideUsers(sb, deal, other)]);
    const details: [string, string][] = [["Advisor", `${firm.name} · ${me?.name ?? ""}`], ["NDA signed", S.fmtDay(now)], ["Valid until", S.fmtDay(exp)]];
    const link = `/marketplace/pipeline?deal=${deal.id}&nda=advisor`;
    await Promise.all([
      sendAlert({ alert: "advisor_joined", role: side, userIds: clientUsers, vars: { firm: firm.name, "other side": otherName }, details, refKey: `${nda.id}:client` }),
      sendAlert({ alert: "advisor_joined_other", role: other, userIds: otherUsers, vars: { firm: firm.name, client }, details, refKey: `${nda.id}:other` }),
      S.bell(sb, clientUsers, "Your advisor joined the deal", `${firm.name} joined your deal with ${otherName}. They signed an NDA with you and ${otherName}.`, link),
      S.bell(sb, otherUsers, "An advisor joined your deal", `${client} brought in ${firm.name} as its advisor on your deal. They signed an NDA with you and ${client}.`, link),
    ]);
    if (dup?.length) {
      await sendAlert({ alert: "advisor_declined", role: other, userIds: otherUsers, vars: { firm: firm.name, "other side": client }, details: [["Advisor", firm.name]], refKey: `${dup[0].id}:declined` });
      await S.bell(sb, otherUsers, "Your advisor declined", `${firm.name} declined your invitation to the deal with ${client}. You can invite another advisor from Pipeline.`, `/marketplace/pipeline?deal=${deal.id}`);
    }
    return { ok: true as const, client, other: otherName, alsoDeclined: !!dup?.length };
  });

/** Advisor declines an invitation. */
export const declineAdvisorInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const S = await srv();
    const sb = await S.admin();
    const { inv, firm, deal } = await loadInvitationForAdvisor(sb, context.userId, data.id);
    const parties = (await S.dealParties(sb, [deal]))[deal.id]!;
    const side = inv.side as Side;
    const client = parties[side].name, otherName = parties[S.otherSide(side)].name;
    const { data: done } = await sb.from("advisor_invitations").update({ status: "declined", answered_by: context.userId, answered_at: new Date().toISOString() }).eq("id", inv.id).eq("status", "waiting").select("id");
    if (!done?.length) return { ok: false as const, client };
    const users = await S.sideUsers(sb, deal, side);
    const { sendAlert } = await import("./email-alerts.server");
    await sendAlert({ alert: "advisor_declined", role: side, userIds: users, vars: { firm: firm.name, "other side": otherName }, details: [["Advisor", firm.name]], refKey: `${inv.id}:declined` });
    await S.bell(sb, users, "Your advisor declined", `${firm.name} declined your invitation to the deal with ${otherName}. You can invite another advisor from Pipeline.`, `/marketplace/pipeline?deal=${deal.id}`);
    return { ok: true as const, client };
  });

/** Advisor: History of a joined deal — step changes and the advisor NDA only, from the day they joined. */
export const advisorDealHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ dealId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const S = await srv();
    const sb = await S.admin();
    const ids = (await myFirmIds(sb, context.userId)).map((f) => f.id);
    const { data: da } = ids.length ? await sb.from("deal_advisors").select("joined_at").eq("deal_id", data.dealId).in("firm_profile_id", ids).maybeSingle() : { data: null };
    if (!da) throw new Error("Not your deal");
    const { data: ev } = await sb.from("deal_pipeline_events").select("event, created_at").eq("pipeline_id", data.dealId)
      .in("event", ["advisor_joined", "legal_shared", "spa_shared", "payment_shared"]).gte("created_at", da.joined_at).order("created_at", { ascending: false });
    return (ev ?? []) as { event: string; created_at: string }[];
  });

/** Advisor: the other side's profile, read-only, for a joined deal. */
export const advisorOtherProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ dealId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const S = await srv();
    const sb = await S.admin();
    const ids = (await myFirmIds(sb, context.userId)).map((f) => f.id);
    const { data: da } = ids.length ? await sb.from("deal_advisors").select("side").eq("deal_id", data.dealId).in("firm_profile_id", ids).maybeSingle() : { data: null };
    if (!da) throw new Error("Not your deal");
    const { data: deal } = await sb.from("deal_pipelines").select("*").eq("id", data.dealId).single();
    const { buildNoteProfile } = await import("./private-notes.functions");
    // The other side buys → its investor profile; the other side sells → its seller profile.
    const r = await buildNoteProfile(sb, deal, da.side === "seller" ? "seller_on_buyer" : "buyer_on_seller");
    // Profile facts only: the deal figures (price, stake, deal type, reason) never reach the advisor.
    const { askingPrice: _a, stake: _s, dealType: _d, reason: _r, ...g } = r.generated as Record<string, string | null>;
    return { otherIsBuyer: da.side === "seller", name: r.name, sub: r.sub, logoUrl: r.logoUrl, verified: r.verified, codeName: r.codeName, contact: r.contact, fields: g };
  });

/* ---------------- seller / buyer side ---------------- */

async function partyDeal(ctx: { supabase: any; userId: string }, dealId: string) {
  const S = await srv();
  const sb = await S.admin();
  const { data: deal } = await sb.from("deal_pipelines").select("*").eq("id", dealId).maybeSingle();
  if (!deal) throw new Error("Deal not found");
  const side = await S.callerSide(ctx.supabase, ctx.userId, deal);
  if (!side) throw new Error("Not your deal");
  return { S, sb, deal, side };
}

/** Live firm profiles for Introduce advisor (up to 8). */
export const searchAdvisorFirms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ dealId: z.string().uuid(), q: z.string().max(80) }).parse(d))
  .handler(async ({ data, context }) => {
    const { sb, side } = await partyDeal(context, data.dealId);
    const q = data.q.trim().replace(/[%,()]/g, "");
    if (!q) return [];
    const { data: rows } = await sb.from("advisor_firms").select("id, name, ref_no, firm_type, city, logo_path, verified_at")
      .eq("status", "live").or(`name.ilike.%${q}%,ref_no.ilike.%${q}%`).order("name").limit(8);
    const { data: onDeal } = await sb.from("deal_advisors").select("firm_profile_id, side").eq("deal_id", data.dealId);
    const busy = new Set((onDeal ?? []).filter((x: any) => x.side !== side).map((x: any) => x.firm_profile_id));
    const paths = (rows ?? []).map((r: any) => r.logo_path).filter(Boolean);
    const urls: Record<string, string> = {};
    if (paths.length) {
      const { data: s } = await sb.storage.from("startup-media").createSignedUrls(paths, 3600);
      for (const x of s ?? []) if (x.path && x.signedUrl) urls[x.path] = x.signedUrl;
    }
    return (rows ?? []).map((r: any) => ({ id: r.id, name: r.name, ref: r.ref_no, type: r.firm_type, city: r.city, logoUrl: r.logo_path ? urls[r.logo_path] ?? null : null, verified: !!r.verified_at, advisesOther: busy.has(r.id) }));
  });

export const inviteAdvisor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ dealId: z.string().uuid(), firmId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { S, sb, deal, side } = await partyDeal(context, data.dealId);
    if (!deal.loi_accepted_at) throw new Error("Invite an advisor once the letter of intent is signed.");
    if (deal.payment_at) throw new Error("This deal is complete.");
    const { data: firm } = await sb.from("advisor_firms").select("id, name, owner_user_id, status").eq("id", data.firmId).maybeSingle();
    if (!firm || firm.status !== "live") throw new Error("This firm isn't available.");
    const { data: onDeal } = await sb.from("deal_advisors").select("firm_profile_id, side").eq("deal_id", deal.id);
    if ((onDeal ?? []).some((x: any) => x.firm_profile_id === firm.id && x.side !== side)) throw new Error("This firm advises the other side on this deal.");
    const { data: inv, error } = await sb.from("advisor_invitations").insert({
      deal_id: deal.id, side, client_org_id: side === "seller" ? deal.startup_id : deal.buyer_user_id, firm_profile_id: firm.id, invited_by: context.userId,
    }).select("id").single();
    if (error) throw new Error(error.message.includes("duplicate") ? "You already have an advisor or an open invitation on this deal." : error.message);
    const parties = (await S.dealParties(sb, [deal]))[deal.id]!;
    const me = (await S.userNames(sb, [context.userId]))[context.userId];
    const { sendAlert } = await import("./email-alerts.server");
    const vars = { person: me?.name ?? "Someone", client: parties[side].name, firm: firm.name, "client side": side };
    // The invitation email never names the other side.
    await sendAlert({ alert: "advisor_invitation", role: "advisor", userIds: [firm.owner_user_id], vars,
      details: [["Client", `${parties[side].name} · ${side}`], ["Letter of intent", `signed ${S.fmtDay(deal.loi_accepted_at)}`]], refKey: `${inv.id}:invite` });
    await S.bell(sb, [firm.owner_user_id], "A client invited you to a deal", `${vars.person} at ${vars.client} invited ${firm.name} to work on one of its deals. Open the invitation to see the deal, then join or decline.`, `/advisor/pipeline?invitation=${inv.id}`);
    return { ok: true, firm: firm.name };
  });

export const withdrawAdvisorInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const S = await srv();
    const sb = await S.admin();
    const { data: inv } = await sb.from("advisor_invitations").select("*").eq("id", data.id).maybeSingle();
    if (!inv) throw new Error("Invitation not found");
    const { side, deal } = await partyDeal(context, inv.deal_id);
    if (side !== inv.side) throw new Error("Not your invitation");
    const { data: done } = await sb.from("advisor_invitations").update({ status: "withdrawn", answered_by: context.userId, answered_at: new Date().toISOString() }).eq("id", inv.id).eq("status", "waiting").select("id");
    if (!done?.length) throw new Error("The advisor already answered this invitation.");
    const { data: firm } = await sb.from("advisor_firms").select("owner_user_id").eq("id", inv.firm_profile_id).maybeSingle();
    const parties = (await S.dealParties(sb, [deal]))[deal.id]!;
    await S.bell(sb, [firm?.owner_user_id].filter(Boolean) as string[], "Invitation withdrawn", `${parties[side].name} withdrew its invitation to its deal with ${parties[S.otherSide(side)].name}.`, "/advisor/pipeline");
    return { ok: true };
  });

export type AdvisorNdaView = {
  firm: string; firmRef: string | null; client: string; seller: string; buyer: string;
  signer: string | null; signerTitle: string | null; signedAt: string; expiresAt: string; text: string; purpose: string;
};

/** The signed advisor NDA, for the advisor or either side of the deal. */
export const getAdvisorNda = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ dealId: z.string().uuid(), side: Side }).parse(d))
  .handler(async ({ data, context }): Promise<AdvisorNdaView> => {
    const S = await srv();
    const sb = await S.admin();
    const { data: da } = await sb.from("deal_advisors").select("*").eq("deal_id", data.dealId).eq("side", data.side).maybeSingle();
    if (!da) throw new Error("No advisor on this side of the deal");
    const { data: firm } = await sb.from("advisor_firms").select("name, ref_no, owner_user_id").eq("id", da.firm_profile_id).maybeSingle();
    const { data: deal } = await sb.from("deal_pipelines").select("*").eq("id", data.dealId).single();
    const isAdvisor = firm?.owner_user_id === context.userId;
    if (!isAdvisor && !(await S.callerSide(context.supabase, context.userId, deal))) throw new Error("Not your deal");
    const { data: nda } = await sb.from("advisor_ndas").select("*").eq("id", da.advisor_nda_id).single();
    const parties = (await S.dealParties(sb, [deal]))[deal.id]!;
    const { advisorNdaPurpose } = await import("@/config/advisor-nda");
    const client = parties[data.side].name;
    return { firm: firm?.name ?? "Advisor", firmRef: firm?.ref_no ?? null, client, seller: parties.seller.name, buyer: parties.buyer.name,
      signer: nda.signer_name, signerTitle: nda.signer_title, signedAt: nda.signed_at, expiresAt: nda.expires_at, text: nda.nda_text, purpose: advisorNdaPurpose(client) };
  });

/** Advisor profile dialog for the seller or buyer: the firm card plus who signed and the firm's contact. */
export const dealAdvisorProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ dealId: z.string().uuid(), side: Side }).parse(d))
  .handler(async ({ data, context }) => {
    const { S, sb, deal } = await partyDeal(context, data.dealId);
    const { data: da } = await sb.from("deal_advisors").select("*").eq("deal_id", deal.id).eq("side", data.side).maybeSingle();
    if (!da) throw new Error("No advisor on this side of the deal");
    const { loadFirmCards } = await import("./advisor-firm.functions");
    const [firm] = await loadFirmCards(sb, [da.firm_profile_id]);
    const signer = (await S.userNames(sb, [da.advisor_user_id]))[da.advisor_user_id];
    const parties = (await S.dealParties(sb, [deal]))[deal.id]!;
    return { firm: firm!, client: parties[data.side as Side].name, signer: signer ?? null };
  });
