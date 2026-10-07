/**
 * Advisor deal access (server only). Every read goes through these helpers
 * after the caller is checked, so an advisor's browser only ever gets the
 * dates, names and step texts of section 10 — never the buyer–seller NDA,
 * reports, figures, LOI terms, private notes or messages.
 */
export type Side = "seller" | "buyer";
export const otherSide = (s: Side): Side => (s === "seller" ? "buyer" : "seller");

export async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export const fullName = (u: any) => (u ? [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email : null);

export async function userNames(sb: any, ids: string[]) {
  const m: Record<string, { name: string; title: string | null }> = {};
  if (!ids.length) return m;
  const [{ data: us }, { data: ps }] = await Promise.all([
    sb.from("users").select("id, first_name, last_name, email").in("id", ids),
    sb.from("user_profiles").select("user_id, title").in("user_id", ids),
  ]);
  const t = Object.fromEntries((ps ?? []).map((p: any) => [p.user_id, p.title]));
  for (const u of us ?? []) m[u.id] = { name: fullName(u) ?? "Someone", title: t[u.id] ?? null };
  return m;
}

/** Names and sub lines of both sides of each deal (no figures). */
export async function dealParties(sb: any, deals: any[]) {
  const hpIds = [...new Set(deals.map((d) => d.hidden_profile_id))];
  const stIds = [...new Set(deals.map((d) => d.startup_id))];
  const bIds = [...new Set(deals.map((d) => d.buyer_user_id))];
  const e = { data: [] as any[] };
  const [{ data: hps }, { data: sts }, { data: bvs }, { data: bps }, { data: ups }] = await Promise.all([
    hpIds.length ? sb.from("hidden_profiles").select("id, code_name, ref_no, region").in("id", hpIds) : e,
    stIds.length ? sb.from("startups").select("id, startup_name, industry, city").in("id", stIds) : e,
    bIds.length ? sb.from("buyer_verifications").select("user_id, company_name, buyer_type").in("user_id", bIds) : e,
    bIds.length ? sb.from("buyer_profiles").select("user_id, investor_id").in("user_id", bIds) : e,
    bIds.length ? sb.from("user_profiles").select("user_id, city, organisation").in("user_id", bIds) : e,
  ]);
  const invIds = (bps ?? []).map((b: any) => b.investor_id).filter(Boolean);
  const { data: invs } = invIds.length ? await sb.from("investors").select("id, investor_name, investor_type, city").in("id", invIds) : e;
  const hp = Object.fromEntries((hps ?? []).map((x: any) => [x.id, x]));
  const st = Object.fromEntries((sts ?? []).map((x: any) => [x.id, x]));
  const bv = Object.fromEntries((bvs ?? []).map((x: any) => [x.user_id, x]));
  const up = Object.fromEntries((ups ?? []).map((x: any) => [x.user_id, x]));
  const inv = Object.fromEntries((invs ?? []).map((x: any) => [x.id, x]));
  const bp = Object.fromEntries((bps ?? []).map((x: any) => [x.user_id, inv[x.investor_id]]));
  const out: Record<string, { seller: { name: string; sub: string; key: string }; buyer: { name: string; sub: string; key: string } }> = {};
  for (const d of deals) {
    const h = hp[d.hidden_profile_id] ?? {}, s = st[d.startup_id] ?? {}, b = bv[d.buyer_user_id] ?? {}, i = bp[d.buyer_user_id] ?? {}, u = up[d.buyer_user_id] ?? {};
    out[d.id] = {
      seller: { name: s.startup_name || h.code_name || "Seller", sub: [h.code_name, h.ref_no, s.city || h.region].filter(Boolean).join(" · "), key: `seller:${d.startup_id}` },
      buyer: { name: i.investor_name || b.company_name || u.organisation || "Buyer", sub: [i.investor_type || b.buyer_type, i.city || u.city].filter(Boolean).join(" · "), key: `buyer:${d.buyer_user_id}` },
    };
  }
  return out;
}

/** People reached for one side of a deal: the listing owners, or the buyer. */
export async function sideUsers(sb: any, deal: any, side: Side): Promise<string[]> {
  if (side === "buyer") return [deal.buyer_user_id];
  const [{ data: own }, { data: su }] = await Promise.all([
    sb.from("startup_ownership").select("owning_agent_user_id").eq("startup_id", deal.startup_id),
    sb.from("startup_users").select("user_id").eq("startup_id", deal.startup_id),
  ]);
  return [...new Set([...(own ?? []).map((o: any) => o.owning_agent_user_id), ...(su ?? []).map((o: any) => o.user_id)].filter(Boolean))] as string[];
}

/** Which side of the deal the caller is on, or null. */
export async function callerSide(sbUser: any, userId: string, deal: any): Promise<Side | null> {
  if (deal.buyer_user_id === userId) return "buyer";
  const { data } = await sbUser.rpc("can_access_startup", { _user_id: userId, _startup_id: deal.startup_id });
  return data ? "seller" : null;
}

export async function bell(sb: any, userIds: string[], title: string, message: string, link: string) {
  if (!userIds.length) return;
  await sb.from("notifications").insert(userIds.map((u) => ({ user_id: u, notification_type: "deal", title, message, link_url: link })));
}

/** Who the deal waits on after Contact M&A, the kind of task and its words for each side. */
export function dealWait(d: any): { side: Side; kind: "work" | "decision"; own: string; others: string } | null {
  if (d.payment_at) return null;
  if (d.wait_task === "legal_questions" && !d.legal_at) return { side: "buyer", kind: "work", own: "send your legal questions", others: "send their legal questions" };
  const kind = d.wait_kind === "work" ? "work" : "decision";
  if (!d.legal_at) return { side: "seller", kind, own: "share the legal folder", others: "legal folder" };
  if (!d.spa_at) return { side: "seller", kind, own: "share the SPA draft", others: "SPA draft" };
  return { side: "seller", kind, own: "confirm payment", others: "payment" };
}

export const fmtDay = (s: string | Date) => new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" });
