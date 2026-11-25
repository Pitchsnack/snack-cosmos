import { showsStages, typeName } from "./investor-bands";

/** Public buyer identity; never use the private company name as a fallback. */
export function buyerListingName(type: string | null | undefined, ref: string | null | undefined, existing?: string | null) {
  return existing?.trim() || [typeName(type), ref?.trim()].filter(Boolean).join(" · ");
}

export function buyerRegistrationMissing(inv: { setup_done_at?: string | null; investor_name?: string | null; ticket_band?: string | null; investor_type?: string | null; preferred_stages?: string[] | null; preferred_industries?: string[] | null } | null, profile: { deal_types?: string[] | null; suggested_headline?: string | null; suggested_headline_th?: string | null }) {
  return [
    !inv?.setup_done_at && "finish setup",
    !inv?.investor_name?.trim() && "company name",
    !inv?.ticket_band && "average investment",
    !(profile.deal_types ?? []).length && "deal types",
    showsStages(inv?.investor_type) && !(inv?.preferred_stages ?? []).length && "stages",
    !(inv?.preferred_industries ?? []).length && "industries",
    !buyerWantFilled(profile.suggested_headline, profile.suggested_headline_th) && "what you want to buy",
  ].filter((value): value is string => typeof value === "string");
}

/** "What you want to buy" counts as written when either language has text. */
export function buyerWantFilled(en: string | null | undefined, th: string | null | undefined) {
  return !!(en?.trim() || th?.trim());
}

export function buyerApprovalTextMissing(name: string | undefined, headline: string | undefined, kind: "seller" | "buyer" | "advisor", headlineTh?: string) {
  if (kind === "advisor") return null;
  if (kind === "buyer") return buyerWantFilled(headline, headlineTh) ? null : "Write the published Wants to buy text.";
  if (!name?.trim()) return "Write a listing name.";
  if (!headline?.trim()) return "Write a headline.";
  return null;
}