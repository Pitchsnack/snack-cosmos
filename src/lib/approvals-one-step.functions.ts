import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resetApprovalNotice } from "@/lib/approval-notices.functions";
import { advisorReview, buyerReview, sellerReview, waitingDays, type OneStepItem, type OneStepKind } from "@/lib/one-step.server";

/**
 * One-step approval: one Admin decision per profile/listing publishes AND
 * verifies it (buyers: buyer_profiles + investor_profile_verifications move
 * together; sellers: the listing goes live Certified; advisors: the firm is
 * verified and live in Browse advisors at once). Every register and decision is
 * logged to approval_events with the reasons and the note.
 */

type Ctx = { supabase: any; userId: string };
async function assertAdmin(ctx: Ctx) {
  const { data } = await ctx.supabase.rpc("is_control", { _user_id: ctx.userId });
  if (!data) throw new Error("Admin only");
}
async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}
const fullName = (u: any) => (u ? [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email : null);
const firstName = (u: any) => (u?.first_name ?? "").trim() || (u?.email ?? "").split("@")[0] || "there";

async function logEvent(e: Record<string, unknown>) {
  const sb = await admin();
  await sb.from("approval_events").insert(e);
}
/** Fetch source + date of the stored DBD data, written onto Verify and publish. */
async function dbdStamp(reg: string | null | undefined) {
  const { normReg } = await import("./dbd-store.server");
  const r = normReg(reg);
  if (!r) return { dbd_source: null, dbd_retrieved_at: null };
  const { data } = await (await admin()).from("dbd_company_records").select("source, retrieved_at").eq("registration_number", r).maybeSingle();
  return { dbd_source: data?.source ?? null, dbd_retrieved_at: data?.retrieved_at ?? null };
}
async function notify(userId: string | null | undefined, title: string, message: string, link?: string) {
  if (!userId) return;
  const sb = await admin();
  await sb.from("notifications").insert({ user_id: userId, notification_type: "approval", title, message, link_url: link ?? null });
}

export const DECISION_REASONS = [
  "Company name is not correct",
  "Address is not correct",
  "Website cannot be accessed",
  "Not a corporate email address",
  "Another reason",
] as const;

/* ================================================================ queue */

export const listOneStepApprovals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as Ctx);
    const sb = await admin();

    // ---- sellers: hidden_profiles waiting or sent back
    const { data: hps } = await sb.from("hidden_profiles")
      .select("id, startup_id, ref_no, code_name, sector, description, highlights, customers_summary, deal_type, owner_stays, handover_months, asking_price_thb, asking_price_band, approval_status, submitted_at, submitted_by, decided_at, decision_note, decision_reasons, suggested_listing_name, suggested_headline, published_headline, review_checks")
      .in("approval_status", ["in_review", "changes_requested"]).order("submitted_at", { ascending: true });
    const stIds = [...new Set((hps ?? []).map((h: any) => h.startup_id).filter(Boolean))];
    const { data: sts } = stIds.length
      ? await sb.from("startups").select("id, startup_name, registered_name, registered_number, website_url, email, city, sector, year_founded, last_year_revenue, business_address, contact_number").in("id", stIds)
      : { data: [] };
    const stBy = new Map<string, any>((sts ?? []).map((s: any) => [s.id, s]));
    const { data: founders } = stIds.length
      ? await sb.from("startup_founders").select("startup_id, full_name, role_title, bio, bio_story").in("startup_id", stIds).order("created_at", { ascending: true })
      : { data: [] };
    const founderBy = new Map<string, any>();
    for (const f of founders ?? []) if (!founderBy.has(f.startup_id)) founderBy.set(f.startup_id, f);

    // ---- buyers: buyer_profiles waiting or sent back
    const { data: bps } = await sb.from("buyer_profiles")
      .select("user_id, ref_no, investor_id, approval_status, status, submitted_at, decided_at, decision_note, decision_reasons, suggested_listing_name, suggested_headline, published_listing_name, published_headline, description, geography, sectors, city, country, people, buyer_relation, revenue_band, contact_number, address")
      .in("approval_status", ["in_review", "changes_requested"]).order("submitted_at", { ascending: true });
    const invIds = [...new Set((bps ?? []).map((b: any) => b.investor_id).filter(Boolean))];
    const { data: invs } = invIds.length
      ? await sb.from("investors").select("id, investor_name, investor_type, country, website_url, registration_no, year_founded, email, aum_band, ticket_band, revenue_min_band, investment_focus, preferred_industries, preferred_stages, address_line1, address_line2, address_city_district, address_province_state, postal_code").in("id", invIds)
      : { data: [] };
    const invBy = new Map<string, any>((invs ?? []).map((i: any) => [i.id, i]));
    const verByUser = await (await import("./profile-verification.server")).verificationsByUsers(sb, (bps ?? []).map((b: any) => b.user_id), "id, status, review_checks");

    // ---- advisors: firms waiting or sent back
    const { data: firms } = await sb.from("advisor_firms")
      .select("*").in("advisor_verification", ["pending", "more_info"]).order("verification_requested_at", { ascending: true });

    // ---- people
    const uids = new Set<string>();
    for (const h of hps ?? []) if (h.submitted_by) uids.add(h.submitted_by);
    for (const b of bps ?? []) uids.add(b.user_id);
    for (const f of firms ?? []) if (f.owner_user_id) uids.add(f.owner_user_id);
    const { data: us } = uids.size ? await sb.from("users").select("id, first_name, last_name, email").in("id", [...uids]) : { data: [] };
    const uBy = new Map<string, any>((us ?? []).map((u: any) => [u.id, u]));

    const sellers: OneStepItem[] = [];
    for (const hp of hps ?? []) {
      const st = stBy.get(hp.startup_id);
      const review = await sellerReview(sb, hp, st, founderBy.get(hp.startup_id), (hp.review_checks ?? []) as string[]);
      sellers.push({
        kind: "seller", id: hp.id, ref: hp.ref_no, name: st?.startup_name ?? hp.code_name ?? hp.ref_no,
        type: hp.sector ?? st?.sector ?? null, place: st?.city ?? null,
        person: fullName(uBy.get(hp.submitted_by)), submittedAt: hp.submitted_at,
        sentBackAt: hp.approval_status === "changes_requested" ? hp.decided_at : null,
        chip: hp.approval_status === "changes_requested" ? "sent_back" : "waiting",
        suggestedName: hp.suggested_listing_name, suggestedHeadline: hp.suggested_headline,
        publishedName: hp.code_name, publishedHeadline: hp.published_headline, review,
      });
    }

    const buyers: OneStepItem[] = [];
    for (const p of bps ?? []) {
      const inv = p.investor_id ? invBy.get(p.investor_id) : null;
      const ver = verByUser.get(p.user_id);
      const review = await buyerReview(sb, p, inv, uBy.get(p.user_id), (ver?.review_checks ?? []) as string[]);
      buyers.push({
        kind: "buyer", id: p.user_id, ref: p.ref_no ?? "—", name: inv?.investor_name ?? "Investor profile",
        type: inv?.investor_type ?? null, place: [p.city, inv?.country ?? p.country].filter(Boolean).join(" · ") || null,
        person: fullName(uBy.get(p.user_id)), submittedAt: p.submitted_at,
        sentBackAt: p.approval_status === "changes_requested" ? p.decided_at : null,
        chip: p.approval_status === "changes_requested" ? "sent_back" : "waiting",
        suggestedName: p.suggested_listing_name, suggestedHeadline: p.suggested_headline,
        publishedName: p.published_listing_name, publishedHeadline: p.published_headline, review,
      });
    }

    const advisors: OneStepItem[] = [];
    for (const f of firms ?? []) {
      const review = await advisorReview(sb, f, f.owner_user_id ? uBy.get(f.owner_user_id) : null, (f.review_checklist ?? []) as string[]);
      advisors.push({
        kind: "advisor", id: f.id, ref: f.ref_no, name: f.name,
        type: f.firm_type ?? null, place: [f.city, f.country].filter(Boolean).join(" · ") || null,
        person: fullName(uBy.get(f.owner_user_id)), submittedAt: f.verification_requested_at,
        sentBackAt: f.advisor_verification === "more_info" ? f.more_info_at : null,
        chip: f.advisor_verification === "more_info" ? "sent_back" : "waiting",
        suggestedName: f.suggested_listing_name, suggestedHeadline: f.suggested_headline,
        publishedName: f.published_listing_name, publishedHeadline: f.published_headline, review,
      });
    }

    const { data: history } = await sb.from("approval_events").select("*").order("created_at", { ascending: false }).limit(500);
    return { sellers, buyers, advisors, history: history ?? [], me: context.userId };
  });

