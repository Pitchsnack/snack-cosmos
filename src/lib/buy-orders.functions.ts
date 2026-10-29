import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { effectiveStatus, isOpen, type BoAppStatus, type BoKind, type BoStatus } from "@/lib/buy-orders";

/**
 * Businesses Wanted. Every read and write goes through here with the service client,
 * after the caller's role is checked. Buyers' names, refs and organisations never
 * leave the server; {client} only reaches admins.
 */
async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export const BO_CHANGED = "BO_CHANGED: This buy order has changed. Refresh and try again.";

export type BoCard = {
  id: string; ref: string; kind: BoKind; status: BoStatus;
  sector: string; name: string; description: string; location: string; cities: string;
  propertySize: string; factorySize: string; products: string | null;
  targetRevenue: string; priceRange: string; dealTypes: string[]; mustHave: string[]; niceToHave: string[];
  profit: string | null; timing: string | null; periodMonths: number;
  postedAt: string | null; closesOn: string | null; closedAt: string | null;
  buyerType: string; country: string | null; aboutBuyer: string | null;
  views: number; applied: number; yours: boolean;
  myApp: { status: BoAppStatus; appliedAt: string } | null;
  /** The buy order's own side only: applications in all, and waiting for a decision. */
  appsTotal: number | null; appsNew: number | null;
  /** Admins only. */
  client: { name: string | null; ref: string | null; writer: string | null } | null;
};

export type ApplyContext = {
  state: "approved" | "pending" | "none";
  listing: { id: string; codeName: string | null; ref: string | null; sector: string | null; province: string | null; country: string | null; revenue: string | null; dealType: string | null } | null;
};

async function myInvestorIds(sb: any, userId: string): Promise<string[]> {
  const { data } = await sb.from("buyer_profiles").select("investor_id").eq("user_id", userId).not("investor_id", "is", null);
  return (data ?? []).map((r: any) => r.investor_id as string);
}

async function mySellerListing(userId: string) {
  const sb = await admin();
  const ids = await (await import("@/lib/workspace-scope.server")).myWorkspaceStartupIds(userId);
  if (!ids.length) return null;
  const { data: hps } = await sb.from("hidden_profiles").select("id, startup_id, ref_no, code_name, approval_status, live, deal_type").in("startup_id", ids);
  const { isBuyerVisible } = await import("@/lib/hidden-profile");
  const list = (hps ?? []) as any[];
  const hp = list.find((h) => isBuyerVisible(h)) ?? list.find((h) => h.approval_status === "in_review") ?? list[0] ?? null;
  if (!hp) return null;
  const { data: st } = await sb.from("startups").select("sector, city, address_province_state, headquarters, last_year_revenue").eq("id", hp.startup_id).maybeSingle();
  const live = (hp.live ?? {}) as any;
  const province = (st?.address_province_state || (st?.city ?? "").split(",")[0] || "").trim() || null;
  const hq = (st?.headquarters ?? "").toLowerCase();
  const country = ["Vietnam", "Malaysia", "Indonesia"].find((c) => hq.includes(c.toLowerCase())) ?? "Thailand";
  return {
    hp,
    approved: isBuyerVisible(hp),
    pending: hp.approval_status === "in_review",
    facts: {
      id: hp.id as string, codeName: (live.code_name ?? hp.code_name ?? null) as string | null, ref: hp.ref_no as string | null,
      sector: (st?.sector ?? null) as string | null, province, country, revenue: (st?.last_year_revenue ?? null) as string | null,
      dealType: (live.deal_type ?? hp.deal_type ?? null) as string | null,
    },
  };
}

async function viewerRole(userId: string) {
  return (await import("@/lib/plan-access.server")).roleOf(userId);
}

