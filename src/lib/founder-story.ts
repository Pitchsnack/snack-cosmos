import { z } from "zod";

export const STORY_KEYS = ["year", "grew", "now", "sales", "from", "who", "where", "top", "since"] as const;
export type StoryKey = typeof STORY_KEYS[number];
export const FounderStorySchema = z.object({
  mode: z.enum(["lines", "own"]),
  lang: z.enum(["en", "th"]),
  parts: z.object(Object.fromEntries(STORY_KEYS.map(k => [k, z.string().max(120)])) as Record<StoryKey, z.ZodString>),
  /** Parts written from earlier answers (true) rather than typed by the owner. */
  auto: z.object(Object.fromEntries(STORY_KEYS.map(k => [k, z.boolean().optional()])) as Record<StoryKey, z.ZodOptional<z.ZodBoolean>>).partial().optional(),
});
export type FounderStory = z.infer<typeof FounderStorySchema>;
export type StoryLine = (string | StoryKey[])[];
export const STORY_LINES: Record<"en" | "th", StoryLine[]> = {
  en: [
    ["Founded the company in ", ["year"], " and developed it into ", ["grew"], "."],
    ["Still leads ", ["now"], "."],
    ["Grew annual sales to ", ["sales"], ", driven mainly by ", ["from"], "."],
    ["Serves ", ["who"], " across ", ["where"], "."],
    ["Top ", ["top"], " customers have placed repeat orders for ", ["since"], " years."],
  ],
  th: [
    ["ก่อตั้งบริษัทเมื่อปี ", ["year"], " และพัฒนาจนเป็น", ["grew"]],
    ["ปัจจุบันยังคงดูแล", ["now"], "โดยตรง"],
    ["เพิ่มยอดขายต่อปีเป็น ", ["sales"], " โดยมาจาก", ["from"], "เป็นหลัก"],
    ["ให้บริการ", ["who"], "ทั่ว", ["where"]],
    ["ลูกค้ารายใหญ่ ", ["top"], " อันดับแรกสั่งซื้อซ้ำต่อเนื่องมา", ["since"], " ปี"],
  ],
};
export const STORY_HINTS: Record<"en" | "th", Record<StoryKey, string>> = {
  en: {year:"year", grew:"what it grew into", now:"what they lead today", sales:"yearly sales", from:"what drives most sales", who:"who the customers are", where:"where", top:"how many", since:"how long"},
  th: {year:"ปี", grew:"พัฒนาจนเป็นอะไร", now:"ปัจจุบันดูแลอะไร", sales:"ยอดขายต่อปี", from:"ยอดขายส่วนใหญ่มาจากอะไร", who:"ลูกค้าคือใคร", where:"ที่ไหน", top:"กี่ราย", since:"นานเท่าไร"},
};
export function plainStoryPart(value: string): string {
  return Array.from(value.replace(/[\r\n\u2028\u2029]+/g, " ")).slice(0, 120).join("");
}
export function founderRevenueLabel(value: string, lang: "en" | "th"): string {
  const thai: Record<string, string> = {"Below ฿50M":"ต่ำกว่า 50 ล้านบาท", "฿50M – 100M":"50–100 ล้านบาท", "฿100M – 250M":"100–250 ล้านบาท", "฿250M – 500M":"250–500 ล้านบาท", "฿500M – 1B":"500–1,000 ล้านบาท", "฿1B +":"มากกว่า 1,000 ล้านบาท"};
  return lang === "th" ? thai[value] ?? value : value;
}
export function composeFounderBio(story: FounderStory, lang = story.lang): string {
  return STORY_LINES[lang].filter(line => line.every(token => typeof token === "string" || !!story.parts[token[0]].trim()))
    .map(line => line.map(token => typeof token === "string" ? token : story.parts[token[0]]).join("")).join("\n");
}
export function initialFounderStory(bio: string | null | undefined, saved: FounderStory | null | undefined, lang: "en" | "th", year: string, sales: string): FounderStory {
  if (saved) return saved;
  const parts = Object.fromEntries(STORY_KEYS.map(k => [k, ""])) as Record<StoryKey, string>;
  parts.year = plainStoryPart(year);
  parts.sales = plainStoryPart(sales.replace(/\s*[–-]\s*/g, "–"));
  return {mode: bio ? "own" : "lines", lang, parts};
}

