import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function logOwnerChange(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  investorId: string,
  tenantId: string,
  userId: string,
  action: string,
  details: Record<string, unknown>,
) {
  await supabase.from("investor_activity").insert({
    investor_id: investorId, tenant_id: tenantId,
    activity_type: action, activity_details: details, created_by: userId,
  });
  await supabase.from("audit_logs").insert({
    tenant_id: tenantId, entity_type: "investor", entity_id: investorId,
    action, performed_by: userId, new_value: details,
  });
}

export const reassignInvestorOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      investorId: z.string().uuid(),
      owningAgentUserId: z.string().uuid(),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("investor_ownership")
      .select("id, tenant_id, owning_agent_user_id")
      .eq("investor_id", data.investorId)
      .maybeSingle();
    if (!existing) throw new Error("Ownership row missing");
    const { error } = await supabase
      .from("investor_ownership")
      .update({ owning_agent_user_id: data.owningAgentUserId, assigned_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    await logOwnerChange(supabase, data.investorId, existing.tenant_id, userId, "OWNER_REASSIGNED", {
      from: existing.owning_agent_user_id, to: data.owningAgentUserId,
    });
    return { ok: true };
  });

export const reassignInvestorAiOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      investorId: z.string().uuid(),
      owningAiAgentId: z.string().uuid(),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("investor_ai_ownership")
      .select("id, tenant_id, owning_ai_agent_id")
      .eq("investor_id", data.investorId)
      .maybeSingle();
    if (!existing) throw new Error("AI ownership row missing");
    const { error } = await supabase
      .from("investor_ai_ownership")
      .update({ owning_ai_agent_id: data.owningAiAgentId, assigned_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    await logOwnerChange(supabase, data.investorId, existing.tenant_id, userId, "AI_OWNER_ASSIGNED", {
      from: existing.owning_ai_agent_id, to: data.owningAiAgentId,
    });
    return { ok: true };
  });
