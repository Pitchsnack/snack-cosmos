import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Seller → investor contact requests. The investor sees only the seller's anonymous
 * listing card; Accept opens the pipeline at the approved-NDA step, Decline closes it.
 * The plan request is used either way. All writes go through here (service client).
 */
async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function notify(userId: string | null | undefined, title: string, message: string) {
  if (!userId) return;
  await (await admin()).from("notifications").insert({ user_id: userId, notification_type: "deal", title, message, link_url: "/marketplace/pipeline" });
}

/** The caller's live listing (first one), or null. */
async function myLiveListing(userId: string) {
  const sb = await admin();
  const [{ data: su }, { data: own }] = await Promise.all([
    sb.from("startup_users").select("startup_id").eq("user_id", userId),
    sb.from("startup_ownership").select("startup_id").eq("owning_agent_user_id", userId),
  ]);
  const ids = [...new Set([...(su ?? []), ...(own ?? [])].map((x: any) => x.startup_id))];
  if (!ids.length) return null;
  const { isBuyerVisible } = await import("@/lib/hidden-profile");
  const { data: hps } = await sb.from("hidden_profiles").select("id, startup_id, ref_no, approval_status, live").in("startup_id", ids);
  return (hps ?? []).find((h: any) => isBuyerVisible(h)) ?? null;
}

async function investorLabels(ids: string[]) {
  if (!ids.length) return new Map<string, { codeName: string; refNo: string }>();
  const { loadPublicInvestors } = await import("./investor-browse.functions");
  const list = await loadPublicInvestors(await admin(), ids);
  return new Map(list.map((i: any) => [i.id, { codeName: i.codeName as string, refNo: i.refNo as string }]));
}

export type ContactButtonState = { hasListing: boolean; sent: string[] };

export const myContactState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ContactButtonState> => {
    const sb = await admin();
    const [hp, { data }] = await Promise.all([
      myLiveListing(context.userId),
      sb.from("contact_requests").select("investor_id").eq("seller_user_id", context.userId),
    ]);
    return { hasListing: !!hp, sent: (data ?? []).map((r: any) => r.investor_id) };
  });

export const sendContactRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ investorId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { requireRole, spendRequest, planAccess, requestsLeft } = await import("./plan-access.server");
    await requireRole(context.userId, ["seller"]);
    const sb = await admin();
    const hp = await myLiveListing(context.userId);
    if (!hp) throw new Error("Add your business first");
    const { data: dup } = await sb.from("contact_requests").select("id").eq("seller_user_id", context.userId).eq("investor_id", data.investorId).maybeSingle();
    if (dup) throw new Error("You already requested this investor");
    const label = (await investorLabels([data.investorId])).get(data.investorId);
    if (!label) throw new Error("This investor isn't available");
    const { data: bp } = await sb.from("buyer_profiles").select("user_id").eq("investor_id", data.investorId).maybeSingle();
    await spendRequest(context.userId, "contact", data.investorId);
    const { error } = await sb.from("contact_requests").insert({
      seller_user_id: context.userId, startup_id: hp.startup_id, hidden_profile_id: hp.id,
      investor_id: data.investorId, investor_user_id: bp?.user_id ?? null,
    });
    if (error) throw new Error(error.message);
    await notify(bp?.user_id, "A seller wants to talk to you", `${hp.ref_no ?? "A business"} sent you a contact request. Open your Pipeline to accept or decline.`);
    const a = await planAccess(context.userId);
    const left = requestsLeft(a, "contact");
    return { label: `${label.codeName} · ${label.refNo}`, left, termMonths: (a.plan?.term_months as number | undefined) ?? null };
  });

export type ContactRequestRow = {
  id: string; status: "waiting" | "accepted" | "declined"; createdAt: string; decidedAt: string | null;
  investorLabel: string | null; listingRef: string | null; listing: any | null; closed: any | null;
};

