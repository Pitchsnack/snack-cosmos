import type { HighlightJob, HighlightPlan, HighlightValues } from "./highlight-translations";

/** Server-only AI translation; browser editors save through their existing authorized functions. */
export async function translateHighlightJobs(jobs: HighlightJob[]): Promise<string[]> {
  if (!jobs.length) return [];
  const { generateResponse } = await import("@lovable.dev/ai-gateway");
  const instructions = `Translate marketplace listing Highlights. Return ONLY JSON {"translations":[...]} with one string per input item, in the same order. Each item names its target language. Preserve meaning, numbers, units and qualifications; never add claims or company-identifying details. Use natural concise business Thai or English. Keep each translation under 200 characters. If a string has no translatable meaning, preserve it rather than inventing a meaning.`;
  const input = JSON.stringify(jobs.map((job) => ({
    sourceLanguage: job.sourceLang === "th" ? "Thai" : "English",
    targetLanguage: job.target === "th" ? "Thai" : "English",
    text: job.text,
  })));
  const res = await generateResponse({ model: "openai/gpt-6.1-sol", instructions, input });
  const text = (res.output ?? []).flatMap((item) => item.type === "message" ? item.content : [])
    .map((item) => item.type === "output_text" ? item.text : "").join("");
  const match = text.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(match?.[0] ?? "{}") as { translations?: unknown };
  if (!Array.isArray(parsed.translations) || parsed.translations.length !== jobs.length) {
    throw new Error("The Highlights could not be translated. Please try saving again.");
  }
  return parsed.translations.map((value, index) => {
    if (typeof value !== "string" || !value.trim()) throw new Error(`Highlight ${index + 1} could not be translated. Please try saving again.`);
    return value.trim().replace(/\s+/g, " ").slice(0, 200);
  });
}

export async function resolveHighlightPlan(plan: HighlightPlan): Promise<HighlightValues> {
  if (!plan.jobs.length) return { en: plan.en, th: plan.th, translations: plan.translations };
  const translated = await translateHighlightJobs(plan.jobs);
  const en = [...plan.en];
  const th = [...plan.th];
  let translations = plan.translations.filter((mark) => !plan.jobs.some((job) => job.index === mark.index && job.target === mark.target));
  plan.jobs.forEach((job, i) => {
    const value = translated[i]!;
    if (job.target === "en") en[job.index] = value;
    else th[job.index] = value;
    translations.push({ index: job.index, target: job.target, source: job.text });
  });
  translations = translations.sort((a, b) => a.index - b.index || a.target.localeCompare(b.target));
  return { en, th, translations };
}
