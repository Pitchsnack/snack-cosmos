import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { addMonths, bkkToday, canShareOrder, checkDraft, draftRow, effectiveStatus, isOpen, sealedOnly, PERIODS, type BoAppStatus, type BoDraft, type BoKind, type BoStatus } from "@/lib/buy-orders";

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
  /** The writer's side only (section 9.2). */
  sentToAdminAt: string | null; adminNote: string | null; extendedCount: number;
  /** Admins only. */
  client: { id: string; name: string | null; ref: string | null; writer: string | null } | null;
  /** The sender's name, when this buy order was shared with the viewer by email (newest share). */
  sharedBy?: string | null; sharedAt?: string | null;
  managedApps?: { id: string; businessId: string; company: string; ref: string | null; status: BoAppStatus; appliedAt: string }[];
  applicationId?: string; forCompany?: { name: string; ref: string | null };
};

export type ApplyContext = {
  state: "approved" | "pending" | "none";
  listing: { id: string; codeName: string | null; ref: string | null; sector: string | null; province: string | null; country: string | null; revenue: string | null; dealType: string | null } | null;
  managed?: boolean;
  companies?: { name: string; listing: NonNullable<ApplyContext["listing"]> }[];
};

/** Reuse the authoritative management projection, scoped to the Control workspace. */
async function managedSellers(sb: any, liveOnly = true): Promise<NonNullable<ApplyContext["companies"]>> {
  const { controlTenantId, managedStartupIds } = await import("@/lib/managed.server");
  const ctl = await controlTenantId(sb);
  if (!ctl) return [];
  const { data: sts, error } = await sb.from("startups").select("id, startup_name, sector, city, address_province_state, headquarters, last_year_revenue").eq("tenant_id", ctl);
  if (error) throw new Error(error.message);
  const managed = await managedStartupIds(sb, (sts ?? []).map((s: any) => s.id));
  if (!managed.size) return [];
  const { data: hps, error: hpError } = await sb.from("hidden_profiles").select("id, startup_id, ref_no, code_name, approval_status, live, deal_type").in("startup_id", [...managed]);
  if (hpError) throw new Error(hpError.message);
  const { isBuyerVisible } = await import("@/lib/hidden-profile");
  const by = new Map<string, any>((sts ?? []).map((s: any) => [s.id, s]));
  return (hps ?? []).filter((h: any) => !liveOnly || isBuyerVisible(h)).map((h: any) => {
    const s = by.get(h.startup_id);
    const live = h.live ?? {};
    const hq = (s.headquarters ?? "").toLowerCase();
    return { name: s.startup_name ?? h.ref_no ?? "—", listing: {
      id: h.id, codeName: live.code_name ?? h.code_name ?? null, ref: h.ref_no ?? null, sector: s.sector ?? null,
      province: (s.address_province_state || (s.city ?? "").split(",")[0] || "").trim() || null,
      country: ["Vietnam", "Malaysia", "Indonesia"].find((c) => hq.includes(c.toLowerCase())) ?? "Thailand",
      revenue: s.last_year_revenue ?? null, dealType: live.deal_type ?? h.deal_type ?? null,
    } };
  }).sort((a: any, b: any) => a.name.localeCompare(b.name));
}

