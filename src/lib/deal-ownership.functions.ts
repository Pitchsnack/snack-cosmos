import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function logOwnerChange(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  dealId: string,
  tenantId: string,
  userId: string,
  action: string,
  details: Record<string, unknown>,
) {
  await supabase.from("deal_activity").insert({
    deal_id: dealId, tenant_id: tenantId,
    activity_type: action, activity_details: details, created_by: userId,
  });
  await supabase.from("audit_logs").insert({
    tenant_id: tenantId, entity_type: "deal", entity_id: dealId,
    action, performed_by: userId, new_value: details,
  });
}

export const reassignDealOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      dealId: z.string().uuid(),
      owningAgentUserId: z.string().uuid(),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("deal_ownership")
      .select("id, tenant_id, owning_agent_user_id")
      .eq("deal_id", data.dealId)
      .maybeSingle();
    if (!existing) throw new Error("Ownership row missing");
    const { error } = await supabase
      .from("deal_ownership")
      .update({ owning_agent_user_id: data.owningAgentUserId, assigned_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    await logOwnerChange(supabase, data.dealId, existing.tenant_id, userId, "OWNER_REASSIGNED", {
      from: existing.owning_agent_user_id, to: data.owningAgentUserId,
    });
    return { ok: true };
  });

export const reassignDealAiOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      dealId: z.string().uuid(),
      owningAiAgentId: z.string().uuid(),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("deal_ai_ownership")
      .select("id, tenant_id, owning_ai_agent_id")
      .eq("deal_id", data.dealId)
      .maybeSingle();
    if (!existing) throw new Error("AI ownership row missing");
    const { error } = await supabase
      .from("deal_ai_ownership")
      .update({ owning_ai_agent_id: data.owningAiAgentId, assigned_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    await logOwnerChange(supabase, data.dealId, existing.tenant_id, userId, "AI_OWNER_ASSIGNED", {
      from: existing.owning_ai_agent_id, to: data.owningAiAgentId,
    });
    return { ok: true };
  });
