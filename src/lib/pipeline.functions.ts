import supportSettings from "@/config/deal-support.json";
import type { DealWorkflow, LoiChanges, LoiConsent } from "@/lib/loi-workflow";
import { priceFor, thbOf } from "@/lib/asking-price";
import { dealCompanyName } from "@/lib/pipeline-company";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isBuyerVisible } from "@/lib/hidden-profile";
import type { StatementItem, RatioItem } from "@/lib/financials.functions";

/**
 * Deal pipeline: one row per buyer × listing. Buyer requests the NDA, seller
 * approves, then each step is a shared document with a timestamp so both
 * sides see the same record. Writes go through here (service client after
 * checking the caller is the buyer or has access to the startup).
 */

type Ctx = { supabase: any; userId: string };

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function load(id: string) {
  const sb = await admin();
  const { data, error } = await sb.from("deal_pipelines").select("*").eq("id", id).single();
  if (error || !data) throw new Error("Pipeline not found");
  return data;
}
/** Same as load, but refuses deals that have ended (withdrawn). */
async function loadOpen(id: string) {
  const p = await load(id);
  if (["ended","declined","withdrawn","revoked"].includes(p.status)) throw new Error("This deal has ended");
  return p;
}
async function assertSeller(ctx: Ctx, startupId: string) {
  const { data } = await ctx.supabase.rpc("can_access_startup", { _user_id: ctx.userId, _startup_id: startupId });
  if (!data) throw new Error("Only the seller can do this");
}
async function log(pipelineId: string, event: string, actor: string, note?: string) {
  const sb = await admin();
  await sb.from("deal_pipeline_events").insert({ pipeline_id: pipelineId, event, actor_id: actor, note: note ?? null });
  const { pipelineAlert } = await import("./email-alerts.server");
  await pipelineAlert(pipelineId, event);
}
async function update(id: string, patch: Record<string, unknown>) {
  const sb = await admin();
  const { error } = await sb.from("deal_pipelines").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export type Withdrawal = {
  at: string; side: "seller" | "buyer"; mine: boolean; step: number;
  reason: string | null; comment: string | null; shared: boolean; feedbackSent: boolean;
  byOrg: string; byName: string | null;
};
export type PipelineRow = {
  id: string;
  status: string;
  hiddenProfileId: string;
  startupId: string;
  /** Own organisation for this deal, independent of counterparty NDA visibility. */
  ownCompanyName?: string | null;
  buyerMessage: string | null;
  ndaRequestedAt: string;
  ndaApprovedAt: string | null;
  reportRequestedAt: string | null;
  reportSharedAt: string | null;
  loiFrom?: "buyer" | "seller";
  loiRevision?: number;
  loiChanges?: LoiChanges | null;
  loiSendConsent?: LoiConsent | null;
  loiAcceptConsent?: LoiConsent | null;
  workflow?: DealWorkflow;
  listingRef?: string | null;
  loiAmount: number | null;
  loiExclusivityDays: number | null;
  loiConditions: string | null;
  loiSentAt: string | null;
  loiAcceptedAt: string | null;
  contactAt: string | null;
  legalAt: string | null;
  spaAt: string | null;
  paymentAt: string | null;
  reportViewedAt: string | null;
  reportAllowDownload: boolean;
  ndaExpiresAt: string | null;
  /** Raw stored expiry for legal-date displays; never a derived legacy fallback. */
  ndaStoredExpiresAt: string | null;
  loiStakePct: number | null;
  loiAcceptedByName: string | null;
  loiChangesRequestedAt: string | null;
  /** Open seller request for a letter of intent (cleared when the buyer sends one or the seller withdraws). */
  loiRequest: { at: string; note: string | null; price: number | null; days: number | null; respondBy: string | null } | null;
  exclusivityUntil: string | null;
  updatedAt: string;
  parties: { sellerCompany: string; codeName: string | null; buyerOrg: string; buyerName: string | null; sellerName: string | null };
  counterparty: { name: string; sub: string; person: string | null; verified: boolean; logoUrl: string | null };
  askingPrice: number | null;
  /** Active seller share (null when none / revoked). */
  share: { financials: boolean; valuation: boolean; allowDownload: boolean; sharedAt: string } | null;
  revokedAt: string | null;
  /** Set when either side withdrew; reason/comment only when mine or shared. */
  withdrawal: Withdrawal | null;
  /** Reports Admin has authorised for this business (buyer: only what's shared). */
  reports: { financials: boolean; valuation: boolean };
};

function mapRow(r: any, counterparty: PipelineRow["counterparty"], asking: number | null, parties: PipelineRow["parties"], names: Record<string, string> = {}): PipelineRow {
  return {
    id: r.id,
    status: r.status,
    hiddenProfileId: r.hidden_profile_id,
    startupId: r.startup_id,
    buyerMessage: r.buyer_message,
    ndaRequestedAt: r.nda_requested_at,
    ndaApprovedAt: r.nda_approved_at,
    reportRequestedAt: r.report_requested_at,
    reportSharedAt: r.report_shared_at,
    loiFrom: r.loi_from ?? "buyer", loiRevision: r.loi_revision ?? 0,
    loiChanges: r.loi_changes ?? null, loiSendConsent: r.loi_send_consent ?? null, loiAcceptConsent: r.loi_accept_consent ?? null,
    workflow: publicWorkflow(r.workflow),
    loiAmount: r.loi_amount != null ? Number(r.loi_amount) : null,
    loiExclusivityDays: r.loi_exclusivity_days,
    loiConditions: r.loi_conditions,
    loiSentAt: r.loi_sent_at,
    loiAcceptedAt: r.loi_accepted_at,
    contactAt: r.contact_at,
    legalAt: r.legal_at,
    spaAt: r.spa_at,
    paymentAt: r.payment_at,
    reportViewedAt: r.report_viewed_at ?? null,
    reportAllowDownload: !!r.report_allow_download,
    ndaExpiresAt: r.nda_expires_at ?? (r.nda_approved_at ? new Date(new Date(r.nda_approved_at).getTime() + 730 * 86_400_000).toISOString() : null),
    ndaStoredExpiresAt: r.nda_expires_at ?? null,
    loiStakePct: r.loi_stake_pct != null ? Number(r.loi_stake_pct) : null,
    loiAcceptedByName: r.loi_accepted_by ? names[r.loi_accepted_by] ?? null : null,
    loiChangesRequestedAt: r.loi_changes_requested_at ?? null,
    loiRequest: r.loi_requested_at ? { at: r.loi_requested_at, note: r.loi_request_note ?? null, price: r.loi_request_price != null ? Number(r.loi_request_price) : null, days: r.loi_request_days ?? null, respondBy: r.loi_request_respond_by ?? null } : null,
    exclusivityUntil: r.exclusivity_until ?? null,
    updatedAt: r.updated_at,
    parties,
    counterparty,
    askingPrice: asking,
    share: null,
    revokedAt: null,
    reports: { financials: false, valuation: false },
    withdrawal: null,
  };
}

/** Buyer: request the NDA for a live listing. Requires buyer verification. */
export const requestNda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ listingId: z.string().uuid(), invitationId:z.string().uuid().optional(), message: z.string().max(1000).optional(), consent: z.string().max(500).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = await admin();
    const { data: hp } = await sb.from("hidden_profiles").select("id, startup_id, approval_status, live").eq("id", data.listingId).maybeSingle();
    // Approval is the only source of truth for what a buyer may reach.
    if (!isBuyerVisible(hp)) throw new Error("This listing isn't available");
    const { data: bv } = await (await import("./profile-verification.server")).verificationByUser(sb, context.userId, "status").then((data: any) => ({ data }));
    const { data: uv } = await sb.from("user_verifications").select("user_id").eq("user_id", context.userId).maybeSingle();
    if (!uv && bv?.status !== "verified") throw new Error("Verify your buyer profile first");
    const { requireRole, planAccess, valueCap, spendRequest } = await import("./plan-access.server");
    await requireRole(context.userId, ["buyer"]);
    // An invitation still New or Viewed opens the listing on any plan and uses no request.
    const { orgInvitations } = await import("./invitations.server");
    const orgRows=(await orgInvitations(context.userId,[hp.id])).rows;
    const invRow = orgRows.find((r) => (!data.invitationId||r.inv.id===data.invitationId)&&(r.status === "new" || r.status === "viewed" || r.status === "not_interested")) ?? null;
    if(data.invitationId&&!invRow)throw new Error('This NDA has changed. The list is up to date.');
    if (!invRow) {
      const cap = valueCap(await planAccess(context.userId));
      const ask = thbOf(hp.live as never);
      if (cap !== null && ask != null && ask / 1_000_000 > cap) throw new Error("This listing is above your plan's price range");
      await spendRequest(context.userId, "nda", hp.id);
    }
    const {data:row,error}=await sb.rpc("nda_request_commit",{_listing:hp.id,_startup:hp.startup_id,_actor:context.userId,_invitation:invRow?.inv.id??null,_message:data.message??null});
    if(error)throw new Error(error.message);
    if(row?.changed){
      if(data.consent) await sb.from('deal_pipeline_events').update({note:data.consent}).eq('pipeline_id',row.id).eq('event','nda_requested').eq('actor_id',context.userId).gte('created_at',new Date(Date.now()-60000).toISOString());
      await (await import('./email-alerts.server')).pipelineAlert(row.id,'nda_requested');
      const {notifySellers}=await import("./invitations.server");
      await notifySellers(hp.startup_id,invRow?"An investor accepted your invitation and signed the NDA":"New NDA request","Open Pipeline › NDA Invitations to review and approve the NDA.",`/marketplace/pipeline/invitations?open=${invRow?.inv.id??row.id}`);
    }
    return {ok:true,invitationId:invRow?.inv.id??null};
  });

