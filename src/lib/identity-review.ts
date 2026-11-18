/** Browser-safe identity-review rules. Only Admin server functions return findings. */
export type IdentityReviewKind = "seller" | "buyer";
export type IdentityReviewValues = Record<string, string>;
export type IdentityReviewFacts = {
  companyNames?: (string | null | undefined)[];
  websites?: (string | null | undefined)[];
  founders?: (string | null | undefined)[];
  districts?: (string | null | undefined)[];
  streets?: (string | null | undefined)[];
  provinces?: (string | null | undefined)[];
};
export type IdentityReason = "Company name" | "District or street address" | "Website" | "Owner or director name";
export type IdentityFinding = {
  id: string;
  field: string;
  label: string;
  reason: IdentityReason;
  term: string;
  start: number;
  end: number;
  replacement: string;
  suggestion: string;
};
export type IdentityReviewResult = {
  kind: IdentityReviewKind;
  itemId: string;
  version: number;
  fields: IdentityReviewValues;
  originalFields: IdentityReviewValues;
  findings: IdentityFinding[];
  originalFindings: IdentityFinding[];
  fixed: IdentityFinding[];
};

const LIST_FIELDS: [string, string][] = [
  ["code_name", "Listing name"], ["suggested_listing_name", "Suggested listing name"],
  ["headline", "Headline"], ["headline_th", "Headline (Thai)"],
  ["short_description", "Short description"], ["short_description_th", "Short description (Thai)"],
  ["customers_summary", "Customer profile"], ["customers_summary_th", "Customer profile (Thai)"],
];
const ARRAY_FIELDS: [string, string][] = [
  ["highlights", "Key business strengths"], ["highlights_th", "Key business strengths (Thai)"],
  ["product_tags", "Product & Service Tags"], ["product_tags_th", "Product & Service Tags (Thai)"],
  ["market_tags", "Market Tags"], ["market_tags_th", "Market Tags (Thai)"],
];
const text = (v: unknown) => typeof v === "string" ? v : v == null ? "" : String(v);
const list = (v: unknown): string[] => Array.isArray(v) ? v.filter(x => typeof x === "string") : [];

export function sellerIdentityValues(hp: any, startup: any): IdentityReviewValues {
  const draft = hp?.review_draft && typeof hp.review_draft === "object" ? hp.review_draft : {};
  const effective = { ...hp, code_name: text(draft.name) || hp?.code_name, headline: text(draft.headline) || hp?.published_headline || hp?.headline, headline_th: text(draft.headlineTh) || hp?.published_headline_th || hp?.headline_th };
  const out: IdentityReviewValues = {};
  for (const [key, label] of LIST_FIELDS) {
    const source = key.startsWith("short_") ? startup : effective;
    out[key] = text(source?.[key]);
    out[`${key}__label`] = label;
  }
  for (const [key, label] of ARRAY_FIELDS) {
    const source = key.includes("tags") ? startup : effective;
    list(source?.[key]).forEach((value, index) => {
      out[`${key}.${index}`] = value;
      out[`${key}.${index}__label`] = `${label} · ${index + 1}`;
    });
  }
  return out;
}

export function buyerIdentityValues(profile: any): IdentityReviewValues {
  return {
    description: text(profile?.description), description__label: "Description",
    description_th: text(profile?.description_th), description_th__label: "Description (Thai)",
  };
}

export function sellerIdentityFacts(startup: any, founders: any[] = [], _hp: any = {}): IdentityReviewFacts {
  return {
    companyNames: [startup?.startup_name, startup?.registered_name, startup?.startup_name_th, startup?.registered_name_th],
    websites: [startup?.website_url], founders: founders.map(f => f?.full_name),
    districts: [startup?.address_city_district], streets: [startup?.address_line1],
    provinces: [startup?.address_province_state, startup?.city],
  };
}

export function buyerIdentityFacts(profile: any, investor: any): IdentityReviewFacts {
  return {
    companyNames: [investor?.investor_name, investor?.investor_name_th, profile?.legal_name],
    websites: [investor?.website_url], founders: (profile?.people ?? []).map((p: any) => p?.name),
    districts: [investor?.address_city_district], streets: [investor?.address_line1],
    provinces: [investor?.address_province_state],
  };
}

