import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pickDraft, runIdentityCheck, type HiddenDraft } from "@/lib/hidden-profile";

/**
 * Approval flow: sellers submit a snapshot (version) of both views, Admin
 * approves / requests changes / rejects; buyers submit for verification.
 * Every action is written to approval_events and notifies the user in-app.
 */

type Ctx = { supabase: any; userId: string };

async function assertAdmin(ctx: Ctx) {
  const { data, error } = await ctx.supabase.rpc("is_control", { _user_id: ctx.userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Admin only");
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function notify(userId: string | null | undefined, tenantId: string | null, title: string, message: string) {
  if (!userId) return;
  const sb = await admin();
  await sb.from("notifications").insert({ user_id: userId, tenant_id: tenantId, notification_type: "approval", title, message });
}

const STARTUP_COLS =
  "id, tenant_id, startup_name, registered_name, registered_number, website_url, email, city, headquarters, region, company_type, year_founded, company_size, last_year_revenue, sector, business_model, industry, product_tags, market_tags, long_description, short_description, regulatory_licenses, iso_standards";

async function buildSnapshot(sb: any, startupId: string, hp: any) {
  const { data: st, error } = await sb.from("startups").select(STARTUP_COLS).eq("id", startupId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!st) throw new Error("Business not found");
  const { data: founders } = await sb.from("startup_founders").select("full_name").eq("startup_id", startupId);
  const { data: fin } = await sb.from("financial_statements").select("fiscal_year").eq("startup_id", startupId);
  const { count: photos } = await sb.from("startup_media").select("id", { count: "exact", head: true }).eq("startup_id", startupId);
  const draft = pickDraft(hp as HiddenDraft);
  const people = ((founders ?? []) as { full_name: string | null }[]).map((f) => f.full_name ?? "").filter(Boolean);
  const findings = runIdentityCheck(draft, { ...st, people, customers: [] });
  return {
    public: draft,
    private: { ...st, people, financial_years: ((fin ?? []) as any[]).map((f) => f.fiscal_year), photos: photos ?? 0 },
    identity_flags: findings.map((f: any) => f.word ?? f.term ?? String(f)),
  };
}

async function logEvent(e: Record<string, unknown>) {
  const sb = await admin();
  await sb.from("approval_events").insert(e);
}

// ---------------------------------------------------------------- seller

export const submitListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ startupId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: hp, error } = await sb.from("hidden_profiles").select("*").eq("startup_id", data.startupId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!hp) throw new Error("Create the Public view first");
    if (hp.approval_status === "in_review") throw new Error("Already in review");
    const snapshot = await buildSnapshot(sb, data.startupId, hp);
    if (snapshot.identity_flags.length) throw new Error("Identity check isn't clean yet");
    const version = (hp.version ?? 0) + 1;
    const { error: e2 } = await sb.from("listing_submissions").insert({
      hidden_profile_id: hp.id, startup_id: hp.startup_id, tenant_id: hp.tenant_id, version, snapshot, submitted_by: context.userId,
    });
    if (e2) throw new Error(e2.message);
    const now = new Date().toISOString();
    const { error: e3 } = await sb.from("hidden_profiles").update({
      approval_status: "in_review", version, submitted_at: now, submitted_by: context.userId, updated_by: context.userId,
    }).eq("id", hp.id);
    if (e3) throw new Error(e3.message);
    const action = version > 1 ? "resubmit" : "submit";
    await logEvent({ item_type: "listing", item_id: hp.id, startup_id: hp.startup_id, subject_user_id: context.userId, version, action, actor_id: context.userId });
    await notify(context.userId, hp.tenant_id, "Submitted for approval", `${hp.code_name} (v${version}) is in review. Admin usually reviews within 1 business day.`);
    return { ok: true };
  });

