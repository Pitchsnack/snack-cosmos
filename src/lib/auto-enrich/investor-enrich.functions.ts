import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildCorpus, extractJson, inferHeadquarters } from "./scrape.server";
import { buildInvestorPrompt, normalizeInvestorResult } from "./investor-enrich.server";
import type { EnrichInvestorResult } from "./investor-enrich-types";

export const enrichInvestorFromUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ websiteUrl: z.string().url() }).parse(input))
  .handler(async ({ data }): Promise<EnrichInvestorResult> => {
    const { base, origin, corpus, corpusChars, pagesTried, pagesUsed } = await buildCorpus(
      data.websiteUrl,
    );
    const { system, user } = buildInvestorPrompt(base, corpus);
    const { content } = await extractJson(system, user);
    let parsedRaw: unknown = {};
    try {
      parsedRaw = JSON.parse(content);
    } catch {
      parsedRaw = {};
    }
    const parsed = normalizeInvestorResult(parsedRaw);
    const hq = inferHeadquarters(corpus, parsed.headquarters ?? "");
    if (hq.country) parsed.headquarters = hq.country;
    parsed._debug = {
      origin,
      pagesTried,
      pagesUsed,
      corpusChars,
      modelOutputChars: content.length,
      headquartersDiagnostic: hq.diagnostic,
      headquartersPhoneCc: hq.phoneCc,
    };
    return parsed;
  });
