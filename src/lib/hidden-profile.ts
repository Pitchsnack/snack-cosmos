/**
 * Hidden profile — pure helpers shared by the browser and the server.
 * Ranges, the identity check and the publish requirements live here so the
 * editor (as you type) and the server (on publish) apply the same rules.
 */

export type HiddenStatus = "live" | "live_edited" | "draft" | "none" | "na";

export const HIDDEN_TEXT_FIELDS = [
  "code_name",
  "headline",
  "description",
  "highlights",
  "customers_summary",
  "structure",
  "reason",
  "handover",
  "process",
] as const;
export type HiddenTextField = (typeof HIDDEN_TEXT_FIELDS)[number];

export const HIDDEN_FIELD_LABEL: Record<HiddenTextField, string> = {
  code_name: "Code name",
  headline: "Headline",
  description: "Description",
  highlights: "Highlights",
  customers_summary: "Customers",
  structure: "Structure",
  reason: "Reason for sale",
  handover: "Owner handover",
  process: "Process and dates",
};

export const OPEN_TO = ["Private equity", "Family office", "Corporate"] as const;
export const DEAL_TYPES = ["Full acquisition", "Majority stake", "Minority stake", "Merger"] as const;
export const COVER_ARTS = [
  "Food & beverage",
  "Manufacturing",
  "Technology",
  "Retail",
  "Services",
  "Logistics",
  "Healthcare",
  "Media",
] as const;

/** Editable hidden-profile content (the draft). */
export interface HiddenDraft {
  code_name: string;
  cover_art: string | null;
  region: string | null;
  headline: string;
  description: string;
  highlights: string[];
  customers_summary: string;
  asking_price: number | null;
  stake_pct: number | null;
  deal_type: string | null;
  structure: string | null;
  reason: string | null;
  handover: string | null;
  process: string | null;
  open_to: string[];
  nda_approver: "seller" | "admin";
}

export interface HiddenProfileRow extends HiddenDraft {
  id: string;
  startup_id: string;
  tenant_id: string;
  ref_no: string;
  status: "draft" | "live";
  published_at: string | null;
  unpublished_at: string | null;
  live: HiddenDraft | null;
  has_unpublished_changes: boolean;
  views: number;
  ndas_approved: number;
  updated_at: string;
}

/** Facts from the full profile the identity check and ranges work from. */
export interface EntryFacts {
  startup_name: string;
  registered_name?: string | null;
  website_url?: string | null;
  city?: string | null;
  headquarters?: string | null;
  region?: string | null;
  year_founded?: number | null;
  company_size?: string | null;
  last_year_revenue?: string | null;
  company_type?: string | null;
  people?: string[];
  customers?: string[];
}

export const isStartupEntry = (companyType?: string | null) =>
  (companyType ?? "").trim().toLowerCase() === "startup";

export function hiddenStatusOf(
  row: Pick<HiddenProfileRow, "status" | "has_unpublished_changes"> | null | undefined,
  companyType?: string | null,
): HiddenStatus {
  if (isStartupEntry(companyType)) return "na";
  if (!row) return "none";
  if (row.status === "live") return row.has_unpublished_changes ? "live_edited" : "live";
  return "draft";
}

export const STATUS_LABEL: Record<HiddenStatus, string> = {
  live: "Live",
  live_edited: "Live · edited",
  draft: "Draft",
  none: "None",
  na: "N/A",
};

// ---------------------------------------------------------------- ranges

function parseNumber(raw?: string | null): number | null {
  if (!raw) return null;
  const s = String(raw).replace(/[,฿\s]/g, "").toUpperCase();
  const m = s.match(/(-?\d+(?:\.\d+)?)(B|M|K)?/);
  if (!m) return null;
  let n = Number(m[1]);
  if (m[2] === "B") n *= 1e9;
  else if (m[2] === "M") n *= 1e6;
  else if (m[2] === "K") n *= 1e3;
  return Number.isFinite(n) ? n : null;
}

export function decadeOf(year?: number | null) {
  if (!year) return null;
  return `The ${Math.floor(year / 10) * 10}s`;
}

