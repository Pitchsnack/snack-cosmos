import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const DEAL_STAGES = [
  "Prospecting","Introduced","Interested","Meeting","Due Diligence",
  "Negotiation","Term Sheet","Invested","Rejected","Paused","Closed",
] as const;
export const DEAL_VISIBILITIES = ["Private","Tenant Visible","Shared","Archived"] as const;

export type DealStage = (typeof DEAL_STAGES)[number];
export type DealVisibility = (typeof DEAL_VISIBILITIES)[number];

export interface DealRow {
  id: string;
  tenant_id: string;
  deal_name: string;
  startup_id: string;
  investor_id: string;
  stage: DealStage;
  visibility: DealVisibility;
  investment_amount: number | null;
  probability: number | null;
  expected_close_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  source_global_id: string | null;
  imported_at: string | null;
}

export interface DealListItem extends DealRow {
  tenant_name: string | null;
  startup_name: string | null;
  investor_name: string | null;
  owning_agent: { id: string; email: string; name: string | null } | null;
  owning_ai_agent: { id: string; email: string; name: string | null } | null;
}

async function logActivity(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  dealId: string,
  tenantId: string,
  userId: string,
  type: string,
  details: Record<string, unknown> = {},
) {
  await supabase.from("deal_activity").insert({
    deal_id: dealId,
    tenant_id: tenantId,
    activity_type: type,
    activity_details: details,
    created_by: userId,
  });
  await supabase.from("audit_logs").insert({
    tenant_id: tenantId,
    entity_type: "deal",
    entity_id: dealId,
    action: type,
    performed_by: userId,
    new_value: details,
  });
}

export const listDeals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("deals")
      .select(`
        id, tenant_id, deal_name, startup_id, investor_id, stage, visibility,
        investment_amount, probability, expected_close_date, notes,
        created_at, updated_at, source_global_id, imported_at,
        tenants!inner(tenant_name),
        startups!inner(startup_name),
        investors!inner(investor_name),
        deal_ownership(owning_agent_user_id, users:owning_agent_user_id(id,email,first_name,last_name)),
        deal_ai_ownership(owning_ai_agent_id, users:owning_ai_agent_id(id,email,first_name,last_name))
      `)
      .order("updated_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as unknown as Array<
      DealRow & {
        tenants: { tenant_name: string } | null;
        startups: { startup_name: string } | null;
        investors: { investor_name: string } | null;
        deal_ownership: Array<{ users: { id: string; email: string; first_name: string | null; last_name: string | null } | null }>;
        deal_ai_ownership: Array<{ users: { id: string; email: string; first_name: string | null; last_name: string | null } | null }>;
      }
    >;
    return rows.map((r): DealListItem => {
      const own = r.deal_ownership?.[0]?.users ?? null;
      const aiOwn = r.deal_ai_ownership?.[0]?.users ?? null;
      return {
        ...r,
        tenant_name: r.tenants?.tenant_name ?? null,
        startup_name: r.startups?.startup_name ?? null,
        investor_name: r.investors?.investor_name ?? null,
        owning_agent: own ? { id: own.id, email: own.email, name: [own.first_name, own.last_name].filter(Boolean).join(" ") || null } : null,
        owning_ai_agent: aiOwn ? { id: aiOwn.id, email: aiOwn.email, name: [aiOwn.first_name, aiOwn.last_name].filter(Boolean).join(" ") || null } : null,
      };
    });
  });

export const getDeal = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("deals")
      .select(`
        id, tenant_id, deal_name, startup_id, investor_id, stage, visibility,
        investment_amount, probability, expected_close_date, notes,
        created_at, updated_at,
        tenants!inner(tenant_name),
        startups!inner(id, startup_name),
        investors!inner(id, investor_name),
        deal_ownership(owning_agent_user_id, assigned_at, users:owning_agent_user_id(id,email,first_name,last_name)),
        deal_ai_ownership(owning_ai_agent_id, assigned_at, users:owning_ai_agent_id(id,email,first_name,last_name)),
        deal_documents(id, file_name, file_url, document_type, created_at)
      `)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Not found");
    return row;
  });

