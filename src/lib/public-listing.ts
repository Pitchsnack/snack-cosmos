/**
 * Public view (Marketplace listing) — pure builders shared by the seller
 * preview and the server's buyer read model. Everything is derived from the
 * wizard answers / private view; only the headline is written by the seller.
 */
import { findTermsIn, identityTerms, type EntryFacts } from "@/lib/hidden-profile";

export interface ListingSource {
  startup_name: string;
  registered_name?: string | null;
  website_url?: string | null;
  email?: string | null;
  city?: string | null;
  headquarters?: string | null;
  company_type?: string | null;
  year_founded?: number | null;
  company_size?: string | null;
  last_year_revenue?: string | null;
  sector?: string | null;
  business_model?: string | null;
  industry?: string[] | null;
  product_tags?: string[] | null;
  market_tags?: string[] | null;
  long_description?: string | null;
  short_description?: string | null;
  regulatory_licenses?: { name: string }[] | null;
  iso_standards?: string[] | null;
  registered_verified?: boolean;
  people?: string[];
}

export interface PublicListing {
  headline: string;
  description: string;
  productTags: string[];
  marketTags: string[];
  revenueBand: string | null;
  location: string | null;
  typeFounded: string | null;
  employees: string | null;
  certifications: string[];
  sector: string | null;
  subSector: string | null;
  verified: boolean;
  hasFinancials: boolean;
  codeName: string;
  refNo: string;
  coverArt: string | null;
  /** Uploaded cover picture (startup-media storage path); null = sector vector art. */
  coverImage: string | null;
  live: boolean;
  publishedAt: string | null;
}

export const HEADLINE_MAX = 90;
export const DESCRIPTION_MAX = 220;

export function factsFromSource(s: ListingSource): EntryFacts {
  return {
    startup_name: s.startup_name,
    registered_name: s.registered_name,
    website_url: s.website_url,
    city: null, // province is allowed in the public view
    year_founded: s.year_founded,
    company_size: null,
    last_year_revenue: null,
    people: s.people ?? [],
    customers: [],
  };
}

export function listingTerms(s: ListingSource) {
  const t = identityTerms(factsFromSource(s));
  if (s.email) t.push({ term: s.email, reason: "Email" });
  return t;
}

/** Revenue band exactly as chosen in the wizard; never the exact figure. */
export function revenueBand(raw?: string | null): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  if (/[–-]|under|over/i.test(v)) return v;
  return null;
}

export function provinceOnly(city?: string | null, hq?: string | null) {
  const c = (city ?? "").split(",")[0].trim();
  if (c && c !== "Other province") return `${c}, Thailand`;
  return hq?.trim() || null;
}

export function decadeLabel(year?: number | null) {
  return year ? `${Math.floor(year / 10) * 10}s` : null;
}

export function employeesBand(size?: string | null) {
  const v = (size ?? "").trim();
  if (!v) return null;
  if (/more than/i.test(v)) return `${v.replace(/^more than/i, "More than")} employees`;
  return `${v.replace(/\s*-\s*/, "–")} employees`;
}

export function cleanTags(tags: string[] | null | undefined, terms: { term: string; reason: string }[]) {
  return (tags ?? []).filter((t) => t.trim() && findTermsIn(t, terms).length === 0);
}

const LEAD_VERB = /^(offers|provides|builds|develops|delivers|operates|runs|is|makes|sells|creates)\s+/i;

/** Removes company/product names and rewrites to start with "A …". */
export function suggestDescription(overview: string | null | undefined, terms: { term: string; reason: string }[]) {
  let t = (overview ?? "").trim().split(/(?<=[.!?])\s/)[0] ?? "";
  if (!t) return "";
  const hits = findTermsIn(t, terms);
  for (const h of [...hits].reverse()) t = t.slice(0, h.start) + t.slice(h.end);
  t = t.replace(/\s*,\s*,/g, ",").replace(/,\s*(enabling|that)/i, " that enables").replace(/\s{2,}/g, " ").trim();
  t = t.replace(/^[,\s]+/, "").replace(LEAD_VERB, "");
  t = t.replace(/^(a|an|the)\s+/i, "");
  if (!t) return "";
  const out = `A ${t.charAt(0).toLowerCase()}${t.slice(1)}`.replace(/\s+,/g, ",");
  return out.length > DESCRIPTION_MAX ? `${out.slice(0, DESCRIPTION_MAX - 1).trimEnd()}…` : out;
}

const titleCase = (s: string) => s.replace(/\w\S*/g, (w) => (w.length <= 3 && /^(and|of|for|the|a)$/i.test(w) ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1)));

export function suggestHeadline(s: ListingSource) {
  const terms = listingTerms(s);
  const cat = cleanTags(s.product_tags, terms)[0] ?? s.industry?.[0] ?? "";
  const sector = s.sector ?? "";
  const core = [cat, cat && sector && !cat.toLowerCase().includes(sector.toLowerCase()) ? "" : sector].filter(Boolean).join(" ") || sector || "Established Business";
  const h = titleCase(`${core} Business Opens Investment Opportunity`);
  return h.length > HEADLINE_MAX ? h.slice(0, HEADLINE_MAX).trimEnd() : h;
}

export function certificationsOf(s: ListingSource) {
  return [
    ...(s.iso_standards ?? []).map((x) => x.split(" – ")[0]),
    ...(s.regulatory_licenses ?? []).map((l) => l.name.replace(/ promotion$/i, " promoted")),
  ];
}

export function buildPublicListing(
  s: ListingSource,
  p: {
    headline?: string | null;
    description?: string | null;
    product_tags?: string[] | null;
    market_tags?: string[] | null;
    code_name?: string | null;
    ref_no?: string | null;
    cover_art?: string | null;
    cover_image_url?: string | null;
    live?: boolean;
    published_at?: string | null;
  } | null,
  hasFinancials: boolean,
): PublicListing {
  const terms = listingTerms(s);
  const typ = s.company_type?.trim() || null;
  const dec = decadeLabel(s.year_founded);
  return {
    headline: p?.headline?.trim() || "",
    description: p?.description?.trim() || suggestDescription(s.long_description || s.short_description, terms),
    productTags: cleanTags(p?.product_tags ?? s.product_tags, terms),
    marketTags: cleanTags(p?.market_tags ?? s.market_tags, terms),
    revenueBand: revenueBand(s.last_year_revenue),
    location: provinceOnly(s.city, s.headquarters),
    typeFounded: [typ, dec ? `Founded ${dec}` : null].filter(Boolean).join(" · ") || null,
    employees: employeesBand(s.company_size),
    certifications: certificationsOf(s),
    sector: s.sector ?? null,
    subSector: s.business_model ?? null,
    verified: !!s.registered_verified,
    hasFinancials,
    codeName: p?.code_name ?? "",
    refNo: p?.ref_no ?? "",
    coverArt: p?.cover_art ?? null,
    coverImage: p?.cover_image_url ?? null,
    live: !!p?.live,
    publishedAt: p?.published_at ?? null,
  };
}

/** Identity check over the public text (headline, description, tags). */
export function checkListing(l: Pick<PublicListing, "headline" | "description" | "productTags" | "marketTags">, terms: { term: string; reason: string }[]) {
  const words = new Set<string>();
  for (const t of [l.headline, l.description, ...l.productTags, ...l.marketTags]) for (const h of findTermsIn(t ?? "", terms)) words.add(h.term);
  return [...words];
}