async function attachManagedApps(sb: any, cards: BoCard[], companies: NonNullable<ApplyContext["companies"]>) {
  if (!companies.length || !cards.length) return;
  const { data, error } = await sb.from("buy_order_applications").select("id, buy_order_id, business_id, status, applied_at").in("business_id", companies.map((c) => c.listing.id)).in("buy_order_id", cards.map((c) => c.id)).order("applied_at", { ascending: false });
  if (error) throw new Error(error.message);
  const by = new Map(companies.map((c) => [c.listing.id, c]));
  for (const card of cards) card.managedApps = (data ?? []).filter((a: any) => a.buy_order_id === card.id).map((a: any) => ({ id: a.id, businessId: a.business_id, company: by.get(a.business_id)?.name ?? "—", ref: by.get(a.business_id)?.listing.ref ?? null, status: a.status, appliedAt: a.applied_at }));
}

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
    sentToAdminAt: own || ctx.isAdmin ? r.sent_to_admin_at : null, adminNote: own || ctx.isAdmin ? r.admin_note : null, extendedCount: r.extended_count ?? 0,
    client: ctx.isAdmin ? { id: r.investor_profile_id, name: i.investor_name ?? i.firm_name ?? null, ref: b?.ref_no ?? null, writer: ctx.writers.get(r.written_by_user_id) ?? null } : null,
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
    isAdmin && writerIds.length ? sb.from("users").select("id, first_name, last_name, email").in("id", writerIds) : { data: [] },
  ]);
  const count = (list: any[]) => { const m = new Map<string, number>(); for (const x of list) m.set(x.buy_order_id, (m.get(x.buy_order_id) ?? 0) + 1); return m; };
  const myApps = new Map<string, any>();
  if (sellerListingId) for (const a of (aps ?? []) as any[]) if (a.business_id === sellerListingId) myApps.set(a.buy_order_id, a);
  return rows.map((r) => toCard(r, {
    inv: new Map((invs ?? []).map((x: any) => [x.id, x])), bp: new Map((bps ?? []).map((x: any) => [x.investor_id, x])),
    views: count(vs ?? []), apps: count(aps ?? []), appsNew: count((aps ?? []).filter((x: any) => x.status === "new")), mine: new Set(mine), myApps, isAdmin,
    writers: new Map((ws ?? []).map((w: any) => [w.id, [w.first_name, w.last_name].filter(Boolean).join(" ") || w.email])),
  }, bands));
}