/* ================================================================ decide */

const Decide = z.object({
  kind: z.enum(["seller", "buyer", "advisor"]),
  id: z.string().uuid(),
  action: z.enum(["approve", "request_changes", "decline"]),
  publishedName: z.string().trim().max(200).optional(),
  publishedHeadline: z.string().trim().max(300).optional(),
  note: z.string().max(2000).optional(),
  reasons: z.array(z.string().max(120)).max(10).optional(),
});

export const decideOneStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Decide.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const sb = await admin();
    const now = new Date().toISOString();

    if (data.action === "approve") {
      if (!data.publishedName?.trim()) throw new Error("Write a listing name.");
      if (!data.publishedHeadline?.trim()) throw new Error("Write a headline.");
    } else {
      if (!data.reasons?.length) throw new Error("Choose at least one reason.");
    }

    if (data.kind === "buyer") {
      const { data: p } = await sb.from("buyer_profiles").select("*").eq("user_id", data.id).maybeSingle();
      if (!p) throw new Error("Profile not found");
      const { data: u } = await sb.from("users").select("first_name, last_name, email").eq("id", p.user_id).maybeSingle();
      const first = firstName(u);
      if (data.action !== "approve" && data.reasons?.includes("Another reason") && !data.note?.trim())
        throw new Error(`Say what the other reason is, so ${first} knows what to fix.`);
      const ver = p.investor_id
        ? await (await import("./profile-verification.server")).verificationByInvestor(sb, p.investor_id, "id")
        : null;

      if (data.action === "approve") {
        const { error } = await sb.from("buyer_profiles").update({
          approval_status: "approved", status: "live", live_since: p.live_since ?? now,
          decided_at: now, decided_by: context.userId, decision_note: null, decision_reasons: [],
          published_listing_name: data.publishedName!.trim(), published_headline: data.publishedHeadline!.trim(), updated_at: now,
        }).eq("user_id", p.user_id);
        if (error) throw new Error(error.message);
        // The verification moves with the profile, in the same decision.
        if (p.investor_id) {
          await sb.from("investor_profile_verifications").upsert({
            investor_id: p.investor_id, user_id: p.user_id, status: "verified",
            decided_at: now, decision_note: null, decision_reasons: [], updated_at: now,
          }, { onConflict: "investor_id" });
        }
        await sb.from("user_verifications").upsert({ user_id: p.user_id, verified_at: now, verified_by: context.userId });
        await resetApprovalNotice(sb, p.user_id, "buyer_profile", p.user_id, now);
        await logEvent({ item_type: "buyer_profile", item_id: p.user_id, subject_user_id: p.user_id, action: "approve", actor_id: context.userId, note: null, reasons: [],
          ...(await dbdStamp(p.investor_id ? (await sb.from("investors").select("registration_no").eq("id", p.investor_id).maybeSingle()).data?.registration_no : null)) });
        await notify(p.user_id, "Your profile is approved", "Sellers can now find you in Browse investors, and you can sign NDAs.", "/marketplace/my-company");
        const { sendAlert } = await import("./email-alerts.server");
        const { bandText } = await import("@/lib/investor-bands");
        const { data: inv } = p.investor_id ? await sb.from("investors").select("ticket_band").eq("id", p.investor_id).maybeSingle() : { data: null };
        const rewrote = (p.suggested_listing_name ?? "").trim() !== data.publishedName!.trim() || (p.suggested_headline ?? "").trim() !== data.publishedHeadline!.trim();
        await sendAlert({
          alert: "approved", role: "buyer", userIds: [p.user_id],
          vars: { "listing name": data.publishedName!, ref: p.ref_no ?? "", rewrote: rewrote ? " PitchSnack rewrote your listing name and headline." : "" },
          details: [["Listing name", data.publishedName!], ["Headline", data.publishedHeadline!], ["Verified", new Date().toLocaleDateString("en-GB", { timeZone: "Asia/Bangkok" })], ["Ticket size", bandText(inv?.ticket_band) ?? "—"]],
          refKey: `buyer_profile:${p.user_id}:approved:${now}`,
        });
        return { ok: true };
      }

      const status = data.action === "request_changes" ? "changes_requested" : "declined";
      const { error } = await sb.from("buyer_profiles").update({
        approval_status: status, decided_at: now, decided_by: context.userId,
        decision_note: data.note?.trim() || null, decision_reasons: data.reasons ?? [], updated_at: now,
      }).eq("user_id", p.user_id);
      if (error) throw new Error(error.message);
      if (p.investor_id) {
        await sb.from("investor_profile_verifications").upsert({
          investor_id: p.investor_id, user_id: p.user_id,
          status: data.action === "request_changes" ? "more_info" : "declined",
          decided_at: now, decision_note: data.note?.trim() || null, decision_reasons: data.reasons ?? [], updated_at: now,
        }, { onConflict: "investor_id" });
      }
      await resetApprovalNotice(sb, p.user_id, "buyer_profile", p.user_id, now);
      await logEvent({ item_type: "buyer_profile", item_id: p.user_id, subject_user_id: p.user_id, action: data.action, actor_id: context.userId, note: data.note ?? null, reasons: data.reasons ?? [] });
      await notify(p.user_id, data.action === "request_changes" ? "PitchSnack needs a change to your profile" : "Your PitchSnack profile was not approved", data.note ?? (data.reasons ?? []).join(" · "), "/marketplace/my-company");
      const { sendAlert } = await import("./email-alerts.server");
      await sendAlert({
        alert: data.action === "request_changes" ? "changes_requested" : "declined", role: "buyer", userIds: [p.user_id],
        details: [["Reason", (data.reasons ?? []).map((r) => (r === "Another reason" ? "Another reason (see the note)" : r)).join(" · ")]],
        quote: data.note ?? null, refKey: `buyer_profile:${p.user_id}:${data.action}:${now}`,
      });
      return { ok: true };
    }

    if (data.kind === "seller") {
      const { data: hp } = await sb.from("hidden_profiles").select("*").eq("id", data.id).maybeSingle();
      if (!hp) throw new Error("Listing not found");
      const { data: u } = await sb.from("users").select("first_name, last_name, email").eq("id", hp.submitted_by).maybeSingle();
      const first = firstName(u);
      if (data.action !== "approve" && data.reasons?.includes("Another reason") && !data.note?.trim())
        throw new Error(`Say what the other reason is, so ${first} knows what to fix.`);

      if (data.action === "approve") {
        const { data: sub } = await sb.from("listing_submissions").select("snapshot").eq("hidden_profile_id", hp.id).eq("version", hp.version).maybeSingle();
        const cover = hp.pending_cover ?? hp.cover_image_url ?? null;
        const { pickDraft } = await import("@/lib/hidden-profile");
        const pub = { ...pickDraft(hp), code_name: data.publishedName!.trim(), headline: data.publishedHeadline!.trim(), cover_image_url: cover };
        const { error } = await sb.from("hidden_profiles").update({
          approval_status: "live", status: "live", live: pub,
          live_snapshot: sub?.snapshot ? { ...sub.snapshot, public: pub } : null,
          code_name: data.publishedName!.trim(), published_headline: data.publishedHeadline!.trim(),
          cover_image_url: cover, decided_at: now, decision_note: null, decision_reasons: [], decision_fields: [],
          has_unpublished_changes: false, published_at: hp.live && hp.published_at ? hp.published_at : now, published_by: context.userId,
        }).eq("id", hp.id);
        if (error) throw new Error(error.message);
        if (hp.startup_id) {
          // Verify and publish also certifies the company and its owner.
          await sb.from("startups").update({ visibility: "Tenant", registration_verified_at: now }).eq("id", hp.startup_id);
        }
        await resetApprovalNotice(sb, hp.submitted_by, "listing", hp.id, now);
        await logEvent({ item_type: "listing", item_id: hp.id, startup_id: hp.startup_id, subject_user_id: hp.submitted_by, version: hp.version, action: "approve", actor_id: context.userId,
          ...(await dbdStamp(hp.startup_id ? (await sb.from("startups").select("registered_number").eq("id", hp.startup_id).maybeSingle()).data?.registered_number : null)) });
        await notify(hp.submitted_by, "Your listing is approved", "Buyers can now find it in Browse listings, and you can connect with buyers.", "/my-startups");
        const { sendAlert, sellerTeam } = await import("./email-alerts.server");
        await sendAlert({
          alert: "approved", role: "seller", userIds: [hp.submitted_by, ...(await sellerTeam(hp.startup_id))],
          vars: { "listing name": data.publishedName!, ref: hp.ref_no ?? "", "listing code name": data.publishedName! },
          details: [["Listing name", data.publishedName!], ["Headline", data.publishedHeadline!], ["Certified", new Date().toLocaleDateString("en-GB", { timeZone: "Asia/Bangkok" })], ["Asking price", hp.asking_price_band ?? "—"]],
          refKey: `listing:${hp.id}:v${hp.version}:approved`,
        });
        return { ok: true };
      }

      const status = data.action === "request_changes" ? "changes_requested" : "rejected";
      const { error } = await sb.from("hidden_profiles").update({
        approval_status: status, decided_at: now, decision_note: data.note?.trim() || null,
        decision_reasons: data.reasons ?? [], decision_fields: [],
      }).eq("id", hp.id);
      if (error) throw new Error(error.message);
      await resetApprovalNotice(sb, hp.submitted_by, "listing", hp.id, now);
      await logEvent({ item_type: "listing", item_id: hp.id, startup_id: hp.startup_id, subject_user_id: hp.submitted_by, version: hp.version, action: data.action === "decline" ? "reject" : "request_changes", actor_id: context.userId, note: data.note ?? null, reasons: data.reasons ?? [] });
      await notify(hp.submitted_by, data.action === "request_changes" ? "PitchSnack needs a change to your listing" : "Your PitchSnack listing was not approved", data.note ?? (data.reasons ?? []).join(" · "), "/my-startups");
      const { sendAlert, sellerTeam } = await import("./email-alerts.server");
      await sendAlert({
        alert: data.action === "request_changes" ? "changes_requested" : "declined", role: "seller",
        userIds: [hp.submitted_by, ...(await sellerTeam(hp.startup_id))],
        vars: { "listing code name": hp.code_name || hp.ref_no },
        details: [["Reason", (data.reasons ?? []).map((r) => (r === "Another reason" ? "Another reason (see the note)" : r)).join(" · ")]],
        quote: data.note ?? null, refKey: `listing:${hp.id}:v${hp.version}:${data.action}`,
      });
      return { ok: true };
    }

    // ---- advisor
    const { data: f } = await sb.from("advisor_firms").select("*").eq("id", data.id).maybeSingle();
    if (!f) throw new Error("Firm not found");
    const { data: u } = f.owner_user_id ? await sb.from("users").select("first_name, last_name, email").eq("id", f.owner_user_id).maybeSingle() : { data: null };
    const first = firstName(u);
    if (data.action !== "approve" && data.reasons?.includes("Another reason") && !data.note?.trim())
      throw new Error(`Say what the other reason is, so ${first} knows what to fix.`);

    if (data.action === "approve") {
      const { error } = await sb.from("advisor_firms").update({
        advisor_verification: "verified", verification_reason: null, verified_at: now, verified_by: context.userId,
        assigned_admin_id: null, more_info_note: null, more_info_fields: [], review_checklist: [],
        status: "live", live_since: f.live_since ?? now,
        published_listing_name: data.publishedName!.trim(), published_headline: data.publishedHeadline!.trim(),
        updated_at: now,
      }).eq("id", f.id);
      if (error) throw new Error(error.message);
      await resetApprovalNotice(sb, f.owner_user_id, "advisor", f.id, now);
      await logEvent({ item_type: "advisor", item_id: f.id, subject_user_id: f.owner_user_id, action: "approve", actor_id: context.userId, ...(await dbdStamp(f.registration_no)) });
      await notify(f.owner_user_id, "Your profile is approved", "Sellers and buyers can now find you in Browse advisors.", "/marketplace/my-company");
      if (f.owner_user_id) {
        const { sendAlert } = await import("./email-alerts.server");
        await sendAlert({
          alert: "approved", role: "advisor", userIds: [f.owner_user_id],
          vars: { firm: f.name, "listing name": data.publishedName! },
          details: [["Listing name", data.publishedName!], ["Headline", data.publishedHeadline!], ["Verified", new Date().toLocaleDateString("en-GB", { timeZone: "Asia/Bangkok" })]],
          refKey: `advisor:${f.id}:approved:${now}`,
        });
      }
      return { ok: true };
    }

    const patch: Record<string, unknown> = data.action === "request_changes"
      ? { advisor_verification: "more_info", more_info_note: data.note?.trim() || null, more_info_fields: data.reasons ?? [], more_info_at: now, more_info_by: context.userId, updated_at: now }
      : { advisor_verification: "declined", decline_reason: (data.reasons ?? []).join(" · "), decline_note: data.note?.trim() || null, declined_at: now, declined_by: context.userId, verified_at: null, verified_by: null, status: f.status === "live" ? "paused" : f.status, updated_at: now };
    const { error } = await sb.from("advisor_firms").update(patch).eq("id", f.id);
    if (error) throw new Error(error.message);
    await resetApprovalNotice(sb, f.owner_user_id, "advisor", f.id, now);
    await logEvent({ item_type: "advisor", item_id: f.id, subject_user_id: f.owner_user_id, action: data.action, actor_id: context.userId, note: data.note ?? null, reasons: data.reasons ?? [] });
    await notify(f.owner_user_id, data.action === "request_changes" ? "PitchSnack needs a change to your profile" : "Your PitchSnack profile was not approved", data.note ?? (data.reasons ?? []).join(" · "), "/marketplace/my-company");
    if (f.owner_user_id) {
      const { sendAlert } = await import("./email-alerts.server");
      await sendAlert({
        alert: data.action === "request_changes" ? "changes_requested" : "declined", role: "advisor", userIds: [f.owner_user_id],
        vars: { firm: f.name },
        details: [["Reason", (data.reasons ?? []).map((r) => (r === "Another reason" ? "Another reason (see the note)" : r)).join(" · ")]],
        quote: data.note ?? null, refKey: `advisor:${f.id}:${data.action}:${now}`,
      });
    }
    return { ok: true };
  });

