import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface AssignableTenantDTO {
  id: string;
  tenantName: string;
  tenantCode: string;
}

export const listAssignableTenants = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AssignableTenantDTO[]> => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("tenants")
      .select("id,tenant_name,tenant_code")
      .order("tenant_name");
    if (error) throw new Error(error.message);
    return (data ?? []).map((t) => ({
      id: t.id as string,
      tenantName: t.tenant_name as string,
      tenantCode: t.tenant_code as string,
    }));
  });
