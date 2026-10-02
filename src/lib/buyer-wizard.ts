/** Buyer investor-profile setup wizard: question order, visibility by role, progress. */
export type BuyerRelation = "individual" | "corporate" | "agent";
export type QId = "role" | "type" | "loc" | "name" | "web" | "aum" | "ticket" | "deal" | "rev" | "deals" | "sectors" | "desc" | "review";

export const ALL_STEPS: { id: QId; sec: string }[] = [
  { id: "role", sec: "About you" },
  { id: "type", sec: "About the firm" },
  { id: "loc", sec: "About the firm" },
  { id: "name", sec: "About the firm" },
  { id: "web", sec: "About the firm" },
  { id: "aum", sec: "Fund & ticket" },
  { id: "ticket", sec: "Fund & ticket" },
  { id: "deal", sec: "Fund & ticket" },
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
