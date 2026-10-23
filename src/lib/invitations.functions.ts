import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sellerContactPending } from "@/lib/pending-contact";

/**
 * Seller › Connect: invite an investor to view the seller's anonymous listing.
 * One open invitation per listing + investor; all writes go through here
 * (service client, after role and plan checks). Bell items name only the
 * listing and the investor type/ref, never a company or a person.
 */
async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function myLiveListing(userId: string) {
  const sb = await admin();
  const [{ data: su }, { data: own }] = await Promise.all([
    sb.from("startup_users").select("startup_id").eq("user_id", userId),
    sb.from("startup_ownership").select("startup_id").eq("owning_agent_user_id", userId),
  ]);
  const ids = await (await import("@/lib/workspace-scope.server")).scopeStartupIds(userId, [...new Set([...(su ?? []), ...(own ?? [])].map((x: any) => x.startup_id as string))]);
  if (!ids.length) return null;
  const { isBuyerVisible } = await import("@/lib/hidden-profile");
  const { data: hps } = await sb.from("hidden_profiles").select("id, startup_id, ref_no, code_name, approval_status, live").in("startup_id", ids);
  return (hps ?? []).find((h: any) => isBuyerVisible(h)) ?? null;
}

export type ConnectKind = "connect" | "invited" | "nda_requested" | "approved" | "not_interested" | "declined";
export type ConnectState = { kind: ConnectKind; at: string | null; invitationId: string | null; pipelineId: string | null };
export type ConnectStates = { hasListing: boolean; pendingVerification: boolean; listingRef: string | null; by: Record<string, ConnectState> };

/** What sits between the seller's live listing and each investor (section 1's table). */
async function statesFor(sb: any, hp: any, investorIds?: string[]): Promise<Record<string, ConnectState>> {
  let iq = sb.from("listing_invitations").select("*").eq("hidden_profile_id", hp.id).is("closed_at", null);
  if (investorIds) iq = iq.in("investor_id", investorIds);
  const [{ data: invs }, { data: pipes }] = await Promise.all([
    iq,
    sb.from("deal_pipelines").select("id, buyer_user_id, status, nda_requested_at, nda_approved_at, nda_expires_at, updated_at, created_at").eq("hidden_profile_id", hp.id),
  ]);
  const buyerIds = [...new Set((pipes ?? []).map((p: any) => p.buyer_user_id))];
  const { data: bps } = buyerIds.length
    ? await sb.from("buyer_profiles").select("user_id, investor_id").in("user_id", buyerIds).not("investor_id", "is", null)
    : { data: [] };
  const invOfUser = new Map<string, string>((bps ?? []).map((b: any) => [b.user_id, b.investor_id]));
  const latestPipe = new Map<string, any>();
  for (const p of pipes ?? []) {
    const inv = invOfUser.get(p.buyer_user_id);
    if (!inv) continue;
    const prev = latestPipe.get(inv);
    if (!prev || (p.nda_requested_at ?? p.created_at) > (prev.nda_requested_at ?? prev.created_at)) latestPipe.set(inv, p);
  }
  const out: Record<string, ConnectState> = {};
  const now = Date.now();
  const invBy = new Map<string, any>((invs ?? []).map((i: any) => [i.investor_id, i]));
  for (const id of new Set([...invBy.keys(), ...latestPipe.keys()])) {
    const inv = invBy.get(id);
    const p = latestPipe.get(id);
    const live = p && !["withdrawn", "declined"].includes(p.status) && !p.ended_at;
    const base = { invitationId: inv?.id ?? null, pipelineId: p?.id ?? null };
    if (live && p.nda_approved_at && (!p.nda_expires_at || new Date(p.nda_expires_at).getTime() > now)) out[id] = { kind: "approved", at: p.nda_approved_at, ...base };
    else if (live && p.nda_requested_at && !p.nda_approved_at) out[id] = { kind: "nda_requested", at: p.nda_requested_at, ...base };
    else if (inv && p?.status === "declined" && (p.nda_requested_at ?? "") >= inv.sent_at) out[id] = { kind: "declined", at: p.updated_at, ...base };
    else if (inv && inv.buyer_choice === "not_interested") out[id] = { kind: "not_interested", at: inv.choice_at, ...base };
    else if (inv) out[id] = { kind: "invited", at: inv.sent_at, ...base };
  }
  return out;
}

