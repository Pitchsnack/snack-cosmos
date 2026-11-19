import { sellerWordingCount } from "./seller-listing-wording";

export type ListingTextLanguage = "en" | "th";
export type ListingTextField = "headline" | "description";
export type ListingTextTranslation = { field: ListingTextField; target: ListingTextLanguage; source: string };
export type ListingTextJob = ListingTextTranslation & { sourceLang: ListingTextLanguage };
export type ListingTextValues = {
  headline: string;
  headlineTh: string;
  description: string;
  descriptionTh: string;
  translations: ListingTextTranslation[];
};
export type ListingTextInput = Partial<Record<"headline" | "headlineTh" | "description" | "descriptionTh", string | null>>;
export type ListingTextPlan = ListingTextValues & { jobs: ListingTextJob[]; changed: boolean };

const clean = (value: unknown) => typeof value === "string" ? value.trim() : "";

export function cleanListingTextTranslations(value: unknown): ListingTextTranslation[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: ListingTextTranslation[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    const field = item.field === "headline" || item.field === "description" ? item.field : null;
    const target = item.target === "en" || item.target === "th" ? item.target : null;
    const source = clean(item.source);
    if (!field || !target || !source) continue;
    const key = `${field}:${target}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ field, target, source });
  }
  return out;
}

export function withoutListingTextTranslation(marks: unknown, field: ListingTextField, target: ListingTextLanguage) {
  return cleanListingTextTranslations(marks).filter((item) => item.field !== field || item.target !== target);
}

export function isTranslatedListingText(
  values: { headline?: string | null; headlineTh?: string | null; description?: string | null; descriptionTh?: string | null; translations?: unknown },
  field: ListingTextField,
  target: ListingTextLanguage,
) {
  const mark = cleanListingTextTranslations(values.translations).find((item) => item.field === field && item.target === target);
  if (!mark) return false;
  const source = field === "headline"
    ? target === "en" ? values.headlineTh : values.headline
    : target === "en" ? values.descriptionTh : values.description;
  const translated = field === "headline"
    ? target === "en" ? values.headline : values.headlineTh
    : target === "en" ? values.description : values.descriptionTh;
  return clean(source) === mark.source && !!clean(translated);
}

/** Plans translation only for blank targets or targets still carrying their automatic mark. */
export function planListingTextSave(
  current: {
    headline?: string | null; headline_th?: string | null; description?: string | null; description_th?: string | null;
    translations?: unknown;
  } | null,
  input: ListingTextInput,
): ListingTextPlan {
  const before = {
    headline: clean(current?.headline), headlineTh: clean(current?.headline_th),
    description: clean(current?.description), descriptionTh: clean(current?.description_th),
  };
  const next = {
    headline: input.headline === undefined ? before.headline : clean(input.headline),
    headlineTh: input.headlineTh === undefined ? before.headlineTh : clean(input.headlineTh),
    description: input.description === undefined ? before.description : clean(input.description),
    descriptionTh: input.descriptionTh === undefined ? before.descriptionTh : clean(input.descriptionTh),
  };
  let translations = cleanListingTextTranslations(current?.translations);
  const jobs: ListingTextJob[] = [];

  for (const field of ["headline", "description"] as const) {
    const enKey = field;
    const thKey = field === "headline" ? "headlineTh" : "descriptionTh";
    const changedEn = input[enKey] !== undefined && next[enKey] !== before[enKey];
    const changedTh = input[thKey] !== undefined && next[thKey] !== before[thKey];
    if (changedEn) translations = withoutListingTextTranslation(translations, field, "en");
    if (changedTh) translations = withoutListingTextTranslation(translations, field, "th");

    const autoEn = translations.some((item) => item.field === field && item.target === "en");
    const autoTh = translations.some((item) => item.field === field && item.target === "th");

    // Removing an original also removes its untouched translation; a manually edited target remains alone.
    if (!next[enKey] && autoTh && changedEn) next[thKey] = "";
    if (!next[thKey] && autoEn && changedTh) next[enKey] = "";

    if (next[enKey] && !changedTh && (!next[thKey] || (autoTh && changedEn))) {
      jobs.push({ field, sourceLang: "en", target: "th", source: next[enKey] });
      translations = withoutListingTextTranslation(translations, field, "th");
    }
    if (next[thKey] && !changedEn && (!next[enKey] || (autoEn && changedTh))) {
      jobs.push({ field, sourceLang: "th", target: "en", source: next[thKey] });
      translations = withoutListingTextTranslation(translations, field, "en");
    }
  }

  translations = translations.filter((mark) => {
    const source = mark.field === "headline"
      ? mark.target === "en" ? next.headlineTh : next.headline
      : mark.target === "en" ? next.descriptionTh : next.description;
    return !!source;
  });
  const previous = JSON.stringify({ ...before, translations: cleanListingTextTranslations(current?.translations) });
  const after = JSON.stringify({ ...next, translations });
  return { ...next, translations, jobs, changed: previous !== after || jobs.length > 0 };
}

export function capGeneratedListingText(field: ListingTextField, language: ListingTextLanguage, value: string) {
  const oneLine = value.replace(/\s+/g, " ").trim();
  if (field === "description") return oneLine.slice(0, 420).trimEnd();
  if (!sellerWordingCount(oneLine, "headline", language).over) return oneLine;
  return /[\u0E00-\u0E7F]/.test(oneLine)
    ? Array.from(oneLine).slice(0, 100).join("").trimEnd()
    : oneLine.split(/\s+/).slice(0, 15).join(" ").trimEnd();
}
