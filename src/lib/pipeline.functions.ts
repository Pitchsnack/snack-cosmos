import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isBuyerVisible } from "@/lib/hidden-profile";

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

export type PipelineRow = {
  id: string;
  status: string;
  hiddenProfileId: string;
  startupId: string;
  buyerMessage: string | null;
  ndaRequestedAt: string;
  ndaApprovedAt: string | null;
  reportRequestedAt: string | null;
  reportSharedAt: string | null;
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
  };
}

/** Buyer: request the NDA for a live listing. Requires buyer verification. */
export const requestNda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ listingId: z.string().uuid(), message: z.string().max(1000).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = await admin();
    const { data: hp } = await sb.from("hidden_profiles").select("id, startup_id, approval_status, live").eq("id", data.listingId).maybeSingle();
    // Approval is the only source of truth for what a buyer may reach.
    if (!isBuyerVisible(hp)) throw new Error("This listing isn't available");
    const { data: bv } = await sb.from("buyer_verifications").select("status").eq("user_id", context.userId).maybeSingle();
    const { data: uv } = await sb.from("user_verifications").select("user_id").eq("user_id", context.userId).maybeSingle();
    if (!uv && bv?.status !== "verified") throw new Error("Verify your buyer profile first");
    const { requireRole, planAccess, valueCap, spendRequest } = await import("./plan-access.server");
    await requireRole(context.userId, ["buyer"]);
    const cap = valueCap(await planAccess(context.userId));
    const ask = (hp.live as { asking_price?: number | null } | null)?.asking_price;
    if (cap !== null && ask != null && Number(ask) > cap) throw new Error("This listing is above your plan's price range");
    await spendRequest(context.userId, "nda", hp.id);
    // A withdrawn or declined request can be made again: reopen the same row.
    const { data: prev } = await sb.from("deal_pipelines").select("id, status").eq("hidden_profile_id", hp.id).eq("buyer_user_id", context.userId).maybeSingle();
    if (prev && ["withdrawn", "declined"].includes(prev.status)) {
      await update(prev.id, { status: "active", nda_requested_at: new Date().toISOString(), nda_approved_at: null, buyer_message: data.message ?? null });
      await log(prev.id, "nda_requested", context.userId);
      return { ok: true };
    }
    const { data: row, error } = await sb
      .from("deal_pipelines")
      .upsert(
        { hidden_profile_id: hp.id, startup_id: hp.startup_id, buyer_user_id: context.userId, buyer_message: data.message ?? null, status: "active" },
        { onConflict: "hidden_profile_id,buyer_user_id", ignoreDuplicates: true },
      )
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (row?.id) await log(row.id, "nda_requested", context.userId);
    return { ok: true };
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
      const ids = [...new Set([...(own ?? []), ...(su ?? [])].map((x: any) => x.startup_id))];
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
      hpIds.length ? sb.from("hidden_profiles").select("id, code_name, region, asking_price, startup_id").in("id", hpIds) : empty,
      stIds.length ? sb.from("startups").select("id, startup_name, industry, logo_url").in("id", stIds) : empty,
      stIds.length ? sb.from("startup_ownership").select("startup_id, owning_agent_user_id").in("startup_id", stIds) : empty,
      buyerIds.length ? sb.from("buyer_verifications").select("user_id, company_name, buyer_type, status").in("user_id", buyerIds) : empty,
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
      data.as === "buyer" && logoPaths.length ? sb.storage.from("startup-media").createSignedUrls(logoPaths, 3600) : Promise.resolve({ data: [] as any[] }),
    ]);
    for (const d of (signedRes as any).data ?? []) if (d.path && d.signedUrl) signedLogos[d.path] = d.signedUrl;
    const bvMap = Object.fromEntries((bvs ?? []).map((b: any) => [b.user_id, b]));

    const items = rows.map((r) => {
      const hp = hpMap[r.hidden_profile_id] ?? {};
      const st0 = stMap[r.startup_id] ?? {};
      const bv0 = bvMap[r.buyer_user_id] ?? {};
      const revealed0 = data.as === "seller" || !!r.nda_approved_at;
      const parties = {
        sellerCompany: revealed0 ? st0.startup_name || hp.code_name || "Business" : hp.code_name || "Business",
        codeName: hp.code_name ?? null,
        buyerOrg: bv0.company_name || names[r.buyer_user_id] || "Buyer",
        buyerName: names[r.buyer_user_id] ?? null,
        sellerName: revealed0 ? names[ownerMap[r.startup_id]] ?? null : null,
      };
      const asking = hp.asking_price != null ? Number(hp.asking_price) : null;
      if (data.as === "seller") {
        const bv = bvMap[r.buyer_user_id] ?? {};
        return mapRow(r, {
          name: bv.company_name || names[r.buyer_user_id] || "Buyer",
          sub: bv.buyer_type || "Buyer",
          person: names[r.buyer_user_id] ?? null,
          verified: bv.status === "verified",
          logoUrl: null,
        }, asking, parties, names);
      }
      const st = stMap[r.startup_id] ?? {};
      const revealed = !!r.nda_approved_at;
      return mapRow(r, {
        name: revealed ? st.startup_name || hp.code_name : hp.code_name || "Business",
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
      const mine = (shares ?? []).filter((x: any) => x.pipeline_id === r.id);
      const act = mine.find((x: any) => !x.revoked_at);
      const d = dk[r.startup_id];
      const live = !!act && ndaActive(r);
      it.share = live ? { financials: act.financials && d.financials, valuation: act.valuation && d.valuation, allowDownload: act.allow_download, sharedAt: act.shared_at } : null;
      it.revokedAt = !act && mine[0]?.revoked_at ? mine[0].revoked_at : null;
      it.reports = data.as === "seller" ? { financials: d.financials, valuation: d.valuation } : { financials: !!it.share?.financials, valuation: !!it.share?.valuation };
      if (data.as === "buyer" && !it.share) it.reportSharedAt = null;
    });
    return items;
  });

