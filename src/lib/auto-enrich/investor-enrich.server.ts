/**
 * Investor Auto Enrich — prompt construction, parsing and taxonomy validation.
 * Mirrors the PitchSnack1 Admin → Edit Investor → Auto Enrich behaviour.
 */
import type { EnrichInvestorResult } from "./investor-enrich-types";

export const INVESTOR_CLASSIFICATIONS = [
  "Angel",
  "Venture Capital",
  "Private Equity",
  "Corporate VC",
  "Family Office",
  "Corporate Enterprise",
  "Sovereign Fund",
  "Incubator/Accelerator",
];
export const AUM_VALUES = ["50M-100M", "100M-250M", "250M-500M", "500M+"];
export const TICKET_VALUES = ["50K-100K", "100K-500K", "500K-1M", "1M-5M", "5M+"];
export const STAGES = ["Ideation", "Early Stage", "Growth Stage", "Maturity Stage"];
export const INDUSTRIES = [
  "Sector Agnostic",
  "FinTech",
  "eCommerce & Marketplace",
  "MarTech",
  "HealthTech",
  "Sustainability",
  "Mobility & Logistics",
  "DeepTech",
  "Defense",
  "EdTech",
  "Gaming",
  "PropTech",
  "AgriTech",
  "FMCG",
  "Others",
];

export function buildInvestorPrompt(base: string, corpus: string) {
  const system =
    "You extract structured investor / investment firm info from raw website text. " +
    "Return ONLY JSON matching the schema. Use null or omit when unknown. Never invent.";
  const user = `Source URL: ${base}

Allowed investorType: ${INVESTOR_CLASSIFICATIONS.join(", ")}
Allowed aum: ${AUM_VALUES.join(", ")}
Allowed minTicketSize / maxTicketSize: ${TICKET_VALUES.join(", ")}
Allowed preferredStages: ${STAGES.join(", ")}
Allowed preferredIndustries (pick up to 5 best matches): ${INDUSTRIES.join(", ")}

Field rules:
- investorName: the investing organisation's public name.
- firmName: legal/parent firm name if it differs from investorName, else omit.
- headquarters: country only (e.g. "Germany").
- city: HQ city name only (e.g. "Berlin", not "Berlin, Germany"). Take it from footers, contact pages or imprint blocks.
- businessAddress: full single-line street address if explicitly stated.
- investmentFocus: geographies (countries or regions) the investor invests in, max 10.
- keywords: up to 5 short product/service tags describing what the firm does.
- aum / ticket sizes: only pick a bucket when the site states figures that clearly fall in it.

Text:
${corpus}

Return JSON with keys: investorName, firmName, investorType, yearFounded (number), email, headquarters (country), city, businessAddress, linkedinUrl, bio (<=1500 chars), keywords (string[] <=5), preferredStages (string[]), preferredIndustries (string[] <=5), investmentFocus (string[] <=10), aum, minTicketSize, maxTicketSize.`;
  return { system, user };
}

const str = (v: unknown, max = 2000): string | undefined => {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  return s ? s.slice(0, max) : undefined;
};

const oneOf = (v: unknown, allowed: string[]): string | undefined => {
  const s = str(v);
  if (!s) return undefined;
  return allowed.find((a) => a.toLowerCase() === s.toLowerCase());
};

const listOf = (v: unknown, allowed: string[] | null, max: number): string[] | undefined => {
  if (!Array.isArray(v)) return undefined;
  const out: string[] = [];
  for (const raw of v) {
    const s = str(raw, 60);
    if (!s) continue;
    const value = allowed ? allowed.find((a) => a.toLowerCase() === s.toLowerCase()) : s;
    if (value && !out.includes(value)) out.push(value);
    if (out.length >= max) break;
  }
  return out.length ? out : undefined;
};

const url = (v: unknown): string | undefined => {
  const s = str(v, 500);
  if (!s) return undefined;
  const withScheme = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    return new URL(withScheme).toString();
  } catch {
    return undefined;
  }
};

const email = (v: unknown): string | undefined => {
  const s = str(v, 255);
  return s && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s.toLowerCase() : undefined;
};

const year = (v: unknown): number | undefined => {
  const n = typeof v === "number" ? v : Number(str(v) ?? NaN);
  return Number.isInteger(n) && n >= 1800 && n <= new Date().getFullYear() ? n : undefined;
};

/** Validate + coerce raw model JSON into the frozen investor result shape. */
export function normalizeInvestorResult(raw: unknown): EnrichInvestorResult {
  const r = (raw ?? {}) as Record<string, unknown>;
  const out: EnrichInvestorResult = {
    investorName: str(r.investorName, 100),
    firmName: str(r.firmName, 100),
    investorType: oneOf(r.investorType, INVESTOR_CLASSIFICATIONS),
    yearFounded: year(r.yearFounded),
    email: email(r.email),
    headquarters: str(r.headquarters, 100),
    city: str(r.city, 100),
    businessAddress: str(r.businessAddress, 500),
    linkedinUrl: url(r.linkedinUrl),
    bio: str(r.bio, 2000),
    keywords: listOf(r.keywords, null, 5),
    preferredStages: listOf(r.preferredStages, STAGES, STAGES.length),
    preferredIndustries: listOf(r.preferredIndustries, INDUSTRIES, 5),
    investmentFocus: listOf(r.investmentFocus, null, 10),
    aum: oneOf(r.aum, AUM_VALUES),
    minTicketSize: oneOf(r.minTicketSize, TICKET_VALUES),
    maxTicketSize: oneOf(r.maxTicketSize, TICKET_VALUES),
  };
  for (const k of Object.keys(out) as (keyof EnrichInvestorResult)[]) {
    if (out[k] === undefined) delete out[k];
  }
  return out;
}