function toCard(r: any, ctx: { inv: Map<string, any>; bp: Map<string, any>; views: Map<string, number>; apps: Map<string, number>; mine: Set<string>; myApps: Map<string, any>; appsNew: Map<string, number>; isAdmin: boolean; writers: Map<string, string> }, bands: any): BoCard {
  const { typeName, sortActsFor } = bands;
  const i = ctx.inv.get(r.investor_profile_id) ?? {};
  const b = ctx.bp.get(r.investor_profile_id) ?? null;
  const actsFor = b?.buyer_relation === "agent" ? sortActsFor(i.acts_for_types ?? []) : [];
  const buyerType = typeName(i.investor_type ?? null, actsFor);
  let about: string | null = b?.description ?? null;
  for (const nm of [i.investor_name, i.legal_name, i.firm_name].filter(Boolean)) {
    const esc = String(nm).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    about = about ? about.replace(new RegExp(esc, "gi"), buyerType) : about;
  }
  const a = ctx.myApps.get(r.id);
  const own = r.kind === "sealed" ? ctx.isAdmin : ctx.mine.has(r.investor_profile_id);
  return {
    id: r.id, ref: r.ref, kind: r.kind, status: effectiveStatus(r.status, r.closes_on),
    sector: r.sector, name: r.name_on_card, description: r.description, location: r.location, cities: r.cities || "Any",
    propertySize: r.property_size, factorySize: r.factory_size, products: r.products,
    targetRevenue: r.target_revenue, priceRange: r.price_range, dealTypes: r.deal_types ?? [], mustHave: r.must_have ?? [], niceToHave: r.nice_to_have ?? [],
    profit: r.profit, timing: r.timing, periodMonths: r.period_months,
    postedAt: r.posted_at, closesOn: r.closes_on, closedAt: r.closed_at ?? (effectiveStatus(r.status, r.closes_on) === "closed" && r.closes_on ? `${r.closes_on}T00:00:00+07:00` : null),
    buyerType, country: i.country ?? null, aboutBuyer: about,
    views: ctx.views.get(r.id) ?? 0, applied: ctx.apps.get(r.id) ?? 0,
    yours: ctx.mine.has(r.investor_profile_id),
    myApp: a ? { status: a.status, appliedAt: a.applied_at } : null,
    appsTotal: own ? ctx.apps.get(r.id) ?? 0 : null, appsNew: own ? ctx.appsNew.get(r.id) ?? 0 : null,
    client: ctx.isAdmin ? { name: i.investor_name ?? i.firm_name ?? null, ref: b?.ref_no ?? null, writer: ctx.writers.get(r.written_by_user_id) ?? null } : null,
  };
}

async function cardsFor(sb: any, rows: any[], userId: string, isAdmin: boolean, sellerListingId: string | null): Promise<BoCard[]> {
  const bands = await import("@/lib/investor-bands");
  const ids = rows.map((r) => r.id);
  const invIds = [...new Set(rows.map((r) => r.investor_profile_id))];
  const writerIds = [...new Set(rows.map((r) => r.written_by_user_id))];
  const [{ data: invs }, { data: bps }, { data: vs }, { data: aps }, mine, { data: ws }] = await Promise.all([
    invIds.length ? sb.from("investors").select("id, investor_name, legal_name, firm_name, investor_type, country, acts_for_types").in("id", invIds) : { data: [] },
    invIds.length ? sb.from("buyer_profiles").select("investor_id, description, buyer_relation, ref_no").in("investor_id", invIds) : { data: [] },
    ids.length ? sb.from("buy_order_views").select("buy_order_id").in("buy_order_id", ids) : { data: [] },
    ids.length ? sb.from("buy_order_applications").select("buy_order_id, business_id, status, applied_at").in("buy_order_id", ids) : { data: [] },
    myInvestorIds(sb, userId),
    isAdmin && writerIds.length ? sb.from("users").select("id, full_name, email").in("id", writerIds) : { data: [] },
  ]);
  const count = (list: any[]) => { const m = new Map<string, number>(); for (const x of list) m.set(x.buy_order_id, (m.get(x.buy_order_id) ?? 0) + 1); return m; };
  const myApps = new Map<string, any>();
  if (sellerListingId) for (const a of (aps ?? []) as any[]) if (a.business_id === sellerListingId) myApps.set(a.buy_order_id, a);
  return rows.map((r) => toCard(r, {
    inv: new Map((invs ?? []).map((x: any) => [x.id, x])), bp: new Map((bps ?? []).map((x: any) => [x.investor_id, x])),
    views: count(vs ?? []), apps: count(aps ?? []), appsNew: count((aps ?? []).filter((x: any) => x.status === "new")), mine: new Set(mine), myApps, isAdmin,
    writers: new Map((ws ?? []).map((w: any) => [w.id, w.full_name || w.email])),
  }, bands));
}

/** Businesses Wanted: posted and closed buy orders of both kinds, as the cards show them. */
export const listBuyOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ cards: BoCard[]; isAdmin: boolean }> => {
    const role = await viewerRole(context.userId);
    if (!role) throw new Error("This page isn't available for your account");
    const sb = await admin();
    let q = sb.from("buy_orders").select("*").in("status", ["posted", "closed"]).order("posted_at", { ascending: false });
    // PitchSnack Control (admins, Buyer tab) sees Sealed buy orders only.
    if (role === "admin") q = q.eq("kind", "sealed");
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const seller = role === "seller" || role === "admin" ? await mySellerListing(context.userId) : null;
    return { cards: await cardsFor(sb, data ?? [], context.userId, role === "admin", seller?.facts.id ?? null), isAdmin: role === "admin" };
  });

