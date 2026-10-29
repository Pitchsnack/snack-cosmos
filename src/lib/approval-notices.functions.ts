import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * One-step approval: the per-user state behind the yellow/red/green banners and
 * the once-only approved pop-up. One row per user per profile/listing; each new
 * Admin decision resets it. Users read their own row (RLS); all writes go
 * through these functions with the service client.
 */

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export type ApprovalRole = "seller" | "buyer" | "advisor";
export type ApprovalState = "draft" | "pending" | "changes_requested" | "declined" | "live" | "paused";

export type ApprovalNotice = {
  itemType: "listing" | "buyer_profile" | "advisor";
  itemId: string;
  role: ApprovalRole;
  ref?: string | null;
  state: ApprovalState;
  submittedAt: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  reasons: string[];
  suggestedName: string | null;
  suggestedHeadline: string | null;
  publishedName: string | null;
  publishedHeadline: string | null;
  adminRewrote: boolean;
  firstName: string;
  popupSeenAt: string | null;
  bannerStep: null | "ok" | "done";
  yellowFolded: boolean;
  redOpen: boolean;
};

const diff = (a: string | null | undefined, b: string | null | undefined) =>
  (a ?? "").trim() !== "" && (b ?? "").trim() !== "" && (a ?? "").trim() !== (b ?? "").trim();

/** The user's most recently relevant approval item, folded into one notice. */
export const getMyApprovalNotice = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ApprovalNotice | null> => {
    const sb = await admin();
    const uid = context.userId;

    // Newest activity wins across the user's listings/profiles.
    const [{ data: bp }, { data: hps }, { data: firms }, { data: me }] = await Promise.all([
      sb.from("buyer_profiles").select("user_id, ref_no, approval_status, status, submitted_at, decided_at, decision_note, decision_reasons, suggested_listing_name, suggested_headline, published_listing_name, published_headline").eq("user_id", uid).maybeSingle(),
      sb.from("hidden_profiles").select("id, ref_no, approval_status, submitted_at, decided_at, decision_note, decision_reasons, suggested_listing_name, suggested_headline, published_headline, code_name, startups!inner(startup_users!inner(user_id))").eq("startups.startup_users.user_id", uid),
      sb.from("advisor_firms").select("id, ref_no, advisor_verification, status, verification_requested_at, more_info_at, more_info_note, more_info_fields, declined_at, decline_note, decline_reason, verified_at, suggested_listing_name, suggested_headline, published_listing_name, published_headline").eq("owner_user_id", uid),
      sb.from("users").select("first_name, email").eq("id", uid).maybeSingle(),
    ]);

    type Cand = Omit<ApprovalNotice, "popupSeenAt" | "bannerStep" | "yellowFolded" | "redOpen" | "firstName"> & { activity: string | null };
    const cands: Cand[] = [];

    if (bp) {
      const state: ApprovalState =
        bp.approval_status === "in_review" ? "pending"
        : bp.approval_status === "changes_requested" ? "changes_requested"
        : bp.approval_status === "declined" ? "declined"
        : bp.approval_status === "approved" ? (bp.status === "paused" ? "paused" : bp.status === "live" ? "live" : "pending")
        : "draft";
      cands.push({
        itemType: "buyer_profile", itemId: uid, role: "buyer", ref: bp.ref_no, state,
        submittedAt: bp.submitted_at, decidedAt: bp.decided_at, decisionNote: bp.decision_note,
        reasons: (bp.decision_reasons ?? []) as string[],
        suggestedName: bp.suggested_listing_name, suggestedHeadline: bp.suggested_headline,
        publishedName: bp.published_listing_name, publishedHeadline: bp.published_headline,
        adminRewrote: diff(bp.suggested_listing_name, bp.published_listing_name) || diff(bp.suggested_headline, bp.published_headline),
        activity: bp.decided_at ?? bp.submitted_at,
      });
    }

    for (const hp of hps ?? []) {
      const state: ApprovalState =
        hp.approval_status === "in_review" ? "pending"
        : hp.approval_status === "changes_requested" ? "changes_requested"
        : hp.approval_status === "rejected" ? "declined"
        : hp.approval_status === "unpublished" ? "paused"
        : hp.approval_status === "live" || hp.approval_status === "live_edits_pending" ? "live"
        : "draft";
      cands.push({
        itemType: "listing", itemId: hp.id, role: "seller", ref: hp.ref_no, state,
        submittedAt: hp.submitted_at, decidedAt: hp.decided_at, decisionNote: hp.decision_note,
        reasons: (hp.decision_reasons ?? []) as string[],
        suggestedName: hp.suggested_listing_name, suggestedHeadline: hp.suggested_headline,
        publishedName: hp.code_name, publishedHeadline: hp.published_headline,
        adminRewrote: diff(hp.suggested_listing_name, hp.code_name) || diff(hp.suggested_headline, hp.published_headline),
        activity: hp.decided_at ?? hp.submitted_at,
      });
    }

    for (const f of firms ?? []) {
      const state: ApprovalState =
        f.advisor_verification === "pending" ? "pending"
        : f.advisor_verification === "more_info" ? "changes_requested"
        : f.advisor_verification === "declined" ? "declined"
        : f.advisor_verification === "verified" ? (f.status === "paused" ? "paused" : f.status === "live" ? "live" : "pending")
        : "draft";
      cands.push({
        itemType: "advisor", itemId: f.id, role: "advisor", ref: f.ref_no, state,
        submittedAt: f.verification_requested_at,
        decidedAt: f.advisor_verification === "more_info" ? f.more_info_at : f.advisor_verification === "declined" ? f.declined_at : f.verified_at,
        decisionNote: f.advisor_verification === "more_info" ? f.more_info_note : f.advisor_verification === "declined" ? f.decline_note : null,
        reasons: f.advisor_verification === "more_info" ? (f.more_info_fields ?? []) : f.advisor_verification === "declined" && f.decline_reason ? [f.decline_reason] : [],
        suggestedName: f.suggested_listing_name, suggestedHeadline: f.suggested_headline,
        publishedName: f.published_listing_name, publishedHeadline: f.published_headline,
        adminRewrote: diff(f.suggested_listing_name, f.published_listing_name) || diff(f.suggested_headline, f.published_headline),
        activity: (f.advisor_verification === "more_info" ? f.more_info_at : f.advisor_verification === "declined" ? f.declined_at : f.verified_at) ?? f.verification_requested_at,
      });
    }

    // Only states with a banner matter; pick the most recent.
    const live = cands.filter((c) => c.state !== "draft" && c.state !== "paused");
    if (!live.length) return null;
    live.sort((a, b) => (b.activity ?? "").localeCompare(a.activity ?? ""));
    const c = live[0];

    const { data: notice } = await sb.from("approval_notices").select("*")
      .eq("user_id", uid).eq("item_type", c.itemType).eq("item_id", c.itemId).maybeSingle();

    // A newer decision/submission resets the fold/open state.
    const fresh = notice && notice.decided_at && c.decidedAt && new Date(c.decidedAt) > new Date(notice.decided_at);
    const freshSubmit = notice && c.state === "pending" && c.submittedAt && notice.updated_at && new Date(c.submittedAt) > new Date(notice.updated_at);

    return {
      ...c,
      firstName: (me?.first_name ?? "").trim() || (me?.email ?? "").split("@")[0] || "there",
      popupSeenAt: fresh ? null : notice?.popup_seen_at ?? null,
      bannerStep: fresh ? null : (notice?.banner_step as ApprovalNotice["bannerStep"]) ?? null,
      yellowFolded: fresh || freshSubmit ? false : notice?.yellow_folded ?? false,
      redOpen: fresh ? false : notice?.red_open ?? false,
    };
  });

