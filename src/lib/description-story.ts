import { z } from "zod";
import type { ListingSource } from "./public-listing";
import { SELLER_SECTOR_EXAMPLES } from "./seller-sector-examples";
import { thaiProvinceName } from "./thai-address";
import { ISO_TH, LICENCE_TH } from "@/i18n/th-edit-info";

export const DESCRIPTION_PART_KEYS = ["what", "where", "year", "offer", "who", "sales", "staff", "licences", "months"] as const;
export type DescriptionPartKey = typeof DESCRIPTION_PART_KEYS[number];
export type DescriptionLanguage = "en" | "th";
export type DescriptionHandover = { stays?: "yes" | "no" | null; months?: number | null };

const partRecord = <T extends z.ZodTypeAny>(schema: T) => z.object(
  Object.fromEntries(DESCRIPTION_PART_KEYS.map((key) => [key, schema])) as Record<DescriptionPartKey, T>,
);

export const DescriptionPartTranslationSchema = z.object({
  key: z.enum(DESCRIPTION_PART_KEYS),
  source: z.string().max(420),
});
export type DescriptionPartTranslation = z.infer<typeof DescriptionPartTranslationSchema>;

export const DescriptionStorySchema = z.object({
  mode: z.enum(["lines", "own"]),
  lang: z.enum(["en", "th"]),
  handover: z.enum(["yes", "no"]).nullable(),
  parts: partRecord(z.string().max(420)),
  auto: partRecord(z.boolean().optional()).partial().optional(),
  translations: z.array(DescriptionPartTranslationSchema).max(9).optional(),
});
export type DescriptionStory = z.infer<typeof DescriptionStorySchema>;
export type DescriptionStoryLine = (string | DescriptionPartKey[])[];
export type DescriptionStoryPair = { en: DescriptionStory; th: DescriptionStory };
export type DescriptionTextPair = { en: string; th: string };
export type DescriptionStoryValue = { stories: DescriptionStoryPair; texts: DescriptionTextPair };

export const DESCRIPTION_HINTS: Record<DescriptionLanguage, Record<DescriptionPartKey, string>> = {
  en: {
    what: "what the business is", where: "where", year: "year", offer: "what you offer",
    who: "who your customers are", sales: "yearly sales", staff: "how many people",
    licences: "licences and certificates", months: "how long",
  },
  th: {
    what: "ธุรกิจอะไร", where: "ที่ไหน", year: "ปี", offer: "สินค้าหรือบริการ",
    who: "ลูกค้าคือใคร", sales: "ยอดขายต่อปี", staff: "จำนวนพนักงาน",
    licences: "ใบอนุญาตและใบรับรอง", months: "นานเท่าไร",
  },
};

export function descriptionStoryLines(lang: DescriptionLanguage, handover: DescriptionHandover): DescriptionStoryLine[] {
  const lines: DescriptionStoryLine[] = lang === "th" ? [
    [["what"], "ใน", ["where"], " ดำเนินงานมาตั้งแต่ปี ", ["year"]],
    ["นำเสนอ", ["offer"], "ให้แก่", ["who"]],
    ["ยอดขายต่อปี ", ["sales"], " มีพนักงาน ", ["staff"], " คน"],
    ["ได้รับ ", ["licences"]],
  ] : [
    [["what"], " based in ", ["where"], ", operating since ", ["year"], "."],
    ["Offers ", ["offer"], " to ", ["who"], "."],
    ["Annual sales of ", ["sales"], ", with ", ["staff"], " employees."],
    ["Holds ", ["licences"], "."],
  ];
  if (handover.stays === "yes") {
    lines.push(lang === "th"
      ? ["เจ้าของจะอยู่ช่วยส่งมอบงาน ", ["months"], " หลังการขาย"]
      : ["The owner will stay ", ["months"], " after the sale to hand over."]);
  } else if (handover.stays === "no") {
    lines.push([lang === "th" ? "เจ้าของจะออกเมื่อการขายเสร็จสิ้น" : "The owner leaves at completion."]);
  }
  return lines;
}

