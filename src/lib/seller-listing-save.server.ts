import { planListingTextSave, cleanListingTextTranslations } from "./listing-text-translations";
import { resolveListingTextPlan } from "./listing-text-translations.server";
import { resolveDescriptionStorySave, type DescriptionStoryInput } from "./description-story.server";
import type { DescriptionStoryPair } from "./description-story";

export type SellerListingTextSaveInput = DescriptionStoryInput & {
  headline?: string | null;
  headlineTh?: string | null;
};
export type SellerListingTextSaveResult = {
  headline: string;
  headlineTh: string;
  description: string;
  descriptionTh: string;
  stories: DescriptionStoryPair | null;
  translations: ReturnType<typeof cleanListingTextTranslations>;
};

/** Shared authorised-save pipeline for wizard and Edit information. */
export async function resolveSellerListingTextSave(
  current: {
    headline?: string | null; headline_th?: string | null;
    description?: string | null; description_th?: string | null;
    description_story?: unknown; description_story_th?: unknown; translations?: unknown; listing_text_translations?: unknown;
  } | null,
  input: SellerListingTextSaveInput,
): Promise<SellerListingTextSaveResult> {
  const normalizedCurrent = current ? { ...current, translations: current.translations ?? current.listing_text_translations } : null;
  const headline = await resolveListingTextPlan(planListingTextSave(normalizedCurrent, {
    headline: input.headline,
    headlineTh: input.headlineTh,
  }));
  const description = await resolveDescriptionStorySave({ ...normalizedCurrent, translations: headline.translations }, input);
  return {
    headline: headline.headline,
    headlineTh: headline.headlineTh,
    description: description.description,
    descriptionTh: description.descriptionTh,
    stories: description.stories,
    translations: [
      ...headline.translations.filter((item) => item.field === "headline"),
      ...description.translations.filter((item) => item.field === "description"),
    ],
  };
}