/** Pipeline: contact requests the seller sent, or the investor received. */
export const listContactRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ as: z.enum(["seller", "buyer"]) }).parse(d))
  .handler(async ({ data, context }): Promise<ContactRequestRow[]> => {
    const sb = await admin();
    const col = data.as === "seller" ? "seller_user_id" : "investor_user_id";
    const { data: rows } = await sb.from("contact_requests").select("*").eq(col, context.userId).order("created_at", { ascending: false });
    if (!rows?.length) return [];
    const labels = data.as === "seller" ? await investorLabels(rows.map((r: any) => r.investor_id)) : new Map();
    const { data: hps } = await sb.from("hidden_profiles").select("id, ref_no").in("id", rows.map((r: any) => r.hidden_profile_id));
    const refBy = new Map((hps ?? []).map((h: any) => [h.id, h.ref_no]));
    let teasers = new Map<string, any>();
    if (data.as === "buyer") {
      const { loadMarketplaceTeasers } = await import("./hidden-profiles.functions");
      const list = await loadMarketplaceTeasers({ excludeNda: false }, context.userId, true);
      teasers = new Map((list as any[]).map((t) => [t.id, t]));
    }
    return rows.map((r: any) => {
      const l = labels.get(r.investor_id);
      const t = teasers.get(r.hidden_profile_id);
      return {
        id: r.id, status: r.status, createdAt: r.created_at, decidedAt: r.decided_at,
        investorLabel: l ? `${l.codeName} · ${l.refNo}` : null,
        listingRef: refBy.get(r.hidden_profile_id) ?? null,
        listing: t && !t.closed ? t.listing : null,
        closed: t?.closed ? t : null,
      };
    });
  });

/** Investor: accept (starts the approved-NDA step) or decline. */
export const decideContactRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), accept: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = await admin();
    const { data: r } = await sb.from("contact_requests").select("*").eq("id", data.id).maybeSingle();
    if (!r || r.investor_user_id !== context.userId) throw new Error("Request not found");
    if (r.status !== "waiting") throw new Error("This request was already answered");
    const now = new Date().toISOString();
    let pipelineId: string | null = null;
    if (data.accept) {
      const patch = { status: "active", nda_requested_at: now, nda_approved_at: now, nda_expires_at: new Date(Date.now() + 730 * 86_400_000).toISOString() };
      const { data: prev } = await sb.from("deal_pipelines").select("id, nda_approved_at").eq("hidden_profile_id", r.hidden_profile_id).eq("buyer_user_id", context.userId).maybeSingle();
      if (prev) {
        pipelineId = prev.id;
        if (!prev.nda_approved_at) await sb.from("deal_pipelines").update(patch).eq("id", prev.id);
      } else {
        const { data: row, error } = await sb.from("deal_pipelines")
          .insert({ hidden_profile_id: r.hidden_profile_id, startup_id: r.startup_id, buyer_user_id: context.userId, ...patch })
          .select("id").single();
        if (error) throw new Error(error.message);
        pipelineId = row.id;
      }
      await sb.from("deal_pipeline_events").insert({ pipeline_id: pipelineId, event: "nda_approved", actor_id: context.userId, note: "Contact request accepted" });
    }
    await sb.from("contact_requests").update({ status: data.accept ? "accepted" : "declined", decided_at: now, pipeline_id: pipelineId }).eq("id", r.id);
    const label = (await investorLabels([r.investor_id])).get(r.investor_id);
    const who = label ? `${label.codeName} · ${label.refNo}` : "The investor";
    await notify(r.seller_user_id, data.accept ? "Contact request accepted" : "Contact request declined",
      data.accept ? `${who} accepted. The NDA is approved and the deal is in your Pipeline.` : `${who} declined your contact request.`);
    return { ok: true };
  });

/** Admin › Approvals › Contact requests (read-only). */
export const adminContactRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireAccountAdmin } = await import("./plan-access.server");
    await requireAccountAdmin(context.userId);
    const sb = await admin();
    const { data: rows } = await sb.from("contact_requests").select("*").order("created_at", { ascending: false }).limit(500);
    if (!rows?.length) return [];
    const { data: hps } = await sb.from("hidden_profiles").select("id, ref_no").in("id", rows.map((r: any) => r.hidden_profile_id));
    const refBy = new Map((hps ?? []).map((h: any) => [h.id, h.ref_no]));
    const labels = await investorLabels([...new Set((rows as any[]).map((r) => String(r.investor_id)))]);
    return rows.map((r: any) => ({
      id: r.id as string, createdAt: r.created_at as string, status: r.status as string,
      listingRef: (refBy.get(r.hidden_profile_id) as string | undefined) ?? "—",
      investorRef: labels.get(r.investor_id)?.refNo ?? "—",
    }));
  });
