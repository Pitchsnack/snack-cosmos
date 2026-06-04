import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const STATUSES = ["Prospect","Active","Engaged","Investing","Inactive","Archived"] as const;
const VISIBILITIES = ["Private","Tenant","Shared","Archived"] as const;

export type InvestorStatus = (typeof STATUSES)[number];
export type InvestorVisibility = (typeof VISIBILITIES)[number];

export interface InvestorRow {
  id: string;
  tenant_id: string;
  investor_name: string;
  legal_name: string | null;
  website_url: string | null;
  country: string | null;
  investor_type: string | null;
  aum: string | null;
  ticket_size: string | null;
  short_description: string | null;
  long_description: string | null;
  status: InvestorStatus;
  visibility: InvestorVisibility;
  created_at: string;
  updated_at: string;
}

export interface InvestorListItem extends InvestorRow {
  tenant_name: string | null;
  owning_agent: { id: string; email: string; name: string | null } | null;
  owning_ai_agent: { id: string; email: string; name: string | null } | null;
}

async function logActivity(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  investorId: string,
  tenantId: string,
  userId: string,
  type: string,
  details: Record<string, unknown> = {},
) {
  await supabase.from("investor_activity").insert({
    investor_id: investorId,
    tenant_id: tenantId,
    activity_type: type,
    activity_details: details,
    created_by: userId,
  });
  await supabase.from("audit_logs").insert({
    tenant_id: tenantId,
    entity_type: "investor",
    entity_id: investorId,
    action: type,
    performed_by: userId,
    new_value: details,
  });
}

export const listInvestors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("investors")
      .select(`
        id, tenant_id, investor_name, legal_name, website_url, country, investor_type,
        aum, ticket_size, short_description, long_description, status, visibility,
        created_at, updated_at,
        tenants!inner(tenant_name),
        investor_ownership(owning_agent_user_id, users:owning_agent_user_id(id,email,first_name,last_name)),
        investor_ai_ownership(owning_ai_agent_id, users:owning_ai_agent_id(id,email,first_name,last_name))
      `)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as unknown as Array<
      InvestorRow & {
        tenants: { tenant_name: string } | null;
        investor_ownership: Array<{
          owning_agent_user_id: string;
          users: { id: string; email: string; first_name: string | null; last_name: string | null } | null;
        }>;
        investor_ai_ownership: Array<{
          owning_ai_agent_id: string;
          users: { id: string; email: string; first_name: string | null; last_name: string | null } | null;
        }>;
      }
    >;
    return rows.map((r): InvestorListItem => {
      const own = r.investor_ownership?.[0]?.users ?? null;
      const aiOwn = r.investor_ai_ownership?.[0]?.users ?? null;
      return {
        ...r,
        tenant_name: r.tenants?.tenant_name ?? null,
        owning_agent: own ? { id: own.id, email: own.email, name: [own.first_name, own.last_name].filter(Boolean).join(" ") || null } : null,
        owning_ai_agent: aiOwn ? { id: aiOwn.id, email: aiOwn.email, name: [aiOwn.first_name, aiOwn.last_name].filter(Boolean).join(" ") || null } : null,
      };
    });
  });

export const getInvestor = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("investors")
      .select(`
        id, tenant_id, investor_name, legal_name, website_url, country, investor_type,
        aum, ticket_size, short_description, long_description, status, visibility,
        created_at, updated_at,
        tenants!inner(tenant_name),
        investor_ownership(owning_agent_user_id, assigned_at, users:owning_agent_user_id(id,email,first_name,last_name)),
        investor_ai_ownership(owning_ai_agent_id, assigned_at, users:owning_ai_agent_id(id,email,first_name,last_name)),
        investor_users(id, user_id, role, created_at, users:user_id(id,email,first_name,last_name))
      `)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Not found");
    return row;
  });

