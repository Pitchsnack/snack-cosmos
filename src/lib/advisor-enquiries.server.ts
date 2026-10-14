/**
 * Browse advisors (server only): who the client company is, who is in an
 * enquiry conversation ('e:<advisor_conversations id>'), lazy proposal expiry,
 * the conversation's cards and events, and bell items. Callers check access
 * first; everything here uses the service client.
 */
import { reasonText, timingLabel, type ClientSide, type EnquiryState, type ProposalDTO } from "@/lib/advisor-enquiry";

export async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

const bkkToday = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

/** The caller's company on this side: the seller's business, or the buyer's investor profile. */
export async function clientOrg(sb: any, userId: string, side: ClientSide): Promise<string | null> {
  if (side === "buyer") {
    const { data } = await sb.from("buyer_profiles").select("investor_id").eq("user_id", userId).maybeSingle();
    return data?.investor_id ?? null;
  }
  const [{ data: su }, { data: own }] = await Promise.all([
    sb.from("startup_users").select("startup_id").eq("user_id", userId),
    sb.from("startup_ownership").select("startup_id").eq("owning_agent_user_id", userId),
  ]);
  const ids = [...new Set([...(own ?? []), ...(su ?? [])].map((x: any) => x.startup_id as string))];
  return ids[0] ?? null;
}

/** Everyone on the client company's side. */
export async function orgUsers(sb: any, side: ClientSide, orgId: string): Promise<string[]> {
  if (side === "buyer") {
    const { data } = await sb.from("buyer_profiles").select("user_id").eq("investor_id", orgId);
    return (data ?? []).map((r: any) => r.user_id);
  }
  const [{ data: su }, { data: own }] = await Promise.all([
    sb.from("startup_users").select("user_id").eq("startup_id", orgId),
    sb.from("startup_ownership").select("owning_agent_user_id").eq("startup_id", orgId),
  ]);
  return [...new Set([...(own ?? []).map((o: any) => o.owning_agent_user_id), ...(su ?? []).map((s: any) => s.user_id)].filter(Boolean))] as string[];
}

/** The company's legal name and the review's sector line. */
export async function orgInfo(sb: any, side: ClientSide, orgId: string) {
  if (side === "seller") {
    const { data } = await sb.from("startups").select("startup_name, registered_name, sector").eq("id", orgId).maybeSingle();
    return { name: (data?.registered_name || data?.startup_name || "Your company") as string, detail: (data?.sector ?? null) as string | null };
  }
  const { data } = await sb.from("investors").select("investor_name, legal_name, firm_name, investor_type").eq("id", orgId).maybeSingle();
  return { name: (data?.legal_name || data?.firm_name || data?.investor_name || "Your company") as string, detail: (data?.investor_type ?? null) as string | null };
}