export const myConnectStates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ConnectStates> => {
    await (await import("./plan-access.server")).requireRole(context.userId, ["seller"]);
    const hp = await myLiveListing(context.userId);
    if (!hp) {
      const ids = await (await import("./workspace-scope.server")).myWorkspaceStartupIds(context.userId);
      const { data: rows, error } = ids.length
        ? await (await admin()).from("hidden_profiles").select("approval_status, live").in("startup_id", ids)
        : { data: [], error: null };
      if (error) throw new Error("Couldn't read listing approval status.");
      return { hasListing: false, pendingVerification: sellerContactPending(rows ?? []), listingRef: null, by: {} };
    }
    return { hasListing: true, pendingVerification: false, listingRef: hp.ref_no ?? null, by: await statesFor(await admin(), hp) };
  });

export const sendInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ investorId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { requireRole, spendRequest, planAccess, requestsLeft } = await import("./plan-access.server");
    await requireRole(context.userId, ["seller"]);
    const sb = await admin();
    const hp = await myLiveListing(context.userId);
    if (!hp) throw new Error("Your listing isn't live.");
    const { loadPublicInvestors } = await import("./investor-browse.functions");
    const [inv] = await loadPublicInvestors(sb, [data.investorId]);
    if (!inv) throw new Error("This investor's profile is no longer published.");
    const st = (await statesFor(sb, hp, [data.investorId]))[data.investorId];
    if (st?.kind === "nda_requested") throw new Error("This investor has just asked you for an NDA. Review it now.");
    if (st?.kind === "approved") throw new Error("You already have an approved NDA with this investor.");
    if (st && st.invitationId) throw new Error("You've already invited this investor.");
    const a0 = await planAccess(context.userId);
    const left0 = requestsLeft(a0, "contact");
    if (left0 !== "unlimited" && a0.role !== "admin" && (left0 == null || left0 <= 0)) throw new Error("You have no Connect requests left.");
    await spendRequest(context.userId, "contact", data.investorId);
    const { data: row, error } = await sb.from("listing_invitations").insert({
      hidden_profile_id: hp.id, startup_id: hp.startup_id, investor_id: data.investorId,
      buyer_user_id: inv.userId, sent_by: context.userId,
    }).select("id, sent_at").single();
    if (error) throw new Error(error.code === "23505" ? "You've already invited this investor." : error.message);
    const name = hp.code_name || hp.ref_no || "A business";
    await sb.from("notifications").insert({
      user_id: inv.userId, notification_type: "deal",
      title: `${name} invited you to view their business`,
      message: "Browse their listed profile. If you're interested, request an NDA to see the company's name and details.",
      link_url: `/marketplace/invitations?open=${row.id}`,
    });
    const a = await planAccess(context.userId);
    return { id: row.id as string, sentAt: row.sent_at as string, investorRef: inv.refNo, listingRef: hp.ref_no as string | null, left: requestsLeft(a, "contact"), termMonths: (a.plan?.term_months as number | undefined) ?? null };
  });

/** Admin › Approvals › Invitations (read-only). */
export const adminInvitations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await (await import("./plan-access.server")).requireAccountAdmin(context.userId);
    const sb = await admin();
    const { data: rows } = await sb.from("listing_invitations").select("*").order("sent_at", { ascending: false }).limit(500);
    if (!rows?.length) return [];
    const { data: hps } = await sb.from("hidden_profiles").select("id, ref_no, code_name, startup_id, approval_status, live").in("id", [...new Set(rows.map((r: any) => r.hidden_profile_id))]);
    const hpBy = new Map<string, any>((hps ?? []).map((h: any) => [h.id, h]));
    const { loadPublicInvestors } = await import("./investor-browse.functions");
    const invs = await loadPublicInvestors(sb, [...new Set((rows as any[]).map((r) => String(r.investor_id)))]);
    const invBy = new Map(invs.map((i) => [i.id, i]));
    const stateCache = new Map<string, Record<string, ConnectState>>();
    const out = [];
    for (const r of rows as any[]) {
      const hp = hpBy.get(r.hidden_profile_id);
      let status = "Closed";
      if (!r.closed_at && hp) {
        if (!stateCache.has(hp.id)) stateCache.set(hp.id, await statesFor(sb, hp));
        const st = stateCache.get(hp.id)![r.investor_id];
        status = st?.kind === "approved" ? "NDA approved" : st?.kind === "nda_requested" ? "Needs your review" : st?.kind === "declined" ? "You declined" : st?.kind === "not_interested" ? "Not interested" : r.viewed_at ? "Viewed your profile" : "Not opened yet";
      }
      const i = invBy.get(r.investor_id);
      out.push({
        id: r.id as string, sentAt: r.sent_at as string, status,
        listing: [hp?.code_name, hp?.ref_no].filter(Boolean).join(" · ") || "—",
        investor: i ? `${i.codeName} · ${i.refNo}` : "—",
      });
    }
    return out;
  });

