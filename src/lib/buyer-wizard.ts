/** Buyer investor-profile setup wizard: question order, visibility by role, progress. */
export type BuyerRelation = "individual" | "corporate" | "agent";
export type QId = "role" | "type" | "loc" | "name" | "web" | "aum" | "ticket" | "rev" | "deals" | "sectors" | "desc" | "review";

export const ALL_STEPS: { id: QId; sec: string }[] = [
  { id: "role", sec: "About you" },
  { id: "type", sec: "About the firm" },
  { id: "loc", sec: "About the firm" },
  { id: "name", sec: "About the firm" },
  { id: "web", sec: "About the firm" },
  { id: "aum", sec: "Fund & ticket" },
  { id: "ticket", sec: "Fund & ticket" },
  { id: "rev", sec: "Buying Requirement" },
  { id: "deals", sec: "Buying Requirement" },
  { id: "sectors", sec: "Buying Requirement" },
  { id: "desc", sec: "Public profile" },
  { id: "review", sec: "Review" },
];

export function stepsFor(rel: BuyerRelation | null) {
  return ALL_STEPS.filter((s) => rel === "corporate" || rel == null || (s.id !== "type" && s.id !== "aum"));
}

/** Banner / checklist progress: answered questions out of N (Review not counted). */
export function wizardProgress(rel: BuyerRelation | null, answered: string[] | undefined) {
  const qs = stepsFor(rel).filter((s) => s.id !== "review");
  const set = new Set(answered ?? []);
  const n = qs.filter((s) => set.has(s.id)).length;
  const first = qs.find((s) => !set.has(s.id))?.id ?? "review";
  return { n, N: qs.length, first };
}

/** Values the skip rules look at. */
export type BuyerSkipVals = { role: BuyerRelation | null; type: string; web: string; year: string; name: string };

/**
 * Questions sign-up fully answered (skipped by Continue, Back and the counts).
 * A field counts only while it still holds a value. The firm name stays in its
 * question with the registration number, except for an individual (no number).
 */
export function buyerSkips(fromSignup: string[] | undefined, v: BuyerSkipVals): Set<QId> {
  const f = new Set(fromSignup ?? []);
  const s = new Set<QId>();
  if (f.has("role") && v.role) s.add("role");
  if (f.has("type") && v.type && v.type !== "Individual Investor") s.add("type");
  if (f.has("web") && v.web.trim()) s.add("web");
  if (v.role === "individual" && f.has("name") && v.name.trim().length >= 2) s.add("name");
  return s;
}

/** Sign-up fields hidden inside a question that still shows. */
export function buyerHiddenFields(fromSignup: string[] | undefined, v: BuyerSkipVals): Set<string> {
  const f = new Set(fromSignup ?? []);
  const h = new Set<string>();
  if (f.has("year") && /^\d{4}$/.test(v.year)) h.add("year");
  return h;
}

export function shownSteps(rel: BuyerRelation | null, skip?: Set<QId>) {
  return stepsFor(rel).filter((s) => !skip?.has(s.id));
}

/** Progress counting only the questions that show. */
export function buyerProgress(rel: BuyerRelation | null, answered: string[] | undefined, skip?: Set<QId>) {
  const qs = shownSteps(rel, skip).filter((s) => s.id !== "review");
  const set = new Set(answered ?? []);
  const n = qs.filter((s) => set.has(s.id)).length;
  const first = qs.find((s) => !set.has(s.id))?.id ?? "review";
  return { n, N: qs.length, first };
}

/** Banner progress straight from the investor record. */
export function buyerProgressFor(rel: BuyerRelation | null, iv: {
  investor_type?: string | null; website_url?: string | null; year_founded?: number | null; investor_name?: string | null;
  wizard?: { answered?: string[]; from_signup?: string[] } | null;
} | null | undefined) {
  const skip = buyerSkips(iv?.wizard?.from_signup, {
    role: rel, type: iv?.investor_type ?? "", web: iv?.website_url ?? "", year: iv?.year_founded ? String(iv.year_founded) : "", name: iv?.investor_name ?? "",
  });
  return buyerProgress(rel, iv?.wizard?.answered, skip);
}