export async function people(sb: any, ids: string[]) {
  const uniq = [...new Set(ids.filter(Boolean))];
  if (!uniq.length) return {} as Record<string, { name: string; first: string; title: string | null; email: string | null; phone: string | null }>;
  const [{ data: us }, { data: ps }] = await Promise.all([
    sb.from("users").select("id, first_name, last_name, email").in("id", uniq),
    sb.from("user_profiles").select("user_id, title, phone").in("user_id", uniq),
  ]);
  const pm = Object.fromEntries((ps ?? []).map((p: any) => [p.user_id, p]));
  return Object.fromEntries((us ?? []).map((u: any) => {
    const name = [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email || "Someone";
    return [u.id, { name, first: u.first_name || name.split(" ")[0], title: pm[u.id]?.title ?? null, email: u.email ?? null, phone: pm[u.id]?.phone ?? null }];
  }));
}

/** Open proposals past their valid-until day (Bangkok) become expired; the enquiry goes back to talking. */
export async function sweepExpired(sb: any, enquiryIds?: string[]) {
  let q = sb.from("advisor_proposals").select("id, enquiry_id, valid_until").eq("status", "open").lt("valid_until", bkkToday());
  if (enquiryIds) { if (!enquiryIds.length) return; q = q.in("enquiry_id", enquiryIds); }
  const { data } = await q;
  for (const p of data ?? []) {
    await sb.from("advisor_proposals").update({ status: "expired", answered_at: new Date().toISOString() }).eq("id", p.id).eq("status", "open");
    const { data: e } = await sb.from("advisor_enquiries").update({ status: "talking" }).eq("id", p.enquiry_id).eq("status", "proposal").select("conversation_id").maybeSingle();
    if (e) await sb.from("advisor_enquiry_events").insert({ conversation_id: e.conversation_id, enquiry_id: p.enquiry_id, kind: "proposal_expired", ref_id: p.id });
  }
}

export function toProposal(p: any): ProposalDTO {
  return {
    id: p.id, service: p.service_key, scope: p.scope, fee: p.fee_text, timing: p.timing ?? null, validUntil: p.valid_until,
    letter: p.letter_file ? { name: p.letter_file.name, size: p.letter_file.size } : null,
    status: p.status, sentAt: p.sent_at, sentBy: p.sent_by, answeredAt: p.answered_at ?? null,
  };
}

/** The latest enquiry per firm for one client company, as EnquiryState. */
export async function statesFor(sb: any, side: ClientSide, orgId: string, firmIds?: string[]): Promise<Record<string, EnquiryState>> {
  let q = sb.from("advisor_enquiries").select("*").eq("client_side", side).eq("client_org_id", orgId).order("created_at", { ascending: false });
  if (firmIds) q = q.in("firm_profile_id", firmIds);
  const { data: es } = await q;
  if (!es?.length) return {};
  await sweepExpired(sb, es.filter((e: any) => e.status === "proposal").map((e: any) => e.id));
  const latest = new Map<string, any>();
  for (const e of es) if (!latest.has(e.firm_profile_id)) latest.set(e.firm_profile_id, e);
  const ids = [...latest.values()].map((e) => e.id);
  const [{ data: fresh }, { data: props }, { data: revs }, { data: evs }] = await Promise.all([
    sb.from("advisor_enquiries").select("*").in("id", ids),
    sb.from("advisor_proposals").select("*").in("enquiry_id", ids).order("sent_at", { ascending: false }),
    sb.from("advisor_firm_reviews").select("enquiry_id, stars, comment, client_role, client_detail").in("enquiry_id", ids),
    sb.from("advisor_enquiry_events").select("enquiry_id, kind, created_at").in("enquiry_id", ids).in("kind", ["proposal_declined", "proposal_expired"]).order("created_at", { ascending: false }),
  ]);
  const ppl = await people(sb, (props ?? []).map((p: any) => p.sent_by));
  const out: Record<string, EnquiryState> = {};
  for (const e of fresh ?? []) {
    const ps = (props ?? []).filter((p: any) => p.enquiry_id === e.id);
    const open = ps.find((p: any) => p.status === "open");
    const acc = ps.find((p: any) => p.status === "accepted");
    const ev = (evs ?? []).find((x: any) => x.enquiry_id === e.id);
    const r = (revs ?? []).find((x: any) => x.enquiry_id === e.id);
    const person = (open ?? acc ?? ps[0]) ? ppl[(open ?? acc ?? ps[0]).sent_by]?.name ?? null : null;
    out[e.firm_profile_id] = {
      enquiryId: e.id, status: e.status, service: e.service_key, createdAt: e.created_at, readAt: e.read_at,
      declinedReason: e.declined_reason, declinedAt: e.declined_at, engagedAt: e.engaged_at, doneAt: e.done_at,
      lastOutcome: e.status === "talking" && ev ? { kind: ev.kind === "proposal_expired" ? "expired" : "declined", at: ev.created_at } : null,
      proposal: open ? toProposal(open) : null, engagedFee: acc?.fee_text ?? null, firmPerson: person,
      review: r ? { stars: r.stars, comment: r.comment, line: [r.client_role === "seller" ? "Seller" : "Buyer", r.client_detail].filter(Boolean).join(" · ") } : null,
      conversationKey: `e:${e.conversation_id}`,
    };
  }
  return out;
}

/** Membership of one enquiry conversation. */
export async function enquiryMember(sb: any, userId: string, key: string) {
  const id = key.slice(2);
  const { data: c } = await sb.from("advisor_conversations").select("*").eq("id", id).maybeSingle();
  if (!c) return null;
  const { data: firm } = await sb.from("advisor_firms").select("id, name, owner_user_id, firm_type, city, status").eq("id", c.firm_profile_id).maybeSingle();
  const clients = await orgUsers(sb, c.client_side, c.client_org_id);
  const isFirm = firm?.owner_user_id === userId;
  if (!isFirm && !clients.includes(userId)) return null;
  const { data: last } = await sb.from("advisor_enquiries").select("*").eq("conversation_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const closed = !last || last.status === "declined" || last.status === "closed";
  return { conv: c, firm, clients, isFirm, last, closed };
}

export type EnquiryCard = {
  id: string; at: string; service: string; text: string; timing: string | null; status: string; readAt: string | null;
  client: { name: string; title: string | null; company: string; email: string | null; phone: string | null; side: ClientSide } | null;
};
export type EnquiryThread = {
  firm: { id: string; name: string; sub: string };
  client: { company: string; side: ClientSide; name: string; first: string };
  status: string; service: string; enquiryId: string | null; isFirm: boolean;
  enquiries: EnquiryCard[]; proposals: (ProposalDTO & { enquiryId: string })[];
  closedLine: string | null;
  firmServices: string[]; firmFees: Record<string, any>;
  stars: number | null; me: { name: string; first: string; title: string | null; company: string; email: string | null; phone: string | null; side: ClientSide } | null;
};

/** Cards, events and header facts of one enquiry conversation, worded for the reader. */
export async function enquiryThread(sb: any, userId: string, m: NonNullable<Awaited<ReturnType<typeof enquiryMember>>>) {
  const { conv, firm, isFirm } = m;
  const { data: es } = await sb.from("advisor_enquiries").select("*").eq("conversation_id", conv.id).order("created_at");
  const eIds = (es ?? []).map((e: any) => e.id);
  await sweepExpired(sb, (es ?? []).filter((e: any) => e.status === "proposal").map((e: any) => e.id));
  const [{ data: es2 }, { data: props }, { data: evs }] = await Promise.all([
    sb.from("advisor_enquiries").select("*").eq("conversation_id", conv.id).order("created_at"),
    eIds.length ? sb.from("advisor_proposals").select("*").in("enquiry_id", eIds).order("sent_at") : { data: [] },
    sb.from("advisor_enquiry_events").select("*").eq("conversation_id", conv.id).order("created_at"),
  ]);
  const org = await orgInfo(sb, conv.client_side, conv.client_org_id);
  const ppl = await people(sb, (es2 ?? []).map((e: any) => e.sent_by));
  const last = (es2 ?? [])[(es2 ?? []).length - 1];
  const firmName = firm?.name ?? "The firm";
  const sender = last ? ppl[last.sent_by] : null;
  const enquiries: EnquiryCard[] = (es2 ?? []).map((e: any) => ({
    id: e.id, at: e.created_at, service: e.service_key, text: e.need_text, timing: timingLabel(e.timing), status: e.status, readAt: e.read_at,
    // Only the firm side gets the client's details, and only for enquiries sent to it.
    client: isFirm ? { name: ppl[e.sent_by]?.name ?? "Client", title: ppl[e.sent_by]?.title ?? null, company: org.name, email: ppl[e.sent_by]?.email ?? null, phone: ppl[e.sent_by]?.phone ?? null, side: e.client_side } : null,
  }));
  const proposals = (props ?? []).map((p: any) => ({ ...toProposal(p), enquiryId: p.enquiry_id }));
  const enqOf = Object.fromEntries((es2 ?? []).map((e: any) => [e.id, e]));
  const events = (evs ?? []).filter((x: any) => !["enquiry", "proposal"].includes(x.kind)).map((x: any) => {
    const e = enqOf[x.enquiry_id] ?? {};
    let text = "";
    let green = false;
    switch (x.kind) {
      case "accepted": text = isFirm ? `${org.name} accepted your proposal. You're now their advisor.` : `You accepted the proposal. ${firmName} is now your advisor.`; green = true; break;
      case "proposal_declined": text = isFirm ? `${org.name} declined your proposal.` : "You declined the proposal."; break;
      case "proposal_expired": text = "The proposal expired."; break;
      case "declined": text = isFirm ? `You declined the enquiry: ${reasonText(e.declined_reason).toLowerCase()}.` : `${firmName} declined your enquiry: ${reasonText(e.declined_reason).toLowerCase()}.`; break;
      case "done": text = isFirm ? `${org.name} marked the work as done and rated it ${x.data?.stars ?? ""} ★.` : `You marked the work as done and rated it ${x.data?.stars ?? ""} ★.`; green = true; break;
      case "closed": text = `This enquiry closed because ${firmName} is no longer on PitchSnack.`; break;
    }
    return { id: x.id, at: x.created_at, text, link: null, nda: null, green };
  });
  const closedLine = !last ? null
    : last.status === "declined" ? (isFirm ? `This enquiry is closed. ${org.name} can send a new one from Browse advisors.` : `${firmName} declined this enquiry. You can send a new one from Browse advisors.`)
    : last.status === "closed" ? `This enquiry closed because ${firmName} is no longer on PitchSnack.` : null;
  const thread: EnquiryThread = {
    firm: { id: firm?.id, name: firmName, sub: [firm?.firm_type, firm?.city].filter(Boolean).join(" · ") },
    client: { company: org.name, side: conv.client_side, name: sender?.name ?? "", first: sender?.first ?? "" },
    status: last?.status ?? "enquiry", service: last?.service_key ?? "", enquiryId: last?.id ?? null, isFirm,
    enquiries, proposals, closedLine, firmServices: [], firmFees: {},
    stars: ([...(evs ?? [])].reverse().find((x: any) => x.kind === "done")?.data?.stars as number) ?? null,
    me: null,
  };
  if (!isFirm) {
    const p = (await people(sb, [userId]))[userId];
    thread.me = { name: p?.name ?? "", first: p?.first ?? "", title: p?.title ?? null, company: org.name, email: p?.email ?? null, phone: p?.phone ?? null, side: conv.client_side };
  }
  if (isFirm) {
    const { rowToFee } = await import("@/lib/advisor-firm.functions");
    const [{ data: fr }, { data: fees }] = await Promise.all([
      sb.from("advisor_firms").select("services").eq("id", conv.firm_profile_id).maybeSingle(),
      sb.from("advisor_firm_fees").select("*").eq("firm_id", conv.firm_profile_id),
    ]);
    thread.firmServices = fr?.services ?? [];
    thread.firmFees = Object.fromEntries((fees ?? []).map((f: any) => [f.service, rowToFee(f)]));
  }
  return { thread, events };
}

/** Bell items (in-app). */
export async function bell(sb: any, userIds: string[], title: string, message: string, link: string) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return;
  await sb.from("notifications").insert(ids.map((user_id) => ({ user_id, notification_type: "advisor", title, message, link_url: link })));
}