/** Follow company-year changes only while the story year is empty or still synchronized. */
export function syncFounderStoryYear(story: FounderStory | null | undefined, previousYear: string, nextYear: string): FounderStory | null | undefined {
  if (!story || previousYear === nextYear) return story;
  const currentYear = story.parts.year;
  if (currentYear && currentYear !== previousYear) return story;
  return {...story, parts: {...story.parts, year: plainStoryPart(nextYear)}};
}

export type FounderStoryCarrier = {
  bio?: string | null;
  bio_story?: FounderStory | null;
  bio_th?: string | null;
  bio_story_th?: FounderStory | null;
};

/** Parent forms call this even while the founder editor is on another, unmounted step. */
export function syncFounderStoriesYear<T extends FounderStoryCarrier>(founders: T[], previousYear: string, nextYear: string): T[] {
  if (previousYear === nextYear) return founders;
  let changed = false;
  const next = founders.map((founder) => {
    const en = syncFounderStoryYear(founder.bio_story, previousYear, nextYear);
    const th = syncFounderStoryYear(founder.bio_story_th, previousYear, nextYear);
    if (en === founder.bio_story && th === founder.bio_story_th) return founder;
    changed = true;
    return {
      ...founder,
      bio_story: en,
      bio_story_th: th,
      bio: en !== founder.bio_story && en?.mode === "lines" ? composeFounderBio(en) : founder.bio,
      bio_th: th !== founder.bio_story_th && th?.mode === "lines" ? composeFounderBio(th) : founder.bio_th,
    };
  });
  return changed ? next : founders;
}

/** Parts an earlier answer can write; "top" and "since" stay hints. */
export const AUTO_STORY_KEYS = ["grew", "now", "from", "who", "where"] as const;
export type StoryFills = Partial<Record<StoryKey, string>>;

const NOW_BY_POSITION: Record<string, [string, string]> = {
  "Owner": ["the company as its owner", "บริษัทในฐานะเจ้าของ"],
  "Family business owner": ["the family business as its owner", "ธุรกิจครอบครัวในฐานะเจ้าของ"],
  "Founder": ["the company as its founder", "บริษัทในฐานะผู้ก่อตั้ง"],
  "Co-founder": ["the company as a co-founder", "บริษัทในฐานะผู้ร่วมก่อตั้ง"],
  "CEO": ["the company as CEO", "บริษัทในฐานะซีอีโอ"],
  "CTO": ["the company as CTO", "บริษัทในฐานะซีทีโอ"],
  "CFO": ["the company as CFO", "บริษัทในฐานะซีเอฟโอ"],
  "C-suite": ["the company as a senior executive", "บริษัทในฐานะผู้บริหารระดับสูง"],
};
/** "What they lead today" from the founder's first known Position. */
export function nowFromPosition(position: string | null | undefined, lang: "en" | "th"): string {
  for (const p of (position ?? "").split(",").map(x => x.trim())) {
    const hit = NOW_BY_POSITION[p];
    if (hit) return hit[lang === "th" ? 1 : 0];
  }
  return "";
}

/** Fill empty or still auto-filled parts from answers; typed parts are never overwritten. */
export function applyStoryFills(story: FounderStory, fills: StoryFills): FounderStory {
  const parts = {...story.parts};
  const auto = {...(story.auto ?? {})};
  let changed = false;
  for (const k of AUTO_STORY_KEYS) {
    if (fills[k] === undefined || (parts[k].trim() && !auto[k])) continue;
    const v = plainStoryPart((fills[k] ?? "").trim());
    if (parts[k] !== v) { parts[k] = v; changed = true; }
    if (!!auto[k] !== !!v) { auto[k] = !!v || undefined; changed = true; }
  }
  if (!changed) return story;
  for (const k of STORY_KEYS) if (!auto[k]) delete auto[k];
  return {...story, parts, auto};
}

/** Owner typing in a part makes it their own words. */
export function typeStoryPart(story: FounderStory, key: StoryKey, value: string): FounderStory {
  const auto = {...(story.auto ?? {})};
  delete auto[key];
  return {...story, parts: {...story.parts, [key]: value}, auto};
}

/** Remove the company name and website from written text. */
export function stripIdentifying(text: string, banned: string[]): string {
  let out = text;
  for (const b of banned.map(x => x.trim()).filter(x => x.length >= 3)) {
    out = out.split(new RegExp(b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi")).join("");
  }
  return out.replace(/\s{2,}/g, " ").replace(/^[\s,]+|[\s,]+$/g, "");
}
