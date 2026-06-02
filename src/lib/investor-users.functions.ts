import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function audit(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  investorId: string, tenantId: string, userId: string,
  action: string, details: Record<string, unknown>,
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

export const assignInvestorUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      investorId: z.string().uuid(),
      userId: z.string().uuid(),
      role: z.string().min(1).max(100),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: i } = await supabase.from("investors").select("tenant_id").eq("id", data.investorId).maybeSingle();
    if (!i) throw new Error("Investor not found");
    const { error } = await supabase
      .from("investor_users")
      .upsert(
        { investor_id: data.investorId, tenant_id: i.tenant_id, user_id: data.userId, role: data.role },
        { onConflict: "investor_id,user_id" },
      );
    if (error) throw new Error(error.message);
    await audit(supabase, data.investorId, i.tenant_id, userId, "USER_ASSIGNED", {
      target_user_id: data.userId, role: data.role,
    });
    return { ok: true };
  });

export const removeInvestorUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      investorId: z.string().uuid(),
      assignmentId: z.string().uuid(),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: i } = await supabase.from("investors").select("tenant_id").eq("id", data.investorId).maybeSingle();
    if (!i) throw new Error("Investor not found");
    const { data: row } = await supabase.from("investor_users").select("user_id, role").eq("id", data.assignmentId).maybeSingle();
    const { error } = await supabase.from("investor_users").delete().eq("id", data.assignmentId);
    if (error) throw new Error(error.message);
    await audit(supabase, data.investorId, i.tenant_id, userId, "USER_REMOVED", {
      target_user_id: row?.user_id, role: row?.role,
    });
    return { ok: true };
  });
