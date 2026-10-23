/** Presentation-only pending rules; no request permissions are changed here. */
export function sellerContactPending(rows: Array<{ approval_status?: string | null; live?: unknown }>) {
  return !rows.some((row) => Boolean(row.live)) && rows.some((row) => row.approval_status === "in_review");
}

export function buyerContactPending(status: string | null | undefined, verified: boolean) {
  return status === "pending" && !verified;
}

export function advisorContactPending(row: { advisor_verification?: string | null; verification_reason?: string | null; verified_at?: string | null } | null | undefined) {
  return row?.advisor_verification === "pending" && row.verification_reason === "first_check" && !row.verified_at;
}