/**
 * Default Intake — canonical server functions.
 *
 * Every function:
 *  - runs under `requireSupabaseAuth`;
 *  - independently re-derives the caller's active tenant from
 *    `public.workspace_context` and rejects browser-supplied tenant IDs
 *    that don't match;
 *  - enforces application permissions (`default_intake.*`);
 *  - rejects fixture IDs via `assertNoFixtureIds`;
 *  - returns vendor-neutral DTOs.
 *
 * DB safety layers below the server function:
 *  - RLS on `public.default_intake_settings` restricts read to tenant
 *    members and write to CONTROL / TENANT_ADMIN / MASTER_AGENT;
 *  - `tg_validate_default_intake_settings` trigger revalidates active
 *    membership + domain-scoped AI role on every INSERT/UPDATE.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AppRole, Permission } from "@/lib/permissions";
import { ROLE_PERMISSIONS } from "@/lib/permissions";
import { assertNoFixtureIds } from "./guards";
import type {
  DefaultIntakeConfiguration,
  DefaultIntakeSaveResult,
  EligibleDefaultIntakeAgent,
  EligibleDefaultIntakeAgents,
} from "./types";
import { DefaultIntakeError } from "./types";

// ---------------------------------------------------------------------------
// Internal helpers (kept inside the server-fn file per project convention;
// each helper is only called from within a `.handler()` body, so the split
// transformer keeps the runtime references intact).
// ---------------------------------------------------------------------------

type Ctx = {
  supabase: import("@supabase/supabase-js").SupabaseClient;
  userId: string;
};

async function loadRoles(ctx: Ctx): Promise<AppRole[]> {
  const { data } = await ctx.supabase
    .from("user_roles")
    .select("roles!inner(role_code)")
    .eq("user_id", ctx.userId);
  return (data ?? [])
    .map((r) => (r.roles as unknown as { role_code: AppRole } | null)?.role_code)
    .filter((r): r is AppRole => Boolean(r));
}

function permsFromRoles(roles: AppRole[]): Set<Permission> {
  const s = new Set<Permission>();
  for (const r of roles) for (const p of ROLE_PERMISSIONS[r] ?? []) s.add(p);
  return s;
}

async function requirePermission(ctx: Ctx, perm: Permission): Promise<AppRole[]> {
  const roles = await loadRoles(ctx);
  const perms = permsFromRoles(roles);
  if (!perms.has(perm)) {
    throw new DefaultIntakeError("FORBIDDEN", `Missing permission: ${perm}`);
  }
  return roles;
}

async function requireActiveTenant(ctx: Ctx): Promise<{ tenantId: string; tenantName: string | null }> {
  const { data: wc } = await ctx.supabase
    .from("workspace_context")
    .select("active_tenant_id, active_workspace_type")
    .eq("user_id", ctx.userId)
    .maybeSingle();
  const tenantId = wc?.active_tenant_id as string | null | undefined;
  const wsType = wc?.active_workspace_type as string | null | undefined;
  if (!tenantId || wsType === "CONTROL") {
    throw new DefaultIntakeError(
      "ACTIVE_TENANT_REQUIRED",
      "Select a tenant workspace before using Default Intake.",
    );
  }
  const { data: t } = await ctx.supabase
    .from("tenants")
    .select("tenant_name")
    .eq("id", tenantId)
    .maybeSingle();
  return { tenantId, tenantName: (t?.tenant_name as string | null) ?? null };
}

function nameOf(u: { first_name?: string | null; last_name?: string | null; email?: string | null }): string {
  const nm = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
  return nm || (u.email ?? "");
}

async function loadAgentById(
  ctx: Ctx,
  userId: string,
  tenantId: string,
  domain: "startup" | "investor",
  actorType: "human" | "ai",
): Promise<EligibleDefaultIntakeAgent | null> {
  const { data: u } = await ctx.supabase
    .from("users")
    .select("id, email, first_name, last_name, status, user_type")
    .eq("id", userId)
    .maybeSingle();
  if (!u || u.status !== "Active") return null;
  if (actorType === "human" && u.user_type !== "Human") return null;
  if (actorType === "ai" && u.user_type !== "AI") return null;
  const { data: mem } = await ctx.supabase
    .from("user_tenants")
    .select("id")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!mem) return null;
  let roleLabel: string | null = null;
  if (actorType === "ai") {
    const need = domain === "startup" ? "TENANT_STARTUP_AI" : "TENANT_INVESTOR_AI";
    const { data: role } = await ctx.supabase
      .from("user_roles")
      .select("roles!inner(role_code)")
      .eq("user_id", userId)
      .eq("tenant_id", tenantId);
    const codes = (role ?? []).map(
      (r) => (r.roles as unknown as { role_code: string } | null)?.role_code,
    );
    if (!codes.includes(need)) return null;
    roleLabel = need;
  }
  return {
    id: u.id as string,
    name: nameOf(u),
    actorType,
    domain,
    tenantId,
    active: true,
    fixture: false,
    roleLabel,
  };
}

// ---------------------------------------------------------------------------
// Public server functions
// ---------------------------------------------------------------------------

export const getDefaultIntakeSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DefaultIntakeConfiguration | null> => {
    await requirePermission(context, "default_intake.read");
    const { tenantId, tenantName } = await requireActiveTenant(context);

    const { data: row } = await context.supabase
      .from("default_intake_settings")
      .select(
        "default_startup_intake_agent_id, default_startup_intake_ai_agent_id, default_investor_intake_agent_id, default_investor_intake_ai_agent_id, updated_at",
      )
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!row) return null;

    const [sh, sa, ih, ia] = await Promise.all([
      loadAgentById(context, row.default_startup_intake_agent_id as string, tenantId, "startup", "human"),
      loadAgentById(context, row.default_startup_intake_ai_agent_id as string, tenantId, "startup", "ai"),
      loadAgentById(context, row.default_investor_intake_agent_id as string, tenantId, "investor", "human"),
      loadAgentById(context, row.default_investor_intake_ai_agent_id as string, tenantId, "investor", "ai"),
    ]);
    if (!sh || !sa || !ih || !ia) return null;

    return {
      tenantId,
      tenantName,
      startup: { humanAgent: sh, aiAgent: sa },
      investor: { humanAgent: ih, aiAgent: ia },
      fixture: false,
      updatedAt: (row.updated_at as string | null) ?? null,
    };
  });

export const listEligibleDefaultIntakeAgents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EligibleDefaultIntakeAgents> => {
    await requirePermission(context, "default_intake.read");
    const { tenantId } = await requireActiveTenant(context);

    // All Active humans in this tenant.
    const { data: humanRows } = await context.supabase
      .from("user_tenants")
      .select("users!inner(id, email, first_name, last_name, status, user_type)")
      .eq("tenant_id", tenantId);

    const humans: EligibleDefaultIntakeAgent[] = (humanRows ?? [])
      .map((r) => r.users as unknown as {
        id: string; email: string | null; first_name: string | null; last_name: string | null;
        status: string; user_type: string;
      })
      .filter((u) => u.user_type === "Human" && u.status === "Active")
      .map((u) => ({
        id: u.id,
        name: nameOf(u),
        actorType: "human" as const,
        domain: "startup" as const, // human agents are domain-neutral; UI renders both lists
        tenantId,
        active: true,
        fixture: false,
        roleLabel: null,
      }));

    // AIs partitioned by their tenant-scoped role.
    const { data: aiRows } = await context.supabase
      .from("user_roles")
      .select(
        "user_id, roles!inner(role_code), users!inner(id, email, first_name, last_name, status, user_type)",
      )
      .eq("tenant_id", tenantId);

    const startupAis: EligibleDefaultIntakeAgent[] = [];
    const investorAis: EligibleDefaultIntakeAgent[] = [];
    for (const r of aiRows ?? []) {
      const u = r.users as unknown as {
        id: string; email: string | null; first_name: string | null; last_name: string | null;
        status: string; user_type: string;
      };
      const code = (r.roles as unknown as { role_code: string } | null)?.role_code;
      if (!u || u.user_type !== "AI" || u.status !== "Active") continue;
      const a: EligibleDefaultIntakeAgent = {
        id: u.id,
        name: nameOf(u),
        actorType: "ai",
        domain: code === "TENANT_STARTUP_AI" ? "startup" : "investor",
        tenantId,
        active: true,
        fixture: false,
        roleLabel: code ?? null,
      };
      if (code === "TENANT_STARTUP_AI") startupAis.push(a);
      else if (code === "TENANT_INVESTOR_AI") investorAis.push(a);
    }

    // Humans are the same list for both domains (a Human isn't domain-scoped).
    const investorHumans = humans.map((h) => ({ ...h, domain: "investor" as const }));

    return {
      startupHumans: humans,
      startupAis,
      investorHumans,
      investorAis,
    };
  });

export const upsertDefaultIntakeSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        startupHumanId: z.string().uuid(),
        startupAiId: z.string().uuid(),
        investorHumanId: z.string().uuid(),
        investorAiId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<DefaultIntakeSaveResult> => {
    await requirePermission(context, "default_intake.write");
    const { tenantId, tenantName } = await requireActiveTenant(context);

    // Defensive fixture-ID rejection at the server boundary.
    assertNoFixtureIds([
      data.startupHumanId,
      data.startupAiId,
      data.investorHumanId,
      data.investorAiId,
    ]);

    // Re-validate each agent against the caller's active tenant before we
    // even attempt the insert — the DB trigger revalidates again.
    const [sh, sa, ih, ia] = await Promise.all([
      loadAgentById(context, data.startupHumanId, tenantId, "startup", "human"),
      loadAgentById(context, data.startupAiId, tenantId, "startup", "ai"),
      loadAgentById(context, data.investorHumanId, tenantId, "investor", "human"),
      loadAgentById(context, data.investorAiId, tenantId, "investor", "ai"),
    ]);
    if (!sh) throw new DefaultIntakeError("INELIGIBLE_HUMAN_AGENT", "Invalid Startup Intake Agent.");
    if (!sa) throw new DefaultIntakeError("INELIGIBLE_STARTUP_AI_AGENT", "Invalid Startup Intake AI Agent.");
    if (!ih) throw new DefaultIntakeError("INELIGIBLE_HUMAN_AGENT", "Invalid Investor Intake Agent.");
    if (!ia) throw new DefaultIntakeError("INELIGIBLE_INVESTOR_AI_AGENT", "Invalid Investor Intake AI Agent.");

    const { error } = await context.supabase
      .from("default_intake_settings")
      .upsert(
        {
          tenant_id: tenantId,
          default_startup_intake_agent_id: data.startupHumanId,
          default_startup_intake_ai_agent_id: data.startupAiId,
          default_investor_intake_agent_id: data.investorHumanId,
          default_investor_intake_ai_agent_id: data.investorAiId,
          updated_by_user_id: context.userId,
        },
        { onConflict: "tenant_id" },
      );
    if (error) {
      // Map DB trigger errors to typed error codes where recognisable.
      const msg = error.message || "";
      if (/startup_intake_ai_agent/i.test(msg))
        throw new DefaultIntakeError("INELIGIBLE_STARTUP_AI_AGENT", msg);
      if (/investor_intake_ai_agent/i.test(msg))
        throw new DefaultIntakeError("INELIGIBLE_INVESTOR_AI_AGENT", msg);
      if (/agent_id invalid/i.test(msg))
        throw new DefaultIntakeError("INELIGIBLE_HUMAN_AGENT", msg);
      throw new DefaultIntakeError("UNKNOWN", msg);
    }

    await context.supabase.from("audit_logs").insert({
      tenant_id: tenantId,
      entity_type: "default_intake_settings",
      entity_id: tenantId,
      action: "DEFAULT_INTAKE_SETTINGS_UPSERT",
      performed_by: context.userId,
      new_value: {
        startupHumanId: data.startupHumanId,
        startupAiId: data.startupAiId,
        investorHumanId: data.investorHumanId,
        investorAiId: data.investorAiId,
      },
    });

    return { ok: true, tenantId, tenantName };
  });

export const createTenantAiAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        displayName: z.string().trim().min(1).max(120),
        domain: z.enum(["startup", "investor"]),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<EligibleDefaultIntakeAgent> => {
    await requirePermission(context, "default_intake.agent.create");
    const { tenantId } = await requireActiveTenant(context);

    // Load the tenant code so the AI user's namespaced email is deterministic
    // and free of real-user collision.
    const { data: tenant } = await context.supabase
      .from("tenants")
      .select("tenant_code")
      .eq("id", tenantId)
      .maybeSingle();
    const code = ((tenant?.tenant_code as string | undefined) ?? "tenant").toLowerCase();
    const slug = data.displayName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "ai";
    const stamp = Date.now().toString(36);
    const email = `ai.${slug}.${code}.${stamp}@snackportal.ai`;

    const roleCode = data.domain === "startup" ? "TENANT_STARTUP_AI" : "TENANT_INVESTOR_AI";

    // Privileged provisioning below — CALLER ALREADY AUTHORIZED.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: role, error: roleErr } = await supabaseAdmin
      .from("roles")
      .select("id")
      .eq("role_code", roleCode)
      .maybeSingle();
    if (roleErr || !role) throw new DefaultIntakeError("UNKNOWN", "Role lookup failed.");

    const { data: created, error: userErr } = await supabaseAdmin
      .from("users")
      .insert({
        id: crypto.randomUUID(),
        email,
        first_name: data.displayName,
        last_name: null,
        status: "Active",
        user_type: "AI",
      })
      .select("id, email, first_name, last_name")
      .single();
    if (userErr || !created) throw new DefaultIntakeError("UNKNOWN", userErr?.message ?? "AI user insert failed");


    const { error: memErr } = await supabaseAdmin.from("user_tenants").insert({
      user_id: created.id,
      tenant_id: tenantId,
      workspace_type: "TENANT",
      is_default: false,
    });
    if (memErr) throw new DefaultIntakeError("UNKNOWN", memErr.message);

    const { error: rErr } = await supabaseAdmin.from("user_roles").insert({
      user_id: created.id,
      tenant_id: tenantId,
      role_id: role.id,
    });
    if (rErr) throw new DefaultIntakeError("UNKNOWN", rErr.message);

    return {
      id: created.id as string,
      name: nameOf(created as { first_name: string | null; last_name: string | null; email: string }),
      actorType: "ai",
      domain: data.domain,
      tenantId,
      active: true,
      fixture: false,
      roleLabel: roleCode,
    };
  });
