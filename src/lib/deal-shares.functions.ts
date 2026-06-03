import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// PRD 7 — Deal Sharing Engine
// Sharing ≠ Ownership. Sharing ≠ Tenant Transfer. Sharing ≠ Duplication.
// All sharing operates through deal_shares + deal_share_targets only.

export const SHARE_STATUSES = [
  "Draft","Pending","Shared","Viewed","Accepted","Rejected","Withdrawn","Expired",
] as const;
export type ShareStatus = (typeof SHARE_STATUSES)[number];

export interface SharedDealListItem {
  shareId: string;
  dealId: string;
  dealName: string;
  stage: string;
  originTenantId: string;
  originTenantName: string | null;
  startupName: string | null;
  investorName: string | null;
  sharedByUserId: string | null;
  sharedByEmail: string | null;
  sharedByRole: string | null;
  shareReason: string | null;
  shareStatus: ShareStatus;
  createdAt: string;
  // For shares targeted at the current user's workspace, the per-target row.
  targetId: string | null;
  targetTenantId: string | null;
  targetTenantName: string | null;
  targetStatus: string | null;
  // direction relative to caller's accessible tenants
  direction: "incoming" | "outgoing" | "both";
}

async function logShareActivity(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  shareId: string,
  tenantId: string,
  userId: string,
  type: string,
  details: Record<string, unknown> = {},
) {
  await supabase.from("deal_share_activity").insert({
    deal_share_id: shareId,
    tenant_id: tenantId,
    activity_type: type,
    activity_details: details,
    created_by: userId,
  });
  await supabase.from("audit_logs").insert({
    tenant_id: tenantId,
    entity_type: "deal_share",
    entity_id: shareId,
    action: type,
    performed_by: userId,
    new_value: details,
  });
}

// ---------------------------------------------------------------------------
// listSharedDeals — returns every deal_share visible to the caller. RLS does
// the heavy lifting; we just join descriptive columns.
// ---------------------------------------------------------------------------
export const listSharedDeals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Caller's accessible tenants (used only to label direction).
    const { data: myTenants } = await supabase
      .from("user_tenants")
      .select("tenant_id")
      .eq("user_id", userId);
    const myTenantSet = new Set((myTenants ?? []).map((t) => t.tenant_id as string));

    const { data, error } = await supabase
      .from("deal_shares")
      .select(`
        id, tenant_id, deal_id, shared_by_user_id, shared_by_role,
        share_reason, status, created_at,
        tenants:tenant_id(tenant_name),
        deals!inner(id, deal_name, stage,
          startups!inner(startup_name),
          investors!inner(investor_name)
        ),
        users:shared_by_user_id(email),
        deal_share_targets(id, target_tenant_id, status,
          target_tenant:target_tenant_id(tenant_name))
      `)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as unknown as Array<{
      id: string;
      tenant_id: string;
      deal_id: string;
      shared_by_user_id: string | null;
      shared_by_role: string | null;
      share_reason: string | null;
      status: ShareStatus;
      created_at: string;
      tenants: { tenant_name: string } | null;
      deals: { id: string; deal_name: string; stage: string;
        startups: { startup_name: string } | null;
        investors: { investor_name: string } | null;
      };
      users: { email: string } | null;
      deal_share_targets: Array<{
        id: string; target_tenant_id: string; status: string;
        target_tenant: { tenant_name: string } | null;
      }>;
    }>;

    const out: SharedDealListItem[] = [];
    for (const r of rows) {
      const targets = r.deal_share_targets ?? [];
      // Prefer surfacing a row per target the caller is on (incoming view).
      const incomingTargets = targets.filter((t) => myTenantSet.has(t.target_tenant_id));
      const isOrigin = myTenantSet.has(r.tenant_id);

      const baseRow = {
        shareId: r.id,
        dealId: r.deal_id,
        dealName: r.deals.deal_name,
        stage: r.deals.stage,
        originTenantId: r.tenant_id,
        originTenantName: r.tenants?.tenant_name ?? null,
        startupName: r.deals.startups?.startup_name ?? null,
        investorName: r.deals.investors?.investor_name ?? null,
        sharedByUserId: r.shared_by_user_id,
        sharedByEmail: r.users?.email ?? null,
        sharedByRole: r.shared_by_role,
        shareReason: r.share_reason,
        shareStatus: r.status,
        createdAt: r.created_at,
      };

      if (incomingTargets.length > 0) {
        for (const t of incomingTargets) {
          out.push({
            ...baseRow,
            targetId: t.id,
            targetTenantId: t.target_tenant_id,
            targetTenantName: t.target_tenant?.tenant_name ?? null,
            targetStatus: t.status,
            direction: isOrigin ? "both" : "incoming",
          });
        }
      } else {
        // Outgoing summary (origin perspective) — collapse targets into a label.
        const t0 = targets[0];
        out.push({
          ...baseRow,
          targetId: t0?.id ?? null,
          targetTenantId: t0?.target_tenant_id ?? null,
          targetTenantName: targets.length === 1
            ? (t0?.target_tenant?.tenant_name ?? null)
            : `${targets.length} tenant${targets.length === 1 ? "" : "s"}`,
          targetStatus: t0?.status ?? null,
          direction: "outgoing",
        });
      }
    }
    return out;
  });

