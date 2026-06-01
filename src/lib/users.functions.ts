import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { adminInviteUserByEmail } from "./users.server";

async function requireControlOrTenantAdmin(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  userId: string,
  tenantId: string | null,
) {
  const { data } = await supabase
    .from("user_roles")
    .select("tenant_id, roles!inner(role_code)")
    .eq("user_id", userId);
  const rows = (data ?? []) as Array<{
    tenant_id: string | null;
    roles: { role_code: string } | null;
  }>;
  const isControl = rows.some((r) => r.roles?.role_code === "CONTROL");
  if (isControl) return;
  const isTenantAdmin =
    tenantId &&
    rows.some(
      (r) => r.roles?.role_code === "TENANT_ADMIN" && r.tenant_id === tenantId,
    );
  if (!isTenantAdmin) throw new Error("Forbidden");
}

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ tenantId: z.string().uuid().nullable().optional() }).parse(input ?? {}),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    if (data.tenantId) {
      const { data: rows, error } = await supabase
        .from("user_tenants")
        .select("users!inner(id,email,first_name,last_name,status,user_type,last_login_at,created_at)")
        .eq("tenant_id", data.tenantId);
      if (error) throw new Error(error.message);
      return (rows ?? []).map((r) => r.users);
    }
    const { data: rows, error } = await supabase
      .from("users")
      .select("id,email,first_name,last_name,status,user_type,last_login_at,created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const inviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        email: z.string().email(),
        firstName: z.string().min(1).max(100).optional(),
        lastName: z.string().min(1).max(100).optional(),
        tenantId: z.string().uuid().nullable().optional(),
        roleCode: z
          .enum([
            "CONTROL","MASTER_AGENT","TENANT_ADMIN","TENANT_AGENT",
            "STARTUP_USER","INVESTOR_USER",
          ])
          .optional(),
        redirectTo: z.string().url(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireControlOrTenantAdmin(supabase, userId, data.tenantId ?? null);

    const authUser = await adminInviteUserByEmail(data.email, data.redirectTo, {
      first_name: data.firstName,
      last_name: data.lastName,
      tenant_id: data.tenantId,
      role_code: data.roleCode,
    });
    if (!authUser) throw new Error("Invite failed");

    await supabase
      .from("users")
      .upsert(
        {
          id: authUser.id,
          email: data.email,
          first_name: data.firstName ?? null,
          last_name: data.lastName ?? null,
          status: "Pending",
          user_type: "Human",
          primary_tenant_id: data.tenantId ?? null,
        },
        { onConflict: "id" },
      );

    if (data.tenantId) {
      await supabase.from("user_tenants").upsert(
        { user_id: authUser.id, tenant_id: data.tenantId, workspace_type: "TENANT" },
        { onConflict: "user_id,tenant_id,workspace_type" },
      );
    }

    if (data.roleCode) {
      const { data: role } = await supabase
        .from("roles")
        .select("id")
        .eq("role_code", data.roleCode)
        .single();
      if (role) {
        await supabase
          .from("user_roles")
          .upsert(
            { user_id: authUser.id, role_id: role.id, tenant_id: data.tenantId ?? null },
            { onConflict: "user_id,role_id,tenant_id" },
          );
      }
    }

    await supabase.from("security_events").insert({
      user_id: userId,
      tenant_id: data.tenantId ?? null,
      event_type: "USER_INVITED",
      details: { invited: data.email, role: data.roleCode },
    });

    return { ok: true, userId: authUser.id };
  });

export const updateUserStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        targetUserId: z.string().uuid(),
        status: z.enum(["Pending","Active","Suspended","Locked","Archived","Deleted"]),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireControlOrTenantAdmin(supabase, userId, null);
    const { error } = await supabase
      .from("users")
      .update({ status: data.status })
      .eq("id", data.targetUserId);
    if (error) throw new Error(error.message);
    await supabase.from("security_events").insert({
      user_id: userId,
      event_type: data.status === "Suspended" ? "ACCOUNT_SUSPENDED" : "ROLE_CHANGE",
      details: { targetUserId: data.targetUserId, newStatus: data.status },
    });
    return { ok: true };
  });

export const assignRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        targetUserId: z.string().uuid(),
        roleCode: z.string(),
        tenantId: z.string().uuid().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    await requireControlOrTenantAdmin(supabase, userId, data.tenantId ?? null);
    const { data: role } = await supabase
      .from("roles")
      .select("id")
      .eq("role_code", data.roleCode)
      .single();
    if (!role) throw new Error("Unknown role");
    const { error } = await supabase.from("user_roles").upsert(
      { user_id: data.targetUserId, role_id: role.id, tenant_id: data.tenantId ?? null },
      { onConflict: "user_id,role_id,tenant_id" },
    );
    if (error) throw new Error(error.message);
    await supabase.from("security_events").insert({
      user_id: userId,
      tenant_id: data.tenantId ?? null,
      event_type: "ROLE_CHANGE",
      details: { targetUserId: data.targetUserId, addedRole: data.roleCode },
    });
    return { ok: true };
  });