/** Businesses Wanted: posted and closed buy orders of both kinds, as the cards show them. */
export const listBuyOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { persona: "seller" | "buyer" | "advisor" }) => z.object({ persona: z.enum(["seller", "buyer", "advisor"]) }).parse(d))
  .handler(async ({ context, data }): Promise<{ cards: BoCard[]; isAdmin: boolean }> => {
    const role = await viewerRole(context.userId);
    if (!role) throw new Error("This page isn't available for your account");
    if (role === "admin") await requireControlAdmin(context);
    const sb = await admin();
    let q = sb.from("buy_orders").select("*").in("status", ["posted", "closed"]).order("posted_at", { ascending: false });
    // PitchSnack Control (admins, Buyer tab) sees Sealed buy orders only.
    if (sealedOnly(role, data.persona)) q = q.eq("kind", "sealed");
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const seller = role === "seller" ? await mySellerListing(context.userId) : null;
    const cards = await cardsFor(sb, data ?? [], context.userId, role === "admin", seller?.facts.id ?? null);
    if (role !== "admin") {
      const { data: sh } = await sb.from("share_invitations").select("buy_order_id, sender_user_id, sent_at").eq("joined_user_id", context.userId).not("buy_order_id", "is", null).order("sent_at", { ascending: false });
      const rows = (sh ?? []) as any[];
      if (rows.length) {
        const sids = [...new Set(rows.map((r) => r.sender_user_id))];
        const { data: us } = await sb.from("users").select("id, first_name, last_name").in("id", sids);
        const nm = new Map((us ?? []).map((u: any) => [u.id, [u.first_name, u.last_name].filter(Boolean).join(" ") || "PitchSnack member"]));
        const first = new Map<string, any>();
        for (const r of rows) if (!first.has(r.buy_order_id)) first.set(r.buy_order_id, r);
        for (const c of cards) { const r = first.get(c.id); if (r && !c.yours) { c.sharedBy = String(nm.get(r.sender_user_id) ?? "PitchSnack member"); c.sharedAt = r.sent_at; } }
      }
    }
    return { cards, isAdmin: role === "admin" };
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

async function reviewRows(sb: any, userId: string, role: string | null, onlyId?: string): Promise<AppRow[]> {
  let q = sb.from("buy_orders").select("id, ref, name_on_card, kind, investor_profile_id, sector, location, target_revenue, deal_types").in("status", ["posted", "closed"]);
  if (onlyId) q = q.eq("id", onlyId);
  else if (role === "admin") q = q.eq("kind", "sealed");
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

// ---------- Stage 3: the writer's side (My advertisements) ----------

const draftSchema = z.object({
  clientId: z.string().uuid().nullable().optional(), sector: z.string().max(80), name: z.string().max(60), description: z.string().max(400),
  location: z.string().max(40), cities: z.string().max(200), propertySize: z.string().max(40), factorySize: z.string().max(40),
  products: z.string().max(500), targetRevenue: z.string().max(40), priceRange: z.string().max(40), dealTypes: z.array(z.string().max(60)).max(5),
  mustHave: z.string().max(2000), niceToHave: z.string().max(2000), profit: z.string().max(200), timing: z.string().max(200),
  periodMonths: z.number().int(),
});

/** Live investor profiles PitchSnack manages: the clients a Sealed buy order can be for. Admins only. */
async function managedClients(sb: any) {
  const ctl = await (await import("@/lib/managed.server")).controlTenantId(sb);
  if (!ctl) return [];
  const { data: invs } = await sb.from("investors").select("id, investor_name, firm_name").eq("tenant_id", ctl);
  const ids = (invs ?? []).map((i: any) => i.id);
  const managed = await (await import("@/lib/managed.server")).managedInvestorIds(sb, ids);
  const { data: bps } = ids.length ? await sb.from("buyer_profiles").select("investor_id, ref_no, approval_status").in("investor_id", [...managed]) : { data: [] };
  const live = new Map((bps ?? []).filter((b: any) => b.approval_status === "approved").map((b: any) => [b.investor_id, b.ref_no]));
  return (invs ?? []).filter((i: any) => live.has(i.id)).map((i: any) => ({ id: i.id as string, name: (i.investor_name ?? i.firm_name ?? "—") as string, ref: (live.get(i.id) ?? null) as string | null }))
    .sort((a: any, b: any) => a.name.localeCompare(b.name));
}

export type BoClient = { id: string; name: string; ref: string | null; buyerType: string; country: string | null };

/** My advertisements: the buyer's own Advertisements, or (admins, Buyer tab) every Sealed one, in every status. */
export const myBuyOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ control: boolean; cards: BoCard[]; clients: BoClient[]; me: { buyerType: string; country: string | null } | null }> => {
    const role = await viewerRole(context.userId);
    if (role !== "buyer" && role !== "admin") throw new Error("This page isn't available for your account");
    const sb = await admin();
    const bands = await import("@/lib/investor-bands");
    if (role === "admin") {
      const { data } = await sb.from("buy_orders").select("*").eq("kind", "sealed").order("created_at", { ascending: false });
      const list = await managedClients(sb);
      const { data: invs } = list.length ? await sb.from("investors").select("id, investor_type, country").in("id", list.map((c: any) => c.id)) : { data: [] };
      const by = new Map((invs ?? []).map((i: any) => [i.id, i]));
      return {
        control: true, cards: await cardsFor(sb, data ?? [], context.userId, true, null), me: null,
        clients: list.map((c: any) => ({ ...c, buyerType: bands.typeName((by.get(c.id) as any)?.investor_type ?? null, []), country: (by.get(c.id) as any)?.country ?? null })),
      };
    }
    const mine = await myInvestorIds(sb, context.userId);
    const { data } = mine.length ? await sb.from("buy_orders").select("*").eq("kind", "advertisement").in("investor_profile_id", mine).order("created_at", { ascending: false }) : { data: [] };
    let me = null;
    if (mine[0]) {
      const [{ data: i }, { data: b }] = await Promise.all([
        sb.from("investors").select("investor_type, country, acts_for_types").eq("id", mine[0]).maybeSingle(),
        sb.from("buyer_profiles").select("buyer_relation").eq("investor_id", mine[0]).limit(1).maybeSingle(),
      ]);
      me = { buyerType: bands.typeName(i?.investor_type ?? null, b?.buyer_relation === "agent" ? bands.sortActsFor(i?.acts_for_types ?? []) : []), country: i?.country ?? null };
    }
    return { control: false, cards: await cardsFor(sb, data ?? [], context.userId, false, null), clients: [], me };
  });

/** Save draft, or send to Admin. New: draft; edited: keeps its status unless sent. */
export const saveBuyOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string | null; draft: BoDraft; send: boolean }) =>
    z.object({ id: z.string().uuid().nullable().optional(), draft: draftSchema, send: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    const role = await viewerRole(context.userId);
    if (role !== "buyer" && role !== "admin") throw new Error("Not allowed");
    const sb = await admin();
    const sealed = role === "admin";
    const errs = checkDraft(data.draft as BoDraft, sealed);
    if (Object.keys(errs).length) throw new Error("Check the highlighted fields.");
    let investorId: string;
    if (sealed) {
      const ok = (await managedClients(sb)).some((c: any) => c.id === data.draft.clientId);
      if (!ok) throw new Error("Pick a buyer PitchSnack looks after.");
      investorId = data.draft.clientId!;
    } else {
      const mine = await myInvestorIds(sb, context.userId);
      if (!mine[0]) throw new Error("Set up your buyer profile first.");
      investorId = mine[0];
    }
    const now = new Date().toISOString();
    const row: any = { ...draftRow(data.draft as BoDraft), investor_profile_id: investorId, updated_at: now };
    if (data.send) { row.status = "waiting"; row.sent_to_admin_at = now; }
    if (data.id) {
      const { data: bo } = await sb.from("buy_orders").select("id, kind, status, investor_profile_id").eq("id", data.id).maybeSingle();
      if (!bo || !(await isOwnSide(sb, context.userId, role, bo)) || !["draft", "sent_back"].includes(bo.status)) throw new Error(BO_CHANGED);
      if (!sealed) row.investor_profile_id = bo.investor_profile_id;
      const { data: done, error } = await sb.from("buy_orders").update(row).eq("id", bo.id).in("status", ["draft", "sent_back"]).select("id");
      if (error) throw new Error(error.message);
      if (!done?.length) throw new Error(BO_CHANGED);
      return { id: bo.id as string };
    }
    const { data: made, error } = await sb.from("buy_orders").insert({ ...row, kind: sealed ? "sealed" : "advertisement", status: data.send ? "waiting" : "draft", written_by_user_id: context.userId }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: made.id as string };
  });

