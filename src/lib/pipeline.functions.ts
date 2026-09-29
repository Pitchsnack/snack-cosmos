import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
  exclusivityUntil: string | null;
  updatedAt: string;
  parties: { sellerCompany: string; codeName: string | null; buyerOrg: string; buyerName: string | null; sellerName: string | null };
  counterparty: { name: string; sub: string; person: string | null; verified: boolean; logoUrl: string | null };
  askingPrice: number | null;
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
    exclusivityUntil: r.exclusivity_until ?? null,
    updatedAt: r.updated_at,
    parties,
    counterparty,
    askingPrice: asking,
  };
}

/** Buyer: request the NDA for a live listing. Requires buyer verification. */
export const requestNda = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ listingId: z.string().uuid(), message: z.string().max(1000).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = await admin();
    const { data: hp } = await sb.from("hidden_profiles").select("id, startup_id, status").eq("id", data.listingId).maybeSingle();
    if (!hp || hp.status !== "live") throw new Error("This listing is not live");
    const { data: bv } = await sb.from("buyer_verifications").select("status").eq("user_id", context.userId).maybeSingle();
    const { data: uv } = await sb.from("user_verifications").select("user_id").eq("user_id", context.userId).maybeSingle();
    if (!uv && bv?.status !== "verified") throw new Error("Verify your buyer profile first");
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
      out[r.hidden_profile_id] = r.status === "declined" ? "declined" : r.contact_at ? "exchanged" : r.nda_approved_at ? "approved" : "requested";
    }
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
      const r = await sb.from("deal_pipelines").select("*").eq("buyer_user_id", context.userId).neq("status", "declined").order("updated_at", { ascending: false });
      rows = r.data ?? [];
    } else {
      // Only businesses the caller owns (not every business an Admin can see).
      const { data: own } = await sb.from("startup_ownership").select("startup_id").eq("owning_agent_user_id", context.userId);
      const { data: su } = await sb.from("startup_users").select("startup_id").eq("user_id", context.userId);
      const ids = [...new Set([...(own ?? []), ...(su ?? [])].map((x: any) => x.startup_id))];
      if (ids.length) {
        const r = await sb.from("deal_pipelines").select("*").in("startup_id", ids).neq("status", "declined").order("updated_at", { ascending: false });
        rows = r.data ?? [];
      }
    }
    const hpIds = [...new Set(rows.map((r) => r.hidden_profile_id))];
    const { data: hps } = hpIds.length
      ? await sb.from("hidden_profiles").select("id, code_name, region, asking_price, startup_id").in("id", hpIds)
      : { data: [] };
    const hpMap = Object.fromEntries((hps ?? []).map((h: any) => [h.id, h]));
    const stIds = [...new Set(rows.map((r) => r.startup_id))];
    const { data: sts } = stIds.length ? await sb.from("startups").select("id, startup_name, industry, logo_url").in("id", stIds) : { data: [] };
    const stMap = Object.fromEntries((sts ?? []).map((s: any) => [s.id, s]));
    // Logos live in private storage; hand the browser a short-lived signed link.
    const logoPaths = (sts ?? []).map((s: any) => s.logo_url).filter((p: any): p is string => !!p && !/^https?:\/\//.test(p));
    const signedLogos: Record<string, string> = {};
    if (logoPaths.length) {
      const { data: signed } = await sb.storage.from("startup-media").createSignedUrls(logoPaths, 3600);
      for (const d of signed ?? []) if (d.path && d.signedUrl) signedLogos[d.path] = d.signedUrl;
    }
    const buyerIds = [...new Set(rows.map((r) => r.buyer_user_id))];
    const { data: owners } = stIds.length ? await sb.from("startup_ownership").select("startup_id, owning_agent_user_id").in("startup_id", stIds) : { data: [] };
    const ownerMap = Object.fromEntries((owners ?? []).map((o: any) => [o.startup_id, o.owning_agent_user_id]));
    const names = await userNames([...new Set([...buyerIds, ...Object.values(ownerMap), ...rows.map((r) => r.loi_accepted_by).filter(Boolean)])] as string[]);
    const { data: bvs } = buyerIds.length
      ? await sb.from("buyer_verifications").select("user_id, company_name, buyer_type, status").in("user_id", buyerIds)
      : { data: [] };
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
    return items;
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
    await update(p.id, { nda_approved_at: now, nda_expires_at: new Date(Date.now() + 730 * 86_400_000).toISOString(), ...(data.shareReport ? { report_shared_at: now } : {}) });
    await log(p.id, "nda_approved", context.userId);
    if (data.shareReport) await log(p.id, "report_shared", context.userId);
    return { ok: true };
  });

export const shareReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Id.parse(d))
  .handler(async ({ data, context }) => {
    const p = await load(data.id);
    await assertSeller(context, p.startup_id);
    if (!p.nda_approved_at) throw new Error("Approve the NDA first");
    await update(p.id, { report_shared_at: new Date().toISOString() });
    await log(p.id, "report_shared", context.userId);
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

export const sendLoi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    Id.extend({ amount: z.number().positive(), exclusivityDays: z.number().int().min(0).max(365), conditions: z.string().max(2000).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const p = await load(data.id);
    if (p.buyer_user_id !== context.userId) throw new Error("Not your pipeline");
    if (!p.nda_approved_at) throw new Error("The NDA must be approved first");
    await update(p.id, {
      loi_amount: data.amount,
      loi_exclusivity_days: data.exclusivityDays,
      loi_conditions: data.conditions ?? null,
      loi_sent_at: new Date().toISOString(),
      loi_accepted_at: null,
    });
    await log(p.id, "loi_sent", context.userId);
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
    if (!p.nda_approved_at) throw new Error("The NDA must be approved first");
    if (!p.report_shared_at) throw new Error("The report has not been shared");
    if (role === "buyer") {
      await update(p.id, { report_viewed_at: new Date().toISOString() });
      await log(p.id, "report_viewed", context.userId);
    }
    return buildReport(p.startup_id);
  });

/** Buyer: every received report side by side. */
export const compareReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = await admin();
    const { data: rows } = await sb.from("deal_pipelines").select("id, startup_id").eq("buyer_user_id", context.userId)
      .not("nda_approved_at", "is", null).not("report_shared_at", "is", null).neq("status", "declined");
    const out: Record<string, ReportData> = {};
    for (const r of rows ?? []) out[r.id] = await buildReport(r.startup_id);
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