const STAFF_BANDS: [number, number][] = [
  [1, 10], [11, 50], [51, 200], [201, 500], [501, 1000], [1001, 5000],
];
export function staffRange(size?: string | null) {
  const n = parseNumber(size);
  if (n == null) return size && /\d+\s*[-–]\s*\d+/.test(size) ? size : null;
  for (const [a, b] of STAFF_BANDS) if (n >= a && n <= b) return `${a}–${b}`;
  return "5000+";
}

export function moneyRange(raw?: string | null) {
  const n = parseNumber(raw);
  if (n == null || n <= 0) return null;
  const m = n / 1e6;
  const step = m >= 100 ? 50 : m >= 20 ? 10 : m >= 5 ? 5 : 1;
  const lo = Math.floor(m / step) * step;
  return `฿${lo}–${lo + step}M`;
}

export function aboutPct(pct?: number | null) {
  if (pct == null || !Number.isFinite(pct)) return null;
  return `about ${Math.round(pct / 5) * 5}%`;
}

export function exactMoney(raw?: string | null) {
  const n = parseNumber(raw);
  return n == null ? null : `฿${(n / 1e6).toFixed(1)}M`;
}

const PROVINCE_REGION: Record<string, string> = {
  bangkok: "Central Thailand",
  "nakhon pathom": "Central Thailand",
  nonthaburi: "Central Thailand",
  "samut prakan": "Central Thailand",
  "pathum thani": "Central Thailand",
  ayutthaya: "Central Thailand",
  "chiang mai": "Northern Thailand",
  "chiang rai": "Northern Thailand",
  "khon kaen": "Northeastern Thailand",
  "nakhon ratchasima": "Northeastern Thailand",
  phuket: "Southern Thailand",
  songkhla: "Southern Thailand",
  chonburi: "Eastern Thailand",
  rayong: "Eastern Thailand",
  jakarta: "Java, Indonesia",
  "jakarta selatan": "Java, Indonesia",
  singapore: "Southeast Asia",
};

export function suggestRegion(f: Pick<EntryFacts, "city" | "headquarters" | "region">) {
  const city = (f.city ?? "").trim().toLowerCase();
  if (PROVINCE_REGION[city]) return PROVINCE_REGION[city];
  const hq = (f.headquarters ?? "").trim();
  if (hq === "Thailand") return "Thailand";
  if (hq) return hq;
  return f.region ?? "Southeast Asia";
}

const CODE_ADJ = ["Amber", "Cobalt", "Jade", "Saffron", "Indigo", "Coral", "Teak", "Lotus", "Orchid", "Monsoon", "Harbor", "Summit"];
const CODE_NOUN = ["Kitchen", "Works", "Foundry", "Line", "House", "Craft", "Logic", "Harvest", "Mill", "Trail", "Bridge", "Studio"];
export function suggestCodeName(seed = Math.random()) {
  const a = CODE_ADJ[Math.floor(seed * CODE_ADJ.length) % CODE_ADJ.length];
  const b = CODE_NOUN[Math.floor(seed * 7919) % CODE_NOUN.length];
  return `Project ${a} ${b}`;
}

// ---------------------------------------------------------- identity check

export interface IdentityFinding {
  field: HiddenTextField;
  term: string;
  reason: string;
}

const STOP = new Set(["co", "ltd", "company", "limited", "the", "and", "pte", "inc", "group", "corp", "plc", "public", "thailand"]);

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Terms that would name the company, longest first. */
export function identityTerms(f: EntryFacts): { term: string; reason: string }[] {
  const out: { term: string; reason: string }[] = [];
  const add = (t: string | null | undefined, reason: string) => {
    const v = (t ?? "").trim();
    if (v.length < 3) return;
    if (STOP.has(v.toLowerCase())) return;
    out.push({ term: v, reason });
  };
  const nameVariants = (n?: string | null) => {
    if (!n) return;
    add(n, "Company name");
    const short = n.replace(/\b(co\.?|ltd\.?|company|limited|pte\.?|inc\.?|plc|public|corp\.?)\b/gi, "").replace(/[.,]/g, " ").replace(/\s+/g, " ").trim();
    if (short && short !== n) add(short, "Company name");
    const first = short.split(" ")[0];
    if (first && first.length >= 4 && !STOP.has(first.toLowerCase())) add(first, "Company name");
  };
  nameVariants(f.startup_name);
  nameVariants(f.registered_name);
  if (f.website_url) {
    const d = f.website_url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0];
    add(d, "Website");
    add(d.split(".")[0], "Website");
  }
  for (const p of f.people ?? []) {
    add(p, "Person's name");
    const parts = p.trim().split(/\s+/);
    if (parts.length > 1) add(parts[parts.length - 1], "Person's name");
  }
  for (const c of f.customers ?? []) add(c, "Customer name");
  add(f.city, "Exact location");
  if (f.year_founded) add(String(f.year_founded), "Exact year founded");
  const staff = parseNumber(f.company_size);
  if (staff && staff >= 10) add(String(staff), "Exact staff count");
  const rev = exactMoney(f.last_year_revenue);
  if (rev) {
    add(rev, "Exact revenue");
    add(rev.replace("฿", ""), "Exact revenue");
  }
  const seen = new Set<string>();
  return out
    .filter((t) => {
      const k = t.term.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => b.term.length - a.term.length);
}