const LEGAL = /(?:\b(?:co\.?|company|ltd\.?|limited|inc\.?|incorporated|corp\.?|corporation|plc\.?|pcl\.?|llc|llp|gmbh|pte\.?|sdn\.?|bhd\.?|jsc|jsc\.?|holdings?|group)\b|บริษัท|จำกัด|มหาชน|\(มหาชน\))/giu;
const LOCATION = /(?:\b(?:thailand|bangkok|nonthaburi|pathum\s*thani|samut\s*prakan|chonburi|phuket|chiang\s*mai)\b|ประเทศไทย|ไทย|กรุงเทพมหานคร|นนทบุรี)/giu;
const STOP = new Set(("the and for with from this that our your their its his her are was were will can could would should about into under over after before company companies group holding holdings limited corp corporation incorporated thailand thai bangkok nonthaburi international global services service solutions solution business businesses investment investments capital partners partner ventures venture enterprise enterprises management consulting consult technology technologies logistics industry industries market markets customer customers founder founders team teams revenue employees employee textile textiles manufacturer manufacturing").split(" "));
const clean = (value: unknown) => text(value).trim();
const useful = (value: string, min = 4) => value.trim().length >= min && !STOP.has(value.trim().toLowerCase());
const domainOf = (value: unknown) => clean(value).replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[/?#]/)[0].toLowerCase();
function companyVariants(value: unknown): string[] {
  const original = clean(value);
  if (!original) return [];
  const stripped = original.replace(LEGAL, " ").replace(/[.,()]/g, " ").replace(/\s+/g, " ").trim();
  const withoutPlace = stripped.replace(LOCATION, " ").replace(/\s+/g, " ").trim();
  const words = withoutPlace.split(/\s+/).filter(w => useful(w, 4));
  return [withoutPlace, stripped, original, ...words].filter(v => useful(v, /[\u0E00-\u0E7F]/.test(v) ? 3 : 4));
}
function add(out: Map<string, { term: string; reason: IdentityReason; replacement: string; suggestion: string }>, value: unknown, reason: IdentityReason, replacement: string, suggestion: string, min = 4) {
  const term = clean(value);
  if (!useful(term, min)) return;
  const key = `${reason}|${term.toLowerCase()}`;
  if (!out.has(key)) out.set(key, { term, reason, replacement, suggestion });
}
function candidates(facts: IdentityReviewFacts) {
  const out = new Map<string, { term: string; reason: IdentityReason; replacement: string; suggestion: string }>();
  for (const name of facts.companyNames ?? []) for (const v of companyVariants(name)) add(out, v, "Company name", "the company", "Change to \"the company\"", /[\u0E00-\u0E7F]/.test(v) ? 3 : 4);
  for (const site of facts.websites ?? []) {
    const full = clean(site); if (full) add(out, full, "Website", "", "Remove it", 4);
    const domain = domainOf(site); if (domain.includes(".")) {
      add(out, domain, "Website", "", "Remove it", 4);
      add(out, `www.${domain}`, "Website", "", "Remove it", 4);
    }
  }
  for (const name of facts.founders ?? []) add(out, name, "Owner or director name", "the owner", "Change to \"the owner\"", 5);
  for (const name of facts.districts ?? []) add(out, name, "District or street address", "", "Remove it", 3);
  for (const name of facts.streets ?? []) add(out, name, "District or street address", "", "Remove it", 6);
  return [...out.values()];
}
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function matcher(term: string) {
  const latin = /^[\x00-\x7F]+$/.test(term);
  return new RegExp(latin ? `(?<![A-Za-z0-9])${escape(term)}(?![A-Za-z0-9])` : escape(term), "giu");
}
function labelOf(values: IdentityReviewValues, field: string) {
  return values[`${field}__label`] ?? field.replaceAll("_", " ").replace(/\.\d+$/, "");
}
function idOf(field: string, reason: IdentityReason, start: number, end: number, term: string) {
  return `${field}|${reason}|${start}|${end}|${term}`;
}

function replacementFor(reason: IdentityReason, value: string, start: number, end: number, field: string, values: IdentityReviewValues, facts: IdentityReviewFacts) {
  if (reason === "District or street address") {
    const province = clean(facts.provinces?.find(p => clean(p)));
    if (!province) return "";
    const nearby = `${value.slice(Math.max(0, start - province.length - 4), start)} ${value.slice(end, end + province.length + 4)}`.toLowerCase();
    const base = field.match(/^(.*)\.\d+$/)?.[1];
    const provinceTag = base && Object.entries(values).some(([key, text]) => key !== field && key.startsWith(`${base}.`) && clean(text).toLowerCase() === province.toLowerCase());
    return nearby.includes(province.toLowerCase()) || provinceTag ? "" : province;
  }
  if (reason === "Company name" || reason === "Owner or director name") {
    const thai = /[\u0E00-\u0E7F]/.test(value.slice(start, end)) || field.endsWith("_th");
    if (thai) return reason === "Company name" ? "บริษัท" : "เจ้าของ";
    const possessive = reason === "Company name" && /['’]s$/.test(value.slice(start, end));
    const sentenceStart = !value.slice(0, start).trim() || /[.!?]\s*$/.test(value.slice(0, start));
    const word = reason === "Company name" ? possessive ? "the company's" : "the company" : "the owner";
    return sentenceStart && !possessive ? `${word[0].toUpperCase()}${word.slice(1)}` : word;
  }
  return "";
}

export function scanIdentityReview(values: IdentityReviewValues, facts: IdentityReviewFacts): IdentityFinding[] {
  const findings: IdentityFinding[] = [];
  for (const [field, value] of Object.entries(values)) {
    if (field.endsWith("__label") || !value) continue;
    const occupied: [number, number][] = [];
    const terms = candidates(facts).sort((a, b) => b.term.length - a.term.length);
    for (const candidate of terms) {
      for (const match of value.matchAll(matcher(candidate.term))) {
        const start = match.index ?? 0;
        let end = start + match[0].length;
        if (candidate.reason === "Company name" && /^['’]s/.test(value.slice(end, end + 2))) end += 2;
        if (occupied.some(([a, b]) => start < b && end > a)) continue;
        occupied.push([start, end]);
        const term = value.slice(start, end);
        const replacement = replacementFor(candidate.reason, value, start, end, field, values, facts);
        const suggestion = replacement ? `Change to "${replacement}"` : "Remove it";
        findings.push({ id: idOf(field, candidate.reason, start, end, term), field, label: labelOf(values, field), reason: candidate.reason, term, start, end, replacement, suggestion });
      }
    }
    for (const match of value.matchAll(/(?:https?:\/\/|www\.)\S+/giu)) {
      const start = match.index ?? 0, end = start + match[0].length;
      if (occupied.some(([a, b]) => start < b && end > a)) continue;
      occupied.push([start, end]);
      findings.push({ id: idOf(field, "Website", start, end, match[0]), field, label: labelOf(values, field), reason: "Website", term: match[0], start, end, replacement: "", suggestion: "Remove it" });
    }
  }
  return findings.sort((a, b) => a.field.localeCompare(b.field) || a.start - b.start || a.reason.localeCompare(b.reason));
}

export function identityFindingKey(f: IdentityFinding) {
  return `${f.field}|${f.reason}|${f.term.toLowerCase()}`;
}
export function fixedIdentityFindings(original: IdentityFinding[], current: IdentityFinding[]) {
  const remaining = new Map<string, number>();
  for (const f of current) remaining.set(identityFindingKey(f), (remaining.get(identityFindingKey(f)) ?? 0) + 1);
  return original.filter(f => {
    const key = identityFindingKey(f), count = remaining.get(key) ?? 0;
    if (count > 0) { remaining.set(key, count - 1); return false; }
    return true;
  });
}
function tidyReplacement(value: string) {
  return value.replace(/[ \t]{2,}/g, " ").replace(/ +([,.;:!?])/g, "$1").replace(/\( +/g, "(").replace(/ +\)/g, ")").trim();
}
/** Apply only the flagged field. A custom value is the Admin's whole-field edit. */
export function applyIdentityFinding(values: IdentityReviewValues, finding: IdentityFinding, customValue?: string): IdentityReviewValues {
  const current = values[finding.field];
  if (current === undefined || current.slice(finding.start, finding.end) !== finding.term) throw new Error("This wording changed. Reload the review and try again.");
  const next = customValue !== undefined ? customValue : tidyReplacement(`${current.slice(0, finding.start)}${finding.replacement}${current.slice(finding.end)}`);
  return { ...values, [finding.field]: next };
}
export function publicIdentityValues(values: IdentityReviewValues) {
  return Object.fromEntries(Object.entries(values).filter(([key]) => !key.endsWith("__label")));
}