/* ───────────────────────── Buyer side ───────────────────────── */

export type BuyerInvitation = {
  id: string; listingId: string; origin?: "received" | "sent"; status: import("./invitations.server").InvStatus;
  sentAt: string; viewedAt: string | null; choiceAt: string | null; closedAt: string | null; closedReason: string | null;
  ndaAt: string | null; approvedAt: string | null; pipelineId: string | null;
  name: string; refNo: string | null; companyName: string | null;
  inviteCount: number; firstDeclinedAt: string | null; buyerOrg: string | null;
  /** Public listing (Browse teaser); null once the listing is no longer live. */
  teaser: any | null;
};

export const listMyInvitations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BuyerInvitation[]> => {
    await (await import("./plan-access.server")).requireRole(context.userId, ["buyer"]);
    const { orgInvitations } = await import("./invitations.server");
    const { rows,org } = await orgInvitations(context.userId);
    const sb = await admin();
    const {data:standalone}=await sb.from("deal_pipelines").select("*").in("buyer_user_id",org.userIds).neq("status","withdrawn");
    const linked=new Set(rows.map(r=>r.inv.hidden_profile_id));
    for(const p of standalone??[]){if(linked.has(p.hidden_profile_id))continue;rows.push({inv:{id:p.id,hidden_profile_id:p.hidden_profile_id,sent_at:p.nda_requested_at,viewed_at:null,choice_at:null,closed_at:null,closed_reason:null},pipe:p,status:p.status==="ended"||p.status==="revoked"||(p.nda_approved_at&&p.nda_expires_at&&Date.parse(p.nda_expires_at)<=Date.now())?"closed":p.status==="declined"?"declined":p.nda_approved_at?"approved":"waiting"});}
    if(!rows.length)return [];
    const hpIds = rows.map((r) => r.inv.hidden_profile_id as string);
    const [{ data: hps }, { loadMarketplaceTeasers }] = await Promise.all([
      sb.from("hidden_profiles").select("id, ref_no, code_name, startup_id, live, approval_status").in("id", hpIds),
      import("./hidden-profiles.functions"),
    ]);
    const hpBy = new Map<string, any>((hps ?? []).map((h: any) => [h.id, h]));
    const teasers = new Map<string, any>(((await loadMarketplaceTeasers({ excludeNda: false }, context.userId, true)) as any[]).filter((t) => !t.closed).map((t) => [t.id, t]));
    const approvedIds = rows.filter((r) => r.status === "approved").map((r) => hpBy.get(r.inv.hidden_profile_id)?.startup_id).filter(Boolean);
    const { data: sts } = approvedIds.length ? await sb.from("startups").select("id, startup_name").in("id", approvedIds) : { data: [] };
    const nameBy = new Map<string, string>((sts ?? []).map((s: any) => [s.id, s.startup_name]));
    const buyerOrg = await myOrgName(context.userId);
    return Promise.all(rows.map(async ({ inv, pipe, status }): Promise<BuyerInvitation> => {
      if(pipe?.nda_approved_at&&(pipe.status==="ended"||pipe.status==="revoked"||(pipe.nda_expires_at&&Date.parse(pipe.nda_expires_at)<=Date.now())))status="closed";
      const hp = hpBy.get(inv.hidden_profile_id);
      let t = teasers.get(inv.hidden_profile_id) ?? null;
      if(t){const {priceFor}=await import("./asking-price");const {askingPrice:_exact,...publicTeaser}=t;t={...publicTeaser,...priceFor(hp?.live as never,false)};}
      if(!t){status="closed";inv.closed_reason="listing_not_live";}
      return {
        id: inv.id, listingId: inv.hidden_profile_id, origin: inv.id===pipe?.id ? "sent" : "received", status,
        sentAt: inv.sent_at, viewedAt: inv.viewed_at, choiceAt: inv.choice_at, closedAt: inv.closed_at, closedReason: status==="closed" ? inv.closed_reason??"nda_ended" : inv.closed_reason,
        ndaAt: pipe?.nda_requested_at ?? null, approvedAt: pipe?.nda_approved_at ?? null, pipelineId: pipe?.id ?? null,
        name: t?.listing?.codeName || hp?.code_name || hp?.ref_no || "Listing", refNo: hp?.ref_no ?? null,
        companyName: status === "approved" ? nameBy.get(hp?.startup_id) ?? null : null,
        inviteCount: inv.id===pipe?.id ? 1 : inv.invite_count ?? 1, firstDeclinedAt: inv.first_declined_at ?? null, buyerOrg,
        teaser: t,
      };
    }));
  });

