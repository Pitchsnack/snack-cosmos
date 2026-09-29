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

// ------------------------------------------------- activity profile (anonymous)

const MAKER_RE = /manufact|packag|factory|production|producer|industrial|textile|chemical|plastic|food|beverage|electronic|furniture|garment|steel|paper|print/i;
const TRADE_RE = /distribut|wholesal|trading|import|export|supply|retail/i;
const SERVICE_RE = /service|consult|software|platform|logistic|agency|clinic|education|maintenance|hospitality|tourism|repair|marketing/i;
const ROLE_WORD = /(manufacturer|producer|supplier|distributor|provider|operator|services|business|company|group)$/i;

const CUSTOMER_RE = /\b(b2b|b2c|oem|odm|wholesale|retail|e-?commerce|export|distributors?|corporate)\b/i;
const GEO_RE = /\b(thailand|thai|asean|southeast asia|asia|domestic|international|global|export)\b/i;

export interface ActivityProfile {
  /** "Packaging Manufacturer" — never the company's own name. */
  noun: string;
  /** "Packaging" — the single core word used in code names. */
  core: string;
  role: "Manufacturer" | "Distributor" | "Provider" | "Business";
  verb: string;
  products: string[];
  markets: string[];
  customerTypes: string[];
  geo: string | null;
  certs: string[];
  decade: string | null;
  employees: string | null;
  revenue: string | null;
}

export function activityProfile(s: ListingSource): ActivityProfile {
  const terms = listingTerms(s);
  const products = cleanTags(s.product_tags, terms);
  const markets = cleanTags(s.market_tags, terms);
  const industries = cleanTags(s.industry, terms);
  const sector = (s.sector ?? "").trim();
  const base = (products[0] || industries[0] || sector || "Established").trim();
  const hay = [base, sector, s.business_model ?? "", industries.join(" "), products.join(" ")].join(" ");

  const role: ActivityProfile["role"] = MAKER_RE.test(hay)
    ? "Manufacturer"
    : TRADE_RE.test(hay)
      ? "Distributor"
      : SERVICE_RE.test(hay)
        ? "Provider"
        : "Business";
  const verb = role === "Manufacturer" ? "manufactures" : role === "Distributor" ? "supplies" : role === "Provider" ? "provides" : "operates in";

  const phrase = titleCase(base.split(/[,/&]| and /i)[0].trim().split(/\s+/).slice(0, 2).join(" "));
  const noun = ROLE_WORD.test(phrase) ? phrase : titleCase(`${phrase} ${role}`);

  // The code name uses the category noun (Packaging), not a leading adjective (Flexible).
  const words = phrase.split(/\s+/);
  const core = titleCase(
    (industries[0] || sector || words[words.length - 1] || "Business").split(/[,/&]| and /i)[0].trim().split(/\s+/).slice(-1)[0],
  );

  const geoTag = markets.find((m) => GEO_RE.test(m));
  const geo = provinceOnly(s.city, s.headquarters) || geoTag || s.headquarters || null;

  return {
    noun,
    core,
    role,
    verb,
    products: products.slice(0, 4),
    markets,
    customerTypes: markets.filter((m) => CUSTOMER_RE.test(m)).slice(0, 3),
    geo,
    certs: certificationsOf(s).slice(0, 4),
    decade: decadeLabel(s.year_founded),
    employees: employeesBand(s.company_size),
    revenue: revenueBand(s.last_year_revenue),
  };
}

const GEO_ADJ = (geo: string | null) =>
  !geo ? "" : /thai/i.test(geo) ? "Thai" : /asean|southeast/i.test(geo) ? "ASEAN" : titleCase(geo.split(",")[0].trim());

/** Sector-true, anonymous deal code names — e.g. "Project Thai Packaging". */
export function suggestCodeNames(s: ListingSource): string[] {
  const a = activityProfile(s);
  const terms = listingTerms(s);
  const geo = GEO_ADJ(a.geo);
  const qualifier = a.certs.length ? "Certified" : a.customerTypes[0] ? titleCase(a.customerTypes[0]) : "Industrial";
  const family = a.role === "Manufacturer" ? "Industries" : a.role === "Distributor" ? "Trading" : a.role === "Provider" ? "Services" : "Group";
  const out = [
    geo && `${geo} ${a.core}`,
    `${a.core} ${a.role}`,
    `${qualifier} ${a.core}`,
    `${a.core} ${family}`,
  ]
    .filter(Boolean)
    .map((x) => `Project ${titleCase(String(x)).replace(/\s{2,}/g, " ").trim()}`)
    .filter((x) => findTermsIn(x, terms).length === 0);
  return [...new Set(out)];
}

