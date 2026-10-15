/**
 * Workspace scoping for seller-side lists. The active workspace (workspace_context)
 * narrows every list to businesses in that workspace; the Control platform view
 * (or no active workspace) means no narrowing.
 */
const CONTROL_TENANT_ID = "9df87a29-e8ef-4dbc-9c63-28410d45b985";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

/** The caller's active workspace id, or null for Control / none. */
export async function activeWorkspaceId(userId: string): Promise<string | null> {
  const sb = await admin();
  const { data } = await sb.from("workspace_context").select("active_tenant_id").eq("user_id", userId).maybeSingle();
  const t = (data?.active_tenant_id as string | null) ?? null;
  return t && t !== CONTROL_TENANT_ID ? t : null;
}

/** Keep only startup ids in the caller's active workspace. */
export async function scopeStartupIds(userId: string, ids: string[]): Promise<string[]> {
  if (!ids.length) return ids;
  const tenant = await activeWorkspaceId(userId);
  if (!tenant) return ids;
  const sb = await admin();
  const { data } = await sb.from("startups").select("id").in("id", ids).eq("tenant_id", tenant);
  return (data ?? []).map((r: any) => r.id as string);
}

/** Startups the caller owns or belongs to, narrowed to the active workspace. */
export async function myWorkspaceStartupIds(userId: string): Promise<string[]> {
  const sb = await admin();
  const [{ data: own }, { data: su }] = await Promise.all([
    sb.from("startup_ownership").select("startup_id").eq("owning_agent_user_id", userId),
    sb.from("startup_users").select("startup_id").eq("user_id", userId),
  ]);
  const ids = [...new Set([...(own ?? []), ...(su ?? [])].map((x: any) => x.startup_id as string))];
  return scopeStartupIds(userId, ids);
}
