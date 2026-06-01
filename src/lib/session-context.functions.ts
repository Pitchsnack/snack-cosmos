import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  ROLE_PERMISSIONS,
  type AppRole,
  type Permission,
} from "@/lib/permissions";

export interface SessionContextDTO {
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    status: string;
    userType: string;
  } | null;
  roles: AppRole[];
  tenants: Array<{
    tenantId: string;
    tenantName: string;
    tenantCode: string;
    workspaceType: string;
    isDefault: boolean;
  }>;
  activeWorkspace: {
    tenantId: string | null;
    tenantName: string | null;
    workspaceType: string | null;
    roleCode: AppRole | null;
  };
  permissions: Permission[];
}

export const getSessionContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SessionContextDTO> => {
    const { supabase, userId } = context;

    const [{ data: userRow }, { data: rolesRows }, { data: tenantsRows }, { data: ctxRow }] =
      await Promise.all([
        supabase
          .from("users")
          .select("id,email,first_name,last_name,status,user_type")
          .eq("id", userId)
          .maybeSingle(),
        supabase
          .from("user_roles")
          .select("tenant_id, roles!inner(role_code)")
          .eq("user_id", userId),
        supabase
          .from("user_tenants")
          .select("tenant_id, workspace_type, is_default, tenants!inner(tenant_name, tenant_code)")
          .eq("user_id", userId),
        supabase
          .from("workspace_context")
          .select("active_tenant_id, active_workspace_type, roles(role_code)")
          .eq("user_id", userId)
          .maybeSingle(),
      ]);

    const roles: AppRole[] = (rolesRows ?? [])
      .map((r) => (r.roles as unknown as { role_code: AppRole } | null)?.role_code)
      .filter((r): r is AppRole => Boolean(r));

    const tenants = (tenantsRows ?? []).map((t) => {
      const tnt = t.tenants as unknown as { tenant_name: string; tenant_code: string };
      return {
        tenantId: t.tenant_id as string,
        tenantName: tnt.tenant_name,
        tenantCode: tnt.tenant_code,
        workspaceType: t.workspace_type as string,
        isDefault: Boolean(t.is_default),
      };
    });

    const activeTenantId = ctxRow?.active_tenant_id ?? null;
    const activeTenantName =
      tenants.find((t) => t.tenantId === activeTenantId)?.tenantName ?? null;
    const activeRoleCode =
      (ctxRow?.roles as unknown as { role_code: AppRole } | null)?.role_code ?? null;

    const permissionSet = new Set<Permission>();
    for (const r of roles) {
      for (const p of ROLE_PERMISSIONS[r] ?? []) permissionSet.add(p);
    }

    return {
      user: userRow
        ? {
            id: userRow.id as string,
            email: userRow.email as string,
            firstName: (userRow.first_name as string | null) ?? null,
            lastName: (userRow.last_name as string | null) ?? null,
            status: userRow.status as string,
            userType: userRow.user_type as string,
          }
        : null,
      roles,
      tenants,
      activeWorkspace: {
        tenantId: activeTenantId,
        tenantName: activeTenantName,
        workspaceType: (ctxRow?.active_workspace_type as string | null) ?? null,
        roleCode: activeRoleCode,
      },
      permissions: Array.from(permissionSet),
    };
  });

export const switchWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        tenantId: z.string().uuid().nullable(),
        workspaceType: z
          .enum(["CONTROL", "MASTER_AGENT", "TENANT", "STARTUP", "INVESTOR"])
          .nullable(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;

    if (data.tenantId) {
      const { data: membership } = await supabase
        .from("user_tenants")
        .select("id")
        .eq("user_id", userId)
        .eq("tenant_id", data.tenantId)
        .maybeSingle();

      const { data: control } = await supabase
        .from("user_roles")
        .select("id, roles!inner(role_code)")
        .eq("user_id", userId);
      const isControl = (control ?? []).some(
        (r) =>
          (r.roles as unknown as { role_code: string } | null)?.role_code === "CONTROL",
      );
      if (!membership && !isControl) {
        throw new Error("Forbidden: not a member of this workspace");
      }
    }

    const { error } = await supabase
      .from("workspace_context")
      .upsert(
        {
          user_id: userId,
          active_tenant_id: data.tenantId,
          active_workspace_type: data.workspaceType,
        },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);

    await supabase.from("security_events").insert({
      user_id: userId,
      tenant_id: data.tenantId,
      event_type: "WORKSPACE_SWITCH",
      details: { tenantId: data.tenantId, workspaceType: data.workspaceType },
    });

    return { ok: true };
  });