/** Light count for the Pipeline menu badge (same rule as waitingOnYouCount). */
export const pipelineBadgeCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ as: z.enum(["seller", "buyer"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = await admin();
    const cols = "id, startup_id, status, nda_approved_at, nda_expires_at, report_requested_at, report_shared_at, loi_sent_at, loi_accepted_at, legal_at, spa_at, payment_at";
    let rows: any[] = [];
    if (data.as === "buyer") {
      rows = (await sb.from("deal_pipelines").select(cols).eq("buyer_user_id", context.userId).not("status", "in", "(declined,withdrawn)")).data ?? [];
    } else {
      const [{ data: own }, { data: su }] = await Promise.all([
        sb.from("startup_ownership").select("startup_id").eq("owning_agent_user_id", context.userId),
        sb.from("startup_users").select("startup_id").eq("user_id", context.userId),
      ]);
      const ids = [...new Set([...(own ?? []), ...(su ?? [])].map((x: any) => x.startup_id))];
      if (ids.length) rows = (await sb.from("deal_pipelines").select(cols).in("startup_id", ids).not("status", "in", "(declined,withdrawn)")).data ?? [];
    }
    const seller = data.as === "seller";
    // Only seller rows waiting on a report share need report/share lookups.
    const need = seller ? rows.filter((r) => r.nda_approved_at && !r.payment_at && r.report_requested_at) : [];
    let shareMap: Record<string, boolean> = {};
    const dk: Record<string, any> = {};
    if (need.length) {
      const { deliveredKinds, ndaActive } = await import("./report-shares.server");
      const sIds = [...new Set(need.map((r) => r.startup_id))];
      const [{ data: shares }, kinds] = await Promise.all([
        sb.from("report_shares").select("pipeline_id, revoked_at").in("pipeline_id", need.map((r) => r.id)).is("revoked_at", null),
        Promise.all(sIds.map((id: string) => deliveredKinds(sb, id))),
      ]);
      sIds.forEach((id, i) => { dk[id] = kinds[i]; });
      shareMap = Object.fromEntries(need.map((r) => [r.id, !!(shares ?? []).find((x: any) => x.pipeline_id === r.id) && ndaActive(r)]));
    }
    let n = 0;
    for (const r of rows) {
      if (!r.nda_approved_at) { if (seller) n++; continue; }
      if (r.payment_at) continue;
      if (seller) {
        const d = dk[r.startup_id];
        if (r.report_requested_at && !shareMap[r.id] && d && (d.financials || d.valuation)) { n++; continue; }
        if (r.loi_sent_at && !r.loi_accepted_at) { n++; continue; }
        if (!r.loi_sent_at) continue;
        n++;
      } else if (!(r.report_requested_at && !r.report_shared_at) && !r.loi_sent_at) n++;
    }
    return n;
  });

const Id = z.object({ id: z.string().uuid() });