export function plainDescriptionPart(value: string): string {
  return Array.from(value.replace(/[\r\n\u2028\u2029]+/g, " ")).slice(0, 420).join("");
}

export function composeDescription(story: DescriptionStory, lang: DescriptionLanguage = story.lang): string {
  return descriptionStoryLines(lang, { stays: story.handover })
    .filter((line) => line.every((token) => typeof token === "string" || !!story.parts[token[0]].trim()))
    .map((line) => line.map((token) => typeof token === "string" ? token : story.parts[token[0]]).join(""))
    .join(" ");
}

const hasThai = (value: string) => /[\u0E00-\u0E7F]/.test(value);
const cleanItems = (items: string[] | null | undefined) => [...new Set((items ?? []).map((item) => item.trim()).filter(Boolean))];

export function joinDescriptionItems(items: string[], lang: DescriptionLanguage): string {
  const values = cleanItems(items);
  if (values.length < 2) return values[0] ?? "";
  return `${values.slice(0, -1).join(", ")} ${lang === "th" ? "และ" : "and"} ${values[values.length - 1]}`;
}

function normalizedStaff(size: string | null | undefined): string {
  const value = (size ?? "").trim();
  const key = value.toLowerCase().replace(/\s+/g, "");
  const bands: Record<string, string> = {
    "1-10": "1–10", "1–10": "1–10", "11-50": "11–50", "11–50": "11–50",
    "51-200": "51–200", "51–200": "51–200", "201-500": "201–500", "201–500": "201–500",
    "morethan500": "More than 500",
  };
  return bands[key] ?? (value ? value.replace(/\s*-\s*/g, "–") : "");
}

function businessWhat(source: ListingSource, lang: DescriptionLanguage): string {
  const sector = (source.sector ?? "").trim();
  if (!sector) return "";
  const size = (source.company_size ?? "").toLowerCase().replace(/\s+/g, "");
  const small = ["1-10", "1–10", "11-50", "11–50"].includes(size);
  const medium = ["51-200", "51–200"].includes(size);
  const large = ["201-500", "201–500", "morethan500"].includes(size);
  if (lang === "th") {
    const thai = SELLER_SECTOR_EXAMPLES.find((row) => row.sector === sector)?.thai ?? sector;
    if (small) return `ธุรกิจ SME ด้าน${thai}`;
    if (medium) return `ธุรกิจ${thai}ขนาดกลาง`;
    if (large) return `ธุรกิจ${thai}ขนาดใหญ่`;
    return `ธุรกิจ${thai}`;
  }
  const noun = sector.toLowerCase();
  if (small) return `${/^[aeiou]/i.test(noun) ? "An" : "A"} ${noun} SME`;
  if (medium) return `A medium-sized ${noun} business`;
  if (large) return `A large ${noun} business`;
  return `${/^[aeiou]/i.test(noun) ? "An" : "A"} ${noun} business`;
}

function localizedTags(primary: string[] | null | undefined, other: string[] | null | undefined, lang: DescriptionLanguage): string {
  const own = cleanItems(primary);
  const fallback = cleanItems(other);
  const matches = (value: string) => lang === "th" ? hasThai(value) : !hasThai(value);
  if (own.length && own.every(matches)) return joinDescriptionItems(own, lang);
  if (own.length && fallback.length && fallback.every(matches)) return joinDescriptionItems(fallback, lang);
  // A missing or wrong-language answer stays empty here and is translated as this part on save.
  return "";
}