export const getInvestorActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ investorId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("investor_activity")
      .select("id, activity_type, activity_details, created_at, created_by, users:created_by(email)")
      .eq("investor_id", data.investorId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getInvestorAuditLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ investorId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("audit_logs")
      .select("id, action, new_value, old_value, created_at, performed_by")
      .eq("entity_type", "investor")
      .eq("entity_id", data.investorId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const CreateInput = z.object({
  tenantId: z.string().uuid(),
  investorName: z.string().min(1).max(255),
  legalName: z.string().max(255).optional().nullable(),
  websiteUrl: z.string().url().max(2048).optional().nullable().or(z.literal("")),
  country: z.string().max(100).optional().nullable(),
  investorType: z.string().max(100).optional().nullable(),
  aum: z.string().max(255).optional().nullable(),
  ticketSize: z.string().max(255).optional().nullable(),
  shortDescription: z.string().max(500).optional().nullable(),
  longDescription: z.string().max(5000).optional().nullable(),
  status: z.enum(STATUSES).default("Prospect"),
  visibility: z.enum(VISIBILITIES).default("Tenant"),
  owningAgentUserId: z.string().uuid(),
  owningAiAgentId: z.string().uuid(),
});

export const createInvestor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => CreateInput.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: ins, error } = await supabase
      .from("investors")
      .insert({
        tenant_id: data.tenantId,
        investor_name: data.investorName,
        legal_name: data.legalName || null,
        website_url: data.websiteUrl || null,
        country: data.country || null,
        investor_type: data.investorType || null,
        aum: data.aum || null,
        ticket_size: data.ticketSize || null,
        short_description: data.shortDescription || null,
        long_description: data.longDescription || null,
        status: data.status,
        visibility: data.visibility,
        created_by: userId,
        updated_by: userId,
      })
      .select("id, tenant_id")
      .single();
    if (error) throw new Error(error.message);

    const { error: oErr } = await supabase.from("investor_ownership").insert({
      investor_id: ins.id,
      tenant_id: ins.tenant_id,
      owning_agent_user_id: data.owningAgentUserId,
    });
    if (oErr) {
      await supabase.from("investors").delete().eq("id", ins.id);
      throw new Error("Owner assignment failed: " + oErr.message);
    }

    const { error: aErr } = await supabase.from("investor_ai_ownership").insert({
      investor_id: ins.id,
      tenant_id: ins.tenant_id,
      owning_ai_agent_id: data.owningAiAgentId,
    });
    if (aErr) {
      await supabase.from("investors").delete().eq("id", ins.id);
      throw new Error("AI owner assignment failed: " + aErr.message);
    }

    await logActivity(supabase, ins.id, ins.tenant_id, userId, "INVESTOR_CREATED", {
      name: data.investorName, owner: data.owningAgentUserId, ai_owner: data.owningAiAgentId,
    });

    return { id: ins.id };
  });

export const updateInvestor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      id: z.string().uuid(),
      investorName: z.string().min(1).max(255).optional(),
      legalName: z.string().max(255).nullable().optional(),
      websiteUrl: z.string().max(2048).nullable().optional(),
      country: z.string().max(100).nullable().optional(),
      investorType: z.string().max(100).nullable().optional(),
      aum: z.string().max(255).nullable().optional(),
      ticketSize: z.string().max(255).nullable().optional(),
      shortDescription: z.string().max(500).nullable().optional(),
      longDescription: z.string().max(5000).nullable().optional(),
      status: z.enum(STATUSES).optional(),
      visibility: z.enum(VISIBILITIES).optional(),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("investors").select("tenant_id, status, visibility").eq("id", data.id).maybeSingle();
    if (!existing) throw new Error("Not found");

    const patch: Record<string, unknown> = { updated_by: userId };
    if (data.investorName !== undefined) patch.investor_name = data.investorName;
    if (data.legalName !== undefined) patch.legal_name = data.legalName;
    if (data.websiteUrl !== undefined) patch.website_url = data.websiteUrl;
    if (data.country !== undefined) patch.country = data.country;
    if (data.investorType !== undefined) patch.investor_type = data.investorType;
    if (data.aum !== undefined) patch.aum = data.aum;
    if (data.ticketSize !== undefined) patch.ticket_size = data.ticketSize;
    if (data.shortDescription !== undefined) patch.short_description = data.shortDescription;
    if (data.longDescription !== undefined) patch.long_description = data.longDescription;
    if (data.status !== undefined) patch.status = data.status;
    if (data.visibility !== undefined) patch.visibility = data.visibility;

    const { error } = await supabase.from("investors").update(patch as never).eq("id", data.id);
    if (error) throw new Error(error.message);

    if (data.status && data.status !== existing.status) {
      await logActivity(supabase, data.id, existing.tenant_id, userId, "STATUS_CHANGED", {
        from: existing.status, to: data.status,
      });
    }
    if (data.visibility && data.visibility !== existing.visibility) {
      await logActivity(supabase, data.id, existing.tenant_id, userId, "VISIBILITY_CHANGED", {
        from: existing.visibility, to: data.visibility,
      });
    }
    await logActivity(supabase, data.id, existing.tenant_id, userId, "INVESTOR_UPDATED", patch);
    return { ok: true };
  });

export const archiveInvestor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase.from("investors").select("tenant_id").eq("id", data.id).maybeSingle();
    if (!row) throw new Error("Not found");
    const { error } = await supabase
      .from("investors")
      .update({ status: "Archived", visibility: "Archived", updated_by: userId })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await logActivity(supabase, data.id, row.tenant_id, userId, "STATUS_CHANGED", { to: "Archived" });
    return { ok: true };
  });
