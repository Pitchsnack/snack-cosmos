/**
 * My Startups membership predicate.
 *
 * RULES (PRD §4 / §10):
 *  - `created_by` is audit metadata. It is NEVER used here, not even as a
 *    fallback or tiebreak.
 *  - Membership is derived only from approved ownership relationships that the
 *    existing backend already returns (startup_ownership / startup_ai_ownership).
 *  - Publication status never affects membership: a founder-owned startup stays
 *    in My Startups whether it is private, published, or unpublished.
 *
 * MISSING DEPENDENCY — founder relationship contract:
 *  The list contract does not expose a founder / co-founder / owner
 *  relationship for startup users, and `startup_users.role` is not an approved
 *  founder attribute. We therefore do NOT treat arbitrary startup_users members
 *  as founders and do not infer it. STARTUP_USER principals are already scoped
 *  by backend row-level access to their own startups, so their scoped result set
 *  is used as-is.
 *
 * MISSING DEPENDENCY — startup creation-origin contract:
 *  There is no approved origin/source attribute distinguishing directory-flow
 *  startups from My Startups-flow startups. Origin is NOT inferred from route,
 *  created_by, publication status, or browser state.
 */

export interface OwnershipShaped {
  owning_agent?: { id: string } | null;
  owning_ai_agent?: { id: string } | null;
}

export function isFounderOwned<T extends OwnershipShaped>(
  item: T,
  principalId: string,
): boolean {
  return item.owning_agent?.id === principalId || item.owning_ai_agent?.id === principalId;
}

export function selectMyStartups<T extends OwnershipShaped>(
  items: T[],
  principalId: string | null,
  isScopedStartupUser: boolean,
): T[] {
  if (isScopedStartupUser) return items;
  if (!principalId) return [];
  return items.filter((it) => isFounderOwned(it, principalId));
}