/** Buyer: NDA status per listing id, for Browse listings. */
export const myNdaStatuses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("deal_pipelines")
      .select("hidden_profile_id, status, nda_approved_at, contact_at")
      .eq("buyer_user_id", context.userId);
    const out: Record<string, "requested" | "approved" | "exchanged" | "declined"> = {};
    for (const r of data ?? []) {
      if (r.status === "withdrawn") continue;
      out[r.hidden_profile_id] = r.status === "declined" ? "declined" : r.contact_at ? "exchanged" : r.nda_approved_at ? "approved" : "requested";
    }
    return out;
  });

/** When the buyer requested each of their NDAs (for the Browse panel note). */
export const myNdaRequestDates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("deal_pipelines")
      .select("hidden_profile_id, status, created_at")
      .eq("buyer_user_id", context.userId);
    const out: Record<string, string> = {};
    for (const r of data ?? []) if (r.status !== "withdrawn" && r.status !== "declined") out[r.hidden_profile_id] = r.created_at;
    return out;
  });

async function userNames(ids: string[]) {
  if (!ids.length) return {} as Record<string, string>;
  const sb = await admin();
  const { data } = await sb.from("users").select("id, first_name, last_name, email").in("id", ids);
  const m: Record<string, string> = {};
  for (const u of data ?? []) m[u.id] = [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email;
  return m;
}

/** Seller or buyer pipeline, depending on persona. */
export const listPipeline = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ as: z.enum(["seller", "buyer"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = await admin();
    let rows: any[] = [];
    if (data.as === "buyer") {
      const r = await sb.from("deal_pipelines").select("*").eq("buyer_user_id", context.userId).not("status", "in", "(declined,withdrawn)").order("updated_at", { ascending: false });
      rows = r.data ?? [];
    } else {
      // Only businesses the caller owns (not every business an Admin can see).
      const { data: own } = await sb.from("startup_ownership").select("startup_id").eq("owning_agent_user_id", context.userId);
      const { data: su } = await sb.from("startup_users").select("startup_id").eq("user_id", context.userId);
      const ids = await (await import("@/lib/workspace-scope.server")).scopeStartupIds(context.userId, [...new Set([...(own ?? []), ...(su ?? [])].map((x: any) => x.startup_id as string))]);
      if (ids.length) {
        const r = await sb.from("deal_pipelines").select("*").in("startup_id", ids).not("status", "in", "(declined,withdrawn)").order("updated_at", { ascending: false });
        rows = r.data ?? [];
      }
    }
    const hpIds = [...new Set(rows.map((r) => r.hidden_profile_id))];
    const stIds = [...new Set(rows.map((r) => r.startup_id))];
    const buyerIds = [...new Set(rows.map((r) => r.buyer_user_id))];
    const pipeIds = rows.map((r) => r.id);
    const { deliveredKinds, ndaActive } = await import("./report-shares.server");
    const empty = { data: [] as any[] };
    // Independent lookups run in parallel.
    const [{ data: hps }, { data: sts }, { data: owners }, { data: bvs }, { data: shares }, dkList] = await Promise.all([
      hpIds.length ? sb.from("hidden_profiles").select("id, ref_no, code_name, region, asking_price, asking_price_thb, startup_id").in("id", hpIds) : empty,
      stIds.length ? sb.from("startups").select("id, startup_name, industry, logo_url").in("id", stIds) : empty,
      stIds.length ? sb.from("startup_ownership").select("startup_id, owning_agent_user_id").in("startup_id", stIds) : empty,
      buyerIds.length ? (await import("./profile-verification.server")).verificationsByUsers(sb, buyerIds, "user_id, company_name, buyer_type, status").then((mp: Map<string, any>) => ({ data: [...mp.values()] })) : empty,
      pipeIds.length ? sb.from("report_shares").select("*").in("pipeline_id", pipeIds).order("shared_at", { ascending: false }) : empty,
      Promise.all(stIds.map((id) => deliveredKinds(sb, id))),
    ]);
    const hpMap = Object.fromEntries((hps ?? []).map((h: any) => [h.id, h]));
    const stMap = Object.fromEntries((sts ?? []).map((s: any) => [s.id, s]));
    const ownerMap = Object.fromEntries((owners ?? []).map((o: any) => [o.startup_id, o.owning_agent_user_id]));
    // Logos live in private storage; one batched signing call.
    const logoPaths = (sts ?? []).map((s: any) => s.logo_url).filter((p: any): p is string => !!p && !/^https?:\/\//.test(p));
    const signedLogos: Record<string, string> = {};
    const [names, signedRes] = await Promise.all([
      userNames([...new Set([...buyerIds, ...Object.values(ownerMap), ...rows.map((r) => r.loi_accepted_by).filter(Boolean)])] as string[]),
      data.as === "buyer" && logoPaths.length ? sb.storage.from("pipeline-valuation").createSignedUrls(logoPaths, 3600) : Promise.resolve({ data: [] as any[] }),
    ]);
    for (const d of (signedRes as any).data ?? []) if (d.path && d.signedUrl) signedLogos[d.path] = d.signedUrl;
    const bvMap: Record<string, any> = Object.fromEntries((bvs ?? []).map((b: any) => [b.user_id, { ...b }]));
    // The linked Investors Directory row is the source of truth for name and type.
    if (buyerIds.length) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: links } = await supabaseAdmin
        .from("buyer_profiles")
        .select("user_id, investors:investor_id(investor_name, investor_type)")
        .in("user_id", buyerIds);
      for (const l of (links ?? []) as any[]) {
        const inv = l.investors;
        if (!inv) continue;
        const cur = (bvMap[l.user_id] ??= {});
        if (inv.investor_name) cur.company_name = inv.investor_name;
        if (inv.investor_type) cur.buyer_type = inv.investor_type;
      }
    }

    const items = rows.map((r) => {
      const hp = hpMap[r.hidden_profile_id] ?? {};
      const st0 = stMap[r.startup_id] ?? {};
      const bv0 = bvMap[r.buyer_user_id] ?? {};
      const revealed0 = ndaActive(r);
      const parties = {
        sellerCompany: data.as === "seller" || revealed0 ? st0.startup_name || hp.code_name || hp.ref_no || "Business" : hp.code_name || hp.ref_no || "Business",
        codeName: hp.code_name ?? null,
        buyerOrg: revealed0 ? bv0.company_name || names[r.buyer_user_id] || "Buyer" : bv0.buyer_type || "Buyer",
        buyerName: revealed0 ? names[r.buyer_user_id] ?? null : null,
        sellerName: revealed0 ? names[ownerMap[r.startup_id]] ?? null : null,
      };
      // Sellers see their own amount; a buyer sees it only with an approved NDA.
      const asking = data.as === "seller" || revealed0 ? thbOf(hp) : null;
      if (data.as === "seller") {
        const bv = bvMap[r.buyer_user_id] ?? {};
        return mapRow(r, {
          name: revealed0 ? bv.company_name || names[r.buyer_user_id] || "Buyer" : bv.buyer_type || "Buyer",
          sub: bv.buyer_type || "Buyer",
          person: revealed0 ? names[r.buyer_user_id] ?? null : null,
          verified: bv.status === "verified",
          logoUrl: null,
        }, asking, parties, names);
      }
      const st = stMap[r.startup_id] ?? {};
      const revealed = ndaActive(r);
      return mapRow(r, {
        name: revealed ? st.startup_name || hp.code_name : hp.code_name || hp.ref_no || "Business",
        sub: [st.industry, hp.region].filter(Boolean).join(" · "),
        person: null,
        verified: true,
        // Identity stays hidden until the seller approves the NDA.
        logoUrl: revealed && st.logo_url ? (signedLogos[st.logo_url] ?? (/^https?:\/\//.test(st.logo_url) ? st.logo_url : null)) : null,
      }, asking, parties, names);
    });
    const dk: Record<string, Awaited<ReturnType<typeof deliveredKinds>>> = {};
    stIds.forEach((id, i) => { dk[id] = dkList[i]; });
    items.forEach((it, i) => {
      const r = rows[i];
      it.listingRef = hpMap[r.hidden_profile_id]?.ref_no ?? null;
      it.ownCompanyName = dealCompanyName(data.as === "seller", stMap[r.startup_id]?.startup_name, bvMap[r.buyer_user_id]?.company_name);
      const mine = (shares ?? []).filter((x: any) => x.pipeline_id === r.id);
      const act = mine.find((x: any) => !x.revoked_at);
      const d = dk[r.startup_id];
      const live = !!act && ndaActive(r);
      it.share = live ? { financials: act.financials && d.financials, valuation: act.valuation && d.valuation, allowDownload: act.allow_download, sharedAt: act.shared_at } : null;
      it.revokedAt = !act && mine[0]?.revoked_at ? mine[0].revoked_at : null;
      it.reports = data.as === "seller" ? { financials: d.financials, valuation: d.valuation } : { financials: !!it.share?.financials, valuation: !!it.share?.valuation };
      if (data.as === "buyer" && !it.share) it.reportSharedAt = null;
    });
    const endedIds = rows.filter((r) => r.status === "ended").map((r) => r.id);
    if (endedIds.length) {
      const { data: ws } = await sb.from("deal_withdrawals").select("*").in("deal_id", endedIds);
      const wn = await userNames([...new Set((ws ?? []).map((w: any) => w.withdrawn_by))] as string[]);
      items.forEach((it) => {
        const w = (ws ?? []).find((x: any) => x.deal_id === it.id);
        if (!w) return;
        const mine = w.side === data.as;
        const show = mine || w.shared;
        it.withdrawal = {
          at: w.withdrawn_at, side: w.side, mine, step: w.step_at_withdrawal,
          reason: show ? w.reason_code : null, comment: show ? w.comment ?? null : null, shared: w.shared,
          feedbackSent: mine && w.withdrawn_by === context.userId && w.feedback_sent,
          byOrg: w.side === "seller" ? it.parties.sellerCompany : it.parties.buyerOrg, byName: wn[w.withdrawn_by] ?? null,
        };
      });
    }
    return items;
  });

/** Uses the same canonical waiting rules as the workspace. */
export const pipelineBadgeCount = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
 .inputValidator(d=>z.object({as:z.enum(["seller","buyer"])}).parse(d))
 .handler(async({data,context})=>{
  const {data:rows,error}=await context.supabase.from("deal_pipelines").select("*").not("status","in","(declined,withdrawn,ended)");
  if(error)throw new Error("Deals could not be loaded");
  const {waitState}=await import("./pipeline-state");
  let scoped:any[]=rows??[];
  if(data.as==="buyer")scoped=scoped.filter(r=>r.buyer_user_id===context.userId);
  else {const {data:own}=await context.supabase.from("startup_ownership").select("startup_id").eq("owning_agent_user_id",context.userId);const {data:su}=await context.supabase.from("startup_users").select("startup_id").eq("user_id",context.userId);const ids=await(await import("./workspace-scope.server")).scopeStartupIds(context.userId,[...new Set([...(own??[]),...(su??[])].map((r:any)=>r.startup_id))] as string[]);scoped=scoped.filter(r=>ids.includes(r.startup_id));}
  return scoped.filter(r=>waitState(mapRow(r,{name:"",sub:"",person:null,verified:false,logoUrl:null},null,{sellerCompany:"",buyerOrg:"",codeName:null,buyerName:null,sellerName:null}),data.as==="seller").onYou).length;
 });

const Id = z.object({ id: z.string().uuid() });

export const decideNda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Id.extend({ approve: z.boolean(), shareReport: z.boolean().optional(), consent: z.string().max(500).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const p = await loadOpen(data.id);
    await assertSeller(context, p.startup_id);
    const {error}=await (await admin()).rpc("nda_decision_commit",{_id:p.id,_actor:context.userId,_approve:data.approve});
    if(error)throw new Error(error.message);
    if (!data.approve) {
      await (await import('./email-alerts.server')).pipelineAlert(p.id,'nda_declined');
      return { ok: true };
    }
    if(data.consent) await (await admin()).from('deal_pipeline_events').update({note:`Consent: ${data.consent}`}).eq('pipeline_id',p.id).eq('event','nda_approved').eq('actor_id',context.userId);
    await (await import('./email-alerts.server')).pipelineAlert(p.id,'nda_approved');
    if (data.shareReport) {
      const { saveShare } = await import("./report-shares.server");
      try {
        await saveShare(await admin(), await load(p.id), context.userId, { financials: true, valuation: true, allowDownload: false });
        await log(p.id, "report_shared", context.userId);
      } catch { /* no authorised report yet — seller can share later */ }
    }
    return { ok: true };
  });

export const shareReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Id.extend({ financials: z.boolean().default(true), valuation: z.boolean().default(false), allowDownload: z.boolean().default(false) }).parse(d))
  .handler(async ({ data, context }) => {
    const p = await loadOpen(data.id);
    await assertSeller(context, p.startup_id);
    const { saveShare, activeShare } = await import("./report-shares.server");
    const had = await activeShare(await admin(), p.id);
    await saveShare(await admin(), p, context.userId, data);
    await log(p.id, had ? "report_share_changed" : "report_shared", context.userId);
    return { ok: true };
  });

export const revokeReportShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Id.parse(d))
  .handler(async ({ data, context }) => {
    const p = await loadOpen(data.id);
    await assertSeller(context, p.startup_id);
    const { revokeShare } = await import("./report-shares.server");
    await revokeShare(await admin(), p, context.userId);
    await log(p.id, "report_revoked", context.userId);
    return { ok: true };
  });

