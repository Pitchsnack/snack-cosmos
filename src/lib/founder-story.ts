import { z } from "zod";

export const STORY_KEYS = ["year", "grew", "now", "sales", "from", "who", "where", "top", "since"] as const;
export type StoryKey = typeof STORY_KEYS[number];
export const FounderStorySchema = z.object({
  mode: z.enum(["lines", "own"]),
  lang: z.enum(["en", "th"]),
  parts: z.object(Object.fromEntries(STORY_KEYS.map(k => [k, z.string().max(120)])) as Record<StoryKey, z.ZodString>),
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