const Patch = z.object({
  itemType: z.enum(["listing", "buyer_profile", "advisor"]),
  itemId: z.string().uuid(),
  patch: z.object({
    yellowFolded: z.boolean().optional(),
    redOpen: z.boolean().optional(),
    bannerStep: z.enum(["ok", "done"]).optional(),
    popupSeen: z.boolean().optional(),
  }),
});

export const setApprovalNoticeState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Patch.parse(d))
  .handler(async ({ data, context }) => {
    const sb = await admin();
    const now = new Date().toISOString();
    const row: Record<string, unknown> = {
      user_id: context.userId, item_type: data.itemType, item_id: data.itemId, updated_at: now,
    };
    if (data.patch.yellowFolded !== undefined) row.yellow_folded = data.patch.yellowFolded;
    if (data.patch.redOpen !== undefined) row.red_open = data.patch.redOpen;
    if (data.patch.bannerStep !== undefined) row.banner_step = data.patch.bannerStep;
    if (data.patch.popupSeen) row.popup_seen_at = now;
    const { error } = await sb.from("approval_notices").upsert(row, { onConflict: "user_id,item_type,item_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Called by the decision functions: a new decision resets the user's notice row. */
export async function resetApprovalNotice(sb: any, userId: string | null | undefined, itemType: string, itemId: string, decidedAt: string) {
  if (!userId) return;
  await sb.from("approval_notices").upsert({
    user_id: userId, item_type: itemType, item_id: itemId, decided_at: decidedAt,
    popup_seen_at: null, banner_step: null, yellow_folded: false, red_open: false, updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,item_type,item_id" });
}
