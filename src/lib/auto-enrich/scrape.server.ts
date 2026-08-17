/**
 * Shared Auto Enrich scraping helpers (server-only).
 *
 * Mirrors the extraction pipeline used by the Startup Auto Enrich server
 * function: multi-page same-origin fetch with early stop, Firecrawl headless
 * fallback for SPA shells, and phone-country-code HQ inference.
 */
import { parsePhoneNumberFromString, getCountryCallingCode } from "libphonenumber-js/min";
import type { EnrichDebugBase, HeadquartersDiagnostic } from "./scrape.server-types";

export type { EnrichDebugBase, HeadquartersDiagnostic };

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export const CANDIDATE_PATHS = [
  "",
  "/about",
  "/about-us",
  "/company",
  "/team",
  "/our-team",
  "/portfolio",
  "/contact",
  "/contact-us",
  "/imprint",
  "/impressum",
  "/legal",
];

export const MIN_CORPUS_CHARS = 400;
const FIRECRAWL_FALLBACK_THRESHOLD = 500;
const FIRECRAWL_MAX_CHARS = 50_000;
const EARLY_STOP_CHARS = 6000;

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
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
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

async function fetchViaFirecrawl(url: string, maxChars: number): Promise<string | null> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) return null;
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
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

export interface Corpus {
  base: string;
  origin: string;
  corpus: string;
  corpusChars: number;
  pagesTried: EnrichDebugBase["pagesTried"];
  pagesUsed: number;
}

/** Fetch a bounded text corpus for a website. Throws when too little text. */
export async function buildCorpus(websiteUrl: string): Promise<Corpus> {
  let base = websiteUrl.trim();
  if (!/^https?:\/\//i.test(base)) base = "https://" + base;
  const origin = (() => {
    try {
      return new URL(base).origin;
    } catch {
      return base;
    }
  })();

  const pagesTried: EnrichDebugBase["pagesTried"] = [];
  const usedTexts: string[] = [];
  let total = 0;
  for (const path of CANDIDATE_PATHS) {
    const out = await fetchText(origin + path);
    pagesTried.push({ path: path || "/", status: out.status, bytes: out.bytes });
    if (out.text) {
      usedTexts.push(out.text);
      total += out.text.length;
      if (total >= EARLY_STOP_CHARS) break;
    }
  }

  let corpus = usedTexts.join("\n\n---\n\n").slice(0, 16000);
  if (corpus.length < FIRECRAWL_FALLBACK_THRESHOLD) {
    const rendered = await fetchViaFirecrawl(base, FIRECRAWL_MAX_CHARS);
    if (rendered) {
      pagesTried.push({ path: "[firecrawl]", status: 200, bytes: rendered.length });
      usedTexts.push(rendered);
      corpus = usedTexts.join("\n\n---\n\n").slice(0, 16000);
    }
  }

  if (corpus.length < MIN_CORPUS_CHARS) {
    const summary = pagesTried
      .map((p) => `${p.path}=${p.status}${p.bytes ? `/${p.bytes}b` : ""}`)
      .join(", ");
    throw new Error(
      `Could not read enough text from ${origin} ` +
        `(fetched ${pagesTried.length} pages, total ${corpus.length} chars; ${summary}). ` +
        `The site may block scrapers or be JS-only.`,
    );
  }

  return {
    base,
    origin,
    corpus,
    corpusChars: corpus.length,
    pagesTried,
    pagesUsed: usedTexts.length,
  };
}

/** Same HQ inference used by Startup Auto Enrich. */
export function inferHeadquarters(
  corpus: string,
  directCountry: string,
): { country?: string; diagnostic: HeadquartersDiagnostic; phoneCc?: string } {
  if (directCountry.trim()) return { country: directCountry.trim(), diagnostic: "direct" };
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
        return {
          country: name,
          diagnostic: "inferred_from_phone",
          phoneCc: `+${getCountryCallingCode(iso2 as Parameters<typeof getCountryCallingCode>[0])}`,
        };
      }
    } catch {
      /* fall through */
    }
    return { diagnostic: "not_found" };
  }
  if (countries.size > 1) return { diagnostic: "conflicting_signals" };
  return { diagnostic: "not_found" };
}

/** Call Lovable AI Gateway for JSON extraction. */
export async function extractJson(system: string, user: string): Promise<{ content: string }> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("Auto Enrich is not configured (missing API key).");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
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
  return { content: json?.choices?.[0]?.message?.content ?? "{}" };
}