/** How many buy orders were posted in the last 7 days (the menu pill). */
export const newBuyOrderCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await viewerRole(context.userId))) return { n: 0 };
    const sb = await admin();
    const since = new Date(Date.now() - 7 * 86400_000).toISOString();
    let q = sb.from("buy_orders").select("id", { count: "exact", head: true }).eq("status", "posted").gte("posted_at", since);
    if ((await viewerRole(context.userId)) === "admin") q = q.eq("kind", "sealed");
    const { count } = await q;
    return { n: count ?? 0 };
  });

/** The seller's listing and whether Apply works yet. */
export const myApplyContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ApplyContext> => {
    const role = await viewerRole(context.userId);
    if (role !== "seller" && role !== "admin") return { state: "none", listing: null };
    const s = await mySellerListing(context.userId);
    if (!s) return { state: "none", listing: null };
    return { state: s.approved ? "approved" : s.pending ? "pending" : "none", listing: s.facts };
  });

/** One view per person; the buy order's own buyer and admins aren't counted. */
export const recordBuyOrderView = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const role = await viewerRole(context.userId);
    if (!role || role === "admin") return { ok: false };
    const sb = await admin();
    const { data: bo } = await sb.from("buy_orders").select("id, status, investor_profile_id").eq("id", data.id).maybeSingle();
    if (!bo || !["posted", "closed"].includes(bo.status)) return { ok: false };
    if ((await myInvestorIds(sb, context.userId)).includes(bo.investor_profile_id)) return { ok: false };
    await sb.from("buy_order_views").upsert({ buy_order_id: bo.id, user_id: context.userId }, { onConflict: "buy_order_id,user_id", ignoreDuplicates: true });
    return { ok: true };
  });

/** Apply: the seller's approved listing, to a posted buy order, once. */
export const applyToBuyOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; note?: string | null }) =>
    z.object({ id: z.string().uuid(), note: z.string().trim().max(500).nullable().optional() }).parse(d))
  .handler(async ({ context, data }) => {
    const role = await viewerRole(context.userId);
    if (role !== "seller" && role !== "admin") throw new Error("Only sellers can apply");
    const s = await mySellerListing(context.userId);
    if (!s?.approved) throw new Error(BO_CHANGED);
    const sb = await admin();
    const { data: bo } = await sb.from("buy_orders").select("id, status, closes_on").eq("id", data.id).maybeSingle();
    if (!bo || !isOpen(bo.status, bo.closes_on)) throw new Error(BO_CHANGED);
    const { error } = await sb.from("buy_order_applications").insert({
      buy_order_id: bo.id, business_id: s.facts.id, seller_user_id: context.userId, note: data.note || null,
    });
    if (error) throw new Error(error.code === "23505" ? BO_CHANGED : error.message);
    return { ok: true };
  });

// ---------- Applications (stage 2) ----------

export type AppRow = {
  id: string; status: BoAppStatus; appliedAt: string; decidedAt: string | null; note: string | null;
  bo: { id: string; ref: string; name: string; kind: BoKind };
  listing: { id: string; codeName: string | null; ref: string | null; sector: string | null; province: string | null; revenue: string | null; dealType: string | null; headline: string | null; description: string | null; highlights: string[] };
  match: { key: "industry" | "location" | "revenue" | "deal"; ok: boolean }[];
  client: { name: string | null; ref: string | null } | null;
};

/** The buy order's own side: the Advertisement's buyer, or an admin for a Sealed one. */
async function isOwnSide(sb: any, userId: string, role: string | null, bo: any) {
  if (bo.kind === "sealed") return role === "admin";
  return (await myInvestorIds(sb, userId)).includes(bo.investor_profile_id);
}

