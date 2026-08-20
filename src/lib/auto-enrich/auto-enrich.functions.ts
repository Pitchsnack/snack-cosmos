import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { parsePhoneNumberFromString, getCountryCallingCode } from "libphonenumber-js/min";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Server-side HQ diagnostic. UI/merge layer adds "skipped_already_filled" separately. */
export type HeadquartersDiagnostic =
  | "direct"
  | "inferred_from_phone"
  | "not_found"
  | "conflicting_signals";

/**
 * Diagnostic info attached to every enrichment result. Non-PII; safe to surface
 * in toasts/dev tools. Lets the UI explain "nothing happened" cases.
 */
export interface EnrichDebug {
  origin: string;
  pagesTried: { path: string; status: number | "error"; bytes: number }[];
  pagesUsed: number;
  corpusChars: number;
  modelOutputChars: number;
  headquartersDiagnostic?: HeadquartersDiagnostic;
  /** Masked country code only (e.g. "+66"). Full phone numbers are never returned. */
  headquartersPhoneCc?: string;
}

/**
 * Structured enrichment payload returned to the UI. All fields are optional —
 * the form merges only those whose target is currently empty.
 */
export interface EnrichResult {
  startupName?: string;
  registeredName?: string;
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
  _debug?: EnrichDebug;
}

const COMPANY_TYPES = ["SME", "Startup", "Corporate Enterprise"];
const STAGES = ["Pre-Seed","Seed","Series A","Series B","Series C+","Growth","IPO","Acquired","Inactive"];
const INDUSTRIES = ["FinTech","eCommerce & Marketplace","MarTech","HealthTech","Sustainability","Mobility & Logistics","DeepTech","Defense","EdTech","Gaming","PropTech","AgriTech","FMCG","Others"];

// Realistic desktop Chrome UA — many sites 403 anything containing "Bot".
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

interface FetchOutcome {
  text: string;
  status: number | "error";
  bytes: number;
}

async function fetchText(url: string, timeoutMs = 8000): Promise<FetchOutcome> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": BROWSER_UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
    });
    if (!res.ok) return { text: "", status: res.status, bytes: 0 };
    const html = await res.text();
    const stripped = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 12000);
    return { text: stripped, status: res.status, bytes: html.length };
  } catch {
    return { text: "", status: "error", bytes: 0 };
  } finally {
    clearTimeout(id);
  }
}

const CANDIDATE_PATHS = [
  "",
  "/about",
  "/about-us",
  "/company",
  "/team",
  "/our-team",
  "/contact",
  "/contact-us",
  "/imprint",
  "/impressum",
  "/legal",
];
const MIN_CORPUS_CHARS = 400;
// Below this raw-fetch corpus size we trigger the Firecrawl fallback for SPA shells.
const FIRECRAWL_FALLBACK_THRESHOLD = 500;
const FIRECRAWL_MAX_CHARS = 50_000;
const EARLY_STOP_CHARS = 6000;

/**
 * Headless-browser fallback for client-rendered (SPA) sites whose raw HTML is
 * a near-empty shell. Never throws — returns null on any failure so the
 * existing "Could not read enough text" guard can fire downstream.
 */
async function fetchViaFirecrawl(url: string, maxChars: number): Promise<string | null> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) return null;
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url, formats: ["markdown"] }),
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    const md: string = data?.data?.markdown ?? "";
    return md ? md.slice(0, maxChars) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(id);
  }
}

