import { CONTACT_ROLES, type AdminContact } from "./admin-contacts";

/** Stable pagination avoids the Data API limit silently hiding older accounts. */
export async function contactRows(sb: any, table: string, columns: string, key = "id") {
  const rows: any[] = [];
  for (let offset = 0; ; offset += 1000) {
    let query = sb.from(table).select(columns).order(key, { ascending: true });
    if (table === "users") query = query.in("account_role", [...CONTACT_ROLES]);
    const { data, error } = await query.range(offset, offset + 999);
    if (error) { console.error("Admin contacts query failed", table, error.code, error.message); throw new Error("Unable to load contacts"); }
    rows.push(...(data ?? []));
    if ((data ?? []).length < 1000) return rows;
  }
}

export async function loadAdminContacts(sb: any): Promise<AdminContact[]> {
  const [users, profiles, buyers, investors, firms, startups, hidden, members, owners] = await Promise.all([
    contactRows(sb, "users", "id,first_name,last_name,email,account_role,status,created_at"),
    contactRows(sb, "user_profiles", "user_id,title,organisation,phone,linkedin,website,city,country", "user_id"),
    contactRows(sb, "buyer_profiles", "user_id,investor_id,legal_name,ref_no,approval_status", "user_id"),
    contactRows(sb, "investors", "id,investor_name,ref_no"),
    contactRows(sb, "advisor_firms", "id,owner_user_id,name,ref_no,status,phone,website,city,country"),
    contactRows(sb, "startups", "id,created_by,startup_name,city,region,website_url"),
    contactRows(sb, "hidden_profiles", "id,startup_id,ref_no,approval_status"),
    contactRows(sb, "startup_users", "id,user_id,startup_id"),
    contactRows(sb, "startup_ownership", "id,owning_agent_user_id,startup_id"),
  ]);
  const ps = new Map(profiles.map(p => [p.user_id, p]));
  const inv = new Map(investors.map(i => [i.id, i]));
  const hp = new Map(hidden.map(h => [h.startup_id, h]));
  return [...new Map(users.map(u => [u.id, u])).values()].filter(u => CONTACT_ROLES.includes(u.account_role)).map(u => {
    const p = ps.get(u.id);
    const myFirms = firms.filter(f => f.owner_user_id === u.id);
    const startupIds = new Set([...members.filter(m => m.user_id === u.id).map(m => m.startup_id), ...owners.filter(o => o.owning_agent_user_id === u.id).map(o => o.startup_id)]);
    const myStartups = startups.filter(s => startupIds.has(s.id) || s.created_by === u.id);
    const organisations: AdminContact["organisations"] = u.account_role === "buyer" ? buyers.filter(b => b.user_id === u.id).map(b => ({
      id: b.investor_id || b.user_id, name: inv.get(b.investor_id)?.investor_name || b.legal_name || p?.organisation || "—",
      ref: inv.get(b.investor_id)?.ref_no || b.ref_no, kind: "buyer", status: b.approval_status || "draft",
    })) : u.account_role === "advisor" ? myFirms.map(f => ({ id: f.id, name: f.name, ref: f.ref_no, kind: "advisor", status: f.status })) : myStartups.map(s => ({
      id: s.id, name: s.startup_name, ref: hp.get(s.id)?.ref_no || null, kind: "seller", status: hp.get(s.id)?.approval_status || "draft",
    }));
    return {
      id: u.id, name: [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email,
      role: u.account_role, title: p?.title || null, email: u.email, status: u.status, joined: u.created_at,
      phone: p?.phone || (u.account_role === "advisor" ? myFirms[0]?.phone : null) || null,
      linkedin: p?.linkedin || null, website: p?.website || (u.account_role === "advisor" ? myFirms[0]?.website : u.account_role === "seller" ? myStartups[0]?.website_url : null) || null,
      location: [p?.city || (u.account_role === "advisor" ? myFirms[0]?.city : u.account_role === "seller" ? myStartups[0]?.city : null), p?.country || (u.account_role === "advisor" ? myFirms[0]?.country : u.account_role === "seller" ? myStartups[0]?.region : null)].filter(Boolean).join(", ") || null,
      organisations: [...new Map(organisations.map(o => [o.id, o])).values()],
    };
  });
}