async function reviewRows(sb: any, userId: string, role: string | null): Promise<AppRow[]> {
  let q = sb.from("buy_orders").select("id, ref, name_on_card, kind, investor_profile_id, sector, location, target_revenue, deal_types").in("status", ["posted", "closed"]);
  if (role === "admin") q = q.eq("kind", "sealed");
  else {
    const mine = await myInvestorIds(sb, userId);
    if (!mine.length) return [];
    q = q.eq("kind", "advertisement").in("investor_profile_id", mine);
  }
  const { data: bos } = await q;
  if (!bos?.length) return [];
  const boBy = new Map<string, any>(bos.map((b: any) => [b.id, b]));
  const { data: apps } = await sb.from("buy_order_applications").select("*").in("buy_order_id", [...boBy.keys()]).order("applied_at", { ascending: false });
  if (!apps?.length) return [];
  const hpIds = [...new Set(apps.map((a: any) => a.business_id))];
  const { data: hps } = await sb.from("hidden_profiles").select("id, startup_id, ref_no, code_name, live, deal_type").in("id", hpIds);
  const sIds = [...new Set((hps ?? []).map((h: any) => h.startup_id))];
  const { data: sts } = sIds.length ? await sb.from("startups").select("id, sector, city, address_province_state, headquarters, last_year_revenue").in("id", sIds) : { data: [] };
  const hpBy = new Map<string, any>((hps ?? []).map((h: any) => [h.id, h]));
  const stBy = new Map<string, any>((sts ?? []).map((s: any) => [s.id, s]));
  let clients = new Map<string, any>();
  if (role === "admin") {
    const invIds = [...new Set(bos.map((b: any) => b.investor_profile_id))];
    const [{ data: invs }, { data: bps }] = await Promise.all([
      sb.from("investors").select("id, investor_name, firm_name").in("id", invIds),
      sb.from("buyer_profiles").select("investor_id, ref_no").in("investor_id", invIds),
    ]);
    const refBy = new Map((bps ?? []).map((b: any) => [b.investor_id, b.ref_no]));
    clients = new Map((invs ?? []).map((i: any) => [i.id, { name: i.investor_name ?? i.firm_name ?? null, ref: refBy.get(i.id) ?? null }]));
  }
  const { matchOf } = await import("@/lib/buy-orders");
  return apps.map((a: any) => {
    const bo = boBy.get(a.buy_order_id);
    const hp = hpBy.get(a.business_id) ?? {};
    const st = stBy.get(hp.startup_id) ?? {};
    const live = (hp.live ?? {}) as any;
    const hq = (st.headquarters ?? "").toLowerCase();
    const country = ["Vietnam", "Malaysia", "Indonesia"].find((c) => hq.includes(c.toLowerCase())) ?? "Thailand";
    const listing = {
      id: a.business_id, codeName: live.code_name ?? hp.code_name ?? null, ref: hp.ref_no ?? null, sector: st.sector ?? null,
      province: (st.address_province_state || (st.city ?? "").split(",")[0] || "").trim() || null,
      revenue: st.last_year_revenue ?? null, dealType: live.deal_type ?? hp.deal_type ?? null,
      headline: live.headline ?? null, description: live.description ?? null, highlights: (live.highlights ?? []) as string[],
    };
    return {
      id: a.id, status: a.status, appliedAt: a.applied_at, decidedAt: a.decided_at, note: a.note,
      bo: { id: bo.id, ref: bo.ref, name: bo.name_on_card, kind: bo.kind },
      listing, match: matchOf({ ...listing, country }, bo).rows,
      client: role === "admin" ? clients.get(bo.investor_profile_id) ?? null : null,
    };
  });
}

/** Pipeline › NDA Invitations › Applications. Sellers get their own; buyers and Control get the ones to decide. */
export const listApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { as: "seller" | "buyer" }) => z.object({ as: z.enum(["seller", "buyer"]) }).parse(d))
  .handler(async ({ context, data }): Promise<{ mode: "seller"; cards: BoCard[] } | { mode: "review"; rows: AppRow[] }> => {
    const role = await viewerRole(context.userId);
    const sb = await admin();
    if (data.as === "seller") {
      if (role !== "seller" && role !== "admin") return { mode: "seller", cards: [] };
      const s = await mySellerListing(context.userId);
      if (!s) return { mode: "seller", cards: [] };
      const { data: apps } = await sb.from("buy_order_applications").select("buy_order_id, applied_at").eq("business_id", s.facts.id).order("applied_at", { ascending: false });
      const ids = (apps ?? []).map((a: any) => a.buy_order_id);
      if (!ids.length) return { mode: "seller", cards: [] };
      const { data: rows } = await sb.from("buy_orders").select("*").in("id", ids);
      const order = new Map(ids.map((id: string, i: number) => [id, i]));
      const sorted = (rows ?? []).sort((a: any, b: any) => (order.get(a.id) as number) - (order.get(b.id) as number));
      return { mode: "seller", cards: await cardsFor(sb, sorted, context.userId, false, s.facts.id) };
    }
    if (role !== "buyer" && role !== "admin") return { mode: "review", rows: [] };
    return { mode: "review", rows: await reviewRows(sb, context.userId, role) };
  });

