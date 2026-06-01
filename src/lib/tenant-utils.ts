import { supabase } from "@/integrations/supabase/client";

/** Slugify a tenant name per PRD 1 §8 rules. */
export function slugifyTenantName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "") // drop symbols
    .replace(/\s+/g, "-")          // spaces -> hyphens
    .replace(/-+/g, "-")           // collapse runs
    .replace(/^-|-$/g, "");        // trim hyphens
}

/**
 * Generate a unique tenant_code by querying existing codes and appending a
 * numeric suffix on collision (abc-ventures, abc-ventures-2, ...).
 */
export async function generateUniqueTenantCode(name: string): Promise<string> {
  const base = slugifyTenantName(name) || "tenant";

  const { data, error } = await supabase
    .from("tenants")
    .select("tenant_code")
    .like("tenant_code", `${base}%`);

  if (error) throw error;

  const taken = new Set((data ?? []).map((r) => r.tenant_code));
  if (!taken.has(base)) return base;

  let i = 2;
  while (taken.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

export type AuditAction = "CREATE" | "UPDATE" | "DELETE";

/** Best-effort audit log write. Failures are logged but don't block the caller. */
export async function logAudit(params: {
  tenantId: string | null;
  entityType: string;
  entityId: string;
  action: AuditAction;
  oldValue?: unknown;
  newValue?: unknown;
}): Promise<void> {
  const { error } = await supabase.from("audit_logs").insert({
    tenant_id: params.tenantId,
    entity_type: params.entityType,
    entity_id: params.entityId,
    action: params.action,
    old_value: (params.oldValue ?? null) as never,
    new_value: (params.newValue ?? null) as never,
  });
  if (error) console.error("[audit] failed to write log", error);
}

export const TENANT_STATUSES = [
  "Draft",
  "Active",
  "Suspended",
  "Archived",
  "Deleted",
] as const;

export type TenantStatus = (typeof TENANT_STATUSES)[number];