export const askForReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Id.parse(d))
  .handler(async ({ data, context }) => {
    const p = await loadOpen(data.id);
    if (p.buyer_user_id !== context.userId) throw new Error("Not your pipeline");
    await update(p.id, { report_requested_at: new Date().toISOString() });
    await log(p.id, "report_requested", context.userId);
    return { ok: true };
  });

export type LoiParty = { nameTh: string | null; nameEn: string | null; regNo: string | null; short: string };
/** Buyer: registered identity of both parties for the LOI (already visible post-NDA). */
export const loiParties = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Id.parse(d))
  .handler(async ({ data, context }) => {
    const p = await load(data.id);
    await assertParty(context, p);
    if (!p.nda_approved_at) throw new Error("The NDA must be approved first");
    const buyerId = p.buyer_user_id as string;
    const sb = await admin();
    const [{ data: ci }, { data: st }, { data: hp }, { data: bp }, { data: bv }, { data: up }] = await Promise.all([
      sb.from("company_info_th").select("legal_name_th, legal_name_en, registration_number").eq("startup_id", p.startup_id).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
      sb.from("startups").select("startup_name, registered_name, registered_number").eq("id", p.startup_id).maybeSingle(),
      sb.from("hidden_profiles").select("ref_no").eq("id", p.hidden_profile_id).maybeSingle(),
      sb.from("buyer_profiles").select("legal_name, investor_id").eq("user_id", buyerId).maybeSingle(),
      (await import("./profile-verification.server")).verificationByUser(sb, buyerId, "company_name, registration_no").then((data: any) => ({ data })),
      sb.from("user_profiles").select("organisation").eq("user_id", buyerId).maybeSingle(),
    ]);
    const { data: inv } = bp?.investor_id
      ? await sb.from("investors").select("investor_name, legal_name").eq("id", bp.investor_id).maybeSingle()
      : { data: null };
    const thai = (s?: string | null) => !!s && /[\u0E00-\u0E7F]/.test(s);
    const bLegal = inv?.investor_name || null;
    const buyer: LoiParty = {
      nameTh: thai(bLegal) ? bLegal : null,
      nameEn: thai(bLegal) ? null : bLegal,
      regNo: bv?.registration_no ?? null,
      short: inv?.investor_name || bv?.company_name || up?.organisation || "the buyer",
    };
    const sTh = ci?.legal_name_th || (thai(st?.registered_name) ? st?.registered_name : null) || null;
    const sEn = ci?.legal_name_en || (!thai(st?.registered_name) ? st?.registered_name : null) || null;
    const seller: LoiParty = {
      nameTh: sTh,
      nameEn: sEn || (!sTh ? st?.startup_name ?? null : null),
      regNo: ci?.registration_number || st?.registered_number || null,
      short: st?.startup_name || sEn || sTh || "the seller",
    };
    return { buyer, seller, listingCode: (hp?.ref_no as string | null) ?? null };
  });

