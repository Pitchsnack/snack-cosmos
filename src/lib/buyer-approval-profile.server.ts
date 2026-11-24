/**
 * One-step buyer approval storage. Ordinary buyers use buyer_profiles; Control's
 * extra profiles keep the same fields in investors.wizard.bp. The caller must
 * already have authorized access (or be Admin in the review handlers).
 */
export type BuyerApprovalProfile = {
  p: any;
  investor: any;
  investorId: string;
  extra: boolean;
  /** buyer_profiles.user_id, or the investor id for a Control-only extra. */
  key: string;
  /** The person notified about the review; for an extra, its Control creator. */
  subjectUserId: string;
};

export function adminExtraBuyerProfile(inv: any) {
  if (!inv || (inv.wizard as any)?.admin_profile !== true) return null;
  const bp = ((inv.wizard as any)?.bp ?? {}) as Record<string, unknown>;
  return { status: "draft", ...bp, user_id: inv.created_by, investor_id: inv.id };
}

function extraRecord(inv: any): BuyerApprovalProfile | null {
  const p = adminExtraBuyerProfile(inv);
  if (!p) return null;
  return { p, investor: inv, investorId: inv.id, extra: true, key: inv.id, subjectUserId: inv.created_by };
}

export async function findBuyerApprovalProfile(sb: any, id: string): Promise<BuyerApprovalProfile | null> {
  const { data: p, error } = await sb.from("buyer_profiles").select("*").eq("user_id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (p) {
    const { data: investor, error: investorError } = p.investor_id
      ? await sb.from("investors").select("*").eq("id", p.investor_id).maybeSingle()
      : { data: null, error: null };
    if (investorError) throw new Error(investorError.message);
    return { p, investor, investorId: p.investor_id, extra: false, key: p.user_id, subjectUserId: p.user_id };
  }
  const { data: inv, error: invError } = await sb.from("investors").select("*").eq("id", id).maybeSingle();
  if (invError) throw new Error(invError.message);
  return inv ? extraRecord(inv) : null;
}

/** All Control-only extras, optionally restricted to their current approval states. */
export async function listAdminExtraBuyerApprovals(sb: any, states?: string[]) {
  const { data, error } = await sb.from("investors").select("*").eq("wizard->>admin_profile", "true");
  if (error) throw new Error(error.message);
  return (data ?? []).map((inv: any) => extraRecord(inv)).filter((r: BuyerApprovalProfile | null): r is BuyerApprovalProfile => !!r && (!states || states.includes(r.p.approval_status ?? "draft")));
}

/** Update whichever existing store owns this profile; no row or account is created. */
export async function updateBuyerApprovalProfile(sb: any, profile: Pick<BuyerApprovalProfile, "p" | "investorId" | "extra">, patch: Record<string, unknown>) {
  if (!profile.extra) {
    const { error } = await sb.from("buyer_profiles").update(patch).eq("user_id", profile.p.user_id);
    if (error) throw new Error(error.message);
    return;
  }
  const { data: inv, error: readError } = await sb.from("investors").select("wizard").eq("id", profile.investorId).single();
  if (readError) throw new Error(readError.message);
  const wizard = (inv?.wizard ?? {}) as Record<string, any>;
  const { error } = await sb.from("investors").update({
    wizard: { ...wizard, bp: { ...(wizard.bp ?? {}), ...patch } },
    updated_at: new Date().toISOString(),
  }).eq("id", profile.investorId);
  if (error) throw new Error(error.message);
}