/** Send to Admin as it is (the card's button). */
export const sendBuyOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const role = await viewerRole(context.userId);
    const sb = await admin();
    const { data: bo } = await sb.from("buy_orders").select("*").eq("id", data.id).maybeSingle();
    if (!bo || !(await isOwnSide(sb, context.userId, role, bo))) throw new Error("Not allowed");
    if (!["draft", "sent_back"].includes(bo.status)) throw new Error(BO_CHANGED);
    const d = rowToDraft(bo);
    if (Object.keys(checkDraft(d, bo.kind === "sealed")).length) throw new Error("Open Edit and fill in the highlighted fields first.");
    const { data: done } = await sb.from("buy_orders").update({ status: "waiting", sent_to_admin_at: new Date().toISOString() }).eq("id", bo.id).in("status", ["draft", "sent_back"]).select("id");
    if (!done?.length) throw new Error(BO_CHANGED);
    return { ok: true };
  });

function rowToDraft(r: any): BoDraft {
  return {
    clientId: r.investor_profile_id, sector: r.sector ?? "", name: r.name_on_card ?? "", description: r.description ?? "", location: r.location ?? "Thailand",
    cities: r.cities === "Any" ? "" : r.cities ?? "", propertySize: r.property_size ?? "Any", factorySize: r.factory_size ?? "Any", products: r.products ?? "",
    targetRevenue: r.target_revenue ?? "", priceRange: r.price_range ?? "", dealTypes: r.deal_types ?? [], mustHave: (r.must_have ?? []).join("\n"),
    niceToHave: (r.nice_to_have ?? []).join("\n"), profit: r.profit ?? "", timing: r.timing ?? "", periodMonths: r.period_months ?? 3,
  };
}

// ---------- Stage 3: Admin › Approvals › Advertisement ----------

async function requireControlAdmin(context: { supabase: any; userId: string }) {
  await (await import("@/lib/profile-handover.server")).requireControlAdmin(context);
}

export type AdminBoRow = BoCard & { writerKind: "control" | "buyer"; company: string | null; ndaRequested: number; notAFit: number };
export type AdminBoFilter = { tile?: "all" | "waiting" | "open" | "closing" | "closed" | "applicants"; q?: string; kind?: "sealed" | "advertisement" | null; sector?: string | null; sort?: "closes" | "newest" | "most" | "mostNew"; page?: number; size?: number };

