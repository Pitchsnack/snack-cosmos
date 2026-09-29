/**
 * Server-only rules for sharing verified reports with buyers.
 * A buyer may open a report only when: Admin has authorised the seller
 * (order delivered) + NDA approved and not expired + active seller share
 * that includes that report. Download also needs allow_download.
 */
export type ReportKind = "financials" | "valuation";
export type ShareRow = { id: string; financials: boolean; valuation: boolean; allow_download: boolean; shared_at: string; revoked_at: string | null };

export async function deliveredKinds(sb: any, startupId: string) {
  const { data } = await sb.from("report_orders").select("kind, delivered_at").eq("startup_id", startupId).eq("status", "delivered");
  const out = { financials: false, valuation: false, financialsAt: null as string | null, valuationAt: null as string | null };
  for (const o of data ?? []) {
    if (o.kind === "financials" || o.kind === "bundle") { out.financials = true; out.financialsAt = o.delivered_at; }
    if (o.kind === "valuation" || o.kind === "bundle") { out.valuation = true; out.valuationAt = o.delivered_at; }
  }
  return out;
}

export function ndaActive(p: any) {
  if (!p?.nda_approved_at || p.status === "declined") return false;
  return !p.nda_expires_at || new Date(p.nda_expires_at).getTime() > Date.now();
}

export async function activeShare(sb: any, pipelineId: string): Promise<ShareRow | null> {
  const { data } = await sb.from("report_shares").select("*").eq("pipeline_id", pipelineId).is("revoked_at", null).maybeSingle();
  return data ?? null;
}

/** Throws unless the buyer may open (and, if asked, download) this report. */
export async function assertBuyerAccess(sb: any, p: any, kind: ReportKind | "any", download = false) {
  if (!ndaActive(p)) throw new Error("The NDA is not active");
  const [d, s] = await Promise.all([deliveredKinds(sb, p.startup_id), activeShare(sb, p.id)]);
  if (!s) throw new Error("The seller hasn't shared a report with you");
  const ok = kind === "any" ? (s.financials && d.financials) || (s.valuation && d.valuation) : s[kind] && d[kind];
  if (!ok) throw new Error("This report isn't shared with you");
  if (download && !s.allow_download) throw new Error("The seller hasn't allowed downloads");
  return { share: s, delivered: d };
}

export async function saveShare(sb: any, p: any, actor: string, o: { financials: boolean; valuation: boolean; allowDownload: boolean }) {
  if (!ndaActive(p)) throw new Error("The NDA with this buyer is not active");
  const d = await deliveredKinds(sb, p.startup_id);
  const fin = o.financials && d.financials;
  const val = o.valuation && d.valuation;
  if (!fin && !val) throw new Error("No authorised report to share yet");
  const now = new Date().toISOString();
  const cur = await activeShare(sb, p.id);
  let id: string;
  if (cur) {
    await sb.from("report_shares").update({ financials: fin, valuation: val, allow_download: o.allowDownload, updated_at: now, updated_by: actor }).eq("id", cur.id);
    id = cur.id;
    await sb.from("report_share_events").insert({ share_id: id, event: "changed", actor_id: actor, detail: detail(fin, val, o.allowDownload) });
  } else {
    const { data, error } = await sb.from("report_shares").insert({
      business_id: p.startup_id, buyer_id: p.buyer_user_id, pipeline_id: p.id, financials: fin, valuation: val,
      allow_download: o.allowDownload, shared_at: now, shared_by: actor,
    }).select("id").single();
    if (error) throw new Error(error.message);
    id = data.id;
    await sb.from("report_share_events").insert({ share_id: id, event: "shared", actor_id: actor, detail: detail(fin, val, o.allowDownload) });
    await sb.from("notifications").insert({ user_id: p.buyer_user_id, notification_type: "deal", title: "A seller shared a report with you",
      message: `${fin && val ? "Financial report and valuation" : fin ? "Financial report" : "Valuation"} · open it from Pipeline.` });
  }
  await sb.from("deal_pipelines").update({ report_shared_at: p.report_shared_at ?? now, report_allow_download: o.allowDownload }).eq("id", p.id);
  return { ok: true, id };
}

export async function revokeShare(sb: any, p: any, actor: string) {
  const cur = await activeShare(sb, p.id);
  if (!cur) return { ok: true };
  const now = new Date().toISOString();
  await sb.from("report_shares").update({ revoked_at: now, revoked_by: actor }).eq("id", cur.id);
  await sb.from("report_share_events").insert({ share_id: cur.id, event: "revoked", actor_id: actor, detail: null });
  await sb.from("deal_pipelines").update({ report_shared_at: null, report_allow_download: false }).eq("id", p.id);
  return { ok: true };
}

const detail = (f: boolean, v: boolean, dl: boolean) => [f && "financials", v && "valuation", dl ? "download allowed" : "view only"].filter(Boolean).join(" · ");