export const decideNda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Id.extend({ approve: z.boolean(), shareReport: z.boolean().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const p = await load(data.id);
    await assertSeller(context, p.startup_id);
    const now = new Date().toISOString();
    if (!data.approve) {
      await update(p.id, { status: "declined" });
      await log(p.id, "nda_declined", context.userId);
      return { ok: true };
    }
    await update(p.id, { nda_approved_at: now, nda_expires_at: new Date(Date.now() + 730 * 86_400_000).toISOString() });
    await log(p.id, "nda_approved", context.userId);
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
    const p = await load(data.id);
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
    const p = await load(data.id);
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
    const p = await load(data.id);
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
      sb.from("buyer_verifications").select("company_name, registration_no").eq("user_id", buyerId).maybeSingle(),
      sb.from("user_profiles").select("organisation").eq("user_id", buyerId).maybeSingle(),
    ]);
    const { data: inv } = bp?.investor_id
      ? await sb.from("investors").select("investor_name, legal_name").eq("id", bp.investor_id).maybeSingle()
      : { data: null };
    const thai = (s?: string | null) => !!s && /[\u0E00-\u0E7F]/.test(s);
    const bLegal = inv?.legal_name || bp?.legal_name || bv?.company_name || null;
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

export const sendLoi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    Id.extend({
      amount: z.number().positive(),
      exclusivityDays: z.number().int().min(0).max(365),
      conditions: z.string().max(2000).optional(),
      consent: z.string().min(10).max(2000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const p = await load(data.id);
    if (p.buyer_user_id !== context.userId) throw new Error("Not your pipeline");
    if (!p.nda_approved_at) throw new Error("The NDA must be approved first");
    const now = new Date().toISOString();
    await update(p.id, {
      loi_amount: data.amount,
      loi_exclusivity_days: data.exclusivityDays,
      loi_conditions: data.conditions ?? null,
      loi_sent_at: now,
      loi_accepted_at: null,
      loi_changes_requested_at: null,
      loi_requested_at: null,
      loi_requested_by: null,
    });
    if (p.loi_requested_at) await log(p.id, "loi_request_fulfilled", context.userId);
    // Buyer's agreement (who · when · text) is kept on the event log.
    await log(p.id, "loi_sent", context.userId, `Buyer consent at ${now}: ${data.consent}`);
    const sb = await admin();
    const { data: owners } = await sb.from("startup_ownership").select("owning_agent_user_id").eq("startup_id", p.startup_id);
    const { data: st } = await sb.from("startups").select("tenant_id").eq("id", p.startup_id).maybeSingle();
    const ids = [...new Set((owners ?? []).map((o: any) => o.owning_agent_user_id).filter(Boolean))];
    if (ids.length) {
      await sb.from("notifications").insert(ids.map((uid) => ({
        user_id: uid, tenant_id: st?.tenant_id ?? null, notification_type: "approval",
        title: "New letter of intent", message: "A buyer sent you a letter of intent. Open Pipeline to review it.",
      })));
    }
    return { ok: true };
  });

/** Seller asks the buyer to send a letter of intent, with optional suggested terms. */
export const requestLoi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    Id.extend({
      note: z.string().trim().max(2000).optional(),
      price: z.number().positive().max(1e15).nullable().optional(),
      days: z.number().int().min(0).max(365).nullable().optional(),
      respondBy: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const p = await load(data.id);
    await assertSeller(context, p.startup_id);
    if (!p.nda_approved_at) throw new Error("The NDA must be approved first");
    if (p.loi_sent_at && !p.loi_accepted_at) throw new Error("The buyer has already sent a letter of intent");
    if (p.loi_accepted_at) throw new Error("A letter of intent was already accepted");
    if (p.loi_requested_at) throw new Error("A request is already open");
    const now = new Date().toISOString();
    await update(p.id, {
      loi_requested_at: now, loi_requested_by: context.userId,
      loi_request_note: data.note || null, loi_request_price: data.price ?? null,
      loi_request_days: data.days ?? null, loi_request_respond_by: data.respondBy ?? null,
    });
    await log(p.id, "loi_requested", context.userId, data.note || undefined);
    const sb = await admin();
    const { data: st } = await sb.from("startups").select("tenant_id").eq("id", p.startup_id).maybeSingle();
    await sb.from("notifications").insert({
      user_id: p.buyer_user_id, tenant_id: st?.tenant_id ?? null, notification_type: "approval",
      title: "Letter of intent requested", message: "A seller asked you to send a letter of intent. Open Pipeline to respond.",
    });
    return { ok: true };
  });

export const withdrawLoiRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Id.parse(d))
  .handler(async ({ data, context }) => {
    const p = await load(data.id);
    await assertSeller(context, p.startup_id);
    if (!p.loi_requested_at) return { ok: true };
    await update(p.id, { loi_requested_at: null, loi_requested_by: null });
    await log(p.id, "loi_request_withdrawn", context.userId);
    return { ok: true };
  });