const Side = z.enum(["seller","buyer"]);
const Terms = { amount:z.number().int().positive().max(1e15),exclusivityDays:z.number().int().min(0).max(365),conditions:z.string().max(2000).default("") };
async function transition(ctx:Ctx,p:any,action:string,side:"seller"|"buyer",version:number,terms:Record<string,unknown>={}) {
 const {data,error}=await ctx.supabase.rpc("pipeline_transition",{_id:p.id,_action:action,_side:side,_version:version,_terms:terms});
 if(error)throw new Error(error.message);
 if(data?.event){const {pipelineAlert}=await import("./email-alerts.server");await pipelineAlert(p.id,data.event,data.eventId,side);
 if(["loi_sent","loi_revised_sent"].includes(data.event)){const sb=await admin();const {sideUsers,bell}=await import("./advisor-pipeline.server");await bell(sb,await sideUsers(sb,p,side==="seller"?"buyer":"seller"),"New letter of intent",`A ${side} sent you a letter of intent. Open Pipeline to review it.`,"/marketplace/pipeline/all-deals?deal="+p.id);}}
 return {ok:true};
}
function publicWorkflow(w:any):DealWorkflow {
 const out:DealWorkflow={supportName:w?.supportName??null,supportAt:w?.supportAt??null,choices:w?.choices??{},receipts:{},spaDraftedAt:w?.spaDraftedAt??null,spaSignedAt:w?.spaSignedAt??null,payment:w?.payment??{}};
 for(const side of ["seller","buyer"] as const){const r=w?.receipts?.[side];if(r)out.receipts[side]={at:r.at,fileName:r.fileName??null};}return out;
}
export const sendLoi = createServerFn({method:"POST"}).middleware([requireSupabaseAuth])
 .inputValidator(d=>Id.extend({...Terms,side:Side.default("buyer"),version:z.number().int().min(0),revised:z.boolean().default(false),read:z.literal(true),consent:z.string().min(10).max(2000)}).parse(d))
 .handler(async({data,context})=>{const p=await loadOpen(data.id);return transition(context,p,data.revised?"resend":"send",data.side,data.version,{amount:data.amount,days:data.exclusivityDays,conditions:data.conditions,consent:data.consent,read:data.read});});
