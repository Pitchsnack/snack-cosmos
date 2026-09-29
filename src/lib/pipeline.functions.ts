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
  counterparty: { name: string; sub: string; person: string | null; verified: boolean; logoUrl: string | null };
  askingPrice: number | null;
};

function mapRow(r: any, counterparty: PipelineRow["counterparty"], asking: number | null): PipelineRow {
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
    const names = await userNames(buyerIds);
    const { data: bvs } = buyerIds.length
      ? await sb.from("buyer_verifications").select("user_id, company_name, buyer_type, status").in("user_id", buyerIds)
      : { data: [] };
    const bvMap = Object.fromEntries((bvs ?? []).map((b: any) => [b.user_id, b]));

    const items = rows.map((r) => {
      const hp = hpMap[r.hidden_profile_id] ?? {};
      const asking = hp.asking_price != null ? Number(hp.asking_price) : null;
      if (data.as === "seller") {
        const bv = bvMap[r.buyer_user_id] ?? {};
        return mapRow(r, {
          name: bv.company_name || names[r.buyer_user_id] || "Buyer",
          sub: bv.buyer_type || "Buyer",
          person: names[r.buyer_user_id] ?? null,
          verified: bv.status === "verified",
          logoUrl: null,
        }, asking);
      }
      const st = stMap[r.startup_id] ?? {};
      const revealed = !!r.nda_approved_at;
      return mapRow(r, {
        name: revealed ? st.startup_name || hp.code_name : hp.code_name || "Business",
        sub: [st.industry, hp.region].filter(Boolean).join(" · "),
        person: null,
        verified: true,
        // Identity stays hidden until the seller approves the NDA.
        logoUrl: revealed ? st.logo_url ?? null : null,
      }, asking);
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
    await update(p.id, { nda_approved_at: now, ...(data.shareReport ? { report_shared_at: now } : {}) });
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
  .inputValidator((d) => Id.extend({ accept: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const p = await load(data.id);
    await assertSeller(context, p.startup_id);
    if (!p.loi_sent_at) throw new Error("No letter of intent to decide");
    if (data.accept) {
      const now = new Date().toISOString();
      await update(p.id, { loi_accepted_at: now, contact_at: now });
      await log(p.id, "loi_accepted", context.userId);
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