export const getDealActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ dealId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("deal_activity")
      .select("id, activity_type, activity_details, created_at, created_by")
      .eq("deal_id", data.dealId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getDealAuditLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ dealId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("audit_logs")
      .select("id, action, new_value, old_value, created_at, performed_by")
      .eq("entity_type", "deal")
      .eq("entity_id", data.dealId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const CreateInput = z.object({
  tenantId: z.string().uuid(),
  dealName: z.string().min(1).max(255),
  startupId: z.string().uuid(),
  investorId: z.string().uuid(),
  stage: z.enum(DEAL_STAGES).default("Prospecting"),
  visibility: z.enum(DEAL_VISIBILITIES).default("Tenant Visible"),
  investmentAmount: z.number().nullable().optional(),
  probability: z.number().int().min(0).max(100).nullable().optional(),
  expectedCloseDate: z.string().nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  owningAgentUserId: z.string().uuid(),
  owningAiAgentId: z.string().uuid(),
});

export const createDeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => CreateInput.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: ins, error } = await supabase
      .from("deals")
      .insert({
        tenant_id: data.tenantId,
        deal_name: data.dealName,
        startup_id: data.startupId,
        investor_id: data.investorId,
        stage: data.stage,
        visibility: data.visibility,
        investment_amount: data.investmentAmount ?? null,
        probability: data.probability ?? null,
        expected_close_date: data.expectedCloseDate || null,
        notes: data.notes || null,
        created_by: userId,
        updated_by: userId,
      })
      .select("id, tenant_id")
      .single();
    if (error) throw new Error(error.message);

    const { error: oErr } = await supabase.from("deal_ownership").insert({
      deal_id: ins.id, tenant_id: ins.tenant_id, owning_agent_user_id: data.owningAgentUserId,
    });
    if (oErr) {
      await supabase.from("deals").delete().eq("id", ins.id);
      throw new Error("Owner assignment failed: " + oErr.message);
    }

    const { error: aErr } = await supabase.from("deal_ai_ownership").insert({
      deal_id: ins.id, tenant_id: ins.tenant_id, owning_ai_agent_id: data.owningAiAgentId,
    });
    if (aErr) {
      await supabase.from("deals").delete().eq("id", ins.id);
      throw new Error("AI owner assignment failed: " + aErr.message);
    }

    await logActivity(supabase, ins.id, ins.tenant_id, userId, "DEAL_CREATED", {
      name: data.dealName, stage: data.stage, startup: data.startupId, investor: data.investorId,
      owner: data.owningAgentUserId, ai_owner: data.owningAiAgentId,
    });

    return { id: ins.id };
  });

export const updateDeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      id: z.string().uuid(),
      dealName: z.string().min(1).max(255).optional(),
      stage: z.enum(DEAL_STAGES).optional(),
      visibility: z.enum(DEAL_VISIBILITIES).optional(),
      investmentAmount: z.number().nullable().optional(),
      probability: z.number().int().min(0).max(100).nullable().optional(),
      expectedCloseDate: z.string().nullable().optional(),
      notes: z.string().max(5000).nullable().optional(),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("deals").select("tenant_id, stage, visibility").eq("id", data.id).maybeSingle();
    if (!existing) throw new Error("Not found");

    const patch: Record<string, unknown> = { updated_by: userId };
    if (data.dealName !== undefined) patch.deal_name = data.dealName;
    if (data.stage !== undefined) patch.stage = data.stage;
    if (data.visibility !== undefined) patch.visibility = data.visibility;
    if (data.investmentAmount !== undefined) patch.investment_amount = data.investmentAmount;
    if (data.probability !== undefined) patch.probability = data.probability;
    if (data.expectedCloseDate !== undefined) patch.expected_close_date = data.expectedCloseDate;
    if (data.notes !== undefined) patch.notes = data.notes;

    const { error } = await supabase.from("deals").update(patch as never).eq("id", data.id);
    if (error) throw new Error(error.message);

    if (data.stage && data.stage !== existing.stage) {
      await logActivity(supabase, data.id, existing.tenant_id, userId, "DEAL_STAGE_CHANGED", {
        from: existing.stage, to: data.stage,
      });
    }
    if (data.visibility && data.visibility !== existing.visibility) {
      await logActivity(supabase, data.id, existing.tenant_id, userId, "VISIBILITY_CHANGED", {
        from: existing.visibility, to: data.visibility,
      });
    }
    await logActivity(supabase, data.id, existing.tenant_id, userId, "DEAL_UPDATED", patch);
    return { ok: true };
  });

export const archiveDeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase.from("deals").select("tenant_id").eq("id", data.id).maybeSingle();
    if (!row) throw new Error("Not found");
    const { error } = await supabase
      .from("deals")
      .update({ visibility: "Archived", updated_by: userId })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await logActivity(supabase, data.id, row.tenant_id, userId, "DEAL_ARCHIVED", {});
    return { ok: true };
  });

// Lightweight lookups for the new-deal form
export const listStartupOptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ tenantId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("startups")
      .select("id, startup_name")
      .eq("tenant_id", data.tenantId)
      .order("startup_name", { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listInvestorOptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ tenantId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("investors")
      .select("id, investor_name")
      .eq("tenant_id", data.tenantId)
      .order("investor_name", { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