/** Retained endpoint refuses new requests; existing withdrawal/fulfilment remains. */
export const requestLoi = createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator(d=>Id.parse(d)).handler(async()=>{throw new Error("Either side can now send a letter of intent. New requests are no longer available.");});

export const withdrawLoiRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Id.parse(d))
  .handler(async ({ data, context }) => {
    const p = await loadOpen(data.id);
    await assertSeller(context, p.startup_id);
    if (!p.loi_requested_at) return { ok: true };
    await update(p.id, { loi_requested_at: null, loi_requested_by: null });
    await log(p.id, "loi_request_withdrawn", context.userId);
    return { ok: true };
  });

export const decideLoi = createServerFn({method:"POST"}).middleware([requireSupabaseAuth])
 .inputValidator(d=>Id.extend({side:Side,version:z.number().int().min(0),decision:z.enum(["accept","decline","changes","accept_revised"]),consent:z.string().max(2000).optional(),read:z.boolean().optional(),amount:z.number().int().positive().max(1e15).optional(),exclusivityDays:z.number().int().min(0).max(365).optional(),conditions:z.string().max(2000).optional(),note:z.string().max(2000).optional()}).parse(d))
 .handler(async({data,context})=>{const p=await loadOpen(data.id);return transition(context,p,data.decision,data.side,data.version,{amount:data.amount,days:data.exclusivityDays,conditions:data.conditions,note:data.note,consent:data.consent,read:data.read,supportName:supportSettings.name});});
export const saveStageChoice=createServerFn({method:"POST"}).middleware([requireSupabaseAuth])
 .inputValidator(d=>Id.extend({side:Side,stage:z.enum(["valuation","legal"]),choice:z.enum(["pitchsnack","own","none"]).nullable(),unlock:z.boolean().optional()}).parse(d))
 .handler(async({data,context})=>{const p=await loadOpen(data.id);return transition(context,p,data.unlock?"unlock":"choice",data.side,p.loi_revision,{stage:data.stage,choice:data.choice});});
export const confirmPayment=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator(d=>Id.extend({side:Side}).parse(d))
 .handler(async({data,context})=>{const p=await loadOpen(data.id);return transition(context,p,"payment",data.side,p.loi_revision);});
export const receiveValuation=createServerFn({method:"POST"}).middleware([requireSupabaseAuth])
 .inputValidator(d=>Id.extend({side:Side,file:z.object({name:z.string().max(200),type:z.string().max(120),base64:z.string().max(14000000)}).optional()}).parse(d))
 .handler(async({data,context})=>{const p=await loadOpen(data.id);if(data.side==="buyer"?p.buyer_user_id!==context.userId:false)throw new Error("Not your deal");if(data.side==="seller")await assertSeller(context,p.startup_id);if(!p.loi_accepted_at||p.workflow?.choices?.[data.side]?.valuation?.value!=="own")throw new Error("Choose your own valuer first");let path:string|null=null;
 const sb=await admin();if(data.file){if(!/\.(pdf|docx?|xlsx?)$/i.test(data.file.name))throw new Error("Choose PDF, Word or Excel");const bytes=Uint8Array.from(atob(data.file.base64),c=>c.charCodeAt(0));if(bytes.length>10*1024*1024)throw new Error("Choose a file under 10 MB");path=`pipeline-valuation/${p.id}/${data.side}/${crypto.randomUUID()}`;const {error}=await sb.storage.from("pipeline-valuation").upload(path,bytes,{contentType:data.file.type||"application/octet-stream"});if(error)throw new Error("Report could not be uploaded");}
 try{return await transition(context,p,"receipt",data.side,p.loi_revision,{fileName:data.file?.name??null,filePath:path});}catch(e){if(path)await sb.storage.from("pipeline-valuation").remove([path]);throw e;}});
