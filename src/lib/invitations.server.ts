/**
 * Server-only invitation helpers shared by invitations, pipeline and listing loaders.
 * An investor organisation = every buyer account linked to the same investor row.
 */
export type InvStatus = "closed" | "approved" | "declined" | "waiting" | "not_interested" | "viewed" | "new";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

/** The investor rows the buyer belongs to, and every buyer account in those organisations. */
export async function buyerOrg(userId: string) {
  const sb = await admin();
  const { data: mine } = await sb.from("buyer_profiles").select("investor_id").eq("user_id", userId).not("investor_id", "is", null);
  const investorIds = [...new Set((mine ?? []).map((b: any) => b.investor_id as string))];
  if (!investorIds.length) return { investorIds, userIds: [userId] };
  const { data: all } = await sb.from("buyer_profiles").select("user_id").in("investor_id", investorIds);
  return { investorIds, userIds: [...new Set([userId, ...(all ?? []).map((b: any) => b.user_id as string)])] };
}

/** Section 14's order: first match wins. `pipe` is the org's latest pipeline row on the listing. */
export function deriveStatus(inv: any, pipe: any | null): InvStatus {
  if (inv.closed_at) return "closed";
  if(pipe?.nda_approved_at&&(pipe.status==="ended"||pipe.status==="revoked"||(pipe.nda_expires_at&&Date.parse(pipe.nda_expires_at)<=Date.now())))return "closed";
  const live = pipe && !["withdrawn", "declined"].includes(pipe.status) && !pipe.ended_at;
  if (live && pipe.nda_approved_at && (!pipe.nda_expires_at || new Date(pipe.nda_expires_at) > new Date())) return "approved";
  if (pipe?.status === "declined" && (pipe.nda_requested_at ?? pipe.updated_at ?? "") >= inv.sent_at) return "declined";
  if (live && pipe.nda_requested_at && !pipe.nda_approved_at) return "waiting";
  if (inv.buyer_choice === "not_interested") return "not_interested";
  if (inv.viewed_at) return "viewed";
  return "new";
}

/** Open invitations for the buyer's organisation, with each one's latest NDA row. */
export async function orgInvitations(userId: string, hpIds?: string[]) {
  const sb = await admin();
  const org = await buyerOrg(userId);
  if (!org.investorIds.length) return { org, rows: [] as Array<{ inv: any; pipe: any | null; status: InvStatus }> };
  let q = sb.from("listing_invitations").select("*").in("investor_id", org.investorIds).order("sent_at", { ascending: false });
  if (hpIds) q = q.in("hidden_profile_id", hpIds);
  const { data: invs } = await q;
  if (!invs?.length) return { org, rows: [] };
  const { data: pipes } = await sb.from("deal_pipelines")
    .select("id, hidden_profile_id, buyer_user_id, status, nda_requested_at, nda_approved_at, nda_expires_at, ended_at, updated_at, created_at")
    .in("hidden_profile_id", [...new Set(invs.map((i: any) => i.hidden_profile_id))]).in("buyer_user_id", org.userIds);
  const latest = new Map<string, any>();
  for (const p of pipes ?? []) {
    const prev = latest.get(p.hidden_profile_id);
    if (!prev || (p.nda_requested_at ?? p.created_at) > (prev.nda_requested_at ?? prev.created_at)) latest.set(p.hidden_profile_id, p);
  }
  // Only the newest invitation per listing counts.
  const seen = new Set<string>();
  const rows = [];
  for (const inv of invs) {
    if (seen.has(inv.hidden_profile_id)) continue;
    seen.add(inv.hidden_profile_id);
    const pipe = latest.get(inv.hidden_profile_id) ?? null;
    rows.push({ inv, pipe, status: deriveStatus(inv, pipe) });
  }
  return { org, rows };
}

/** Listings this buyer was invited to, while New or Viewed (plan limits don't apply to them). */
export async function invitedListingIds(userId: string) {
  const { rows } = await orgInvitations(userId);
  return new Set(rows.filter((r) => r.status === "new" || r.status === "viewed").map((r) => r.inv.hidden_profile_id as string));
}

/** Bell items for every seller user of the listing's company. */
export async function notifySellers(startupId: string, title: string, message: string, link = "/marketplace/pipeline/invitations?view=sent") {
  const sb = await admin();
  const [{ data: su }, { data: own }] = await Promise.all([
    sb.from("startup_users").select("user_id").eq("startup_id", startupId),
    sb.from("startup_ownership").select("owning_agent_user_id").eq("startup_id", startupId),
  ]);
  const ids = [...new Set([...(su ?? []).map((x: any) => x.user_id), ...(own ?? []).map((x: any) => x.owning_agent_user_id)].filter(Boolean))];
  if (ids.length) await sb.from("notifications").insert(ids.map((user_id) => ({ user_id, notification_type: "deal", title, message, link_url: link })));
}

/** First view of an invitation: stamp it and tell the seller once. */
export async function markViewed(inv: any) {
  if (inv.viewed_at) return;
  const sb = await admin();
  const { data: upd } = await sb.from("listing_invitations").update({ viewed_at: new Date().toISOString() }).eq("id", inv.id).is("viewed_at", null).select("id");
  if (!upd?.length) return;
  const { loadPublicInvestors } = await import("./investor-browse.functions");
  const [i] = await loadPublicInvestors(sb, [inv.investor_id]);
  await notifySellers(inv.startup_id, `${i ? `${i.codeName} (${i.refNo})` : "An investor"} has opened your listed profile.`, "");
}