function localizedCredentials(source: ListingSource, lang: DescriptionLanguage): string {
  const credentials = cleanItems([
    ...(source.regulatory_licenses ?? []).map((item) => item.name),
    ...(source.iso_standards ?? []),
  ]);
  if (!credentials.length) return "";
  if (lang === "en") {
    return credentials.every((value) => !hasThai(value)) ? joinDescriptionItems(credentials, lang) : "";
  }
  const canLocalize = credentials.every((value) => hasThai(value) || ISO_TH[value] || LICENCE_TH[value]);
  if (!canLocalize) return "";
  return joinDescriptionItems(credentials.map((value) => ISO_TH[value] ?? LICENCE_TH[value] ?? value), lang);
}

export function descriptionStoryAnswers(source: ListingSource, lang: DescriptionLanguage, handover: DescriptionHandover): Record<DescriptionPartKey, string> {
  const province = (source.city ?? "").split(",")[0].trim();
  const months = handover.stays === "yes" ? handover.months ?? 6 : null;
  return {
    what: businessWhat(source, lang),
    where: province && province !== "Other province" ? (lang === "th" ? thaiProvinceName(province) : province) : "",
    year: source.year_founded ? String(source.year_founded) : "",
    offer: lang === "th" ? localizedTags(source.product_tags_th, source.product_tags, lang) : localizedTags(source.product_tags, source.product_tags_th, lang),
    who: lang === "th" ? localizedTags(source.market_tags_th, source.market_tags, lang) : localizedTags(source.market_tags, source.market_tags_th, lang),
    sales: (source.last_year_revenue ?? "").trim().replace(/\s*[–-]\s*/g, "–"),
    staff: normalizedStaff(source.company_size),
    licences: localizedCredentials(source, lang),
    months: months ? plainDescriptionPart(lang === "th" ? `${months} เดือน` : `${months} month${months === 1 ? "" : "s"}`) : "",
  };
}

function emptyParts(): Record<DescriptionPartKey, string> {
  return Object.fromEntries(DESCRIPTION_PART_KEYS.map((key) => [key, ""])) as Record<DescriptionPartKey, string>;
}

function cleanTranslations(value: DescriptionPartTranslation[] | undefined): DescriptionPartTranslation[] {
  const seen = new Set<DescriptionPartKey>();
  const out: DescriptionPartTranslation[] = [];
  for (const item of value ?? []) {
    if (seen.has(item.key) || !item.source.trim()) continue;
    seen.add(item.key);
    out.push({ key: item.key, source: item.source.trim() });
  }
  return out;
}

/** Fill empty or still answer-derived parts; typed parts are never overwritten. */
export function applyDescriptionAnswers(story: DescriptionStory, fills: Record<DescriptionPartKey, string>, handover: DescriptionHandover): DescriptionStory {
  const parts = { ...story.parts };
  const auto = { ...(story.auto ?? {}) };
  let changed = story.handover !== (handover.stays ?? null);
  for (const key of DESCRIPTION_PART_KEYS) {
    if (auto[key] === false || (parts[key].trim() && !auto[key])) continue;
    const value = plainDescriptionPart((fills[key] ?? "").trim());
    if (parts[key] !== value) { parts[key] = value; changed = true; }
    const nextAuto = value ? true : auto[key];
    if (auto[key] !== nextAuto) { auto[key] = nextAuto; changed = true; }
  }
  for (const key of DESCRIPTION_PART_KEYS) if (auto[key] === undefined) delete auto[key];
  if (!changed) return story;
  return { ...story, handover: handover.stays ?? null, parts, auto, translations: cleanTranslations(story.translations) };
}

export function initialDescriptionStory(
  description: string | null | undefined,
  saved: DescriptionStory | null | undefined,
  lang: DescriptionLanguage,
  source: ListingSource,
  handover: DescriptionHandover,
): DescriptionStory {
  const fills = descriptionStoryAnswers(source, lang, handover);
  if (saved) return applyDescriptionAnswers({ ...saved, lang }, fills, handover);
  const automatic = !(description ?? "").trim();
  const base: DescriptionStory = {
    mode: automatic ? "lines" : "own", lang, handover: handover.stays ?? null,
    parts: emptyParts(), auto: {}, translations: [],
  };
  return applyDescriptionAnswers(base, fills, handover);
}