export const readValuationFile=createServerFn({method:"GET"}).middleware([requireSupabaseAuth]).inputValidator(d=>Id.extend({side:Side}).parse(d))
 .handler(async({data,context})=>{const p=await loadOpen(data.id);const side=await assertParty(context,p);if(side!==data.side)throw new Error("This report belongs to the other side");if(!p.nda_approved_at||(p.nda_expires_at&&Date.parse(p.nda_expires_at)<=Date.now()))throw new Error("An active NDA is required");const path=p.workflow?.receipts?.[side]?.filePath;if(!path)throw new Error("No attachment");if(!new RegExp(`^pipeline-valuation/${p.id}/${side}/[0-9a-f-]{36}$`).test(path))throw new Error("Invalid report attachment");const {data:r,error}=await(await admin()).storage.from("pipeline-valuation").createSignedUrl(path,300);if(error||!r)throw new Error("Report could not be opened");return {url:r.signedUrl};});
export const pendingLoiDeclines=createServerFn({method:"GET"}).middleware([requireSupabaseAuth]).inputValidator(d=>z.object({side:Side}).parse(d)).handler(async({data,context})=>{
 const {data:events,error}=await context.supabase.from("deal_pipeline_events").select("id,pipeline_id,payload,created_at").eq("event","loi_declined").order("created_at");if(error)throw new Error("Notices could not be loaded");const {data:seen}=await context.supabase.from("loi_decline_receipts").select("event_id").eq("user_id",context.userId);const ids=new Set((seen??[]).map(r=>r.event_id));const out=[];
 for(const e of events??[]){const payload=e.payload as any;if(ids.has(e.id)||payload?.from!==data.side)continue;const p=await load(e.pipeline_id);if(data.side==="buyer"){if(p.buyer_user_id!==context.userId)continue;}else{try{await assertSeller(context,p.startup_id);}catch{continue;}}out.push({id:e.id,pipelineId:e.pipeline_id,at:e.created_at,amount:payload.amount as number,days:payload.days as number,revised:!!payload.previous,side:payload.side as string});}return out;});
export const acknowledgeLoiDecline=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator(d=>z.object({eventId:z.string().uuid()}).parse(d)).handler(async({data,context})=>{const {error}=await context.supabase.from("loi_decline_receipts").upsert({event_id:data.eventId,user_id:context.userId},{ignoreDuplicates:true});if(error)throw new Error("Notice could not be acknowledged");return {ok:true};});

/** Seller shares the Legal folder / SPA draft, or marks payment complete. */
export const shareStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Id.extend({ step: z.enum(["legal", "spa", "payment"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const p = await loadOpen(data.id);
    await assertSeller(context, p.startup_id);
    const prev = { legal: p.contact_at, spa: p.legal_at, payment: p.spa_at }[data.step];
    if (!prev) throw new Error("Finish the previous step first");
    await update(p.id, { [`${data.step}_at`]: new Date().toISOString() });
    await log(p.id, `${data.step}_shared`, context.userId);
    return { ok: true };
  });

export const pipelineEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Id.parse(d))
  .handler(async ({ data, context }) => {
    const { data: ev } = await context.supabase
      .from("deal_pipeline_events")
      .select("id, event, actor_id, created_at, payload")
      .eq("pipeline_id", data.id)
      .order("created_at", { ascending: false });
    return ev ?? [];
  });

async function assertParty(ctx: Ctx, p: any) {
  if (p.buyer_user_id === ctx.userId) return "buyer" as const;
  await assertSeller(ctx, p.startup_id);
  return "seller" as const;
}

export type ReportData = {
  years: number[];
  income: Record<string, Record<number, number | null>>;
  position: Record<string, Record<number, number | null>>;
  ratios: { code: string; label: string; value: number | null; unit: string | null }[];
  info: { registration: string | null; capital: number | null; founded: string | null; employees: string | null; directors: string | null; shareholders: string | null };
  valuationShared: boolean;
  /** Full filed line items, same shape the seller's My Financials uses. */
  full?: { income: StatementItem[]; position: StatementItem[]; cashFlow: StatementItem[]; ratios: RatioItem[] };
};

async function buildReport(startupId: string): Promise<ReportData> {
  const sb = await admin();
  const [inc, pos, rat, ci, st, vo, cf] = await Promise.all([
    sb.from("income_statement_items").select("fiscal_year, item_code, item_label, amount, percent_change, display_order, is_total").eq("startup_id", startupId),
    sb.from("financial_position_items").select("fiscal_year, item_code, item_label, amount, percent_change, display_order, is_total").eq("startup_id", startupId),
    sb.from("financial_ratios").select("fiscal_year, ratio_category, ratio_code, ratio_label, value, unit, display_order").eq("startup_id", startupId).order("display_order"),
    sb.from("company_info_th").select("registration_number, registered_capital_thb, registration_date, authorized_signatory_th").eq("startup_id", startupId).maybeSingle(),
    sb.from("startups").select("registered_number, registered_capital, year_founded, company_size").eq("id", startupId).maybeSingle(),
    sb.from("report_orders").select("kind, status").eq("startup_id", startupId).eq("status", "delivered"),
    sb.from("cash_flow_items").select("fiscal_year, item_code, item_label, amount, percent_change, display_order, is_total, section").eq("startup_id", startupId),
  ]);
  const income: ReportData["income"] = {}; const position: ReportData["position"] = {};
  const ys = new Set<number>();
  for (const r of inc.data ?? []) { ys.add(r.fiscal_year); (income[r.item_code] ??= {})[r.fiscal_year] = r.amount != null ? Number(r.amount) : null; }
  for (const r of pos.data ?? []) { ys.add(r.fiscal_year); (position[r.item_code] ??= {})[r.fiscal_year] = r.amount != null ? Number(r.amount) : null; }
  const years = [...ys].sort((a, b) => a - b).slice(-5);
  const last = years[years.length - 1];
  const ratios = (rat.data ?? []).filter((r: any) => r.fiscal_year === last).map((r: any) => ({ code: r.ratio_code, label: r.ratio_label, value: r.value != null ? Number(r.value) : null, unit: r.unit }));
  const nn = (v: unknown) => (v == null ? null : Number(v));
  const items = (rows: any[] | null): StatementItem[] => (rows ?? []).filter((r) => years.includes(r.fiscal_year)).map((r) => ({
    fiscal_year: r.fiscal_year, item_code: r.item_code, item_label: r.item_label, amount: nn(r.amount), percent_change: nn(r.percent_change),
    display_order: r.display_order ?? 0, is_total: !!r.is_total, section: r.section ?? null,
  }));
  const fullRatios: RatioItem[] = (rat.data ?? []).filter((r: any) => years.includes(r.fiscal_year)).map((r: any) => ({
    fiscal_year: r.fiscal_year, ratio_category: r.ratio_category, ratio_code: r.ratio_code, ratio_label: r.ratio_label, value: nn(r.value), unit: r.unit, display_order: r.display_order ?? 0,
  }));
  return {
    years, income, position, ratios,
    info: {
      registration: ci.data?.registration_number ?? st.data?.registered_number ?? null,
      capital: ci.data?.registered_capital_thb != null ? Number(ci.data.registered_capital_thb) : st.data?.registered_capital != null ? Number(st.data.registered_capital) : null,
      founded: st.data?.year_founded ? String(st.data.year_founded) : ci.data?.registration_date ? String(ci.data.registration_date).slice(0, 4) : null,
      employees: st.data?.company_size ?? null,
      directors: ci.data?.authorized_signatory_th ?? null,
      shareholders: null,
    },
    valuationShared: (vo.data ?? []).some((o: any) => o.kind === "valuation" || o.kind === "bundle"),
    full: { income: items(inc.data), position: items(pos.data), cashFlow: items(cf.data), ratios: fullRatios },
  };
}

/** Report viewer data. Buyer opens are logged so the seller sees "Report viewed". */
export const getPipelineReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Id.parse(d))
  .handler(async ({ data, context }) => {
    const p = await loadOpen(data.id);
    const role = await assertParty(context, p);
    if (role === "buyer") {
      const { assertBuyerAccess } = await import("./report-shares.server");
      const { share } = await assertBuyerAccess(await admin(), p, "any");
      // Seller-shared reports are always free to the buyer; plan report allowances
      // (can_open_report / record_report_open) are kept for buyer-ordered reports later.
      await update(p.id, { report_viewed_at: new Date().toISOString() });
      await log(p.id, "report_viewed", context.userId);
      const r = await buildReport(p.startup_id);
      return { ...r, valuationShared: r.valuationShared && share.valuation, allowDownload: share.allow_download };
    }
    return { ...(await buildReport(p.startup_id)), allowDownload: true };
  });

