import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function logOwnerChange(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  startupId: string,
  tenantId: string,
  userId: string,
  action: string,
  details: Record<string, unknown>,
) {
  await supabase.from("startup_activity").insert({
    startup_id: startupId, tenant_id: tenantId,
    activity_type: action, activity_details: details, created_by: userId,
  });
  await supabase.from("audit_logs").insert({
    tenant_id: tenantId, entity_type: "startup", entity_id: startupId,
    action, performed_by: userId, new_value: details,
  });
}

export const reassignOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      startupId: z.string().uuid(),
      owningAgentUserId: z.string().uuid(),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("startup_ownership")
      .select("id, tenant_id, owning_agent_user_id")
      .eq("startup_id", data.startupId)
      .maybeSingle();
    if (!existing) throw new Error("Ownership row missing");
    const { error } = await supabase
      .from("startup_ownership")
      .update({ owning_agent_user_id: data.owningAgentUserId, assigned_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    await logOwnerChange(supabase, data.startupId, existing.tenant_id, userId, "OWNER_REASSIGNED", {
      from: existing.owning_agent_user_id, to: data.owningAgentUserId,
    });
    return { ok: true };
  });

export const reassignAiOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      startupId: z.string().uuid(),
      owningAiAgentId: z.string().uuid(),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("startup_ai_ownership")
      .select("id, tenant_id, owning_ai_agent_id")
      .eq("startup_id", data.startupId)
      .maybeSingle();
    if (!existing) throw new Error("AI ownership row missing");
    const { error } = await supabase
      .from("startup_ai_ownership")
      .update({ owning_ai_agent_id: data.owningAiAgentId, assigned_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    await logOwnerChange(supabase, data.startupId, existing.tenant_id, userId, "AI_OWNER_ASSIGNED", {
      from: existing.owning_ai_agent_id, to: data.owningAiAgentId,
    });
    return { ok: true };
  });

export const listAssignableUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      tenantId: z.string().uuid(),
      userType: z.enum(["Human", "AI"]),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("user_tenants")
      .select("user_id, users!inner(id,email,first_name,last_name,user_type,status)")
      .eq("tenant_id", data.tenantId);
    if (error) throw new Error(error.message);
    const users = (rows ?? [])
      .map((r) => r.users as unknown as { id: string; email: string; first_name: string | null; last_name: string | null; user_type: string; status: string })
      .filter((u) => u.user_type === data.userType && u.status !== "Deleted" && u.status !== "Archived");
    return users;
  });
