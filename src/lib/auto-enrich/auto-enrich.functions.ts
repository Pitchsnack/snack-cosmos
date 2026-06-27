import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Structured enrichment payload returned to the UI. All fields are optional —
 * the form merges only those whose target is currently empty.
 */
export interface EnrichResult {
  startupName?: string;
  companyType?: string;
  yearFounded?: number;
  email?: string;
  headquarters?: string;
  city?: string;
  linkedinUrl?: string;
  shortDescription?: string;
  longDescription?: string;
  industries?: string[];
  productTags?: string[];
  marketTags?: string[];
  investmentStage?: string;
  founders?: Array<{ full_name: string; position?: string; linkedin_url?: string; bio?: string }>;
}

const COMPANY_TYPES = ["SME", "Startup", "Corporate Enterprise"];
const STAGES = ["Pre-Seed","Seed","Series A","Series B","Series C+","Growth","IPO","Acquired","Inactive"];
const INDUSTRIES = ["FinTech","eCommerce & Marketplace","MarTech","HealthTech","Sustainability","Mobility & Logistics","DeepTech","Defense","EdTech","Gaming","PropTech","AgriTech","FMCG","Others"];

async function fetchText(url: string, timeoutMs = 8000): Promise<string> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AutoEnrichBot/1.0)" },
      redirect: "follow",
    });
    if (!res.ok) return "";
    const html = await res.text();
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 12000);
  } catch {
    return "";
  } finally {
    clearTimeout(id);
  }
}

export const enrichStartupFromUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ websiteUrl: z.string().url() }).parse(input),
  )
  .handler(async ({ data }): Promise<EnrichResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Auto Enrich is not configured (missing API key).");

    let base = data.websiteUrl.trim();
    if (!/^https?:\/\//i.test(base)) base = "https://" + base;
    const origin = (() => { try { return new URL(base).origin; } catch { return base; } })();

    const [home, about, team] = await Promise.all([
      fetchText(origin),
      fetchText(origin + "/about"),
      fetchText(origin + "/team"),
    ]);
    const corpus = [home, about, team].filter(Boolean).join("\n\n---\n\n").slice(0, 16000);
    if (!corpus) throw new Error("Could not fetch website content. Check the URL.");

    const system = `You extract structured company info from raw website text. Return ONLY JSON matching the schema. Use null/omit when unknown. Never invent.`;
    const user = `Source URL: ${base}\n\nAllowed companyType: ${COMPANY_TYPES.join(", ")}\nAllowed investmentStage: ${STAGES.join(", ")}\nAllowed industries (pick 1-3 best matches): ${INDUSTRIES.join(", ")}\n\nText:\n${corpus}\n\nReturn JSON with keys: startupName, companyType, yearFounded (number), email, headquarters (country), city, linkedinUrl, shortDescription (<=300 chars), longDescription (<=1500 chars), industries (string[]), productTags (string[] <=5), marketTags (string[] <=5), investmentStage, founders (array of {full_name, position, linkedin_url, bio}).`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("Auto Enrich rate-limited. Try again shortly.");
      if (res.status === 402) throw new Error("Auto Enrich credits exhausted.");
      throw new Error(`Auto Enrich failed (${res.status}): ${txt.slice(0, 200)}`);
    }
    const json = await res.json();
    const content: string = json?.choices?.[0]?.message?.content ?? "{}";
    let parsed: EnrichResult = {};
    try { parsed = JSON.parse(content); } catch { parsed = {}; }
    return parsed;
  });