/** Buyer: every received report side by side. */
export const compareReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = await admin();
    const { data: rows } = await sb.from("deal_pipelines").select("id, startup_id").eq("buyer_user_id", context.userId)
      .not("nda_approved_at", "is", null).not("report_shared_at", "is", null).neq("status", "declined");
    const { assertBuyerAccess } = await import("./report-shares.server");
    const out: Record<string, ReportData> = {};
    for (const r of rows ?? []) {
      const full = await load(r.id);
      try { await assertBuyerAccess(sb, full, "financials"); } catch { continue; }
      out[r.id] = await buildReport(r.startup_id);
    }
    return out;
  });

/** Seller: the buyer's profile, only for pairs with an approved NDA. */
export const investorProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Id.parse(d))
  .handler(async ({ data, context }) => {
    const p = await load(data.id);
    await assertSeller(context, p.startup_id);
    const sb = await admin();
    const [{ data: bv }, { data: up }, { data: u }] = await Promise.all([
      (await import("./profile-verification.server")).verificationByUser(sb, p.buyer_user_id, "company_name, buyer_type, status").then((data: any) => ({ data })),
      sb.from("user_profiles").select("title, organisation, bio, city, country, industry_focus, buyer_type, experience").eq("user_id", p.buyer_user_id).maybeSingle(),
      sb.from("users").select("first_name, last_name, email").eq("id", p.buyer_user_id).maybeSingle(),
    ]);
    const approved = !!p.nda_approved_at;
    const sectors = Array.isArray(up?.industry_focus) ? up.industry_focus.join(", ") : up?.industry_focus ?? null;
    return {
      org: bv?.company_name || up?.organisation || [u?.first_name, u?.last_name].filter(Boolean).join(" ") || "Buyer",
      type: bv?.buyer_type || up?.buyer_type || null,
      city: [up?.city, up?.country].filter(Boolean).join(", ") || null,
      verified: bv?.status === "verified",
      about: up?.bio ?? null,
      sectors: sectors || null,
      trackRecord: up?.experience ?? null,
      person: approved ? { name: [u?.first_name, u?.last_name].filter(Boolean).join(" ") || u?.email || null, role: up?.title ?? null } : null,
    };
  });

/** Buyer: the seller's profile, contact only once the NDA is approved. */
export const sellerProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Id.parse(d))
  .handler(async ({ data, context }) => {
    const p = await load(data.id);
    if (p.buyer_user_id !== context.userId) throw new Error("Not your pipeline");
    const sb = await admin();
    const approved = !!p.nda_approved_at;
    const [{ data: hp }, { data: st }, { data: own }] = await Promise.all([
      sb.from("hidden_profiles").select("code_name, asking_price, asking_price_thb, deal_type, reason, headline, region").eq("id", p.hidden_profile_id).maybeSingle(),
      sb.from("startups").select("startup_name, industry, city, year_founded, company_size, website_url, short_description").eq("id", p.startup_id).maybeSingle(),
      sb.from("startup_ownership").select("owning_agent_user_id").eq("startup_id", p.startup_id).maybeSingle(),
    ]);
    let person: { name: string | null; role: string | null } | null = null;
    if (approved && own?.owning_agent_user_id) {
      const [{ data: u }, { data: up }] = await Promise.all([
        sb.from("users").select("first_name, last_name, email").eq("id", own.owning_agent_user_id).maybeSingle(),
        sb.from("user_profiles").select("title").eq("user_id", own.owning_agent_user_id).maybeSingle(),
      ]);
      person = { name: [u?.first_name, u?.last_name].filter(Boolean).join(" ") || u?.email || null, role: up?.title ?? "Owner" };
    }
    return {
      name: approved ? st?.startup_name || hp?.code_name || "Business" : hp?.code_name || "Business",
      industry: st?.industry ?? null,
      city: approved ? st?.city ?? hp?.region ?? null : hp?.region ?? null,
      about: (approved ? st?.short_description : null) || hp?.headline || null,
      ...priceFor(hp as never, approved),
      dealType: hp?.deal_type ?? null,
      reason: hp?.reason ?? null,
      codeName: hp?.code_name ?? null,
      founded: st?.year_founded ? String(st.year_founded) : null,
      employees: st?.company_size ?? null,
      website: approved ? st?.website_url ?? null : null,
      person,
    };
  });