// ---------------------------------------------------------------------------
// getSharedDeal — read-only detail for a single share (joins all the bits a
// receiving tenant is allowed to see).
// ---------------------------------------------------------------------------
export const getSharedDeal = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ shareId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("deal_shares")
      .select(`
        id, tenant_id, deal_id, shared_by_user_id, shared_by_role,
        share_reason, status, created_at, updated_at,
        tenants:tenant_id(tenant_name),
        users:shared_by_user_id(email, first_name, last_name),
        deals!inner(
          id, tenant_id, deal_name, stage, visibility,
          investment_amount, probability, expected_close_date, notes,
          startups!inner(id, startup_name, country, industry, short_description),
          investors!inner(id, investor_name, country, investor_type, short_description)
        ),
        deal_share_targets(id, target_tenant_id, status, target_tenant:target_tenant_id(tenant_name))
      `)
      .eq("id", data.shareId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Shared deal not found");

    // Best-effort: mark this view as Viewed for the current user's target row.
    const targets = (row as unknown as { deal_share_targets: Array<{ id: string; target_tenant_id: string; status: string }> }).deal_share_targets ?? [];
    const { data: myTenants } = await supabase
      .from("user_tenants").select("tenant_id").eq("user_id", userId);
    const myTenantSet = new Set((myTenants ?? []).map((t) => t.tenant_id as string));
    const mine = targets.find((t) => myTenantSet.has(t.target_tenant_id));
    if (mine && mine.status === "Pending") {
      await supabase.from("deal_share_targets").update({ status: "Viewed" }).eq("id", mine.id);
      await logShareActivity(supabase, data.shareId,
        (row as unknown as { tenant_id: string }).tenant_id, userId, "SHARE_VIEWED",
        { target_id: mine.id });
    }

    return row;
  });