function fieldText(d: Partial<HiddenDraft>, field: HiddenTextField): string {
  const v = d[field as keyof HiddenDraft];
  if (Array.isArray(v)) return v.join("\n");
  return (v as string | null | undefined) ?? "";
}

/** Whole-word, case-insensitive, longest match first. */
export function findTermsIn(text: string, terms: { term: string; reason: string }[]) {
  const hits: { term: string; reason: string; start: number; end: number }[] = [];
  const taken: boolean[] = [];
  for (const t of terms) {
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(t.term)}(?![\\p{L}\\p{N}])`, "giu");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const s = m.index;
      const e = s + m[0].length;
      let overlap = false;
      for (let i = s; i < e; i++) if (taken[i]) overlap = true;
      if (overlap) continue;
      for (let i = s; i < e; i++) taken[i] = true;
      hits.push({ term: m[0], reason: t.reason, start: s, end: e });
    }
  }
  return hits.sort((a, b) => a.start - b.start);
}

export function runIdentityCheck(d: Partial<HiddenDraft>, facts: EntryFacts): IdentityFinding[] {
  const terms = identityTerms(facts);
  const out: IdentityFinding[] = [];
  for (const field of HIDDEN_TEXT_FIELDS) {
    for (const h of findTermsIn(fieldText(d, field), terms)) out.push({ field, term: h.term, reason: h.reason });
  }
  return out;
}

export function missingForPublish(d: Partial<HiddenDraft>): string[] {
  const m: string[] = [];
  if (!d.code_name?.trim()) m.push("Code name");
  if (!d.headline?.trim()) m.push("Headline");
  if (!d.description?.trim()) m.push("Description");
  if ((d.highlights ?? []).filter((h) => h.trim()).length < 3) m.push("3 highlights");
  if (!d.customers_summary?.trim()) m.push("Customers described");
  if (d.asking_price !== null && d.asking_price !== undefined && !(d.asking_price > 0)) m.push("Asking price or on request");
  if (!(d.stake_pct != null && d.stake_pct >= 1 && d.stake_pct <= 100)) m.push("Stake 1–100%");
  if (!d.reason?.trim()) m.push("Reason for sale");
  if (!(d.open_to ?? []).length) m.push("At least one \u201copen to\u201d");
  if ((d.headline ?? "").length > 120) m.push("Headline up to 120 characters");
  if ((d.description ?? "").length > 420) m.push("Description up to 420 characters");
  return m;
}

export function pickDraft(r: Partial<HiddenDraft>): HiddenDraft {
  return {
    code_name: r.code_name ?? "",
    cover_art: r.cover_art ?? null,
    region: r.region ?? null,
    headline: r.headline ?? "",
    description: r.description ?? "",
    highlights: [...(r.highlights ?? []), "", "", "", ""].slice(0, 4),
    customers_summary: r.customers_summary ?? "",
    asking_price: r.asking_price ?? null,
    stake_pct: r.stake_pct ?? null,
    deal_type: r.deal_type ?? null,
    structure: r.structure ?? null,
    reason: r.reason ?? null,
    handover: r.handover ?? null,
    process: r.process ?? null,
    open_to: r.open_to ?? [],
    nda_approver: r.nda_approver ?? "admin",
  };
}
