/** DBD-confirmed identity lock (registration number, company names, year founded). Browser-safe. */
export type IdentityTable = "startups" | "investors" | "advisor_firms";

export const IDENTITY_COLUMNS: Record<IdentityTable, readonly string[]> = {
  startups: ["registered_number", "startup_name", "year_founded", "thai_name", "english_name"],
  investors: ["registration_no", "investor_name", "year_founded", "thai_name", "english_name"],
  advisor_firms: ["registration_no", "name", "year_founded", "thai_name", "english_name"],
};

export const IDENTITY_LOCKED_MESSAGE = "These details are confirmed with the official DBD record, so they're locked. Only PitchSnack Admin can change them.";

const norm = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());

/** A field is locked once the number is DBD-confirmed and the stored value is filled. Admin editing never locks. */
export function isIdentityLocked(lockedAt: string | null | undefined, stored: unknown, adminEdit = false): boolean {
  return !adminEdit && !!lockedAt && norm(stored) !== "";
}

/** Columns in `patch` that would change a locked, filled stored value. */
export function lockedIdentityChanges(table: IdentityTable, stored: Record<string, unknown>, patch: Record<string, unknown>): string[] {
  if (!stored.reg_locked_at) return [];
  return IDENTITY_COLUMNS[table].filter((c) => c in patch && norm(stored[c]) !== "" && norm(stored[c]) !== norm(patch[c]));
}