export const adminBuyOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: AdminBoFilter) => z.object({
    tile: z.enum(["all", "waiting", "open", "closing", "closed", "applicants"]).optional(), q: z.string().max(100).optional(),
    kind: z.enum(["sealed", "advertisement"]).nullable().optional(), sector: z.string().max(80).nullable().optional(),
    sort: z.enum(["closes", "newest", "most", "mostNew"]).optional(), page: z.number().int().min(1).optional(), size: z.number().int().min(5).max(50).optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    await requireControlAdmin(context);
    const sb = await admin();
    const { data: rows } = await sb.from("buy_orders").select("*").neq("status", "draft");
    const cards = await cardsFor(sb, rows ?? [], context.userId, true, null);
    const { data: aps } = (rows ?? []).length ? await sb.from("buy_order_applications").select("buy_order_id, status").in("buy_order_id", (rows ?? []).map((r: any) => r.id)) : { data: [] };
    const invIds = [...new Set((rows ?? []).map((r: any) => r.investor_profile_id))];
    const { data: invs } = invIds.length ? await sb.from("investors").select("id, investor_name, legal_name, firm_name").in("id", invIds) : { data: [] };
    const company = new Map<string, string | null>((invs ?? []).map((i: any) => [i.id, i.legal_name ?? i.firm_name ?? i.investor_name ?? null]));
    const rowBy = new Map((rows ?? []).map((r: any) => [r.id, r]));
    const today = bkkToday();
    const in30 = new Date(Date.parse(today) + 30 * 86400_000).toISOString().slice(0, 10);
    const all: AdminBoRow[] = cards.map((c) => ({
      ...c, writerKind: c.kind === "sealed" ? "control" : "buyer", company: company.get((rowBy.get(c.id) as any).investor_profile_id) ?? null,
      appsTotal: c.applied, appsNew: (aps ?? []).filter((a: any) => a.buy_order_id === c.id && a.status === "new").length,
      ndaRequested: (aps ?? []).filter((a: any) => a.buy_order_id === c.id && a.status === "nda_requested").length,
      notAFit: (aps ?? []).filter((a: any) => a.buy_order_id === c.id && a.status === "not_a_fit").length,
    }));
    const closing = (c: AdminBoRow) => c.status === "posted" && !!c.closesOn && c.closesOn <= in30;
    const tiles = {
      all: all.length, waiting: all.filter((c) => c.status === "waiting").length, open: all.filter((c) => c.status === "posted").length,
      closing: all.filter(closing).length, closed: all.filter((c) => c.status === "closed").length,
      applicants: all.reduce((n, c) => n + c.applied, 0), applicantsNew: all.reduce((n, c) => n + (c.appsNew ?? 0), 0),
    };
    let list = all;
    const t = data.tile ?? "all";
    if (t === "waiting") list = list.filter((c) => c.status === "waiting");
    if (t === "open") list = list.filter((c) => c.status === "posted");
    if (t === "closing") list = list.filter(closing);
    if (t === "closed") list = list.filter((c) => c.status === "closed");
    if (t === "applicants") list = list.filter((c) => (c.appsNew ?? 0) > 0);
    if (data.kind) list = list.filter((c) => c.kind === data.kind);
    if (data.sector) list = list.filter((c) => c.sector === data.sector);
    const q = (data.q ?? "").trim().toLowerCase();
    if (q) list = list.filter((c) => [c.name, c.ref, c.client?.name, c.client?.ref, c.company, c.client?.writer].some((v) => (v ?? "").toLowerCase().includes(q)));
    const rank = (c: AdminBoRow) => (c.status === "waiting" ? 0 : c.status === "sent_back" ? 1 : c.status === "posted" ? 2 : 3);
    const sort = data.sort ?? "closes";
    list = [...list].sort((a, b) => {
      if (sort === "newest") return (b.postedAt ?? "").localeCompare(a.postedAt ?? "");
      if (sort === "most") return b.applied - a.applied;
      if (sort === "mostNew") return (b.appsNew ?? 0) - (a.appsNew ?? 0);
      const r = rank(a) - rank(b);
      if (r) return r;
      if (a.status === "closed") return (b.closesOn ?? "").localeCompare(a.closesOn ?? "");
      if (a.status === "posted") return (a.closesOn ?? "").localeCompare(b.closesOn ?? "");
      return (a.sentToAdminAt ?? "").localeCompare(b.sentToAdminAt ?? "");
    });
    const size = data.size ?? 25;
    const page = Math.max(1, Math.min(data.page ?? 1, Math.max(1, Math.ceil(list.length / size))));
    return { tiles, total: list.length, page, size, rows: list.slice((page - 1) * size, page * size) };
  });