/** Applications waiting for a decision (the tab and menu counts). */
export const applicationsToCheck = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const role = await viewerRole(context.userId);
    if (role !== "buyer" && role !== "admin") return { n: 0 };
    const rows = await reviewRows(await admin(), context.userId, role);
    return { n: rows.filter((r) => r.status === "new").length };
  });

/** Request NDA (signed by the caller; for a Sealed one, for the client) or Not a fit. */
export const decideApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; action: "nda" | "not_a_fit"; consent?: string }) =>
    z.object({ id: z.string().uuid(), action: z.enum(["nda", "not_a_fit"]), consent: z.string().max(500).optional() }).parse(d))
  .handler(async ({ context, data }) => {
    const role = await viewerRole(context.userId);
    const sb = await admin();
    const { data: app } = await sb.from("buy_order_applications").select("*").eq("id", data.id).maybeSingle();
    if (!app) throw new Error(BO_CHANGED);
    const { data: bo } = await sb.from("buy_orders").select("id, kind, status, investor_profile_id").eq("id", app.buy_order_id).maybeSingle();
    if (!bo || !(await isOwnSide(sb, context.userId, role, bo))) throw new Error("Not allowed");
    if (app.status !== "new") throw new Error(BO_CHANGED);
    const now = new Date().toISOString();
    if (data.action === "not_a_fit") {
      const { data: done } = await sb.from("buy_order_applications").update({ status: "not_a_fit", decided_at: now, decided_by_user_id: context.userId }).eq("id", app.id).eq("status", "new").select("id");
      if (!done?.length) throw new Error(BO_CHANGED);
      return { ok: true };
    }
    // NDA request from the buy order's investor profile to the applicant's listing.
    const { isBuyerVisible } = await import("@/lib/hidden-profile");
    const { data: hp } = await sb.from("hidden_profiles").select("id, startup_id, approval_status, live").eq("id", app.business_id).maybeSingle();
    if (!isBuyerVisible(hp)) throw new Error("This listing isn't available");
    let buyerUserId = context.userId;
    if (bo.kind === "sealed") {
      const { data: bp } = await sb.from("buyer_profiles").select("user_id").eq("investor_id", bo.investor_profile_id).limit(1).maybeSingle();
      if (!bp?.user_id) throw new Error("This client has no buyer account");
      buyerUserId = bp.user_id;
    } else {
      const { verificationByUser } = await import("./profile-verification.server");
      const bv = await verificationByUser(sb, context.userId, "status");
      const { data: uv } = await sb.from("user_verifications").select("user_id").eq("user_id", context.userId).maybeSingle();
      if (!uv && (bv as any)?.status !== "verified") throw new Error("Verify your buyer profile first");
    }
    const { data: prev } = await sb.from("deal_pipelines").select("id, status").eq("hidden_profile_id", hp.id).eq("buyer_user_id", buyerUserId).maybeSingle();
    if (prev && !["withdrawn", "declined"].includes(prev.status)) throw new Error("This buyer already has an NDA request or invitation with this listing.");
    if (role !== "admin") await (await import("./plan-access.server")).spendRequest(context.userId, "nda", hp.id);
    let pipelineId: string;
    if (prev) {
      const { error } = await sb.from("deal_pipelines").update({ status: "active", nda_requested_at: now, nda_approved_at: null }).eq("id", prev.id);
      if (error) throw new Error(error.message);
      pipelineId = prev.id;
    } else {
      const { data: row, error } = await sb.from("deal_pipelines").insert({ hidden_profile_id: hp.id, startup_id: hp.startup_id, buyer_user_id: buyerUserId, status: "active" }).select("id").single();
      if (error) throw new Error(error.message);
      pipelineId = row.id;
    }
    await sb.from("deal_pipeline_events").insert({ pipeline_id: pipelineId, event: "nda_requested", actor_id: context.userId, note: data.consent ?? null });
    await (await import("./email-alerts.server")).pipelineAlert(pipelineId, "nda_requested").catch(() => {});
    await (await import("./invitations.server")).notifySellers(hp.startup_id, "New NDA request", "Open Pipeline › NDA Invitations to review and approve the NDA.", "/marketplace/pipeline/invitations").catch(() => {});
    await sb.from("buy_order_applications").update({ status: "nda_requested", decided_at: now, decided_by_user_id: context.userId, nda_request_id: pipelineId }).eq("id", app.id);
    return { ok: true };
  });
