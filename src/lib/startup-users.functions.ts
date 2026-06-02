import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function audit(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  startupId: string, tenantId: string, userId: string,
  action: string, details: Record<string, unknown>,
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

export const assignStartupUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      startupId: z.string().uuid(),
      userId: z.string().uuid(),
      role: z.string().min(1).max(100),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: s } = await supabase.from("startups").select("tenant_id").eq("id", data.startupId).maybeSingle();
    if (!s) throw new Error("Startup not found");
    const { error } = await supabase
      .from("startup_users")
      .upsert(
        { startup_id: data.startupId, tenant_id: s.tenant_id, user_id: data.userId, role: data.role },
        { onConflict: "startup_id,user_id" },
      );
    if (error) throw new Error(error.message);
    await audit(supabase, data.startupId, s.tenant_id, userId, "USER_ASSIGNED", {
      target_user_id: data.userId, role: data.role,
    });
    return { ok: true };
  });

export const removeStartupUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      startupId: z.string().uuid(),
      assignmentId: z.string().uuid(),
    }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: s } = await supabase.from("startups").select("tenant_id").eq("id", data.startupId).maybeSingle();
    if (!s) throw new Error("Startup not found");
    const { data: row } = await supabase.from("startup_users").select("user_id, role").eq("id", data.assignmentId).maybeSingle();
    const { error } = await supabase.from("startup_users").delete().eq("id", data.assignmentId);
    if (error) throw new Error(error.message);
    await audit(supabase, data.startupId, s.tenant_id, userId, "USER_REMOVED", {
      target_user_id: row?.user_id, role: row?.role,
    });
    return { ok: true };
  });