export const adminWaitingCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if ((await viewerRole(context.userId)) !== "admin") return { n: 0 };
    const { count } = await (await admin()).from("buy_orders").select("id", { count: "exact", head: true }).eq("status", "waiting");
    return { n: count ?? 0 };
  });

/** Post buy order or Send back, with Admin's edits (section 11.5). */
export const adminDecideBuyOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; action: "post" | "send_back"; draft: BoDraft; note?: string }) =>
    z.object({ id: z.string().uuid(), action: z.enum(["post", "send_back"]), draft: draftSchema, note: z.string().trim().max(1000).optional() }).parse(d))
  .handler(async ({ context, data }) => {
    await requireControlAdmin(context);
    const sb = await admin();
    const { data: bo } = await sb.from("buy_orders").select("*").eq("id", data.id).maybeSingle();
    if (!bo || bo.status !== "waiting") throw new Error(BO_CHANGED);
    // Admin edits only these; the rest stays as written.
    const merged: BoDraft = { ...rowToDraft(bo), ...pick(data.draft as BoDraft, ["name", "description", "targetRevenue", "priceRange", "location", "cities", "propertySize", "factorySize", "mustHave", "periodMonths"]) };
    if (Object.keys(checkDraft(merged, false)).length) throw new Error("Check the highlighted fields.");
    const now = new Date();
    const { investor_profile_id: _i, ...cols } = { ...draftRow(merged), investor_profile_id: null };
    let upd: any = { ...cols, updated_at: now.toISOString() };
    if (data.action === "send_back") {
      if (!data.note) throw new Error("Write a note first.");
      upd = { ...upd, status: "sent_back", admin_note: data.note, sent_back_at: now.toISOString() };
    } else {
      upd = { ...upd, status: "posted", posted_at: now.toISOString(), posted_by_user_id: context.userId, closes_on: addMonths(bkkToday(now.getTime()), merged.periodMonths), closed_at: null };
    }
    const { data: done, error } = await sb.from("buy_orders").update(upd).eq("id", bo.id).eq("status", "waiting").select("id");
    if (error) throw new Error(error.message);
    if (!done?.length) throw new Error(BO_CHANGED);
    return { ok: true };
  });

function pick<T extends object>(o: T, keys: (keyof T)[]): Partial<T> { const r: Partial<T> = {}; for (const k of keys) r[k] = o[k]; return r; }

/** Extend (posted) or Reopen (closed), section 11.6. */
export const adminExtendBuyOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; months: number }) => z.object({ id: z.string().uuid(), months: z.number().int() }).parse(d))
  .handler(async ({ context, data }) => {
    await requireControlAdmin(context);
    if (!(PERIODS as readonly number[]).includes(data.months)) throw new Error("Pick a period.");
    const sb = await admin();
    const { data: bo } = await sb.from("buy_orders").select("*").eq("id", data.id).maybeSingle();
    if (!bo) throw new Error(BO_CHANGED);
    const st = effectiveStatus(bo.status, bo.closes_on);
    let upd: any;
    if (st === "posted") upd = { closes_on: addMonths(bo.closes_on, data.months) };
    else if (st === "closed") upd = { status: "posted", closes_on: addMonths(bkkToday(), data.months), closed_at: null };
    else throw new Error(BO_CHANGED);
    const { error } = await sb.from("buy_orders").update({ ...upd, extended_count: (bo.extended_count ?? 0) + 1, updated_at: new Date().toISOString() }).eq("id", bo.id).eq("updated_at", bo.updated_at);
    if (error) throw new Error(error.message);
    return { closesOn: upd.closes_on as string };
  });

/** Applicants of one buy order, read-only (section 11.7). */
export const adminBuyOrderApplicants = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await requireControlAdmin(context);
    const sb = await admin();
    const rows = await reviewRows(sb, context.userId, "admin", data.id);
    return { rows };
  });


const senderName = (u: any) => [u?.first_name, u?.last_name].filter(Boolean).join(" ") || "PitchSnack member";

