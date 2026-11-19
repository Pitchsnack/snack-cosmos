import {
  capGeneratedListingText,
  type ListingTextJob,
  type ListingTextPlan,
  type ListingTextValues,
} from "./listing-text-translations";

/** Server-only translation for public listing headlines and descriptions. */
export async function translateListingTextJobs(jobs: ListingTextJob[]): Promise<string[]> {
  if (!jobs.length) return [];
  const { generateResponse } = await import("@lovable.dev/ai-gateway");
  const instructions = `Translate marketplace listing headlines and descriptions. Return ONLY JSON {"translations":[...]} with one string per input item, in the same order. Preserve meaning, numbers, units and qualifications; never add claims or company-identifying details. Use natural concise business Thai or English. A headline is at most 15 English words or 100 Thai characters. A description is at most 420 characters. Return single-line text without markdown or labels.`;
  const input = JSON.stringify(jobs.map((job) => ({
    field: job.field,
    sourceLanguage: job.sourceLang === "th" ? "Thai" : "English",
    targetLanguage: job.target === "th" ? "Thai" : "English",
    text: job.source,
  })));
  const res = await generateResponse({ model: "openai/gpt-6.1-sol", instructions, input });
  const text = (res.output ?? []).flatMap((item) => item.type === "message" ? item.content : [])
    .map((item) => item.type === "output_text" ? item.text : "").join("");
  const match = text.match(/\{[\s\S]*\}/);
  let parsed: { translations?: unknown };
  try { parsed = JSON.parse(match?.[0] ?? "{}") as { translations?: unknown }; }
  catch { throw new Error("The listing text could not be translated. Please try saving again."); }
  if (!Array.isArray(parsed.translations) || parsed.translations.length !== jobs.length) {
    throw new Error("The listing text could not be translated. Please try saving again.");
  }
  return parsed.translations.map((value, index) => {
    if (typeof value !== "string" || !value.trim()) throw new Error("The listing text could not be translated. Please try saving again.");
    const job = jobs[index]!;
    return capGeneratedListingText(job.field, job.target, value);
  });
}

export async function resolveListingTextPlan(plan: ListingTextPlan): Promise<ListingTextValues> {
  if (!plan.jobs.length) return {
    headline: plan.headline, headlineTh: plan.headlineTh,
    description: plan.description, descriptionTh: plan.descriptionTh,
    translations: plan.translations,
  };
  const translated = await translateListingTextJobs(plan.jobs);
  const next: ListingTextValues = {
    headline: plan.headline, headlineTh: plan.headlineTh,
    description: plan.description, descriptionTh: plan.descriptionTh,
    translations: plan.translations.filter((mark) => !plan.jobs.some((job) => job.field === mark.field && job.target === mark.target)),
  };
  plan.jobs.forEach((job, index) => {
    const value = translated[index]!;
    if (job.field === "headline") {
      if (job.target === "en") next.headline = value;
      else next.headlineTh = value;
    } else {
      if (job.target === "en") next.description = value;
      else next.descriptionTh = value;
    }
    next.translations.push({ field: job.field, target: job.target, source: job.source });
  });
  next.translations.sort((a, b) => a.field.localeCompare(b.field) || a.target.localeCompare(b.target));
  return next;
}
