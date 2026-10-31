import { setupAnswered } from "./setup-step-state";
import { isValidUrl } from "./seller-wizard";
import { descriptionError, descriptionLeaks, regError, yearError, showsStages } from "./investor-bands";
/** Buyer investor-profile setup wizard: question order, visibility by role, progress. */
export type BuyerRelation = "individual" | "corporate" | "agent";
export type QId = "role" | "type" | "name" | "web" | "aum" | "ticket" | "rev" | "deals" | "sectors" | "photos" | "desc" | "review";

export const ALL_STEPS: { id: QId; sec: string }[] = [
  { id: "role", sec: "About you" },
  { id: "type", sec: "About the firm" },
  { id: "name", sec: "About the firm" },
  { id: "web", sec: "About the firm" },
  { id: "aum", sec: "Fund & ticket" },
  { id: "ticket", sec: "Fund & ticket" },
  { id: "rev", sec: "Buying Requirement" },
  { id: "deals", sec: "Buying Requirement" },
  { id: "sectors", sec: "Buying Requirement" },
  { id: "photos", sec: "Firm images" },
  { id: "desc", sec: "Public profile" },
  { id: "review", sec: "Review" },
];

export function stepsFor(rel: BuyerRelation | null) {
  // Question 2 (type) asks a Corporate Enterprise one type and a representative one or more; AUM is corporate only.
  // Logo and photos: firm buyers only (never an Individual Investor).
  return ALL_STEPS.filter((s) => (s.id === "type" ? rel !== "individual" : s.id === "aum" ? rel === "corporate" || rel == null : s.id === "photos" ? rel !== "individual" : true));
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
export type BuyerSkipVals = { role: BuyerRelation | null; type: string; web: string; year: string; name: string; actsFor?: string[]; sectors?: string[] };

/**
 * Questions sign-up fully answered (skipped by Continue, Back and the counts).
 * A field counts only while it still holds a value. The firm name stays in its
 * question with the registration number, except for an individual (no number).
 */
export function buyerSkips(fromSignup: string[] | undefined, v: BuyerSkipVals): Set<QId> {
  const f = new Set(fromSignup ?? []);
  const s = new Set<QId>();
  if (f.has("role") && v.role) s.add("role");
  if (f.has("type") && (v.role === "agent" ? (v.actsFor ?? []).length > 0 : !!v.type && v.type !== "Individual Investor")) s.add("type");
  if (f.has("web") && v.web.trim()) s.add("web");
  if (f.has("sectors") && (v.sectors ?? []).length > 0) s.add("sectors");
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

/** Saved checks shared by wizard resume and My Company progress. */
export function buyerProgressFor(rel: BuyerRelation | null, iv: {
  investor_type?: string | null; acts_for_types?: string[] | null; website_url?: string | null; year_founded?: number | null; investor_name?: string | null; preferred_industries?: string[] | null;
  country?: string | null; address_line1?: string | null; address_city_district?: string | null; address_province_state?: string | null; postal_code?: string | null; registration_no?: string | null;
  aum_band?: string | null; ticket_band?: string | null; revenue_min_band?: string | null; preferred_stages?: string[]; logo_path?: string | null; media?: unknown[]; setup_reached?: string | null;
  sector_picks?: { types: string[]; other: string[] } | null;
  wizard?: { answered?: string[]; from_signup?: string[] } | null;
} | null | undefined, buyer?: { deal_types: string[]; description: string }) {
  const type = iv?.investor_type ?? "", acts = iv?.acts_for_types ?? [];
  const skip = buyerSkips(iv?.wizard?.from_signup, {role: rel, type, web: iv?.website_url ?? "", year: iv?.year_founded ? String(iv.year_founded) : "", name: iv?.investor_name ?? "", actsFor: acts, sectors: iv?.preferred_industries ?? []});
  const country = iv?.country ?? "Thailand", thai = country === "Thailand";
  const desc = buyer?.description ?? "";
  const valid: Record<QId, boolean> = {
    role: !!rel, type: rel === "agent" ? acts.length > 0 : !!type && type !== "Individual Investor",
    name: !!iv?.country && (iv?.investor_name?.trim().length ?? 0) >= 2 && (rel === "individual" || (!yearError(String(iv?.year_founded ?? "")) && !regError(iv?.registration_no ?? "", country))) && !!iv?.address_line1?.trim() && !!iv?.address_city_district?.trim() && (!thai || (!!iv?.address_province_state && /^\d{5}$/.test(iv?.postal_code ?? ""))),
    web: isValidUrl(iv?.website_url ?? ""), aum: !!iv?.aum_band, ticket: !!iv?.ticket_band, rev: !!iv?.revenue_min_band,
    deals: !!buyer?.deal_types.length && (!showsStages(type, rel === "agent" ? acts : null) || !!iv?.preferred_stages?.length),
    sectors: (iv?.preferred_industries ?? []).includes("Sector Agnostic") || (!!iv?.sector_picks?.types.length && (!iv.sector_picks.types.includes("other") || !!iv.sector_picks.other.length)),
    photos: !!iv?.logo_path && !!iv?.media?.length,
    desc: !!desc.trim() && !descriptionError(desc) && !descriptionLeaks(desc, iv?.investor_name ?? "", iv?.website_url ?? "").length,
    review: false,
  };
  const order = stepsFor(rel).map(s => s.id);
  const answered = order.filter(k => k !== "review" && setupAnswered(k, valid[k], ["rev", "desc"], order, iv?.setup_reached));
  return buyerProgress(rel, answered, skip);
}