async function myInvitation(userId: string, id: string) {
  const { orgInvitations } = await import("./invitations.server");
  const { rows } = await orgInvitations(userId);
  const r = rows.find((x) => x.inv.id === id);
  if (!r) throw new Error("Invitation not found");
  return r;
}

/** Buyer opened the invitation's panel. */
export const openInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await (await import("./plan-access.server")).requireRole(context.userId, ["buyer"]);
    const r = await myInvitation(context.userId, data.id);
    await (await import("./invitations.server")).markViewed(r.inv);
    return { ok: true };
  });

/** Buyer opened a listing (Browse panel, full page, bell or email): counts as viewing its invitation. */
export const markListingViewed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ listingId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { roleOf } = await import("./plan-access.server");
    if ((await roleOf(context.userId)) !== "buyer") return { ok: true };
    const { orgInvitations, markViewed } = await import("./invitations.server");
    const { rows } = await orgInvitations(context.userId, [data.listingId]);
    for (const r of rows) if (!r.inv.closed_at) await markViewed(r.inv);
    return { ok: true };
  });

/** Not interested / Reconsider. The seller is told once per invitation, the first time. */
export const setInvitationChoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), notInterested: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await (await import("./plan-access.server")).requireRole(context.userId, ["buyer"]);
    const r = await myInvitation(context.userId, data.id);
    if (data.notInterested && r.status !== "new" && r.status !== "viewed") throw new Error("This invitation can't be changed now");
    if (!data.notInterested && r.status !== "not_interested") throw new Error("This invitation can't be changed now");
    const sb = await admin();
    const now = new Date().toISOString();
    const first = data.notInterested && !r.inv.choice_at;
    await sb.from("listing_invitations").update(data.notInterested
      ? { buyer_choice: "not_interested", choice_at: now, viewed_at: r.inv.viewed_at ?? now }
      : { buyer_choice: "open" }).eq("id", r.inv.id);
    if (first) {
      const { loadPublicInvestors } = await import("./investor-browse.functions");
      const [i] = await loadPublicInvestors(sb, [r.inv.investor_id]);
      await (await import("./invitations.server")).notifySellers(r.inv.startup_id, `${i ? `${i.codeName} (${i.refNo})` : "An investor"} isn't interested in your listing.`, "");
    }
    return { ok: true };
  });

/** Buyer: listing ids with an invitation still New or Viewed (Invited you chip). */
export const myInvitedListings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { roleOf } = await import("./plan-access.server");
    const role = await roleOf(context.userId);
    // Admins in Buyer view see their own organisation's invitations too.
    if (role !== "buyer" && role !== "admin") return [] as string[];
    return [...(await (await import("./invitations.server")).invitedListingIds(context.userId))];
  });

/** Menu count: buyer = invitations still New; seller = Needs your review. */
export const invitationsBadgeCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { roleOf } = await import("./plan-access.server");
    const role = await roleOf(context.userId);
    if (role === "seller") return (await sellerRows(context.userId)).filter((r) => r.status === "waiting").length;
    // Admins previewing Buyer view count their own buyer invitations.
    if (role !== "buyer" && role !== "admin") return 0;
    const { rows } = await (await import("./invitations.server")).orgInvitations(context.userId);
    return rows.filter((r) => r.status === "new" || r.status === "viewed").length;
  });

/* ───────────────────────── Seller side ───────────────────────── */

export type SellerInvitation = {
  id: string; investorId: string; origin?: "received" | "sent"; status: import("./invitations.server").InvStatus;
  sentAt: string; viewedAt: string | null; choiceAt: string | null; closedAt: string | null; closedReason: string | null;
  ndaAt: string | null; approvedAt: string | null; declinedAt: string | null; pipelineId: string | null;
  inviteCount: number; firstDeclinedAt: string | null;
  listingName: string; listingRef: string | null; companyName: string | null;
  /** Public investor card; null once their profile is unpublished. */
  investor: import("@/lib/investor-browse").PublicInvestor | null;
  /** Real name, only while the NDA is approved and valid. */
  investorName: string | null;
};

