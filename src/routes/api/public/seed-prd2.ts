// TEMP — PRD 2 verification seeding endpoint. Delete after run.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SEED_TOKEN = "prd2-seed-7f3b9a";

async function ensureUser(email: string, password: string, meta: Record<string, unknown>) {
  const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const existing = list?.users.find((u) => u.email === email);
  if (existing) return existing;
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: meta,
  });
  if (error) throw new Error(`createUser ${email}: ${error.message}`);
  return data.user!;
}

export const Route = createFileRoute("/api/public/seed-prd2")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("token") !== SEED_TOKEN) {
          return new Response("forbidden", { status: 403 });
        }

        const log: string[] = [];
        const sb = supabaseAdmin;

        // 1) Two tenants
        const tenantsSpec = [
          { tenant_code: "ACME", tenant_name: "Acme Ventures", status: "Active" },
          { tenant_code: "ZETA", tenant_name: "Zeta Capital", status: "Active" },
        ];
        const tenantIds: Record<string, string> = {};
        for (const t of tenantsSpec) {
          const { data: existing } = await sb
            .from("tenants")
            .select("id")
            .eq("tenant_code", t.tenant_code)
            .maybeSingle();
          if (existing) {
            tenantIds[t.tenant_code] = existing.id as string;
          } else {
            const { data, error } = await sb.from("tenants").insert(t).select("id").single();
            if (error) throw new Error(`tenant ${t.tenant_code}: ${error.message}`);
            tenantIds[t.tenant_code] = data.id as string;
          }
        }
        log.push(`tenants: ${JSON.stringify(tenantIds)}`);

        // 2) Roles map
        const { data: rolesRows } = await sb.from("roles").select("id, role_code");
        const roleId = Object.fromEntries(
          (rolesRows ?? []).map((r) => [r.role_code as string, r.id as string]),
        );

        // 3) Users
        const usersSpec = [
          { email: "master.agent@prd2.test", role: "MASTER_AGENT", tenant: null, type: "Human" },
          { email: "admin.acme@prd2.test", role: "TENANT_ADMIN", tenant: "ACME", type: "Human" },
          { email: "agent.acme@prd2.test", role: "TENANT_AGENT", tenant: "ACME", type: "Human" },
          { email: "agent.zeta@prd2.test", role: "TENANT_AGENT", tenant: "ZETA", type: "Human" },
          { email: "startup.user@prd2.test", role: "STARTUP_USER", tenant: "ACME", type: "Human" },
          { email: "investor.user@prd2.test", role: "INVESTOR_USER", tenant: "ACME", type: "Human" },
          { email: "ai.tenant@prd2.test", role: "TENANT_STARTUP_AI", tenant: "ACME", type: "AI" },
        ];

        const created: Record<string, string> = {};
        for (const u of usersSpec) {
          const authUser = await ensureUser(u.email, "TestPass1!", { seeded: true });
          created[u.email] = authUser.id;

          // public.users (handle_new_auth_user trigger should have made the row, but upsert to set fields)
          await sb.from("users").upsert(
            {
              id: authUser.id,
              email: u.email,
              status: "Active",
              user_type: u.type as "Human" | "AI",
              primary_tenant_id: u.tenant ? tenantIds[u.tenant] : null,
            },
            { onConflict: "id" },
          );

          // user_tenants
          if (u.tenant) {
            await sb.from("user_tenants").upsert(
              {
                user_id: authUser.id,
                tenant_id: tenantIds[u.tenant],
                workspace_type: "TENANT",
                is_default: true,
              },
              { onConflict: "user_id,tenant_id,workspace_type" },
            );
          }

          // user_roles
          await sb.from("user_roles").upsert(
            {
              user_id: authUser.id,
              role_id: roleId[u.role],
              tenant_id: u.tenant ? tenantIds[u.tenant] : null,
            },
            { onConflict: "user_id,role_id,tenant_id" },
          );
        }
        log.push(`users: ${JSON.stringify(created)}`);

        // 4) Master Agent → assigned to BOTH tenants (ACME + ZETA), NOT a 3rd we'll create
        const masterId = created["master.agent@prd2.test"];
        for (const code of ["ACME", "ZETA"]) {
          await sb.from("master_agent_tenants").upsert(
            { master_agent_user_id: masterId, tenant_id: tenantIds[code] },
            { onConflict: "master_agent_user_id,tenant_id" },
          );
        }
        // Create a third tenant the Master Agent is NOT assigned to
        const { data: exNova } = await sb
          .from("tenants")
          .select("id")
          .eq("tenant_code", "NOVA")
          .maybeSingle();
        let novaId: string;
        if (exNova) novaId = exNova.id as string;
        else {
          const { data } = await sb
            .from("tenants")
            .insert({ tenant_code: "NOVA", tenant_name: "Nova Labs", status: "Active" })
            .select("id")
            .single();
          novaId = data!.id as string;
        }
        tenantIds["NOVA"] = novaId;

        return Response.json({ ok: true, tenantIds, users: created, log });
      },
    },
  },
});
