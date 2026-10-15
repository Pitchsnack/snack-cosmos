import type { HelpProfile, HelpSummary } from "./admin-help.functions";

/** Both checks use the caller's authenticated client before any privileged read. */
export async function requireHelpAdmin(ctx: { supabase: any; userId: string }) {
  const [{ data: control, error }, { data: me }] = await Promise.all([
    ctx.supabase.rpc("is_control", { _user_id: ctx.userId }),
    ctx.supabase.from("users").select("account_role").eq("id", ctx.userId).maybeSingle(),
  ]);
  if (error || !control || me?.account_role !== "admin") throw new Error("Forbidden");
}

export async function helpAdminIds(sb: any): Promise<string[]> {
  const { data, error } = await sb.from("user_roles").select("user_id, roles!inner(role_code)").eq("roles.role_code", "CONTROL");
  if (error) throw new Error(error.message);
  const ids = [...new Set((data ?? []).map((r: any) => r.user_id))] as string[];
  if (!ids.length) return [];
  const { data: users, error: e } = await sb.from("users").select("id").in("id", ids).eq("account_role", "admin");
  if (e) throw new Error(e.message);
  return (users ?? []).map((u: any) => u.id);
}

export async function helpProfile(sb: any, id: string): Promise<HelpProfile | null> {
  const [{ data: u, error }, { data: p }, { data: sub }, { data: buyer }, { data: firms }, { data: memberships }, { data: owned }] = await Promise.all([
    sb.from("users").select("id, first_name, last_name, email, account_role, created_at").eq("id", id).maybeSingle(),
    sb.from("user_profiles").select("organisation, phone").eq("user_id", id).maybeSingle(),
    sb.from("subscriptions").select("status, manager_user_id, plans(name)").eq("user_id", id).maybeSingle(),
    sb.from("buyer_profiles").select("legal_name, approval_status, pof_verified_at").eq("user_id", id).limit(10),
    sb.from("advisor_firms").select("name, status").eq("owner_user_id", id).limit(10),
    sb.from("startup_users").select("startup_id").eq("user_id", id),
    sb.from("startup_ownership").select("startup_id").eq("owning_agent_user_id", id),
  ]);
  if (error) throw new Error(error.message);
  if (!u || !["seller", "buyer", "advisor"].includes(u.account_role)) return null;
  const ids = [...new Set([...(memberships ?? []), ...(owned ?? [])].map((r: any) => r.startup_id))];
  let listings: any[] = [];
  if (u.account_role === "seller") {
    const { data: created, error: e } = await sb.from("startups").select("id, startup_name").eq("created_by", id);
    if (e) throw new Error(e.message);
    const { data: linked, error: e2 } = ids.length ? await sb.from("startups").select("id, startup_name").in("id", ids) : { data: [], error: null };
    if (e2) throw new Error(e2.message);
    listings = [...new Map([...(created ?? []), ...(linked ?? [])].map((s: any) => [s.id, s])).values()];
  }
  let advisor: string | null = null;
  if (sub?.manager_user_id) {
    const { data: a } = await sb.from("users").select("first_name, last_name").eq("id", sub.manager_user_id).maybeSingle();
    advisor = a ? [a.first_name, a.last_name].filter(Boolean).join(" ") || null : null;
  }
  const statuses: HelpProfile["statuses"] = [];
  if (u.account_role === "seller" && listings.length) {
    const { data: hidden, error: e } = await sb.from("hidden_profiles").select("startup_id, approval_status").in("startup_id", listings.map((s) => s.id));
    if (e) throw new Error(e.message);
    const state = Object.fromEntries((hidden ?? []).map((s: any) => [s.startup_id, s.approval_status]));
    for (const s of listings) statuses.push({ label: s.startup_name || "Listing", value: state[s.id] || "Draft" });
  }
  if (u.account_role === "seller" && !listings.length) statuses.push({ label: "Listing", value: "No listing" });
  if (u.account_role === "buyer") statuses.push({ label: "Buyer verification", value: buyer?.[0]?.pof_verified_at ? "Verified" : buyer?.[0]?.approval_status || "Not verified" });
  if (u.account_role === "advisor") for (const f of firms ?? []) statuses.push({ label: f.name || "Firm", value: f.status });
  statuses.push({ label: "Plan", value: sub?.plans?.name ? `${sub.plans.name} · ${sub.status}` : "No plan" });
  return { id, name: [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email, first: u.first_name || u.email, role: u.account_role,
    company: p?.organisation || (u.account_role === "buyer" ? buyer?.[0]?.legal_name : u.account_role === "advisor" ? firms?.[0]?.name : listings[0]?.startup_name) || "—",
    email: u.email, phone: p?.phone || null, joined: u.created_at, statuses, advisor };
}

/** Paginate rather than silently omit older conversations at the Data API row limit. */
export async function helpSummaries(sb: any, meId: string): Promise<HelpSummary[]> {
  const msgs: any[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await sb.from("marketplace_messages").select("thread_key, sender_id, body, files, created_at").like("thread_key", "a:%").order("created_at", { ascending: false }).range(offset, offset + 999);
    if (error) throw new Error(error.message);
    msgs.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  const keys = [...new Set(msgs.filter((m) => m.sender_id === m.thread_key.slice(2)).map((m) => m.thread_key))] as string[];
  const adminIds = await helpAdminIds(sb);
  const { data: reads, error } = adminIds.length ? await sb.from("marketplace_message_reads").select("thread_key, read_at").like("thread_key", "a:%").in("user_id", adminIds) : { data: [], error: null };
  if (error) throw new Error(error.message);
  const readAt: Record<string, string> = {};
  for (const r of reads ?? []) if (!readAt[r.thread_key] || r.read_at > readAt[r.thread_key]) readAt[r.thread_key] = r.read_at;
  const { data: admins } = adminIds.length ? await sb.from("users").select("id, first_name").in("id", adminIds) : { data: [] };
  const names = Object.fromEntries((admins ?? []).map((u: any) => [u.id, u.first_name]));
  const out = await Promise.all(keys.map(async (key): Promise<HelpSummary | null> => {
    const profile = await helpProfile(sb, key.slice(2));
    if (!profile) return null;
    const list = msgs.filter((m) => m.thread_key === key), last = list[0];
    return { key, profile, unread: list.filter((m) => m.sender_id === profile.id && (!readAt[key] || m.created_at > readAt[key])).length,
      last: last ? { body: last.body || last.files?.[0]?.name || "", at: last.created_at, mine: last.sender_id === meId, from: last.sender_id === profile.id ? null : names[last.sender_id] || null } : null };
  }));
  return out.filter((x): x is HelpSummary => x !== null).sort((a, b) => (b.last?.at || "").localeCompare(a.last?.at || ""));
}