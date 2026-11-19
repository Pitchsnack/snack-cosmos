export type TextLanguage = "en" | "th";
export type BilingualText = { en: string | null; th: string | null };
export type BilingualTextInput = { en?: string | null; th?: string | null };
export type BilingualTextPatch = { en?: string | null; th?: string | null };

export const hasThaiLetter = (value: string | null | undefined) => /[\u0E00-\u0E7F]/.test(value ?? "");
export const languageOfText = (value: string | null | undefined): TextLanguage => hasThaiLetter(value) ? "th" : "en";

/** Reader's language first, then the other saved language. */
export function preferredLanguageText(en: string | null | undefined, th: string | null | undefined, language: string): string {
  const english = en?.trim() ? en : "";
  const thai = th?.trim() ? th : "";
  return language === "th" ? thai || english || "" : english || thai || "";
}

/**
 * Routes only the side the wizard changed. The untouched language is deliberately absent
 * from the patch, so setup never translates or overwrites it. Empty input clears the side
 * the editor supplied; non-empty input follows its letters instead of the app language.
 */
export function routeWizardText(current: BilingualText, input: BilingualTextInput): BilingualTextPatch {
  const patch: BilingualTextPatch = {};
  const enChanged = input.en !== undefined && input.en !== current.en;
  const thChanged = input.th !== undefined && input.th !== current.th;
  if (enChanged) {
    if (input.en && hasThaiLetter(input.en)) patch.th = input.en;
    else patch.en = input.en;
  }
  if (thChanged) {
    if (input.th && !hasThaiLetter(input.th)) patch.en = input.th;
    else patch.th = input.th;
  }
  return patch;
}

export type BilingualTags = { en: string[]; th: string[] };
export type BilingualTagsInput = { en?: string[]; th?: string[] };
export type BilingualTagsPatch = { en?: string[]; th?: string[] };
const sameTags = (a: string[], b: string[]) => a.length === b.length && a.every((value, index) => value === b[index]);
const unique = (values: string[]) => [...new Set(values)];

/** Sorts each changed tag list one tag at a time while retaining the untouched language. */
export function routeWizardTags(current: BilingualTags, input: BilingualTagsInput): BilingualTagsPatch {
  const patch: BilingualTagsPatch = {};
  let en = current.en;
  let th = current.th;
  const enChanged = input.en !== undefined && !sameTags(input.en, current.en);
  const thChanged = input.th !== undefined && !sameTags(input.th, current.th);
  if (enChanged) {
    en = input.en!.filter((tag) => !hasThaiLetter(tag));
    th = unique([...th, ...input.en!.filter(hasThaiLetter)]);
  }
  if (thChanged) {
    th = input.th!.filter(hasThaiLetter);
    en = unique([...en, ...input.th!.filter((tag) => !hasThaiLetter(tag))]);
  }
  if (enChanged || thChanged) {
    if (!sameTags(en, current.en)) patch.en = en;
    if (!sameTags(th, current.th)) patch.th = th;
  }
  return patch;
}