export const enrichStartupFromUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ websiteUrl: z.string().url() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<EnrichResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Auto Enrich is not configured (missing API key).");

    let base = data.websiteUrl.trim();
    if (!/^https?:\/\//i.test(base)) base = "https://" + base;
    const origin = (() => { try { return new URL(base).origin; } catch { return base; } })();

    // Fetch candidate pages sequentially with early stop so we can keep latency low.
    const pagesTried: EnrichDebug["pagesTried"] = [];
    const usedTexts: string[] = [];
    let total = 0;
    for (const path of CANDIDATE_PATHS) {
      const url = origin + path;
      const out = await fetchText(url);
      pagesTried.push({ path: path || "/", status: out.status, bytes: out.bytes });
      if (out.text) {
        usedTexts.push(out.text);
        total += out.text.length;
        if (total >= EARLY_STOP_CHARS) break;
      }
    }

    let corpus = usedTexts.join("\n\n---\n\n").slice(0, 16000);
    let corpusChars = corpus.length;

    // SPA fallback: raw HTML was a near-empty shell. Try Firecrawl's headless
    // browser to render the page, then continue with the same extraction pipeline.
    if (corpusChars < FIRECRAWL_FALLBACK_THRESHOLD) {
      const rendered = await fetchViaFirecrawl(base, FIRECRAWL_MAX_CHARS);
      if (rendered && rendered.length > 0) {
        const claims = (context as { claims?: Record<string, unknown> } | undefined)?.claims;
        const tenantId = (claims?.tenant_id as string | undefined) ?? null;
        const callerType: "control" | "tenant" | "unknown" =
          claims === undefined
            ? "unknown"
            : claims?.is_control
              ? "control"
              : "tenant";
        console.log(
          JSON.stringify({
            event: "firecrawl_fallback_used",
            tenant_id: tenantId,
            caller_type: callerType,
            url: base,
            bytes_returned: rendered.length,
          }),
        );
        pagesTried.push({ path: "[firecrawl]", status: 200, bytes: rendered.length });
        usedTexts.push(rendered);
        corpus = usedTexts.join("\n\n---\n\n").slice(0, 16000);
        corpusChars = corpus.length;
      }
    }

    if (corpusChars < MIN_CORPUS_CHARS) {
      const summary = pagesTried
        .map((p) => `${p.path}=${p.status}${p.bytes ? `/${p.bytes}b` : ""}`)
        .join(", ");
      throw new Error(
        `Could not read enough text from ${origin} ` +
          `(fetched ${pagesTried.length} pages, total ${corpusChars} chars; ${summary}). ` +
          `The site may block scrapers or be JS-only.`,
      );
    }


    const system = `You extract structured company info from raw website text. Return ONLY JSON matching the schema. Use null/omit when unknown. Never invent.`;
    const user = `Source URL: ${base}\n\nAllowed companyType: ${COMPANY_TYPES.join(", ")}\nAllowed investmentStage: ${STAGES.join(", ")}\nAllowed industries (pick 1-3 best matches): ${INDUSTRIES.join(", ")}\n\nField rules:\n- headquarters: country only (e.g. "Germany").\n- city: HQ city name only (e.g. "Berlin", not "Berlin, Germany"). Extract from address blocks in footers, contact pages, or imprint/impressum sections. Omit if not explicitly stated.\n\nText:\n${corpus}\n\nReturn JSON with keys: startupName, companyType, yearFounded (number), email, headquarters (country), city, linkedinUrl, shortDescription (<=300 chars), longDescription (<=1500 chars), industries (string[]), productTags (string[] <=5), marketTags (string[] <=5), investmentStage, founders (array of {full_name, position, linkedin_url, bio}).`;

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

    // HQ country diagnostic + phone country-code fallback.
    // Empty-field-only merge happens in the UI; the server just reports what it found.
    let hqDiagnostic: HeadquartersDiagnostic;
    let hqPhoneCc: string | undefined;
    const directCountry =
      typeof parsed.headquarters === "string" ? parsed.headquarters.trim() : "";
    if (directCountry) {
      hqDiagnostic = "direct";
    } else {
      // Scan the already-collected same-origin corpus for international phone numbers.
      // No new fetches, no off-domain requests — reuses the bounded corpus.
      const matches = corpus.match(/\+\d[\d\s().\-]{6,}\d/g) ?? [];
      const countries = new Set<string>();
      for (const raw of matches.slice(0, 30)) {
        const pn = parsePhoneNumberFromString(raw.replace(/\s+/g, " ").trim());
        if (pn && pn.isValid() && pn.country) countries.add(pn.country);
      }
      if (countries.size === 1) {
        const iso2 = [...countries][0];
        try {
          const name = new Intl.DisplayNames(["en"], { type: "region" }).of(iso2);
          if (name) {
            parsed.headquarters = name;
            hqPhoneCc = `+${getCountryCallingCode(iso2 as Parameters<typeof getCountryCallingCode>[0])}`;
            hqDiagnostic = "inferred_from_phone";
          } else {
            hqDiagnostic = "not_found";
          }
        } catch {
          hqDiagnostic = "not_found";
        }
      } else if (countries.size > 1) {
        hqDiagnostic = "conflicting_signals";
      } else {
        hqDiagnostic = "not_found";
      }
    }

    parsed._debug = {
      origin,
      pagesTried,
      pagesUsed: usedTexts.length,
      corpusChars,
      modelOutputChars: content.length,
      headquartersDiagnostic: hqDiagnostic,
      headquartersPhoneCc: hqPhoneCc,
    };
    return parsed;
  });
