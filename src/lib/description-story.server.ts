import {
  composeDescription,
  DescriptionStorySchema,
  planDescriptionPartSave,
  type DescriptionStory,
  type DescriptionStoryPair,
} from "./description-story";
import type { ListingTextTranslation } from "./listing-text-translations";

export type DescriptionStoryRow = {
  description?: string | null;
  description_th?: string | null;
  description_story?: unknown;
  description_story_th?: unknown;
  translations?: unknown;
};
export type DescriptionStoryInput = {
  description?: string | null;
  descriptionTh?: string | null;
  descriptionStory?: unknown;
  descriptionStoryTh?: unknown;
};
export type ResolvedDescriptionStory = {
  description: string;
  descriptionTh: string;
  stories: DescriptionStoryPair | null;
  translations: ListingTextTranslation[];
};

function savedStory(value: unknown, lang: "en" | "th"): DescriptionStory | null {
  const parsed = DescriptionStorySchema.safeParse(value);
  return parsed.success ? { ...parsed.data, lang } : null;
}

function assertLimit(en: string, th: string) {
  if (en.length > 420 || th.length > 420) throw new Error("Description must be 420 characters or fewer in each language.");
}

/** Resolve seller listing Descriptions, using per-part jobs in sentence mode and whole-text jobs in own-words mode. */
export async function resolveDescriptionStorySave(
  current: DescriptionStoryRow | null,
  input: DescriptionStoryInput,
): Promise<ResolvedDescriptionStory> {
  const currentStories = {
    en: savedStory(current?.description_story, "en"),
    th: savedStory(current?.description_story_th, "th"),
  };
  const supplied = input.descriptionStory !== undefined || input.descriptionStoryTh !== undefined;
  const nextStories = {
    en: savedStory(input.descriptionStory, "en") ?? currentStories.en,
    th: savedStory(input.descriptionStoryTh, "th") ?? currentStories.th,
  };
  const { capGeneratedListingText, planListingTextSave } = await import("./listing-text-translations");

  if (nextStories.en?.mode === "lines" && nextStories.th?.mode === "lines") {
    const plan = planDescriptionPartSave(
      currentStories.en && currentStories.th ? { en: currentStories.en, th: currentStories.th } : {},
      { en: nextStories.en, th: nextStories.th },
    );
    const stories: DescriptionStoryPair = plan.stories;
    if (plan.jobs.length) {
      const { translateListingTextJobs } = await import("./listing-text-translations.server");
      const translated = await translateListingTextJobs(plan.jobs.map((job) => ({
        field: "description" as const,
        sourceLang: job.sourceLang,
        target: job.target,
        source: job.source,
      })));
      plan.jobs.forEach((job, index) => {
        const target = stories[job.target];
        const source = stories[job.sourceLang];
        const value = translated[index]!.trim();
        target.parts[job.key] = value;
        if (source.auto?.[job.key]) target.auto = { ...(target.auto ?? {}), [job.key]: true };
        target.translations = [
          ...(target.translations ?? []).filter((item) => item.key !== job.key),
          { key: job.key, source: job.source },
        ];
      });
    }
    const description = composeDescription(stories.en);
    const descriptionTh = composeDescription(stories.th);
    assertLimit(description, descriptionTh);
    const { cleanListingTextTranslations } = await import("./listing-text-translations");
    return {
      description,
      descriptionTh,
      stories,
      translations: cleanListingTextTranslations(current?.translations).filter((item) => item.field !== "description"),
    };
  }

  const plan = planListingTextSave(current, {
    description: input.description === undefined ? undefined : capGeneratedListingText("description", "en", input.description ?? ""),
    descriptionTh: input.descriptionTh === undefined ? undefined : capGeneratedListingText("description", "th", input.descriptionTh ?? ""),
  });
  const { resolveListingTextPlan } = await import("./listing-text-translations.server");
  const resolved = await resolveListingTextPlan(plan);
  assertLimit(resolved.description, resolved.descriptionTh);
  return {
    description: resolved.description,
    descriptionTh: resolved.descriptionTh,
    stories: supplied ? (nextStories.en && nextStories.th ? { en: nextStories.en, th: nextStories.th } : null) : null,
    translations: resolved.translations,
  };
}