// ---------------------------------------------------------------------------
// createShare — creates a deal_share + N deal_share_targets in one call.
// Authorization is enforced by RLS (insert policies + manage helper).
// ---------------------------------------------------------------------------
export const createShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      dealId: z.string().uuid(),
      targetTenantIds: z.array(z.string().uuid()).min(1).max(50),
      shareReason: z.string().max(2000).optional(),
      sharedByRole: z.string().max(100).optional(),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    // Look up origin deal tenant.
    const { data: deal, error: dErr } = await supabase
      .from("deals").select("id, tenant_id").eq("id", data.dealId).maybeSingle();
    if (dErr) throw new Error(dErr.message);
    if (!deal) throw new Error("Deal not found or you don't have access");

    // Reject self-sharing onto origin tenant (no-op + confusing).
    const targets = Array.from(new Set(data.targetTenantIds)).filter((t) => t !== deal.tenant_id);
    if (targets.length === 0) throw new Error("Pick at least one tenant other than the origin tenant");

    const { data: ins, error } = await supabase
      .from("deal_shares")
      .insert({
        tenant_id: deal.tenant_id,
        deal_id: deal.id,
        shared_by_user_id: userId,
        shared_by_role: data.sharedByRole ?? null,
        share_reason: data.shareReason ?? null,
        status: "Shared",
      })
      .select("id, tenant_id")
      .single();
    if (error) throw new Error(error.message);

    const rows = targets.map((t) => ({
      deal_share_id: ins.id,
      tenant_id: deal.tenant_id,
      target_tenant_id: t,
      status: "Pending",
    }));
    const { error: tErr } = await supabase.from("deal_share_targets").insert(rows);
    if (tErr) {
      await supabase.from("deal_shares").delete().eq("id", ins.id);
      throw new Error("Failed to create share targets: " + tErr.message);
    }

    await logShareActivity(supabase, ins.id, ins.tenant_id, userId, "DEAL_SHARED", {
      deal_id: deal.id, targets,
    });
    return { id: ins.id };
  });

// ---------------------------------------------------------------------------
// respondToShare — recipient sets Accepted or Rejected on their target row.
// ---------------------------------------------------------------------------
export const respondToShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      targetId: z.string().uuid(),
      response: z.enum(["Accepted", "Rejected"]),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: target, error } = await supabase
      .from("deal_share_targets")
      .select("id, deal_share_id, target_tenant_id, status, deal_shares:deal_share_id(tenant_id)")
      .eq("id", data.targetId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!target) throw new Error("Share target not found");

    const { error: uErr } = await supabase
      .from("deal_share_targets")
      .update({ status: data.response })
      .eq("id", data.targetId);
    if (uErr) throw new Error(uErr.message);

    const originTenant = (target.deal_shares as unknown as { tenant_id: string } | null)?.tenant_id;
    if (originTenant) {
      await logShareActivity(supabase, target.deal_share_id, originTenant, userId,
        data.response === "Accepted" ? "SHARE_ACCEPTED" : "SHARE_REJECTED",
        { target_id: target.id });
    }
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// withdrawShare — origin manager withdraws their entire share.
// ---------------------------------------------------------------------------
export const withdrawShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ shareId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("deal_shares").select("tenant_id").eq("id", data.shareId).maybeSingle();
    if (!row) throw new Error("Share not found");
    const { error } = await supabase
      .from("deal_shares")
      .update({ status: "Withdrawn" })
      .eq("id", data.shareId);
    if (error) throw new Error(error.message);
    await logShareActivity(supabase, data.shareId, row.tenant_id, userId, "SHARE_WITHDRAWN", {});
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// listShareActivity — audit/activity feed for a share.
// ---------------------------------------------------------------------------
export const listShareActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ shareId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("deal_share_activity")
      .select("id, activity_type, activity_details, created_at, created_by")
      .eq("deal_share_id", data.shareId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ---------------------------------------------------------------------------
// listEligibleShareTenants — for the share dialog, return tenants the caller
// is allowed to share TO. Trivially: all tenants the caller can see except
// the origin tenant. RLS already constrains the result set.
// ---------------------------------------------------------------------------
export const listEligibleShareTenants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ dealId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: deal } = await supabase
      .from("deals").select("tenant_id").eq("id", data.dealId).maybeSingle();
    if (!deal) throw new Error("Deal not found");

    const { data: rows, error } = await supabase
      .from("tenants")
      .select("id, tenant_name, tenant_code")
      .neq("id", deal.tenant_id)
      .order("tenant_name", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
