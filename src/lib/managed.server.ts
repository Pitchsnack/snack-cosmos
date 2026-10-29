/**
 * "Managed by PitchSnack": a company in the Control tenant that only Admin
 * accounts own. Worked out live from ownership, so a handover to a seller,
 * buyer or advisor account turns it off by itself. Only the boolean ever
 * leaves the server.
 */
type Sb = any;

let controlId: string | null | undefined;
export async function controlTenantId(sb: Sb): Promise<string | null> {
  if (controlId !== undefined) return controlId;
  const { data } = await sb.from("tenants").select("id").ilike("tenant_code", "control").maybeSingle();
  controlId = (data?.id as string | undefined) ?? null;
  return controlId;
}

/** Of these users, the ones on an Admin account. */
export async function adminUserIds(sb: Sb, userIds: (string | null | undefined)[]): Promise<Set<string>> {
  const ids = [...new Set(userIds.filter(Boolean) as string[])];
  if (!ids.length) return new Set();
  const { data } = await sb.from("users").select("id, account_role").in("id", ids);
  return new Set((data ?? []).filter((u: any) => u.account_role === "admin").map((u: any) => u.id as string));
}

/** Businesses (startup ids) managed by PitchSnack: only Admin accounts own them, in any workspace. */
export async function managedStartupIds(sb: Sb, startupIds: string[]): Promise<Set<string>> {
  const ids = [...new Set(startupIds)];
  if (!ids.length) return new Set();
  const { data: sts } = await sb.from("startups").select("id, created_by").in("id", ids);
  if (!sts?.length) return new Set();
  const inCtl = sts.map((s: any) => s.id as string);
  const [{ data: su }, { data: own }] = await Promise.all([
    sb.from("startup_users").select("startup_id, user_id").in("startup_id", inCtl),
    sb.from("startup_ownership").select("startup_id, owning_agent_user_id").in("startup_id", inCtl),
  ]);
  const people = new Map<string, string[]>();
  const add = (k: string, u: string | null) => { if (u) people.set(k, [...(people.get(k) ?? []), u]); };
  for (const s of sts) add(s.id, s.created_by);
  for (const r of su ?? []) add(r.startup_id, r.user_id);
  for (const r of own ?? []) add(r.startup_id, r.owning_agent_user_id);
  const admins = await adminUserIds(sb, [...people.values()].flat());
  const out = new Set<string>();
  for (const s of sts) {
    const members = [...(su ?? []), ...(own ?? []).map((o: any) => ({ startup_id: o.startup_id, user_id: o.owning_agent_user_id }))]
      .filter((m: any) => m.startup_id === s.id).map((m: any) => m.user_id as string);
    const all = [...(s.created_by ? [s.created_by] : []), ...members];
    // Every owner is an Admin user, and at least one exists.
    if (all.length && all.every((u) => admins.has(u)) && members.every((u) => admins.has(u))) out.add(s.id);
  }
  return out;
}

/** Investor profiles (investor ids) managed by PitchSnack. */
export async function managedInvestorIds(sb: Sb, investorIds: string[]): Promise<Set<string>> {
  const ids = [...new Set(investorIds)];
  const ctl = await controlTenantId(sb);
  if (!ids.length || !ctl) return new Set();
  const [{ data: invs }, { data: bps }] = await Promise.all([
    sb.from("investors").select("id").in("id", ids).eq("tenant_id", ctl),
    sb.from("buyer_profiles").select("investor_id, user_id").in("investor_id", ids),
  ]);
  const inCtl = new Set((invs ?? []).map((i: any) => i.id as string));
  const admins = await adminUserIds(sb, (bps ?? []).map((b: any) => b.user_id));
  return new Set((bps ?? []).filter((b: any) => inCtl.has(b.investor_id) && admins.has(b.user_id)).map((b: any) => b.investor_id as string));
}

/** Firm profiles managed by PitchSnack: owned by an Admin account. */
export async function managedFirmIds(sb: Sb, firms: { id: string; owner_user_id?: string | null }[]): Promise<Set<string>> {
  const admins = await adminUserIds(sb, firms.map((f) => f.owner_user_id));
  return new Set(firms.filter((f) => f.owner_user_id && admins.has(f.owner_user_id)).map((f) => f.id));
}