const SELLER_REASONS = ["offer_too_low", "terms", "other_buyer", "not_selling", "other"] as const;
const BUYER_REASONS = ["price_too_high", "report_concerns", "other_business", "plans_changed", "timing", "other"] as const;
const SELLER_FB = ["concerns_buyer", "buyer_slow", "offer_not_serious", "buyer_funding", "hard_to_use", "too_long", "something_else"];
const BUYER_FB = ["concerns_seller", "seller_slow", "figures_mismatch", "price_unrealistic", "hard_to_use", "too_long", "something_else"];

/** Seller or buyer leaves a deal: ends it, report access, LOI/exclusivity and chats, then tells the other side and advisors. */
export const withdrawDeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Id.extend({ reason: z.string(), comment: z.string().max(500).default(""), shared: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const p = await loadOpen(data.id);
    const side = await assertParty(context, p);
    if (!p.nda_approved_at || p.status === "declined") throw new Error("This deal can't be withdrawn");
    if (p.spa_at || p.payment_at) throw new Error("Contact PitchSnack to stop this deal");
    const allowed: readonly string[] = side === "seller" ? SELLER_REASONS : BUYER_REASONS;
    if (!allowed.includes(data.reason)) throw new Error("Choose a reason");
    const comment = data.comment.trim();
    if (data.reason === "other" && !comment) throw new Error("Add a comment to explain your reason.");
    const dates = [p.nda_approved_at, p.report_shared_at, p.loi_accepted_at, p.contact_at, p.legal_at, p.spa_at, p.payment_at];
    const step = Math.max(0, dates.findIndex((x) => !x));
    const sb = await admin();
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { status: "ended", ended_at: now, ended_by_side: side, ended_at_step: step };
    if (p.exclusivity_until && new Date(p.exclusivity_until) > new Date()) patch.exclusivity_until = now;
    const { error } = await sb.from("deal_pipelines").update(patch).eq("id", p.id).neq("status", "ended");
    if (error) throw new Error(error.message);
    await sb.from("report_shares").update({ revoked_at: now, revoked_by: context.userId }).eq("pipeline_id", p.id).is("revoked_at", null);
    const { error: we } = await sb.from("deal_withdrawals").insert({
      deal_id: p.id, withdrawn_by: context.userId, side, reason_code: data.reason, comment: comment || null, shared: data.shared, withdrawn_at: now, step_at_withdrawal: step,
    });
    if (we) throw new Error(we.message);
    await log(p.id, "withdrawn", context.userId);
    // Bell: the other side and every advisor on the deal. No reason or comment.
    try {
      const { sideUsers, bell, dealParties } = await import("./advisor-pipeline.server");
      const parties = (await dealParties(sb, [p]))[p.id];
      const { data: hp } = await sb.from("hidden_profiles").select("code_name").eq("id", p.hidden_profile_id).maybeSingle();
      const org = side === "seller" ? parties.seller.name : parties.buyer.name;
      const title = `${org} withdrew from the deal for ${hp?.code_name ?? "your listing"}`;
      const other = await sideUsers(sb, p, side === "seller" ? "buyer" : "seller");
      await bell(sb, other, title, "The NDA stays in force until it expires.", `/marketplace/pipeline?deal=${p.id}&view=ended`);
      const { data: das } = await sb.from("deal_advisors").select("advisor_user_id").eq("deal_id", p.id);
      await bell(sb, [...new Set((das ?? []).map((d: any) => d.advisor_user_id).filter(Boolean))] as string[], title, "", `/advisor/pipeline?deal=${p.id}`);
    } catch (e) { console.error("[withdraw] bell", (e as Error).message); }
    return { ok: true };
  });

/** Private feedback for PitchSnack after a withdrawal; once, by the person who withdrew. */
export const sendWithdrawalFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Id.extend({ options: z.array(z.string()).max(7), more: z.string().max(1000).default(""), improve: z.string().max(1000).default("") }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = await admin();
    const { data: w } = await sb.from("deal_withdrawals").select("*").eq("deal_id", data.id).maybeSingle();
    if (!w || w.withdrawn_by !== context.userId) throw new Error("Not allowed");
    if (w.feedback_sent) throw new Error("Feedback already sent");
    const codes = w.side === "seller" ? SELLER_FB : BUYER_FB;
    const options = data.options.filter((o) => codes.includes(o));
    if (!options.length && !data.more.trim() && !data.improve.trim()) throw new Error("Nothing to send");
    const { error } = await sb.from("withdrawal_feedback").insert({ withdrawal_id: w.id, user_id: context.userId, options, more_text: data.more.trim() || null, improve_text: data.improve.trim() || null });
    if (error) throw new Error(error.message);
    await sb.from("deal_withdrawals").update({ feedback_sent: true }).eq("id", w.id);
    return { ok: true };
  });

/** User-private deal stars; requests retain their pipeline ID when approved. */
export const listDealWatchlist = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({context}) => {
 const {data,error}=await context.supabase.from("deal_watchlist").select("deal_id").eq("user_id",context.userId);
 if(error)throw new Error("Deal watchlist could not be loaded");return (data??[]).map(r=>r.deal_id);
});
export const setDealWatchlist = createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator(d=>z.object({id:z.string().uuid(),starred:z.boolean()}).parse(d)).handler(async({data,context})=>{
 const p=await load(data.id);await assertParty(context,p);
 if(data.starred&&["ended","declined","withdrawn","revoked"].includes(p.status))throw new Error("This deal is no longer open");
 const sb=await admin();const result=data.starred?await sb.from("deal_watchlist").upsert({user_id:context.userId,deal_id:p.id},{onConflict:"user_id,deal_id",ignoreDuplicates:true}):await sb.from("deal_watchlist").delete().eq("user_id",context.userId).eq("deal_id",p.id);
 if(result.error)throw new Error("Deal watchlist could not be saved");return {ok:true};
});