/* ================================================================ review checks */

export const markReviewCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ kind: z.enum(["seller", "buyer", "advisor"]), id: z.string().uuid(), row: z.string().max(40) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context as Ctx);
    const sb = await admin();
    if (data.kind === "seller") {
      const { data: hp } = await sb.from("hidden_profiles").select("review_checks").eq("id", data.id).maybeSingle();
      const next = [...new Set([...((hp?.review_checks ?? []) as string[]), data.row])];
      await sb.from("hidden_profiles").update({ review_checks: next }).eq("id", data.id);
    } else if (data.kind === "buyer") {
      const { data: p } = await sb.from("buyer_profiles").select("investor_id").eq("user_id", data.id).maybeSingle();
      if (!p?.investor_id) throw new Error("Profile not found");
      const ver = await (await import("./profile-verification.server")).verificationByInvestor(sb, p.investor_id, "id, review_checks");
      if (!ver) throw new Error("No verification row");
      const next = [...new Set([...((ver.review_checks ?? []) as string[]), data.row])];
      await sb.from("investor_profile_verifications").update({ review_checks: next, updated_at: new Date().toISOString() }).eq("id", ver.id);
    } else {
      const { data: f } = await sb.from("advisor_firms").select("review_checklist").eq("id", data.id).maybeSingle();
      const next = [...new Set([...((f?.review_checklist ?? []) as string[]), data.row])];
      await sb.from("advisor_firms").update({ review_checklist: next }).eq("id", data.id);
    }
    return { ok: true };
  });