/** Share a posted buy order by email (section 12.2). Answers OK either way so it never tells who is on PitchSnack. */
export const sendBuyOrderShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), email: z.string().trim().email().max(254).transform((v) => v.toLowerCase()), lang: z.enum(["en", "th"]) }).parse(d))
  .handler(async ({ context, data }) => {
    const role = await viewerRole(context.userId);
    if (!role || role === "admin") throw new Error("Not available");
    const sb = await admin();
    const { data: r } = await sb.from("buy_orders").select("*").eq("id", data.id).maybeSingle();
    if (!r || effectiveStatus(r.status, r.closes_on) !== "posted") throw new Error(BO_CHANGED);
    const mine = await myInvestorIds(sb, context.userId);
    if (mine.includes(r.investor_profile_id)) throw new Error("Not available");
    const { count } = await sb.from("share_invitations").select("id", { count: "exact", head: true }).eq("sender_user_id", context.userId).not("buy_order_id", "is", null).gte("sent_at", new Date(Date.now() - 60000).toISOString());
    if ((count ?? 0) >= 10) throw new Error("Please wait before sending again");
    const [card] = await cardsFor(sb, [r], context.userId, false, null);
    const { data: me } = await sb.from("users").select("first_name, last_name").eq("id", context.userId).maybeSingle();
    const name = senderName(me);
    const { data: ex } = await sb.from("users").select("id").ilike("email", data.email.replace(/[\\%_]/g, "\\$&")).limit(1);
    let existing = !!ex?.length;
    if (!existing) { const { data: f } = await sb.rpc("share_email_has_account", { _email: data.email }); existing = !!f; }
    let url = `https://pitchsnack.com/marketplace/businesses-wanted?bo=${encodeURIComponent(r.ref)}`;
    let refKey = `buy-order-share:${r.id}:${data.email}:${Date.now()}`;
    if (!existing) {
      const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");
      const { data: inv, error } = await sb.from("share_invitations").insert({ sender_user_id: context.userId, email: data.email, token, buy_order_id: r.id }).select("id").single();
      if (error) throw new Error("Invitation unavailable");
      url = `https://pitchsnack.com/signup?join=${token}`; refKey = `buy-order-share:${inv.id}`;
    }
    const th = data.lang === "th";
    const { coverOf, placeOf, fmtDay } = await import("@/lib/buy-orders");
    const { BO_SHARE_COPY: C } = await import("@/lib/email-templates/buy-order-share");
    const k = (x: keyof typeof C) => C[x][th ? 1 : 0];
    const payload = {
      name, email: data.email, lang: data.lang, url, existing,
      card: {
        title: card.name, ref: card.ref, description: card.description, tile: coverOf(card.sector).mid,
        buyer: [card.buyerType, card.country].filter(Boolean).join(" · "), sealed: card.kind === "sealed",
        rows: [
          { l: k("location"), v: placeOf(card.cities, card.location) }, { l: k("rev"), v: card.targetRevenue }, { l: k("price"), v: card.priceRange },
          { l: k("deal"), v: card.dealTypes.join(", ") }, { l: k("close"), v: fmtDay(card.closesOn, th) },
        ],
      },
    };
    const base = { alert_key: "Buy order share", role, user_id: context.userId, email: data.email, subject: k("subject").replace("{name}", name), ref_key: refKey };
    try {
      const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
      const res = await sendTemplateEmail("buy-order-share", data.email, { templateData: payload, idempotencyKey: refKey });
      await sb.from("email_alert_log").insert({ ...base, status: res.sent ? "sent" : "suppressed" });
    } catch (e) {
      await sb.from("email_alert_log").insert({ ...base, status: "failed", reason: (e instanceof Error ? e.message : "Send failed").slice(0, 300) });
      throw new Error("Invitation unavailable");
    }
    return { ok: true };
  });

/** Sign-up from a buy order email: only the token holder learns the sender and the card's public name/ref. */
export const buyOrderInvite = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string().min(16).max(128) }).parse(d))
  .handler(async ({ data }) => {
    const sb = await admin();
    const { data: inv } = await sb.from("share_invitations").select("email, sender_user_id, buy_order_id").eq("token", data.token).maybeSingle();
    if (!inv?.buy_order_id) return null;
    const [{ data: bo }, { data: u }] = await Promise.all([
      sb.from("buy_orders").select("ref, name_on_card").eq("id", inv.buy_order_id).maybeSingle(),
      sb.from("users").select("first_name, last_name").eq("id", inv.sender_user_id).maybeSingle(),
    ]);
    if (!bo) return null;
    return { email: inv.email as string, sender: senderName(u), name: bo.name_on_card as string, ref: bo.ref as string };
  });