/** Owner typing makes this part their own words and retires its automatic translation. */
export function typeDescriptionPart(story: DescriptionStory, key: DescriptionPartKey, value: string): DescriptionStory {
  const auto = { ...(story.auto ?? {}) };
  auto[key] = false;
  return {
    ...story,
    parts: { ...story.parts, [key]: plainDescriptionPart(value) },
    auto,
    translations: cleanTranslations(story.translations).filter((item) => item.key !== key),
  };
}

export function withoutDescriptionPartTranslation(story: DescriptionStory, key: DescriptionPartKey): DescriptionStory {
  return { ...story, translations: cleanTranslations(story.translations).filter((item) => item.key !== key) };
}

export function isDescriptionStoryTranslated(stories: DescriptionStoryPair, lang: DescriptionLanguage): boolean {
  const target = stories[lang];
  const source = stories[lang === "en" ? "th" : "en"];
  return cleanTranslations(target.translations).some((mark) =>
    !!target.parts[mark.key].trim() && source.parts[mark.key].trim() === mark.source,
  );
}

export type DescriptionPartJob = {
  key: DescriptionPartKey;
  sourceLang: DescriptionLanguage;
  target: DescriptionLanguage;
  source: string;
};
export type DescriptionPartPlan = {
  stories: DescriptionStoryPair;
  jobs: DescriptionPartJob[];
  changed: boolean;
};

/** Translate only blank or still-automatic twins of changed/generated parts. */
export function planDescriptionPartSave(
  current: Partial<DescriptionStoryPair>,
  next: DescriptionStoryPair,
): DescriptionPartPlan {
  const stories: DescriptionStoryPair = {
    en: { ...next.en, parts: { ...next.en.parts }, translations: cleanTranslations(next.en.translations) },
    th: { ...next.th, parts: { ...next.th.parts }, translations: cleanTranslations(next.th.translations) },
  };
  const jobs: DescriptionPartJob[] = [];
  for (const key of DESCRIPTION_PART_KEYS) {
    const enChanged = !!current.en && next.en.parts[key] !== current.en.parts[key];
    const thChanged = !!current.th && next.th.parts[key] !== current.th.parts[key];
    if (enChanged) stories.en = withoutDescriptionPartTranslation(stories.en, key);
    if (thChanged) stories.th = withoutDescriptionPartTranslation(stories.th, key);
    const autoEn = stories.en.translations?.some((item) => item.key === key) ?? false;
    const autoTh = stories.th.translations?.some((item) => item.key === key) ?? false;
    const en = stories.en.parts[key].trim();
    const th = stories.th.parts[key].trim();
    if (!en && autoTh && thChanged) stories.th.parts[key] = "";
    if (!th && autoEn && enChanged) stories.en.parts[key] = "";
    const thManuallyChanged = thChanged && stories.th.auto?.[key] === false;
    const enManuallyChanged = enChanged && stories.en.auto?.[key] === false;
    if (stories.en.parts[key].trim() && !thManuallyChanged && (!stories.th.parts[key].trim() || (autoTh && enChanged))) {
      jobs.push({ key, sourceLang: "en", target: "th", source: stories.en.parts[key].trim() });
      stories.th = withoutDescriptionPartTranslation(stories.th, key);
    } else if (stories.th.parts[key].trim() && !enManuallyChanged && (!stories.en.parts[key].trim() || (autoEn && thChanged))) {
      jobs.push({ key, sourceLang: "th", target: "en", source: stories.th.parts[key].trim() });
      stories.en = withoutDescriptionPartTranslation(stories.en, key);
    }
  }
  const before = JSON.stringify(current.en && current.th ? current : {});
  const after = JSON.stringify(stories);
  return { stories, jobs, changed: before !== after || jobs.length > 0 };
}
