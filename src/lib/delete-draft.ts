/**
 * Delete-draft rules for My Company (sellers, buyers, advisors; users and Control).
 * Browser-safe pure helpers; the server re-checks everything in delete-draft.functions.ts.
 */

export type DraftKind = "startup" | "investor" | "advisor_firm";

export type DraftDeleteState = {
  deletable: boolean;
  /** Why it can't be deleted: submitted before/under review, or an active NDA/deal. */
  reason: "submitted" | "active" | null;
};

export function draftDeleteDecision(input: { neverSubmitted: boolean; activeDealsOrNdas: boolean }): DraftDeleteState {
  if (!input.neverSubmitted) return { deletable: false, reason: "submitted" };
  if (input.activeDealsOrNdas) return { deletable: false, reason: "active" };
  return { deletable: true, reason: null };
}

/** Seller: a Draft that was never sent to Admin (no hidden profile yet counts as draft). */
export function startupNeverSubmitted(
  hp: { approval_status?: string | null; submitted_at?: string | null } | null,
): boolean {
  if (!hp) return true;
  return (hp.approval_status ?? "draft") === "draft" && !hp.submitted_at;
}

/** Buyer: the account row and the per-investor verification row must both be unsubmitted. */
export function buyerNeverSubmitted(
  bp: { approval_status?: string | null; submitted_at?: string | null } | null,
  ver: { submitted_at?: string | null } | null,
): boolean {
  const bpDraft = !bp || ((bp.approval_status ?? "draft") === "draft" && !bp.submitted_at);
  return bpDraft && !ver?.submitted_at;
}

/** Advisor: draft firm that was never sent for verification. */
export function advisorNeverSubmitted(f: {
  status?: string | null;
  advisor_verification?: string | null;
  verification_requested_at?: string | null;
}): boolean {
  return (
    (f.status ?? "draft") === "draft" &&
    (f.advisor_verification ?? "unverified") === "unverified" &&
    !f.verification_requested_at
  );
}

/** A Pipeline deal is active unless withdrawn/declined/ended/revoked or explicitly ended. */
export function pipelineIsActive(p: { status?: string | null; ended_at?: string | null }): boolean {
  return !["withdrawn", "declined", "ended", "revoked"].includes(p.status ?? "") && !p.ended_at;
}

/** A listing invitation is active until it is closed. */
export function invitationIsActive(i: { closed_at?: string | null }): boolean {
  return !i.closed_at;
}

/** An advisor NDA is active once signed and not expired. */
export function advisorNdaIsActive(n: { signed_at?: string | null; expires_at?: string | null }, now = Date.now()): boolean {
  return !!n.signed_at && (!n.expires_at || Date.parse(n.expires_at) > now);
}