export const withdrawListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ startupId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: hp } = await sb.from("hidden_profiles").select("id, startup_id, tenant_id, version, status, code_name").eq("startup_id", data.startupId).maybeSingle();
    if (!hp) throw new Error("Not found");
    const next = hp.status === "live" ? "live_edits_pending" : "draft";
    const { error } = await sb.from("hidden_profiles").update({ approval_status: next, updated_by: context.userId }).eq("id", hp.id);
    if (error) throw new Error(error.message);
    await logEvent({ item_type: "listing", item_id: hp.id, startup_id: hp.startup_id, subject_user_id: context.userId, version: hp.version, action: "withdraw", actor_id: context.userId });
    await notify(context.userId, hp.tenant_id, "Submission withdrawn", `${hp.code_name} is back to ${next === "draft" ? "Draft" : "Live · edits pending"}.`);
    return { ok: true };
  });

export const unpublishListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ startupId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: hp } = await sb.from("hidden_profiles").select("id, startup_id, tenant_id, version, code_name").eq("startup_id", data.startupId).maybeSingle();
    if (!hp) throw new Error("Not found");
    const { error } = await sb.from("hidden_profiles").update({
      status: "draft", live: null, approval_status: "unpublished", has_unpublished_changes: false, unpublished_at: new Date().toISOString(), updated_by: context.userId,
    }).eq("id", hp.id);
    if (error) throw new Error(error.message);
    await logEvent({ item_type: "listing", item_id: hp.id, startup_id: hp.startup_id, subject_user_id: context.userId, version: hp.version, action: "unpublish", actor_id: context.userId });
    await notify(context.userId, hp.tenant_id, "Listing unpublished", `${hp.code_name} is no longer visible to buyers.`);
    return { ok: true };
  });

/** Snapshot preview for the seller's confirmation dialog. */
export const getSubmissionPreview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ startupId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: hp } = await sb.from("hidden_profiles").select("*").eq("startup_id", data.startupId).maybeSingle();
    if (!hp) throw new Error("Create the Public view first");
    return buildSnapshot(sb, data.startupId, hp);
  });

// ---------------------------------------------------------------- admin

export const listApprovals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as Ctx);
    const sb = await admin();
    const { data: listings } = await sb
      .from("hidden_profiles")
      .select("id, startup_id, ref_no, code_name, cover_art, approval_status, version, submitted_at, submitted_by, assignee_id, decided_at, startups!inner(startup_name, sector, last_year_revenue)")
      .in("approval_status", ["in_review", "changes_requested"])
      .order("submitted_at", { ascending: true });
    const { data: buyers } = await sb.from("buyer_verifications").select("*").in("status", ["pending", "more_info"]).order("submitted_at", { ascending: true });
    const { data: history } = await sb.from("approval_events").select("*").order("created_at", { ascending: false }).limit(100);
    const userIds = new Set<string>();
    for (const l of listings ?? []) { if (l.submitted_by) userIds.add(l.submitted_by); if (l.assignee_id) userIds.add(l.assignee_id); }
    for (const b of buyers ?? []) { userIds.add(b.user_id); if (b.assignee_id) userIds.add(b.assignee_id); }
    for (const h of history ?? []) userIds.add(h.actor_id);
    const names = await userNames(sb, [...userIds]);
    return { listings: listings ?? [], buyers: buyers ?? [], history: history ?? [], names, me: context.userId };
  });

async function userNames(sb: any, ids: string[]) {
  if (!ids.length) return {} as Record<string, string>;
  const { data } = await sb.from("users").select("id, full_name, email").in("id", ids);
  const out: Record<string, string> = {};
  for (const u of data ?? []) out[u.id] = u.full_name || u.email || "User";
  return out;
}

export const pendingApprovalsCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await (context.supabase as any).rpc("is_control", { _user_id: context.userId });
    if (!isAdmin) return 0;
    const sb = await admin();
    const { count: a } = await sb.from("hidden_profiles").select("id", { count: "exact", head: true }).eq("approval_status", "in_review");
    const { count: b } = await sb.from("buyer_verifications").select("id", { count: "exact", head: true }).eq("status", "pending");
    return (a ?? 0) + (b ?? 0);
  });

