import type { ListingSource } from "./public-listing";
import type { ListingTextTranslation } from "./listing-text-translations";

export type AutomaticSellerListingResult = {
  name: string;
  headline: string;
  headlineTh: string;
  description: string;
  descriptionTh: string;
  translations: ListingTextTranslation[];
  filled: string[];
};

const STARTUP_COLUMNS = "startup_name,registered_name,website_url,email,city,headquarters,company_type,year_founded,company_size,last_year_revenue,sector,business_model,product_tags,market_tags,product_tags_th,market_tags_th,long_description,short_description,regulatory_licenses,iso_standards";
const LISTING_COLUMNS = "startup_id,code_name,suggested_listing_name,headline,headline_th,description,description_th,listing_text_translations";

/** Fill only empty listing fields from the seller's current answers, then translate blank/protected twins. */
export async function ensureAutomaticSellerListing(
  sb: any,
  startupId: string,
  control: boolean,
  updatedBy?: string,
): Promise<AutomaticSellerListingResult | null> {
  const [{ data: startup, error: startupError }, { data: current, error: listingError }] = await Promise.all([
    sb.from("startups").select(STARTUP_COLUMNS).eq("id", startupId).single(),
    sb.from("hidden_profiles").select(LISTING_COLUMNS).eq("startup_id", startupId).maybeSingle(),
  ]);
  if (startupError) throw new Error(startupError.message);
  if (listingError) throw new Error(listingError.message);
  if (!current) return null;

  const { suggestBusinessDescription, suggestCodeNames, suggestHeadline } = await import("./public-listing");
  const { capGeneratedListingText, planListingTextSave } = await import("./listing-text-translations");
  const { resolveListingTextPlan } = await import("./listing-text-translations.server");
  const source = startup as ListingSource;
  const headlineEmpty = !current.headline?.trim() && !current.headline_th?.trim();
  const descriptionEmpty = !current.description?.trim() && !current.description_th?.trim();
  const plan = planListingTextSave(current, {
    headline: headlineEmpty ? capGeneratedListingText("headline", "en", suggestHeadline(source)) : undefined,
    description: descriptionEmpty ? capGeneratedListingText("description", "en", suggestBusinessDescription(source)) : undefined,
  });
  const resolved = plan.changed ? await resolveListingTextPlan(plan) : {
    headline: current.headline?.trim() ?? "", headlineTh: current.headline_th?.trim() ?? "",
    description: current.description?.trim() ?? "", descriptionTh: current.description_th?.trim() ?? "",
    translations: current.listing_text_translations ?? [],
  };

  const patch: Record<string, unknown> = {};
  const filled: string[] = [];
  const put = (column: string, before: unknown, after: unknown) => {
    if ((before ?? "") === (after ?? "")) return;
    patch[column] = after;
    filled.push(column);
  };
  put("headline", current.headline?.trim(), resolved.headline);
  put("headline_th", current.headline_th?.trim(), resolved.headlineTh);
  put("description", current.description?.trim(), resolved.description);
  put("description_th", current.description_th?.trim(), resolved.descriptionTh);
  if (plan.changed) patch.listing_text_translations = resolved.translations;

  const nameColumn = control ? "code_name" : "suggested_listing_name";
  let name = String(current[nameColumn] ?? "").trim();
  if (!name) {
    const ideas = suggestCodeNames(source);
    const fallback = ideas.length ? ideas : ["Project Confidential Business"];
    const { data: existing, error: namesError } = await sb.from("hidden_profiles").select("startup_id,code_name").not("code_name", "is", null);
    if (namesError) throw new Error(namesError.message);
    const taken = new Set((existing ?? []).filter((row: any) => row.startup_id !== startupId).map((row: any) => String(row.code_name ?? "").trim().toLowerCase()));
    name = fallback.find((candidate) => !taken.has(candidate.toLowerCase())) ?? "";
    if (name) {
      patch[nameColumn] = name;
      filled.push(nameColumn);
    }
  }
  if (Object.keys(patch).length) {
    if (updatedBy) patch.updated_by = updatedBy;
    const { error } = await sb.from("hidden_profiles").update(patch).eq("startup_id", startupId);
    if (error) throw new Error(/code_name/.test(error.message) ? "NAME_TAKEN: That listing name is already used by another listing" : error.message);
  }
  return {
    name,
    headline: resolved.headline,
    headlineTh: resolved.headlineTh,
    description: resolved.description,
    descriptionTh: resolved.descriptionTh,
    translations: resolved.translations,
    filled,
  };
}
