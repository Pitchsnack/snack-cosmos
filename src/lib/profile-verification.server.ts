/**
 * Buyer verification lives per investor profile (investor_profile_verifications).
 * A buyer account's verification = the entry of its linked profile (buyer_profiles.investor_id).
 * Server-only: callers pass a service client after their own access checks.
 */
const T = "investor_profile_verifications";

export async function linkedInvestorIds(sb: any, userIds: string[]) {
  const out = new Map<string, string>();
  if (!userIds.length) return out;
  const { data } = await sb.from("buyer_profiles").select("user_id, investor_id").in("user_id", userIds);
  for (const r of data ?? []) if (r.investor_id) out.set(r.user_id, r.investor_id);
  return out;
}

/** user_id → that account's own profile entry (selected columns + user_id, investor_id). */
export async function verificationsByUsers(sb: any, userIds: string[], cols = "*") {
  const out = new Map<string, any>();
  const links = await linkedInvestorIds(sb, [...new Set(userIds)]);
  const inv = [...links.values()];
  if (!inv.length) return out;
  const sel = cols === "*" ? "*" : `${cols}, user_id, investor_id`;
  const { data } = await sb.from(T).select(sel).in("investor_id", inv);
  const byInv = new Map((data ?? []).map((r: any) => [r.investor_id, r]));
  for (const [u, i] of links) { const r = byInv.get(i); if (r) out.set(u, r); }
  return out;
}

export async function verificationByUser(sb: any, userId: string, cols = "*") {
  return (await verificationsByUsers(sb, [userId], cols)).get(userId) ?? null;
}

export async function verificationByInvestor(sb: any, investorId: string, cols = "*") {
  const { data } = await sb.from(T).select(cols).eq("investor_id", investorId).maybeSingle();
  return data ?? null;
}
