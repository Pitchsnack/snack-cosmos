import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { stripIdentifying } from "./founder-story";

const Input = z.object({
  lang: z.enum(["en", "th"]),
  short: z.string().max(1000),
  products: z.array(z.string().max(60)).max(10),
  markets: z.array(z.string().max(60)).max(10),
  province: z.string().max(80),
  banned: z.array(z.string().max(200)).max(5),
});
export type StoryAnswers = z.infer<typeof Input>;
export type WrittenParts = { grew: string; from: string; who: string; where: string };

/** Writes the founder story's answer-based parts in the reader's language; nothing is stored. */
export const writeFounderStoryParts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => Input.parse(input))
  .handler(async ({ data }): Promise<WrittenParts> => {
    const empty = { grew: "", from: "", who: "", where: "" };
    if (!data.short.trim() && !data.products.length && !data.markets.length && !data.province.trim()) return empty;
    const language = data.lang === "th" ? "Thai (natural, concise, no polite particles)" : "English";
    const system = `You fill short phrases into a fixed founder biography template. Return ONLY JSON {"grew","from","who","where"}. Write every value in ${language}, translating if the inputs are in another language. Never include the company's name, brand or website. Use "" when the inputs give no basis. Never invent facts.`;
    const user = `Template (${data.lang}):
${data.lang === "th"
  ? `"...และพัฒนาจนเป็น{grew}" / "โดยมาจาก{from}เป็นหลัก" / "ให้บริการ{who}ทั่ว{where}"`
  : `"...developed it into {grew}." / "driven mainly by {from}." / "Serves {who} across {where}."`}
Rules:
- grew: the Short description shortened to a noun phrase (${data.lang === "th" ? 'e.g. "ผู้ผลิตขนมขบเคี้ยวบรรจุซองและอาหารแช่แข็ง"' : 'e.g. "a maker of packaged snacks and frozen foods"'}), max 12 words.
- from: the first one or two product/service tags joined naturally (${data.lang === "th" ? '"ขนมขบเคี้ยวและอาหารแช่แข็ง"' : '"packaged snacks and frozen foods"'}), lower-case except proper nouns.
- who: only the market tags that describe customers (e.g. restaurants and cafés); "" if none.
- where: only the market tags that are places (countries/regions); if none, the province (${data.lang === "th" ? 'e.g. "นนทบุรี"' : 'e.g. "Nonthaburi"'}); "" if neither.
Company name/website to never use: ${JSON.stringify(data.banned)}
Short description: ${JSON.stringify(data.short)}
Product & service tags: ${JSON.stringify(data.products)}
Market tags: ${JSON.stringify(data.markets)}
Province: ${JSON.stringify(data.province)}`;
    try {
      const { generateResponse } = await import("@lovable.dev/ai-gateway");
      const res = await generateResponse({ model: "openai/gpt-6.1-terra", instructions: system, input: user });
      const text = (res.output ?? []).flatMap((o) => (o.type === "message" ? o.content : [])).map((c) => (c.type === "output_text" ? c.text : "")).join("");
      const match = text.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(match ? match[0] : "{}") as Partial<WrittenParts>;
      const clean = (v: unknown) => typeof v === "string" ? stripIdentifying(v, data.banned).replace(/[.。]+$/, "").slice(0, 120) : "";
      return { grew: clean(parsed.grew), from: clean(parsed.from), who: clean(parsed.who), where: clean(parsed.where) };
    } catch {
      return empty;
    }
  });