export function suggestCodeNameFor(s: ListingSource, index = 0): string {
  const list = suggestCodeNames(s);
  return list.length ? list[index % list.length] : "Project Confidential Business";
}

/** Descriptive, anonymous headline built from the business profile. */
export function suggestHeadline(s: ListingSource) {
  const a = activityProfile(s);
  const credential = a.certs.some((c) => /^ISO/i.test(c))
    ? "ISO-Certified"
    : a.certs.length
      ? "Licensed"
      : s.year_founded && new Date().getFullYear() - s.year_founded >= 10
        ? "Established"
        : "";
  const geo = GEO_ADJ(a.geo);
  const audience = a.customerTypes[0] ? `Serving ${titleCase(a.customerTypes[0])} Clients` : "";
  const parts = [credential, geo && !new RegExp(geo, "i").test(a.noun) ? geo : "", a.noun].filter(Boolean).join(" ");
  const full = [parts, audience].filter(Boolean).join(" ");
  const h = titleCase(full || "Established Business");
  return h.length > HEADLINE_MAX ? titleCase(parts).slice(0, HEADLINE_MAX).trimEnd() : h;
}

/** A brand-new anonymous description written from the profile, never from the company's own text. */
export function suggestBusinessDescription(s: ListingSource) {
  const a = activityProfile(s);
  const terms = listingTerms(s);
  const where = a.geo ? ` based in ${a.geo}` : "";
  const since = a.decade ? `, operating since the ${a.decade}` : "";
  const sentences: string[] = [`A ${a.noun.toLowerCase()}${where}${since}.`];
  if (a.products.length) sentences.push(`The business ${a.verb} ${listOf(a.products.map(lower))}.`);
  const buyers = a.markets.filter((m) => !GEO_RE.test(m)).slice(0, 3).map(lower);
  const reach = a.markets.filter((m) => GEO_RE.test(m)).slice(0, 2).map(lower);
  if (buyers.length || reach.length) {
    sentences.push(
      [
        buyers.length ? `It serves ${listOf(buyers)} customers` : "It sells",
        reach.length ? ` across ${listOf(reach)} markets` : "",
      ].join("") + ".",
    );
  }
  if (a.certs.length) sentences.push(`Operations hold ${listOf(a.certs)}.`);
  const scale = [a.employees, a.revenue ? `annual revenue of ${a.revenue}` : null].filter(Boolean);
  if (scale.length) sentences.push(`The company reports ${listOf(scale as string[])}.`);

  let out = "";
  for (const raw of sentences) {
    let t = raw;
    for (const h of [...findTermsIn(t, terms)].reverse()) t = t.slice(0, h.start) + t.slice(h.end);
    t = t.replace(/\s{2,}/g, " ").replace(/\s+\./g, ".").trim();
    if (!t || t === ".") continue;
    const next = out ? `${out} ${t}` : t;
    if (next.length > DESCRIPTION_MAX) break;
    out = next;
  }
  return out;
}

function listOf(items: string[]) {
  const v = items.map((x) => x.trim()).filter(Boolean);
  if (v.length <= 1) return v[0] ?? "";
  return `${v.slice(0, -1).join(", ")} and ${v[v.length - 1]}`;
}

/** Lower-cases a tag unless it is an acronym or a proper place/standard name. */
function lower(t: string) {
  return t
    .split(" ")
    .map((w) => (w.length <= 4 && w === w.toUpperCase() ? w : /^(thailand|asean|asia|europe|japan|china)$/i.test(w) ? w : w.toLowerCase()))
    .join(" ");
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
    description: p?.description?.trim() || suggestBusinessDescription(s) || suggestDescription(s.long_description || s.short_description, terms),
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
    // Public image is set by Admin and only shows once a version has been approved.
    coverImage: p?.live ? p?.cover_image_url ?? null : null,
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
