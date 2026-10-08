/**
 * Who is in each Messages conversation, and the deal-advisor conversations
 * (server only). Keys: 'p:<pipeline>' seller–buyer, 'a:<user>' PitchSnack Help,
 * 'c:<deal_advisors id>:<seller|buyer>' an advisor with one side of a deal.
 * Deal-advisor conversations are derived from deal_advisors, so every joined
 * deal has its two conversations without storing copies.
 */
import { sideUsers, userNames, dealParties, type Side } from "./advisor-pipeline.server";

export type As = "seller" | "buyer" | "advisor";
export type Role = "seller" | "buyer" | "advisor";
export type Member = { id: string; name: string; first: string; title: string | null; org: string; role: Role; main: boolean };
export type DaMeta = {
  key: string; dealId: string; daId: string; clientSide: Side; withSide: Side;
  firm: { id: string; name: string; sub: string }; other: string; codeName: string | null; ref: string;
  sellerOrg: string; buyerOrg: string; joinedAt: string; expiresAt: string | null; closed: boolean;
};
export type ThreadEvent = { id: string; at: string; text: string; link: string | null; nda: { dealId: string; side: Side } | null };

export const parseC = (key: string) => {
  const [, id, side] = key.split(":");
  return { daId: id, side: side as Side };
};

async function myFirmIds(sb: any, userId: string) {
  const { data } = await sb.from("advisor_firms").select("id").eq("owner_user_id", userId);
  return (data ?? []).map((f: any) => f.id as string);
}

/** Deal-advisor conversations the caller is in, for the tab they are looking at. */
export async function daThreads(sb: any, userId: string, as: As, pipelineIds: string[]): Promise<DaMeta[]> {
  let das: any[] = [];
  if (as === "advisor") {
    const f = await myFirmIds(sb, userId);
    if (!f.length) return [];
    das = (await sb.from("deal_advisors").select("*").in("firm_profile_id", f)).data ?? [];
  } else {
    if (!pipelineIds.length) return [];
    das = (await sb.from("deal_advisors").select("*").in("deal_id", pipelineIds)).data ?? [];
  }
  if (!das.length) return [];
  const dealIds = [...new Set(das.map((d) => d.deal_id))];
  const [{ data: deals }, { data: firms }, { data: ndas }] = await Promise.all([
    sb.from("deal_pipelines").select("id, hidden_profile_id, startup_id, buyer_user_id, status").in("id", dealIds),
    sb.from("advisor_firms").select("id, name, firm_type, city").in("id", [...new Set(das.map((d) => d.firm_profile_id))]),
    sb.from("advisor_ndas").select("id, signed_at, expires_at").in("id", das.map((d) => d.advisor_nda_id).filter(Boolean)),
  ]);
  const dm = Object.fromEntries((deals ?? []).map((d: any) => [d.id, d]));
  const fm = Object.fromEntries((firms ?? []).map((f: any) => [f.id, f]));
  const nm = Object.fromEntries((ndas ?? []).map((n: any) => [n.id, n]));
  const parties = await dealParties(sb, deals ?? []);
  const { data: hps } = await sb.from("hidden_profiles").select("id, code_name").in("id", [...new Set((deals ?? []).map((d: any) => d.hidden_profile_id))]);
  const code = Object.fromEntries((hps ?? []).map((h: any) => [h.id, h.code_name]));
  const out: DaMeta[] = [];
  for (const a of das) {
    const d = dm[a.deal_id];
    if (!d || ["declined", "withdrawn"].includes(d.status)) continue;
    const pp = parties[d.id]!;
    const f = fm[a.firm_profile_id] ?? {};
    const n = nm[a.advisor_nda_id] ?? {};
    const sides: Side[] = as === "advisor" ? ["seller", "buyer"] : [as];
    for (const s of sides) {
      out.push({
        key: `c:${a.id}:${s}`, dealId: d.id, daId: a.id, clientSide: a.side, withSide: s,
        firm: { id: a.firm_profile_id, name: f.name ?? "Advisor", sub: [f.firm_type, f.city].filter(Boolean).join(" · ") },
        other: as === "advisor" ? pp[s].name : f.name ?? "Advisor",
        codeName: code[d.hidden_profile_id] ?? null, ref: `PS-${String(d.hidden_profile_id).slice(0, 4).toUpperCase()}`,
        sellerOrg: pp.seller.name, buyerOrg: pp.buyer.name,
        joinedAt: n.signed_at ?? a.joined_at, expiresAt: n.expires_at ?? null,
        closed: !!n.expires_at && new Date(n.expires_at) < new Date(),
      });
    }
  }
  return out;
}

/** Membership check for one deal-advisor conversation. */
export async function daMember(sb: any, userId: string, key: string) {
  const { daId, side } = parseC(key);
  const { data: da } = await sb.from("deal_advisors").select("*").eq("id", daId).maybeSingle();
  if (!da) return null;
  const [{ data: firm }, { data: deal }, { data: nda }] = await Promise.all([
    sb.from("advisor_firms").select("owner_user_id, name").eq("id", da.firm_profile_id).maybeSingle(),
    sb.from("deal_pipelines").select("*").eq("id", da.deal_id).single(),
    da.advisor_nda_id ? sb.from("advisor_ndas").select("signed_at, expires_at").eq("id", da.advisor_nda_id).maybeSingle() : { data: null },
  ]);
  const advisorId = firm?.owner_user_id ?? da.advisor_user_id;
  const isAdvisor = advisorId === userId;
  const sideIds = await sideUsers(sb, deal, side);
  if (!isAdvisor && !sideIds.includes(userId)) return null;
  const closed = !!nda?.expires_at && new Date(nda.expires_at) < new Date();
  return { da, deal, firm, nda, side, advisorId, sideIds, isAdvisor, closed };
}