export const getListingReview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const sb = await admin();
    const { data: hp } = await sb.from("hidden_profiles").select("*").eq("id", data.id).maybeSingle();
    if (!hp) throw new Error("Listing not found");
    const { data: subs } = await sb.from("listing_submissions").select("*").eq("hidden_profile_id", hp.id).order("version", { ascending: false }).limit(2);
    const { data: events } = await sb.from("approval_events").select("*").eq("item_id", hp.id).order("created_at", { ascending: false });
    const { data: fin } = await sb.from("financial_statements").select("startup_id").eq("startup_id", hp.startup_id).limit(1);
    const current = subs?.[0] ?? null;
    const previous = subs?.[1] ?? null;
    const { buildPublicListing } = await import("@/lib/public-listing");
    const snap = current?.snapshot ?? (await buildSnapshot(sb, hp.startup_id, hp));
    const listing = buildPublicListing(snap.private, { ...snap.public, ref_no: hp.ref_no, live: false, published_at: hp.published_at }, (fin ?? []).length > 0);
    const changed = previous ? diffKeys(previous.snapshot.public, snap.public) : [];
    const ids = [hp.submitted_by, hp.assignee_id, ...(events ?? []).map((e: any) => e.actor_id)].filter(Boolean);
    return { hp, snapshot: snap, listing, changed, events: events ?? [], names: await userNames(sb, ids) };
  });

function diffKeys(a: Record<string, unknown> = {}, b: Record<string, unknown> = {}) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].filter((k) => JSON.stringify(a[k] ?? null) !== JSON.stringify(b[k] ?? null));
}

export const assignApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ kind: z.enum(["listing", "buyer"]), id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const sb = await admin();
    const table = data.kind === "listing" ? "hidden_profiles" : "buyer_verifications";
    const { error } = await sb.from(table).update({ assignee_id: context.userId }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await logEvent({ item_type: data.kind, item_id: data.id, action: "assign", actor_id: context.userId });
    return { ok: true };
  });

export const decideListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      action: z.enum(["approve", "request_changes", "reject"]),
      note: z.string().max(2000).optional(),
      reasons: z.array(z.string().max(80)).max(10).optional(),
      fields: z.array(z.string().max(60)).max(10).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    if (data.action === "reject" && !data.note?.trim()) throw new Error("Give a reason");
    const sb = await admin();
    const { data: hp } = await sb.from("hidden_profiles").select("*").eq("id", data.id).maybeSingle();
    if (!hp) throw new Error("Listing not found");
    const now = new Date().toISOString();
    const base = { decided_at: now, decision_note: data.note ?? null, decision_reasons: data.reasons ?? [], decision_fields: data.fields ?? [] };
    let patch: Record<string, unknown>;
    if (data.action === "approve") {
      const { data: sub } = await sb.from("listing_submissions").select("snapshot").eq("hidden_profile_id", hp.id).eq("version", hp.version).maybeSingle();
      const pub = sub?.snapshot?.public ?? pickDraft(hp);
      patch = {
        ...base, approval_status: "live", status: "live", live: pub, live_snapshot: sub?.snapshot ?? null,
        has_unpublished_changes: false, published_at: hp.status === "live" && hp.published_at ? hp.published_at : now, published_by: context.userId,
      };
    } else if (data.action === "request_changes") {
      patch = { ...base, approval_status: "changes_requested" };
    } else {
      patch = { ...base, approval_status: "rejected" };
    }
    const { error } = await sb.from("hidden_profiles").update(patch).eq("id", hp.id);
    if (error) throw new Error(error.message);
    await logEvent({
      item_type: "listing", item_id: hp.id, startup_id: hp.startup_id, subject_user_id: hp.submitted_by, version: hp.version,
      action: data.action, actor_id: context.userId, note: data.note ?? null, reasons: data.reasons ?? [], fields: data.fields ?? [],
    });
    const msg = {
      approve: ["Listing approved", `${hp.code_name} is live in the Marketplace.`],
      request_changes: ["Changes requested", `Admin asked for changes to ${hp.code_name}: ${data.note ?? ""}`],
      reject: ["Listing rejected", `${hp.code_name} was rejected: ${data.note ?? ""}`],
    }[data.action];
    await notify(hp.submitted_by, hp.tenant_id, msg[0], msg[1]);
    return { ok: true };
  });

