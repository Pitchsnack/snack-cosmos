import type { ListingSource } from "./public-listing";
import type { ListingTextTranslation } from "./listing-text-translations";
import { DescriptionStorySchema, composeDescription, initialDescriptionStory, type DescriptionStory } from "./description-story";

export type AutomaticSellerListingResult = {
  name: string;
  headline: string;
  headlineTh: string;
  description: string;
  descriptionTh: string;
  descriptionStory: DescriptionStory | null;
  descriptionStoryTh: DescriptionStory | null;
  translations: ListingTextTranslation[];
  filled: string[];
  legacyAutomaticDescription: boolean;
};

const STARTUP_COLUMNS = "startup_name,registered_name,website_url,email,city,headquarters,company_type,year_founded,company_size,last_year_revenue,sector,business_model,product_tags,market_tags,product_tags_th,market_tags_th,long_description,short_description,regulatory_licenses,iso_standards";
const LISTING_COLUMNS = "startup_id,code_name,suggested_listing_name,headline,headline_th,description,description_th,description_story,description_story_th,owner_stays,handover_months,listing_text_translations";
const clean = (value: unknown) => typeof value === "string" ? value.trim() : "";

function savedStory(value: unknown): DescriptionStory | null {
  const parsed = DescriptionStorySchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** Fill only empty/protected listing fields from current answers and persist editable Description sentences. */
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
  const { capGeneratedListingText } = await import("./listing-text-translations");
  const { resolveSellerListingTextSave } = await import("./seller-listing-save.server");
  const source = startup as ListingSource;
  const savedEn = savedStory(current.description_story);
  const savedTh = savedStory(current.description_story_th);
  const headlineEmpty = !clean(current.headline) && !clean(current.headline_th);
  const descriptionEmpty = !clean(current.description) && !clean(current.description_th);
  // The retired generator is used only to recognise its own output during the one-time upgrade.
  const legacyText = suggestBusinessDescription(source);
  const legacyAutomaticDescription = !savedEn && !savedTh && !!legacyText && clean(current.description) === clean(legacyText);
  const sentenceMode = descriptionEmpty || legacyAutomaticDescription || (savedEn?.mode === "lines" && savedTh?.mode === "lines");
  const handover = { stays: current.owner_stays as "yes" | "no" | null, months: current.handover_months as number | null };
  const storyEn = initialDescriptionStory(sentenceMode ? "" : current.description, savedEn, "en", source, handover);
  const storyTh = initialDescriptionStory(sentenceMode ? "" : current.description_th, savedTh, "th", source, handover);
  const resolved = await resolveSellerListingTextSave(current, {
    headline: headlineEmpty ? capGeneratedListingText("headline", "en", suggestHeadline(source)) : undefined,
    description: sentenceMode ? composeDescription(storyEn) : undefined,
    descriptionTh: sentenceMode ? composeDescription(storyTh) : undefined,
    descriptionStory: storyEn,
    descriptionStoryTh: storyTh,
  });

  const patch: Record<string, unknown> = {};
  const filled: string[] = [];
  const put = (column: string, before: unknown, after: unknown) => {
    if (JSON.stringify(before ?? null) === JSON.stringify(after ?? null)) return;
    patch[column] = after;
    filled.push(column);
  };
  put("headline", clean(current.headline), resolved.headline);
  put("headline_th", clean(current.headline_th), resolved.headlineTh);
  put("description", clean(current.description), resolved.description);
  put("description_th", clean(current.description_th), resolved.descriptionTh);
  put("description_story", current.description_story, resolved.stories?.en ?? null);
  put("description_story_th", current.description_story_th, resolved.stories?.th ?? null);
  put("listing_text_translations", current.listing_text_translations, resolved.translations);

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
    descriptionStory: resolved.stories?.en ?? null,
    descriptionStoryTh: resolved.stories?.th ?? null,
    translations: resolved.translations,
    filled,
    legacyAutomaticDescription,
  };
}