export const paidReportsCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: ok } = await (context.supabase as any).rpc("is_control", { _user_id: context.userId });
    if (!ok) return 0;
    const sb = await admin();
    const { count } = await sb.from("report_orders").select("id", { count: "exact", head: true }).in("status", ["paid", "generated"]);
    return count ?? 0;
  });

/* ================================================================ register */

/** Register your company — buyer: profile + verification move together. */
export const registerBuyerCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = await admin();
    const uid = context.userId;
    const { data: p } = await sb.from("buyer_profiles").select("*").eq("user_id", uid).maybeSingle();
    if (!p) throw new Error("Set up your investor profile first");
    if (p.approval_status === "in_review") return { ok: true, already: true };

    const { data: inv } = p.investor_id
      ? await sb.from("investors").select("investor_name, investor_type, ticket_band, preferred_stages, preferred_industries, setup_done_at, website_url, registration_no, linkedin_url, email").eq("id", p.investor_id).maybeSingle()
      : { data: null };

    // The same checks setBuyerListing runs today, plus the listing name, headline and identity check.
    const { showsStages, descriptionLeaks } = await import("@/lib/investor-bands");
    const missing = [
      !inv?.setup_done_at && "finish setup",
      !inv?.investor_name?.trim() && "company name",
      !inv?.ticket_band && "average investment",
      !(p.deal_types ?? []).length && "deal types",
      showsStages(inv?.investor_type) && !(inv?.preferred_stages ?? []).length && "stages",
      !(inv?.preferred_industries ?? []).length && "industries",
      !p.suggested_listing_name?.trim() && "a listing name",
      !p.suggested_headline?.trim() && "a headline",
    ].filter(Boolean);
    if (missing.length) throw new Error(`Add ${missing.join(", ")} before registering.`);
    const leaks = descriptionLeaks([p.suggested_listing_name, p.suggested_headline, p.description].filter(Boolean).join("\n"), inv?.investor_name ?? "", inv?.website_url ?? "");
    if (leaks.length) throw new Error(`Identity check: mentions ${leaks.join(", ")}`);

    const now = new Date().toISOString();
    const { error } = await sb.from("buyer_profiles").update({
      approval_status: "in_review", submitted_at: now, decision_note: null, decision_reasons: [], updated_at: now,
    }).eq("user_id", uid);
    if (error) throw new Error(error.message);

    // The verification row goes with the profile, filled from it — no separate form.
    const { data: u } = await sb.from("users").select("email").eq("id", uid).maybeSingle();
    const domainOf = (v?: string | null) => {
      if (!v) return "";
      const s = v.includes("@") ? v.split("@")[1] : v.replace(/^https?:\/\//, "").split("/")[0];
      return s.toLowerCase().replace(/^www\./, "");
    };
    const workEmail = inv?.email || u?.email || "";
    await sb.from("investor_profile_verifications").upsert({
      investor_id: p.investor_id, user_id: uid,
      company_name: inv?.investor_name ?? "", buyer_type: inv?.investor_type ?? null,
      registration_no: inv?.registration_no ?? null, website: inv?.website_url ?? null,
      linkedin: inv?.linkedin_url ?? null, work_email: workEmail,
      email_domain_match: inv?.website_url && workEmail ? domainOf(workEmail) === domainOf(inv.website_url) : null,
      status: "pending", submitted_at: now, decided_at: null, decision_note: null, decision_reasons: [], updated_at: now,
    }, { onConflict: "investor_id" });

    await logEvent({ item_type: "buyer_profile", item_id: uid, subject_user_id: uid, action: p.approval_status === "draft" || !p.approval_status ? "submit" : "resubmit", actor_id: uid });
    await notify(uid, "Sent for approval", "PitchSnack checks your firm and publishes your profile together, usually within 1 business day.", "/marketplace/my-company");
    return { ok: true };
  });