async function sellerStartupIds(userId: string) {
  const sb = await admin();
  const [{ data: su }, { data: own }] = await Promise.all([
    sb.from("startup_users").select("startup_id").eq("user_id", userId),
    sb.from("startup_ownership").select("startup_id").eq("owning_agent_user_id", userId),
  ]);
  return (await import("@/lib/workspace-scope.server")).scopeStartupIds(userId, [...new Set([...(su ?? []), ...(own ?? [])].map((x: any) => x.startup_id as string))]);
}

async function sellerRows(userId: string): Promise<SellerInvitation[]> {
  const sb = await admin();
  const ids = await sellerStartupIds(userId);
  if (!ids.length) return [];
  const { data: invs } = await sb.from("listing_invitations").select("*").in("startup_id", ids).order("sent_at", { ascending: false });
  const {data:allPipes}=await sb.from("deal_pipelines").select("*").in("startup_id",ids).neq("status","withdrawn");
  const invitations=invs??[];
  const {data:allBps}=await sb.from("buyer_profiles").select("user_id,investor_id").in("user_id",(allPipes??[]).map((p:any)=>p.buyer_user_id));
  for(const p of allPipes??[]){const bp=allBps?.find((b:any)=>b.user_id===p.buyer_user_id);if(invitations.some((i:any)=>i.pipeline_id===p.id))continue;if(invitations.some((i:any)=>i.hidden_profile_id===p.hidden_profile_id&&i.investor_id===bp?.investor_id))continue;invitations.push({id:p.id,hidden_profile_id:p.hidden_profile_id,startup_id:p.startup_id,investor_id:bp?.investor_id,sent_at:p.nda_requested_at,viewed_at:null,choice_at:null,closed_at:p.status==="ended"||p.status==="revoked"?p.updated_at:null,closed_reason:p.status==="ended"||p.status==="revoked"?"nda_ended":null});}
  if(!invitations.length)return [];
  const hpIds = [...new Set(invitations.map((i: any) => i.hidden_profile_id as string))];
  const invIds: string[] = [...new Set<string>(invitations.map((i: any) => i.investor_id).filter(Boolean))];
  const [{ data: hps }, { data: sts }, { data: pipes }, { data: bps }, { loadPublicInvestors }, { isBuyerVisible }, { deriveStatus }] = await Promise.all([
    sb.from("hidden_profiles").select("id, startup_id, ref_no, code_name, approval_status, live").in("id", hpIds),
    sb.from("startups").select("id, startup_name").in("id", ids),
    sb.from("deal_pipelines").select("id, hidden_profile_id, buyer_user_id, status, nda_requested_at, nda_approved_at, nda_expires_at, ended_at, updated_at, created_at").in("hidden_profile_id", hpIds),
    sb.from("buyer_profiles").select("user_id, investor_id").in("investor_id", invIds),
    import("./investor-browse.functions"),
    import("@/lib/hidden-profile"),
    import("./invitations.server"),
  ]);
  const hpBy = new Map<string, any>((hps ?? []).map((h: any) => [h.id, h]));
  const nameBy = new Map<string, string>((sts ?? []).map((s: any) => [s.id, s.startup_name]));
  const invOfUser = new Map<string, string>((bps ?? []).map((b: any) => [b.user_id, b.investor_id]));
  const latest = new Map<string, any>();
  for (const p of pipes ?? []) {
    const inv = invOfUser.get(p.buyer_user_id);
    if (!inv) continue;
    const k = `${p.hidden_profile_id}:${inv}`;
    const prev = latest.get(k);
    if (!prev || (p.nda_requested_at ?? p.created_at) > (prev.nda_requested_at ?? prev.created_at)) latest.set(k, p);
  }
  const pubs = await loadPublicInvestors(sb, invIds);
  const pubBy = new Map(pubs.map((i) => [i.id, i]));
  const approvedInv = new Set<string>();
  const seen = new Set<string>();
  const out: SellerInvitation[] = [];
  const pending: Array<[SellerInvitation, string]> = [];
  for (const inv of invitations as any[]) {
    const key = `${inv.hidden_profile_id}:${inv.investor_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const hp = hpBy.get(inv.hidden_profile_id);
    const pipe = latest.get(key) ?? null;
    const pub = pubBy.get(inv.investor_id) ?? null;
    let status = deriveStatus(inv, pipe);
    if(pipe?.nda_approved_at&&(pipe.status==="ended"||pipe.status==="revoked"||(pipe.nda_expires_at&&Date.parse(pipe.nda_expires_at)<=Date.now())))status="closed";
    let closedReason = inv.closed_reason ?? null;
    let closedAt = inv.closed_at ?? null;
    if (status !== "closed") {
      if (!pub) { status = "closed"; closedReason = "profile_unpublished"; closedAt = closedAt ?? inv.updated_at ?? inv.sent_at; }
      else if (hp && !isBuyerVisible(hp)) { status = "closed"; closedReason = "listing_not_live"; closedAt = closedAt ?? inv.sent_at; }
    }
    const publicInvestor = pub ? (({ userId: _u, liveSince: _l, ...rest }) => rest)(pub) : null;
    const row: SellerInvitation = {
      id: inv.id, investorId: inv.investor_id, origin: inv.id===pipe?.id ? "received" : "sent", status,
      sentAt: inv.sent_at, viewedAt: inv.viewed_at, choiceAt: inv.choice_at, closedAt, closedReason,
      ndaAt: pipe?.nda_requested_at ?? null, approvedAt: pipe?.nda_approved_at ?? null,
      declinedAt: pipe?.status === "declined" ? pipe.updated_at : null, pipelineId: pipe?.id ?? null,
      inviteCount: inv.id===pipe?.id ? 1 : inv.invite_count ?? 1, firstDeclinedAt: inv.first_declined_at ?? null,
      listingName: hp?.code_name || hp?.ref_no || "Listing", listingRef: hp?.ref_no ?? null,
      companyName: nameBy.get(inv.startup_id) ?? null,
      investor: status === "closed" && ["profile_unpublished","listing_not_live"].includes(closedReason??"") ? null : publicInvestor,
      investorName: null,
    };
    if (status === "approved") { approvedInv.add(inv.investor_id); pending.push([row, inv.investor_id]); }
    out.push(row);
  }
  if (approvedInv.size) {
    const { data: names } = await sb.from("investors").select("id, investor_name").in("id", [...approvedInv]);
    const nm = new Map<string, string>((names ?? []).map((n: any) => [n.id, n.investor_name]));
    for (const [row, id] of pending) row.investorName = nm.get(id) ?? null;
  }
  return out;
}

/** Seller › Invitations: every buyer the seller invited, newest first. */
export const listSellerInvitations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await (await import("./plan-access.server")).requireRole(context.userId, ["seller"]);
    return sellerRows(context.userId);
  });

export type NdaReview = {
  answered: boolean; pipelineId: string; signedAt: string | null;
  listingName: string; listingRef: string | null; companyName: string | null;
  investor: import("@/lib/investor-browse").PublicInvestor | null; invitationId: string | null;
};

/** Review investor (section 9): the waiting NDA request with the buyer's public profile. */
export const sellerNdaReview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ pipelineId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<NdaReview> => {
    await (await import("./plan-access.server")).requireRole(context.userId, ["seller"]);
    const sb = await admin();
    const { data: p } = await sb.from("deal_pipelines").select("*").eq("id", data.pipelineId).maybeSingle();
    if (!p) throw new Error("This NDA request no longer exists.");
    const { data: ok } = await context.supabase.rpc("can_access_startup", { _user_id: context.userId, _startup_id: p.startup_id });
    if (!ok) throw new Error("Only the seller can do this");
    const [{ data: hp }, { data: st }, { data: bp }] = await Promise.all([
      sb.from("hidden_profiles").select("ref_no, code_name").eq("id", p.hidden_profile_id).maybeSingle(),
      sb.from("startups").select("startup_name").eq("id", p.startup_id).maybeSingle(),
      sb.from("buyer_profiles").select("investor_id").eq("user_id", p.buyer_user_id).maybeSingle(),
    ]);
    let investor = null;
    let invitationId: string | null = null;
    if (bp?.investor_id) {
      const { loadPublicInvestors } = await import("./investor-browse.functions");
      const [i] = await loadPublicInvestors(sb, [bp.investor_id]);
      if (i) { const { userId: _u, liveSince: _l, ...rest } = i; investor = rest; }
      const { data: inv } = await sb.from("listing_invitations").select("id").eq("hidden_profile_id", p.hidden_profile_id).eq("investor_id", bp.investor_id).order("sent_at", { ascending: false }).limit(1).maybeSingle();
      invitationId = inv?.id ?? null;
    }
    const waiting = !!p.nda_requested_at && !p.nda_approved_at && !p.ended_at && !["declined", "withdrawn", "ended"].includes(p.status);
    return {
      answered: !waiting, pipelineId: p.id, signedAt: p.nda_requested_at ?? null,
      listingName: hp?.code_name || hp?.ref_no || "Listing", listingRef: hp?.ref_no ?? null,
      companyName: st?.startup_name ?? null, investor, invitationId,
    };
  });

/** Selected-pair private profile: never unlock using another deal's NDA. */
export const invitationPrivateProfile=createServerFn({method:"GET"}).middleware([requireSupabaseAuth]).inputValidator(d=>z.object({pipelineId:z.string().uuid(),as:z.enum(["buyer","seller"])}).parse(d)).handler(async({data,context})=>{
 await (await import("./plan-access.server")).requireRole(context.userId,[data.as]);
 const sb=await admin();const {data:p}=await sb.from("deal_pipelines").select("*").eq("id",data.pipelineId).maybeSingle();if(!p)throw new Error("NDA request unavailable");
 if(data.as==="buyer"){if(p.buyer_user_id!==context.userId)throw new Error("Private profile is only available to the NDA participant");}else{const ids=await sellerStartupIds(context.userId);if(!ids.includes(p.startup_id))throw new Error("Not your listing");}
 const [{data:hp},{data:buyerPublication}]=await Promise.all([sb.from("hidden_profiles").select("approval_status,live").eq("id",p.hidden_profile_id).maybeSingle(),sb.from("buyer_profiles").select("status").eq("user_id",p.buyer_user_id).maybeSingle()]);
 const {isBuyerVisible}=await import("./hidden-profile");if(!isBuyerVisible(hp)||buyerPublication?.status!=="live")throw new Error("Profile is no longer published");
 const {hubNdaActive}=await import("./reports-hub");if(!hubNdaActive(p))throw new Error("An approved valid NDA is required");
 if(data.as==="buyer"){const {loadBuyerFavourites}=await import("./favourites.functions");const row=(await loadBuyerFavourites(context.userId)).find(r=>r.id===p.hidden_profile_id&&r.pipelineId===p.id);return {buyer:row??null,seller:null};}
 const {data:bp}=await sb.from("buyer_profiles").select("investor_id").eq("user_id",p.buyer_user_id).maybeSingle();const {loadSellerFavourites}=await import("./investor-browse.functions");const row=(await loadSellerFavourites(context.userId)).find(r=>r.id===bp?.investor_id);return {buyer:null,seller:row??null};
});

async function myOrgName(userId: string): Promise<string | null> {
  const sb = await admin();
  const { data: bp } = await sb.from("buyer_profiles").select("investor_id").eq("user_id", userId).not("investor_id", "is", null).limit(1).maybeSingle();
  if (bp?.investor_id) { const { data: i } = await sb.from("investors").select("investor_name").eq("id", bp.investor_id).maybeSingle(); if (i?.investor_name) return i.investor_name; }
  const { data: up } = await sb.from("user_profiles").select("organisation").eq("user_id", userId).maybeSingle();
  return up?.organisation ?? null;
}

/** Seller › Invite again: one second invitation after a first decline. Same checks as Connect. */
export const inviteAgain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { requireRole, spendRequest, planAccess, requestsLeft } = await import("./plan-access.server");
    await requireRole(context.userId, ["seller"]);
    const sb = await admin();
    const { data: inv } = await sb.from("listing_invitations").select("*").eq("id", data.id).maybeSingle();
    if (!inv || !(await sellerStartupIds(context.userId)).includes(inv.startup_id)) throw new Error("Invitation not found");
    if ((inv.invite_count ?? 1) >= 2) throw new Error("You can't invite this investor a third time.");
    if (inv.buyer_choice !== "not_interested" || inv.closed_at) throw new Error("This invitation can't be sent again now.");
    const hp = await myLiveListing(context.userId);
    if (!hp || hp.id !== inv.hidden_profile_id) throw new Error("Your listing isn't live.");
    const { loadPublicInvestors } = await import("./investor-browse.functions");
    const [pub] = await loadPublicInvestors(sb, [inv.investor_id]);
    if (!pub) throw new Error("This investor's profile is no longer published.");
    const st = (await statesFor(sb, hp, [inv.investor_id]))[inv.investor_id];
    if (st?.kind === "nda_requested") throw new Error("This investor has just asked you for an NDA. Review it now.");
    if (st?.kind === "approved") throw new Error("You already have an approved NDA with this investor.");
    const a0 = await planAccess(context.userId);
    const left0 = requestsLeft(a0, "contact");
    if (left0 !== "unlimited" && a0.role !== "admin" && (left0 == null || left0 <= 0)) throw new Error("You have no Connect requests left.");
    const now = new Date().toISOString();
    const { data: upd } = await sb.from("listing_invitations").update({ invite_count: 2, first_declined_at: inv.choice_at ?? now, buyer_choice: "open", choice_at: null, viewed_at: null, sent_at: now })
      .eq("id", inv.id).eq("invite_count", 1).select("id");
    if (!upd?.length) throw new Error("You can't invite this investor a third time.");
    await spendRequest(context.userId, "contact", inv.investor_id);
    const name = hp.code_name || hp.ref_no || "A business";
    await sb.from("notifications").insert({
      user_id: pub.userId, notification_type: "deal",
      title: `${name} invited you to view their business`,
      message: "Browse their listed profile. If you're interested, request an NDA to see the company's name and details.",
      link_url: `/marketplace/invitations?open=${inv.id}`,
    });
    const a = await planAccess(context.userId);
    return { ok: true, left: requestsLeft(a, "contact") };
  });

export type ApprovalSummary = { pipelineId: string; name: string; other: string; typeName: string; investorRef: string | null; listingName: string; listingRef: string | null; approvedAt: string | null };

async function summaryFor(p: any): Promise<ApprovalSummary | null> {
  const sb = await admin();
  const { hubNdaActive } = await import("./reports-hub");
  if (!hubNdaActive(p)) return null;
  const [{ data: hp }, { data: st }, { data: bp }] = await Promise.all([
    sb.from("hidden_profiles").select("ref_no, code_name").eq("id", p.hidden_profile_id).maybeSingle(),
    sb.from("startups").select("startup_name").eq("id", p.startup_id).maybeSingle(),
    sb.from("buyer_profiles").select("investor_id").eq("user_id", p.buyer_user_id).maybeSingle(),
  ]);
  let pub: any = null;
  if (bp?.investor_id) { const { loadPublicInvestors } = await import("./investor-browse.functions"); [pub] = await loadPublicInvestors(sb, [bp.investor_id]); }
  const org = (await myOrgName(p.buyer_user_id)) ?? "Buyer";
  return { pipelineId: p.id, name: st?.startup_name ?? "", other: org, typeName: pub?.codeName ?? "Investor", investorRef: pub?.refNo ?? null,
    listingName: hp?.code_name || hp?.ref_no || "Listing", listingRef: hp?.ref_no ?? null, approvedAt: p.nda_approved_at };
}

/** Seller: what the NDA approved box shows right after approving. */
export const sellerApprovalSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ pipelineId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await (await import("./plan-access.server")).requireRole(context.userId, ["seller"]);
    const { data: p } = await (await admin()).from("deal_pipelines").select("*").eq("id", data.pipelineId).maybeSingle();
    if (!p || !(await sellerStartupIds(context.userId)).includes(p.startup_id)) throw new Error("Not your listing");
    return summaryFor(p);
  });

/** Buyer: the next approved NDA not shown yet; marks it seen so it shows once on any device. */
export const nextBuyerApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { roleOf } = await import("./plan-access.server");
    if ((await roleOf(context.userId)) !== "buyer") return null;
    const sb = await admin();
    const { data: ps } = await sb.from("deal_pipelines").select("*").eq("buyer_user_id", context.userId).not("nda_approved_at", "is", null).is("buyer_approval_seen_at", null).order("nda_approved_at").limit(5);
    for (const p of ps ?? []) {
      const { data: upd } = await sb.from("deal_pipelines").update({ buyer_approval_seen_at: new Date().toISOString() }).eq("id", p.id).is("buyer_approval_seen_at", null).select("id");
      if (!upd?.length) continue;
      const s = await summaryFor(p);
      if (s) return s;
    }
    return null;
  });
