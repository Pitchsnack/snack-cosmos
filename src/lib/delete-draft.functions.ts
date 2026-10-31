/**
 * Delete a never-submitted Draft from My Company (seller business, buyer investor
 * profile, advisor firm profile), for its owner and for Control. The server
 * re-checks edit rights, never-submitted state and active deals/NDAs before
 * deleting; child rows (media, founders, financials, team, documents) cascade.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  advisorNdaIsActive,
  advisorNeverSubmitted,
  buyerNeverSubmitted,
  draftDeleteDecision,
  invitationIsActive,
  pipelineIsActive,
  startupNeverSubmitted,
  type DraftDeleteState,
  type DraftKind,
} from "./delete-draft";

const input = z.object({
  kind: z.enum(["startup", "investor", "advisor_firm"]),
  id: z.string().uuid(),
});

type Ctx = { supabase: any; userId: string };

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function isControl(context: Ctx): Promise<boolean> {
  const { data } = await context.supabase.rpc("is_control", { _user_id: context.userId });
  return !!data;
}

type Evaluated = { state: DraftDeleteState; ownerUserId: string | null; name: string | null };

/** Load the profile, verify edit rights and compute the delete state. Throws DRAFT_NOT_FOUND when the caller may not edit it. */
async function evaluate(context: Ctx, kind: DraftKind, id: string): Promise<Evaluated> {
  const sb = await admin();
  const control = await isControl(context);
  const uid = context.userId;

  if (kind === "startup") {
    const { data: s } = await sb.from("startups").select("id, startup_name").eq("id", id).maybeSingle();
    if (!s) throw new Error("DRAFT_NOT_FOUND");
    if (!control) {
      const { myWorkspaceStartupIds } = await import("./workspace-scope.server");
      const mine = await myWorkspaceStartupIds(uid);
      if (!mine.includes(id)) throw new Error("DRAFT_NOT_FOUND");
    }
    const [{ data: hp }, { data: pipes }, { data: invs }, { data: deals }, { data: own }] = await Promise.all([
      sb.from("hidden_profiles").select("approval_status, submitted_at").eq("startup_id", id).maybeSingle(),
      sb.from("deal_pipelines").select("status, ended_at").eq("startup_id", id),
      sb.from("listing_invitations").select("closed_at").eq("startup_id", id),
      sb.from("deals").select("id").eq("startup_id", id).limit(1),
      sb.from("startup_ownership").select("owning_agent_user_id").eq("startup_id", id).limit(1).maybeSingle(),
    ]);
    const active =
      (deals?.length ?? 0) > 0 ||
      (pipes ?? []).some(pipelineIsActive) ||
      (invs ?? []).some(invitationIsActive);
    return {
      state: draftDeleteDecision({ neverSubmitted: startupNeverSubmitted(hp), activeDealsOrNdas: active }),
      ownerUserId: (own?.owning_agent_user_id as string | null) ?? null,
      name: (s.startup_name as string | null) ?? null,
    };
  }

  if (kind === "investor") {
    const { data: inv } = await sb.from("investors").select("id, investor_name").eq("id", id).maybeSingle();
    if (!inv) throw new Error("DRAFT_NOT_FOUND");
    const { data: bp } = await sb
      .from("buyer_profiles")
      .select("user_id, approval_status, submitted_at")
      .eq("investor_id", id)
      .maybeSingle();
    if (!control && bp?.user_id !== uid) throw new Error("DRAFT_NOT_FOUND");
    const [{ data: ver }, { data: invs }, { data: deals }, { data: pipes }] = await Promise.all([
      sb.from("investor_profile_verifications").select("submitted_at").eq("investor_id", id).maybeSingle(),
      sb.from("listing_invitations").select("closed_at").eq("investor_id", id),
      sb.from("deals").select("id").eq("investor_id", id).limit(1),
      bp?.user_id
        ? sb.from("deal_pipelines").select("status, ended_at").eq("buyer_user_id", bp.user_id)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const active =
      (deals?.length ?? 0) > 0 ||
      (invs ?? []).some(invitationIsActive) ||
      (pipes ?? []).some(pipelineIsActive);
    return {
      state: draftDeleteDecision({ neverSubmitted: buyerNeverSubmitted(bp, ver), activeDealsOrNdas: active }),
      ownerUserId: (bp?.user_id as string | null) ?? null,
      name: (inv.investor_name as string | null) ?? null,
    };
  }

  // advisor_firm
  const { data: f } = await sb
    .from("advisor_firms")
    .select("id, name, owner_user_id, status, advisor_verification, verification_requested_at")
    .eq("id", id)
    .maybeSingle();
  if (!f) throw new Error("DRAFT_NOT_FOUND");
  if (!control && f.owner_user_id !== uid) throw new Error("DRAFT_NOT_FOUND");
  const [{ data: invs }, { data: ndas }, { data: da }] = await Promise.all([
    sb.from("advisor_invitations").select("answered_at").eq("firm_profile_id", id),
    sb.from("advisor_ndas").select("signed_at, expires_at").eq("firm_profile_id", id),
    sb.from("deal_advisors").select("id").eq("firm_profile_id", id).limit(1),
  ]);
  const active =
    (da?.length ?? 0) > 0 ||
    (invs ?? []).some((i: any) => !i.answered_at) ||
    (ndas ?? []).some((n: any) => advisorNdaIsActive(n));
  return {
    state: draftDeleteDecision({ neverSubmitted: advisorNeverSubmitted(f), activeDealsOrNdas: active }),
    ownerUserId: (f.owner_user_id as string | null) ?? null,
    name: (f.name as string | null) ?? null,
  };
}

/** Whether the ⋮ menu's Delete draft is red (deletable) or greyed out, and why. */
export const deleteDraftState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data, context }): Promise<DraftDeleteState> => {
    try {
      return (await evaluate(context, data.kind, data.id)).state;
    } catch {
      return { deletable: false, reason: "submitted" };
    }
  });

/** Delete the draft after re-checking every rule. Throws DRAFT_NOT_DELETABLE on any failed check. */
export const deleteDraftProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => input.parse(d))
  .handler(async ({ data, context }) => {
    const { state, ownerUserId, name } = await evaluate(context, data.kind, data.id);
    if (!state.deletable) throw new Error("DRAFT_NOT_DELETABLE");
    const sb = await admin();
    const table = data.kind === "startup" ? "startups" : data.kind === "investor" ? "investors" : "advisor_firms";
    const { error } = await sb.from(table).delete().eq("id", data.id);
    if (error) {
      if (/violates foreign key|23503/i.test(error.message)) throw new Error("DRAFT_NOT_DELETABLE");
      throw new Error(error.message);
    }
    await sb.from("approval_events").insert({
      item_type: data.kind === "startup" ? "startup" : data.kind === "investor" ? "buyer_profile" : "advisor_firm",
      item_id: data.id,
      startup_id: data.kind === "startup" ? data.id : null,
      subject_user_id: ownerUserId,
      action: "delete_draft",
      actor_id: context.userId,
      note: name ? `Deleted draft "${name}"` : "Deleted untitled draft",
    });
    return { ok: true };
  });