// ---------------------------------------------------------------- buyers

export const getMyVerification = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await (context.supabase as any).from("buyer_verifications").select("*").eq("user_id", context.userId).maybeSingle();
    return data ?? null;
  });

const domainOf = (v?: string | null) => {
  if (!v) return "";
  const s = v.includes("@") ? v.split("@")[1] : v.replace(/^https?:\/\//, "").split("/")[0];
  return s.toLowerCase().replace(/^www\./, "");
};

export const submitVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      company_name: z.string().trim().min(1).max(200),
      buyer_type: z.string().max(60).optional(),
      registration_no: z.string().max(60).optional(),
      work_email: z.string().trim().email().max(255),
      website: z.string().max(255).optional(),
      linkedin: z.string().max(255).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const match = data.website ? domainOf(data.work_email) === domainOf(data.website) : null;
    const row = { ...data, user_id: context.userId, status: "pending", email_domain_match: match, submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    const { data: existing } = await sb.from("buyer_verifications").select("id").eq("user_id", context.userId).maybeSingle();
    const res = existing
      ? await sb.from("buyer_verifications").update(row).eq("id", existing.id).select("*").single()
      : await sb.from("buyer_verifications").insert(row).select("*").single();
    if (res.error) throw new Error(res.error.message);
    await logEvent({ item_type: "buyer", item_id: res.data.id, subject_user_id: context.userId, action: existing ? "resubmit" : "submit", actor_id: context.userId });
    await notify(context.userId, null, "Submitted for verification", "Admin usually reviews within 1 business day.");
    return res.data;
  });

export const getBuyerReview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const sb = await admin();
    const { data: bv } = await sb.from("buyer_verifications").select("*").eq("id", data.id).maybeSingle();
    if (!bv) throw new Error("Buyer not found");
    const { data: profile } = await sb.from("user_profiles").select("*").eq("user_id", bv.user_id).maybeSingle();
    const { data: user } = await sb.from("users").select("full_name, email").eq("id", bv.user_id).maybeSingle();
    const { data: events } = await sb.from("approval_events").select("*").eq("item_id", bv.id).order("created_at", { ascending: false });
    const ids = [bv.assignee_id, ...(events ?? []).map((e: any) => e.actor_id)].filter(Boolean);
    return { bv, profile, user, events: events ?? [], names: await userNames(sb, ids) };
  });

export const decideBuyer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), action: z.enum(["verify", "more_info", "decline"]), note: z.string().max(2000).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    if (data.action !== "verify" && !data.note?.trim()) throw new Error("Add a note for the buyer");
    const sb = await admin();
    const status = { verify: "verified", more_info: "more_info", decline: "declined" }[data.action];
    const { data: bv, error } = await sb.from("buyer_verifications")
      .update({ status, decision_note: data.note ?? null, decided_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", data.id).select("*").single();
    if (error) throw new Error(error.message);
    await logEvent({ item_type: "buyer", item_id: bv.id, subject_user_id: bv.user_id, action: data.action, actor_id: context.userId, note: data.note ?? null });
    const msg = {
      verify: ["You're a verified buyer", "You can now request NDAs."],
      more_info: ["More information needed", data.note ?? ""],
      decline: ["Verification declined", data.note ?? ""],
    }[data.action];
    await notify(bv.user_id, null, msg[0], msg[1]);
    return bv;
  });
