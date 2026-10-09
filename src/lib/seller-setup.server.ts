/**
 * Seller self-service: a seller account owns its businesses through
 * startup_users. Drafts are created with the service client, always for the
 * verified caller, in the default intake workspace with its intake agents.
 */
type SB = any;

export type SellerSeed = {
  name: string; relation: "owner" | "family_owner" | "agent" | null;
  website?: string | null; year?: number | null; size?: string | null;
  regNo?: string | null; city?: string | null; revenue?: string | null; sector?: string | null;
  licences?: unknown[]; iso?: string[]; fromSignup?: string[]; setupDone?: boolean;
};

async function intake(sb: SB, tenantId?: string | null) {
  let q = sb.from("default_intake_settings").select("tenant_id, default_startup_intake_agent_id, default_startup_intake_ai_agent_id");
  if (tenantId) q = q.eq("tenant_id", tenantId);
  const { data } = await q.limit(1).maybeSingle();
  if (!data?.default_startup_intake_agent_id || !data?.default_startup_intake_ai_agent_id) throw new Error("Seller sign-up isn't set up yet. Please contact PitchSnack.");
  return data as { tenant_id: string; default_startup_intake_agent_id: string; default_startup_intake_ai_agent_id: string };
}

/** Gives the account the seller role (STARTUP_USER) in the workspace, once. */
export async function ensureSellerRole(sb: SB, userId: string, tenantId: string) {
  const { data: role } = await sb.from("roles").select("id").eq("role_code", "STARTUP_USER").single();
  const [{ data: ut }, { data: ur }] = await Promise.all([
    sb.from("user_tenants").select("id").eq("user_id", userId).eq("tenant_id", tenantId).maybeSingle(),
    sb.from("user_roles").select("id").eq("user_id", userId).eq("role_id", role.id).eq("tenant_id", tenantId).maybeSingle(),
  ]);
  if (!ut) await sb.from("user_tenants").insert({ user_id: userId, tenant_id: tenantId, is_default: true, workspace_type: "TENANT", created_by: userId });
  if (!ur) await sb.from("user_roles").insert({ user_id: userId, role_id: role.id, tenant_id: tenantId, created_by: userId });
  await sb.from("users").update({ primary_tenant_id: tenantId }).eq("id", userId).is("primary_tenant_id", null);
}

/** The seller's tenant: where it already holds the seller role, else the intake workspace. */
export async function sellerTenant(sb: SB, userId: string): Promise<string | null> {
  const { data } = await sb.from("user_roles").select("tenant_id, roles!inner(role_code)").eq("user_id", userId).eq("roles.role_code", "STARTUP_USER");
  return (data ?? []).find((r: any) => r.tenant_id)?.tenant_id ?? null;
}

export async function createSellerBusiness(sb: SB, userId: string, s: SellerSeed): Promise<string> {
  const { assertCanAddCompany } = await import("./plan-access.server");
  await assertCanAddCompany(userId, "seller");
  const tenantFromRole = await sellerTenant(sb, userId);
  const cfg = await intake(sb, tenantFromRole).catch(() => intake(sb));
  await ensureSellerRole(sb, userId, cfg.tenant_id);
  const now = new Date().toISOString();
  const { data: me } = await sb.from("users").select("email").eq("id", userId).maybeSingle();
  const { data: st, error } = await sb.from("startups").insert({
    tenant_id: cfg.tenant_id, startup_name: s.name, status: "Draft", visibility: "Tenant",
    email: me?.email || null, website_url: s.website || null, year_founded: s.year ?? null, company_size: s.size || null,
    registered_number: s.regNo || null, city: s.city || null, headquarters: "Thailand", last_year_revenue: s.revenue || null,
    sector: s.sector || null, regulatory_licenses: s.licences ?? [], iso_standards: s.iso ?? [],
    setup_from_signup: s.fromSignup ?? [], setup_done_at: s.setupDone ? now : null,
    created_by: userId, updated_by: userId,
  }).select("id").single();
  if (error) throw new Error(error.message);
  const id = st.id as string;
  const undo = async (msg: string) => { await sb.from("startups").delete().eq("id", id); throw new Error(msg); };
  const r1 = await sb.from("startup_ownership").insert({ startup_id: id, tenant_id: cfg.tenant_id, owning_agent_user_id: cfg.default_startup_intake_agent_id, seller_relation: s.relation });
  if (r1.error) await undo(r1.error.message);
  const r2 = await sb.from("startup_ai_ownership").insert({ startup_id: id, tenant_id: cfg.tenant_id, owning_ai_agent_id: cfg.default_startup_intake_ai_agent_id });
  if (r2.error) await undo(r2.error.message);
  const r3 = await sb.from("startup_users").insert({ startup_id: id, tenant_id: cfg.tenant_id, user_id: userId, role: "Founder" });
  if (r3.error) await undo(r3.error.message);
  await sb.from("startup_activity").insert({ startup_id: id, tenant_id: cfg.tenant_id, activity_type: "STARTUP_CREATED", activity_details: { name: s.name, by: "seller" }, created_by: userId });
  return id;
}

const SIZE_FROM_SIGNUP: Record<string, string> = { "1-10": "1-10", "11-50": "11-50", "51-200": "51-200", "201-500": "201-500", "500+": "More than 500" };

/** The Draft business made from a seller's sign-up answers (once). */
export async function ensureSellerDraftFromSignup(sb: SB, userId: string, a: any): Promise<string | null> {
  if (a.profile_id) {
    const { data } = await sb.from("startups").select("id").eq("id", a.profile_id).maybeSingle();
    if (data) return data.id;
  }
  const c = a.company;
  if (!c?.name) return null;
  const fromSignup = ["role", "name", ...(c.website ? ["web"] : []), ...(c.year ? ["year"] : []), ...(c.size ? ["size"] : [])];
  const id = await createSellerBusiness(sb, userId, {
    name: c.name, relation: a.first_answer, website: c.website ? `https://${c.website}` : null,
    year: c.year ? Number(c.year) : null, size: c.size ? SIZE_FROM_SIGNUP[c.size] ?? null : null, fromSignup,
  });
  await sb.from("signup_answers").update({ profile_id: id, updated_at: new Date().toISOString() }).eq("user_id", userId);
  return id;
}

/** Caller may set up this business: a member of it, or a workspace manager. */
export async function assertCanSetup(sb: SB, userClient: SB, userId: string, startupId: string) {
  const { data: m } = await sb.from("startup_users").select("id").eq("startup_id", startupId).eq("user_id", userId).maybeSingle();
  if (m) return;
  const { data: s } = await sb.from("startups").select("tenant_id").eq("id", startupId).maybeSingle();
  if (!s) throw new Error("Business not found");
  const { data: ok } = await userClient.rpc("can_manage_startup", { _user_id: userId, _tenant_id: s.tenant_id });
  if (!ok) throw new Error("This business isn't yours.");
}
