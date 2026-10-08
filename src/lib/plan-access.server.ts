/** Role and plan checks. Every count and decision is made here, on the server. */
export type AccountRole = "seller" | "buyer" | "advisor" | "admin";
export type UsageKind = "contact" | "nda";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export async function roleOf(userId: string): Promise<AccountRole | null> {
  const sb = await admin();
  const { data } = await sb.from("users").select("account_role").eq("id", userId).maybeSingle();
  if (data?.account_role) return data.account_role as AccountRole;
  const { data: ctl } = await sb.rpc("is_control", { _user_id: userId });
  return ctl ? "admin" : null;
}

/** Throws unless the caller has one of these roles (admins always pass). */
export async function requireRole(userId: string, roles: AccountRole[]) {
  const r = await roleOf(userId);
  if (r === "admin" || (r && roles.includes(r))) return r;
  throw new Error("This page isn't available for your account");
}

export async function requireAccountAdmin(userId: string) {
  const sb = await admin();
  const { data } = await sb.rpc("is_account_admin", { _uid: userId });
  if (!data) throw new Error("Admin only");
}

export type PlanAccess = {
  role: AccountRole | null;
  plan: any | null;
  sub: any | null;
  ended: boolean;
  termStart: string | null;
  used: Record<UsageKind, number>;
};

export async function planAccess(userId: string): Promise<PlanAccess> {
  const sb = await admin();
  const role = await roleOf(userId);
  const { data: sub } = await sb.from("subscriptions").select("*, plans(*)").eq("user_id", userId).maybeSingle();
  const plan = sub?.plans ?? null;
  const ended = !!sub && (sub.status === "ended" || (sub.term_end && new Date(sub.term_end) < new Date()));
  const used: Record<UsageKind, number> = { contact: 0, nda: 0 };
  if (sub) {
    const { data: rows } = await sb.from("plan_usage").select("kind").eq("user_id", userId).eq("term_start", sub.term_start).in("kind", ["contact", "nda"]);
    for (const r of rows ?? []) used[r.kind as UsageKind]++;
  }
  return { role, plan, sub, ended: !!ended, termStart: sub?.term_start ?? null, used };
}

/** How many requests are left this term: a number, "unlimited", or null when the plan has none. */
export function requestsLeft(a: PlanAccess, kind: UsageKind): number | "unlimited" | null {
  if (a.role === "admin") return "unlimited";
  const p = a.plan;
  if (!p || a.ended) return null;
  if (p.requests_mode === "unlimited" || p.requests_mode === "contract") return "unlimited";
  if (p.requests_mode === "number") return Math.max(0, (p.requests_n ?? 0) - a.used[kind]);
  if (p.requests_mode === "bundles") return Math.max(0, a.sub?.nda_credits ?? 0);
  return null;
}

/** Throws the toast wording when a request can't be made; records one use otherwise. */
export async function spendRequest(userId: string, kind: UsageKind, ref: string) {
  const a = await planAccess(userId);
  if (a.role === "admin") return;
  if (a.termStart) {
    const { data: again } = await (await admin()).from("plan_usage").select("id").eq("user_id", userId).eq("kind", kind).eq("ref", ref).eq("term_start", a.termStart).maybeSingle();
    if (again) return; // the same request again this term is free
  }
  if (!a.plan) throw new Error("Choose a plan to send requests");
  if (a.ended) throw new Error("Renew to request");
  const left = requestsLeft(a, kind);
  if (left === null) throw new Error(`${upgradeName(a)} plan`);
  if (left !== "unlimited" && left <= 0) throw new Error(a.plan.requests_mode === "bundles" ? "Buy a bundle" : "No requests left");
  const sb = await admin();
  await sb.from("plan_usage").insert({ user_id: userId, kind, ref, term_start: a.termStart });
  if (a.plan.requests_mode === "bundles") await sb.from("subscriptions").update({ nda_credits: Math.max(0, (a.sub.nda_credits ?? 0) - 1) }).eq("user_id", userId);
}

function upgradeName(a: PlanAccess) {
  return a.role === "seller" ? "Professional" : a.role === "buyer" ? "Investor" : "Pro";
}

/** Listing value cap in ฿M for the caller; null = no cap. */
export function valueCap(a: PlanAccess): number | null {
  if (a.role === "admin" || a.role === "seller") return null;
  if (!a.plan) return a.role === "buyer" || a.role === "advisor" ? 0 : null;
  return a.plan.value_cap_thb_m == null ? null : Number(a.plan.value_cap_thb_m);
}