/** Everyone in a conversation, with each side's main contact. */
export async function threadMembers(sb: any, key: string): Promise<Member[]> {
  if (key.startsWith("a:")) return [];
  let deal: any, entries: { id: string; role: Role; org: string; main: boolean }[] = [];
  if (key.startsWith("p:")) {
    ({ data: deal } = await sb.from("deal_pipelines").select("*").eq("id", key.slice(2)).single());
    const pp = (await dealParties(sb, [deal]))[deal.id]!;
    const s = await sideUsers(sb, deal, "seller");
    entries = [
      ...s.map((id, i) => ({ id, role: "seller" as Role, org: pp.seller.name, main: i === 0 })),
      { id: deal.buyer_user_id, role: "buyer", org: pp.buyer.name, main: true },
    ];
  } else {
    const { daId, side } = parseC(key);
    const { data: da } = await sb.from("deal_advisors").select("*").eq("id", daId).single();
    const { data: firm } = await sb.from("advisor_firms").select("owner_user_id, name").eq("id", da.firm_profile_id).maybeSingle();
    ({ data: deal } = await sb.from("deal_pipelines").select("*").eq("id", da.deal_id).single());
    const pp = (await dealParties(sb, [deal]))[deal.id]!;
    const ids = await sideUsers(sb, deal, side);
    entries = [
      { id: firm?.owner_user_id ?? da.advisor_user_id, role: "advisor", org: firm?.name ?? "Advisor", main: true },
      ...ids.map((id, i) => ({ id, role: side as Role, org: pp[side].name, main: side === "buyer" ? id === deal.buyer_user_id : i === 0 })),
    ];
  }
  const seen = new Set<string>();
  entries = entries.filter((e) => e.id && !seen.has(e.id) && seen.add(e.id));
  const names = await userNames(sb, entries.map((e) => e.id));
  const { data: us } = await sb.from("users").select("id, first_name").in("id", entries.map((e) => e.id));
  const first = Object.fromEntries((us ?? []).map((u: any) => [u.id, u.first_name]));
  return entries.map((e) => ({ ...e, name: names[e.id]?.name ?? "Someone", title: names[e.id]?.title ?? null, first: first[e.id] || (names[e.id]?.name ?? "Someone").split(" ")[0] }));
}

const STEP_EV: Record<string, string> = { legal_shared: "Deal moved to Offer & SPA", spa_shared: "Deal moved to Payment", payment_shared: "Deal completed" };

/** Events shown in a conversation, worded for the reader; read from the deal's records. */
export async function threadEvents(sb: any, userId: string, key: string): Promise<ThreadEvent[]> {
  if (key.startsWith("a:")) return [];
  if (key.startsWith("c:")) {
    const m = await daMember(sb, userId, key);
    if (!m) return [];
    const pp = (await dealParties(sb, [m.deal]))[m.deal.id]!;
    const firm = m.firm?.name ?? "Your advisor";
    const nda = { dealId: m.deal.id, side: m.da.side as Side };
    const joinedAt = m.nda?.signed_at ?? m.da.joined_at;
    const text = m.isAdvisor ? "You joined the deal" : m.side === m.da.side ? `${firm} joined as your advisor` : `${firm} joined for ${pp[m.da.side as Side].name}`;
    const out: ThreadEvent[] = [{ id: `j${m.da.id}`, at: joinedAt, text, link: m.isAdvisor ? "View your NDA" : "View advisor NDA", nda }];
    let q = sb.from("deal_pipeline_events").select("id, event, created_at").eq("pipeline_id", m.deal.id).in("event", Object.keys(STEP_EV)).gte("created_at", m.da.joined_at);
    if (m.nda?.expires_at) q = q.lte("created_at", m.nda.expires_at);
    const { data: ev } = await q.order("created_at");
    for (const e of ev ?? []) out.push({ id: e.id, at: e.created_at, text: STEP_EV[e.event], link: null, nda: null });
    return out;
  }
  // Seller–buyer conversation: only the advisors' joined events.
  const { data: deal } = await sb.from("deal_pipelines").select("*").eq("id", key.slice(2)).single();
  const mine: Side = deal.buyer_user_id === userId ? "buyer" : "seller";
  const { data: das } = await sb.from("deal_advisors").select("*").eq("deal_id", deal.id);
  if (!das?.length) return [];
  const pp = (await dealParties(sb, [deal]))[deal.id]!;
  const { data: fs } = await sb.from("advisor_firms").select("id, name").in("id", das.map((d: any) => d.firm_profile_id));
  const fn = Object.fromEntries((fs ?? []).map((f: any) => [f.id, f.name]));
  return das.map((a: any) => ({
    id: `j${a.id}`, at: a.joined_at,
    text: a.side === mine ? `${fn[a.firm_profile_id] ?? "Your advisor"} joined as your advisor` : `${fn[a.firm_profile_id] ?? "An advisor"} joined for ${pp[a.side as Side].name}`,
    link: "View advisor NDA", nda: { dealId: deal.id, side: a.side as Side },
  }));
}
