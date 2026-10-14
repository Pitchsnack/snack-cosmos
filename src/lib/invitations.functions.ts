import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
  const ids = [...new Set([...(su ?? []), ...(own ?? [])].map((x: any) => x.startup_id))];
  if (!ids.length) return null;
  const { isBuyerVisible } = await import("@/lib/hidden-profile");
  const { data: hps } = await sb.from("hidden_profiles").select("id, startup_id, ref_no, code_name, approval_status, live").in("startup_id", ids);
  return (hps ?? []).find((h: any) => isBuyerVisible(h)) ?? null;
}

export type ConnectKind = "connect" | "invited" | "nda_requested" | "approved" | "not_interested" | "declined";
export type ConnectState = { kind: ConnectKind; at: string | null; invitationId: string | null; pipelineId: string | null };
export type ConnectStates = { hasListing: boolean; listingRef: string | null; by: Record<string, ConnectState> };

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
    if (!hp) return { hasListing: false, listingRef: null, by: {} };
    return { hasListing: true, listingRef: hp.ref_no ?? null, by: await statesFor(await admin(), hp) };
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
      link_url: "/marketplace/browse",
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