/** Register your company — advisor: verification request replaces Submit for verification + Publish. */
export const registerAdvisorFirm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ firmId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = await admin();
    const { data: f } = await sb.from("advisor_firms").select("id, owner_user_id, name, setup_done_at, advisor_verification, suggested_listing_name, suggested_headline").eq("id", data.firmId).maybeSingle();
    if (!f) throw new Error("Firm not found");
    if (f.owner_user_id !== context.userId) throw new Error("Not your firm");
    if (f.advisor_verification === "pending") return { ok: true, already: true };
    const missing = [
      !f.setup_done_at && "finish setup",
      !f.suggested_listing_name?.trim() && "a listing name",
      !f.suggested_headline?.trim() && "a headline",
    ].filter(Boolean);
    if (missing.length) throw new Error(`Add ${missing.join(", ")} before registering.`);
    const now = new Date().toISOString();
    const { error } = await sb.from("advisor_firms").update({
      advisor_verification: "pending", verification_reason: f.advisor_verification === "unverified" ? "first_check" : "re_check",
      verification_requested_at: now, decline_reason: null, decline_note: null, declined_at: null, declined_by: null,
      more_info_note: null, more_info_fields: [], updated_at: now,
    }).eq("id", f.id);
    if (error) throw new Error(error.message);
    await logEvent({ item_type: "advisor", item_id: f.id, subject_user_id: f.owner_user_id, action: f.advisor_verification === "unverified" ? "submit" : "resubmit", actor_id: context.userId });
    await notify(f.owner_user_id, "Sent for approval", "PitchSnack checks your firm and your profile, usually within 1 business day.", "/marketplace/my-company");
    return { ok: true };
  });

export { waitingDays };