export const decideLoi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Id.extend({ decision: z.enum(["accept", "decline", "changes"]), consent: z.string().max(2000).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const p = await load(data.id);
    await assertSeller(context, p.startup_id);
    if (!p.loi_sent_at || p.loi_accepted_at) throw new Error("No letter of intent to decide");
    const now = new Date();
    if (data.decision === "accept") {
      if (!data.consent) throw new Error("Tick the box to accept");
      const until = new Date(now.getTime() + (p.loi_exclusivity_days ?? 0) * 86_400_000).toISOString();
      await update(p.id, { loi_accepted_at: now.toISOString(), contact_at: now.toISOString(), loi_accepted_by: context.userId, loi_consent_text: data.consent, exclusivity_until: until });
      await log(p.id, "loi_accepted", context.userId, data.consent);
    } else if (data.decision === "changes") {
      await update(p.id, { loi_changes_requested_at: now.toISOString() });
      await log(p.id, "loi_changes_requested", context.userId);
    } else {
      await update(p.id, { loi_sent_at: null, loi_amount: null });
      await log(p.id, "loi_declined", context.userId);
    }
    return { ok: true };
  });

/** Seller shares the Legal folder / SPA draft, or marks payment complete. */
export const shareStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Id.extend({ step: z.enum(["legal", "spa", "payment"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const p = await load(data.id);
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
      .select("event, actor_id, created_at")
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
};

async function buildReport(startupId: string): Promise<ReportData> {
  const sb = await admin();
  const [inc, pos, rat, ci, st, vo] = await Promise.all([
    sb.from("income_statement_items").select("fiscal_year, item_code, amount").eq("startup_id", startupId),
    sb.from("financial_position_items").select("fiscal_year, item_code, amount").eq("startup_id", startupId),
    sb.from("financial_ratios").select("fiscal_year, ratio_code, ratio_label, value, unit, display_order").eq("startup_id", startupId).order("display_order"),
    sb.from("company_info_th").select("registration_number, registered_capital_thb, registration_date, authorized_signatory_th").eq("startup_id", startupId).maybeSingle(),
    sb.from("startups").select("registered_number, registered_capital, year_founded, company_size").eq("id", startupId).maybeSingle(),
    sb.from("report_orders").select("kind, status").eq("startup_id", startupId).eq("status", "delivered"),
  ]);
  const income: ReportData["income"] = {}; const position: ReportData["position"] = {};
  const ys = new Set<number>();
  for (const r of inc.data ?? []) { ys.add(r.fiscal_year); (income[r.item_code] ??= {})[r.fiscal_year] = r.amount != null ? Number(r.amount) : null; }
  for (const r of pos.data ?? []) { ys.add(r.fiscal_year); (position[r.item_code] ??= {})[r.fiscal_year] = r.amount != null ? Number(r.amount) : null; }
  const years = [...ys].sort((a, b) => a - b).slice(-5);
  const last = years[years.length - 1];
  const ratios = (rat.data ?? []).filter((r: any) => r.fiscal_year === last).map((r: any) => ({ code: r.ratio_code, label: r.ratio_label, value: r.value != null ? Number(r.value) : null, unit: r.unit }));
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
  };
}

/** Report viewer data. Buyer opens are logged so the seller sees "Report viewed". */
export const getPipelineReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Id.parse(d))
  .handler(async ({ data, context }) => {
    const p = await load(data.id);
    const role = await assertParty(context, p);
    if (role === "buyer") {
      const { assertBuyerAccess } = await import("./report-shares.server");
      const { share } = await assertBuyerAccess(await admin(), p, "any");
      // Each buyer report counts once per term against the plan (can_open_report / record_report_open).
      const { data: okOpen } = await (await admin()).rpc("record_report_open", { _uid: context.userId, _report_key: "fs5", _ref: p.startup_id });
      if (!okOpen) throw new Error("Your plan has no report opens left this term");
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
      const { data: okOpen } = await sb.rpc("can_open_report", { _uid: context.userId, _report_key: "fs5", _ref: r.startup_id });
      if (!okOpen) continue;
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
      sb.from("buyer_verifications").select("company_name, buyer_type, status").eq("user_id", p.buyer_user_id).maybeSingle(),
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
      sb.from("hidden_profiles").select("code_name, asking_price, stake_pct, deal_type, reason, headline, region").eq("id", p.hidden_profile_id).maybeSingle(),
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
      askingPrice: hp?.asking_price != null ? Number(hp.asking_price) : null,
      stakePct: hp?.stake_pct != null ? Number(hp.stake_pct) : null,
      dealType: hp?.deal_type ?? null,
      reason: hp?.reason ?? null,
      codeName: hp?.code_name ?? null,
      founded: st?.year_founded ? String(st.year_founded) : null,
      employees: st?.company_size ?? null,
      website: approved ? st?.website_url ?? null : null,
      person,
    };
  });
