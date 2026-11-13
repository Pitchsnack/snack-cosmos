/**
 * Seller onboarding wizard — shared constants, draft storage and the
 * wizard → "Add my business" form mapping. Drafts autosave to this browser
 * (per user) until the business is created.
 */
import type { RegulatoryLicence } from "@/lib/compliance";
import type { FounderStory } from "@/lib/founder-story";
import { strengthCount, STRENGTH_MAX } from './seller-strengths';

export type SellerRelation = "owner" | "family_owner" | "agent";

/** Step 1 choices, bilingual [EN, TH]; the stored value is the key, never the wording. */
export const SELLER_RELATIONS: { value: SellerRelation; label: [string, string]; hint: [string, string] }[] = [
  { value: "owner", label: ["Business owner", "เจ้าของกิจการ"], hint: ["I am the business owner and selling my own company", "ฉันเป็นเจ้าของกิจการและกำลังขายบริษัทของตนเอง"] },
  { value: "family_owner", label: ["Family business owner", "เจ้าของธุรกิจครอบครัว"], hint: ["I am a family business owner, selling or considering the sale of the business", "ฉันเป็นเจ้าของธุรกิจครอบครัว และกำลังขายหรืออยู่ระหว่างพิจารณาขายกิจการ"] },
  { value: "agent", label: ["Authorized representative (agent)", "ผู้แทนที่ได้รับมอบอำนาจ (ตัวแทน)"], hint: ["I am acting on behalf of the business owner as authorised", "ฉันดำเนินการแทนเจ้าของกิจการตามที่ได้รับมอบหมาย"] },
];

/** Stored exactly as selected (THB bands) — never converted. */
export const THB_REVENUE_BANDS: string[] = [
  "Below ฿50M",
  "฿50M – 100M",
  "฿100M – 250M",
  "฿250M – 500M",
  "฿500M – 1B",
  "฿1B +",
];
/** Older answers were saved with the Thai wording for the lowest band. */
export const normRevBand = (v: string | null | undefined): string => {
  const t = (v ?? "").trim();
  return /^ต่ำกว่า/.test(t) ? "Below ฿50M" : t;
};

/** Values line up with the form's company-size options; last one is its own band. */
export const WIZARD_SIZES: { value: string; label: string }[] = [
  { value: "1-10", label: "1 – 10" },
  { value: "11-50", label: "11 – 50" },
  { value: "51-200", label: "51 – 200" },
  { value: "201-500", label: "201 – 500" },
  { value: "More than 500", label: "More than 500" },
];

export const THAI_PROVINCES = [
  "Bangkok", "Nonthaburi", "Samut Prakan", "Pathum Thani", "Samut Sakhon", "Nakhon Pathom",
  "Chonburi", "Rayong", "Chachoengsao", "Phra Nakhon Si Ayutthaya", "Chiang Mai", "Chiang Rai",
  "Lampang", "Phitsanulok", "Khon Kaen", "Nakhon Ratchasima", "Udon Thani", "Ubon Ratchathani",
  "Phuket", "Krabi", "Surat Thani", "Songkhla", "Prachuap Khiri Khan", "Other province",
];

export const WIZARD_LICENCES: RegulatoryLicence[] = [
  { category: "Financial", name: "BOT – e-Money licence" },
  { category: "Financial", name: "BOT – Payment agent" },
  { category: "Financial", name: "SEC licence" },
  { category: "Business", name: "Thai FDA (อย.)" },
  { category: "Business", name: "BOI promotion" },
  { category: "Manufacturing", name: "TISI (มอก.)" },
  { category: "Business", name: "Halal certification" },
  { category: "Manufacturing", name: "Factory licence (รง.4)" },
];

export const WIZARD_ISO = [
  "ISO 9001 – Quality", "ISO 14001 – Environment", "ISO 22000 – Food safety",
  "ISO 27001 – Information security", "ISO 45001 – Health & safety", "ISO 13485 – Medical devices",
  "HACCP", "GMP",
];

export const WIZARD_QUESTION_TITLES = [
  "Your role", "Company name", "Business sector", "Company website and description", "Year founded and company size",
  "Revenue", "Licences & certifications", "Logo and photos", "Deal type", "Owner handover", "Asking price (Estimate)", "About the founder",
];

export type SellerAddr = { street: string; unit: string; district: string; province: string; postal: string };
export const emptyAddr = (): SellerAddr => ({ street: "", unit: "", district: "", province: "", postal: "" });
export const addrComplete = (a: SellerAddr) => !!a.street.trim() && !!a.district.trim() && !!a.province && /^\d{5}$/.test(a.postal);

/** Answered flags for the questions (review excluded). */
export function answeredFlags(d: SellerDraft): boolean[] {
  const answered = sellerAnswered(d);
  return SELLER_STEPS.map(q => answered[q.id]);
}
export const answeredCount = (d: SellerDraft) => answeredFlags(d).filter(Boolean).length;
export const SELLER_STEPS = [
  { id: "role", sec: "About you" }, { id: "name", sec: "About the company" },
  { id: "sector", sec: "About the company" }, { id: "web", sec: "About the company" },
  { id: "founded", sec: "About the company" }, { id: "rev", sec: "Financial & business profile" },
  { id: "lic", sec: "Intangible assets" }, { id: "photos", sec: "Company images" },
  { id: "deal", sec: "Your listing" }, { id: "handover", sec: "Your listing" },
  { id: "price", sec: "Your listing" }, { id: "founder", sec: "About the founder" },
] as const;
export const REVIEW_STEP = SELLER_STEPS.length;
/** The four listing questions (all required, no Skip). Only Admin names a listing, outside the wizard. */
export const LISTING_KEYS = ["photos", "deal", "handover", "price"] as const;
export const DEAL_HINTS: Record<string, [string, string]> = {
  "Full acquisition": ["Sell the whole company", "ขายกิจการทั้งหมด"],
  "Majority stake (above 51%)": ["Sell control and keep a share", "ขายอำนาจควบคุมและถือหุ้นส่วนหนึ่งไว้"],
  "Minority stake (below 49%)": ["Keep control and sell a share", "คงอำนาจควบคุมและขายหุ้นส่วนหนึ่ง"],
};
const NAME_A = ["Golden", "Silver", "Northern", "Eastern", "Coastal", "Royal", "Evergreen", "Lotus", "Summit", "Harbour", "Jade", "Amber", "Sapphire", "Bright", "Crown", "Pioneer"];
const NAME_B = ["River", "Orchid", "Peak", "Bridge", "Harvest", "Lantern", "Compass", "Anchor", "Meridian", "Horizon", "Garden", "Falcon", "Banyan", "Delta", "Tiger", "Monsoon"];
const NAME_C = ["Holdings", "Industries", "Group", "Enterprises", "Partners", "Works", "Trading", "Ventures", "Company", "Collective"];
/** Four listing names: 3 words, never "Project", none in `avoid`. */
export function listingNameIdeas(avoid: Set<string>, seed = Math.random()): string[] {
  const out: string[] = [];
  let r = seed;
  for (let i = 0; out.length < 4 && i < 200; i++) {
    r = (r * 9301 + 49297) % 233280 / 233280;
    const n = `${NAME_A[Math.floor(r * NAME_A.length)]} ${NAME_B[Math.floor((r * 7919) % 1 * NAME_B.length)]} ${NAME_C[Math.floor((r * 104729) % 1 * NAME_C.length)]}`;
    if (!avoid.has(n.toLowerCase()) && !out.includes(n)) out.push(n);
  }
  return out;
}

/**
 * Questions sign-up fully answered, so the wizard skips them. A field counts only
 * while it still holds a value; clearing it later brings its question back.
 * The company name never skips its question (it shares it with the registration number).
 */
export function sellerSkips(d: SellerDraft, fromSignup: string[] = []): Set<string> {
  const f = new Set(fromSignup);
  const s = new Set<string>();
  if (f.has("role") && d.role) s.add("role");
  // Website always shows: the URL alone no longer completes this question.
  if (f.has("year") && f.has("size") && validFoundedYear(d.year) && d.size) s.add("founded");
  if (f.has("sector") && d.sector) s.add("sector");
  // The company check confirmed name, number and address at sign-up: skip while all still hold a value.
  if (f.has("address") && !!d.name.trim() && /^\d{13}$/.test(d.reg) && addrComplete(d.addr)) s.add("name");
  if (d.noUpload) s.add("photos");
  return s;
}
/** Indexes of the questions that show. */
export function sellerShown(d: SellerDraft, fromSignup: string[] = []): number[] {
  const skip = sellerSkips(d, fromSignup);
  return SELLER_STEPS.map((q, i) => (skip.has(q.id) ? -1 : i)).filter((i) => i >= 0);
}
/** Banner progress over the questions that show. */
export function sellerProgress(d: SellerDraft, fromSignup: string[] = []) {
  const shown = sellerShown(d, fromSignup);
  const f = answeredFlags(d);
  return { n: shown.filter((i) => f[i]).length, N: shown.length };
}
/** First unanswered required question (website + licences are optional); REVIEW_STEP = review. */
export function firstOpenStep(d: SellerDraft, fromSignup: string[] = []): number {
  const f = answeredFlags(d);
  const shown = new Set(sellerShown(d, fromSignup));
  const optional = new Set(["lic"]);
  const required = SELLER_STEPS.map((q, n) => (optional.has(q.id) ? -1 : n)).filter((n) => n >= 0 && shown.has(n));
  const i = required.find((n) => !f[n]);
  return i ?? REVIEW_STEP;
}

/* Step progress also counts optional questions once the seller has passed them. */
export const STEP_KEYS = [...SELLER_STEPS.map(q => q.id), "review"] as const;
export type StepKey = typeof SELLER_STEPS[number]["id"] | "review";
export const STEP_SHORT: Record<StepKey, [string, string]> = {
  role: ["Role", "บทบาท"], name: ["Company", "บริษัท"], sector: ["Sector", "กลุ่มอุตสาหกรรม"],
  web: ["Website", "เว็บไซต์"], founded: ["Founded & size", "ปีก่อตั้งและขนาด"], rev: ["Revenue", "รายได้"],
  lic: ["Licences", "ใบอนุญาต"], photos: ["Photos", "รูปภาพ"], deal: ["Deal type", "รูปแบบดีล"],
  handover: ["Handover", "ส่งมอบ"], price: ["Price", "ราคา"], founder: ["Founder", "ผู้ก่อตั้ง"], review: ["Review", "ตรวจสอบ"],
};
export const STEP_FULL: Record<StepKey, [string, string]> = {
  role: ["Your role", "บทบาทของท่าน"], name: ["Company name, registration number and address", "ชื่อบริษัท เลขทะเบียน และที่อยู่"],
  sector: ["Business sector", "กลุ่มอุตสาหกรรม"], web: ["Company website and description", "เว็บไซต์และคำอธิบายบริษัท"],
  founded: ["Year founded and company size", "ปีที่ก่อตั้งและขนาดบริษัท"], rev: ["Revenue last year", "รายได้ปีที่แล้ว"],
  lic: ["Licences and certifications", "ใบอนุญาตและมาตรฐาน"], photos: ["Logo and photos", "โลโก้และรูปภาพ"],
  deal: ["Deal type", "รูปแบบดีล"], handover: ["Owner handover", "การส่งมอบงานของเจ้าของ"], price: ["Asking price (Estimate)", "ราคาที่ต้องการ (ประมาณการ)"],
  founder: ["About the founder", "เกี่ยวกับผู้ก่อตั้ง"], review: ["Review your answers", "ตรวจสอบข้อมูล"],
};
/** Edit information's existing limits, not the reference's illustrative counters. */
export const SELLER_DESCRIPTION_LIMITS = { short: 500, long: 5000, tag: 50, tags: 5 } as const;
export function validFoundedYear(year: string, now = new Date().getFullYear()) {
  return /^\d{4}$/.test(year) && Number(year) >= 1800 && Number(year) <= now;
}
export function foundedYearError(year: string, now = new Date().getFullYear()): "digits" | "thai" | "range" | null {
  if (!/^\d{4}$/.test(year)) return "digits";
  const n = Number(year);
  if (n > now && n - 543 >= 1800 && n - 543 <= now) return "thai";
  return n < 1800 || n > now ? "range" : null;
}
export type SellerFounder = {
  id?: string; full_name: string; position?: string | null; linkedin_url?: string | null;
  email?: string; phone?: string;
  bio?: string | null; bio_story?: FounderStory | null; bio_th?: string | null; bio_story_th?: FounderStory | null; photo_url?: string | null;
};
export function websiteDescriptionFieldsAnswered(d: SellerDraft) {
  const short = d.shortDescription?.trim() || d.shortDescriptionTh?.trim() || "";
  const long = d.longDescription?.trim() || d.longDescriptionTh?.trim() || "";
  return !!short && short.length <= SELLER_DESCRIPTION_LIMITS.short && !!long && long.length <= SELLER_DESCRIPTION_LIMITS.long
    && Math.max(d.productTags?.length ?? 0, d.productTagsTh?.length ?? 0) > 0
    && Math.max(d.productTags?.length ?? 0, d.productTagsTh?.length ?? 0) <= 5
    && [d.shortDescription, d.shortDescriptionTh].every(v => (v?.length ?? 0) <= 500)
    && [d.longDescription, d.longDescriptionTh].every(v => (v?.length ?? 0) <= 5000)
    && [...(d.productTags ?? []), ...(d.productTagsTh ?? [])].every(v => !!v.trim() && v.length <= 50);
}
export function websiteFieldsAnswered(d: SellerDraft) {
  return websiteDescriptionFieldsAnswered(d) && strengthCount(d, true) === 3
    && [...(d.highlights ?? []), ...(d.highlightsTh ?? [])].every(text => text.trim().length <= STRENGTH_MAX);
}
/** Legacy year and size both map to the combined question; other keys retain identity. */
export function normalizeSellerStep(k: string | null | undefined): StepKey | null {
  if (k === "year" || k === "size") return "founded";
  return STEP_KEYS.includes(k as StepKey) ? k as StepKey : null;
}
export const stepIdx = (k: string | null | undefined) => {
  const key = normalizeSellerStep(k);
  return key ? STEP_KEYS.indexOf(key) : -1;
};
export function founderContactComplete(f: SellerFounder | undefined): boolean {
  if (!f?.full_name.trim()) return false;
  const digits = (f.phone ?? "").replace(/\D/g, "");
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((f.email ?? "").trim()) && digits.length >= 9 && digits.length <= 15;
}
export function sellerValid(d: SellerDraft): Record<StepKey, boolean> {
  return {
    role: !!d.role, name: !!d.name.trim() && /^\d{13}$/.test(d.reg) && addrComplete(d.addr),
    sector: !!d.sector, web: websiteFieldsAnswered(d), founded: validFoundedYear(d.year) && !!d.size,
    rev: !!d.rev, lic: d.licences.length + d.iso.length > 0 || stepIdx(d.reached) > stepIdx("lic"),
    photos: !!d.hasLogo && (d.photos ?? 0) > 0, deal: !!d.deal, handover: d.stays === "yes" || d.stays === "no",
    price: (d.price ?? 0) > 0, founder: founderContactComplete(d.founders?.[0]), review: false,
  };
}
export function sellerAnswered(d: SellerDraft): Record<StepKey, boolean> { return sellerValid(d); }
export const laterKey = (a: string | null | undefined, b: string | null | undefined) =>
  normalizeSellerStep(stepIdx(b) > stepIdx(a) ? b : a);
/** Question keys that show (sign-up answers left out), in order. */
export const sellerQuestionKeys = (d: SellerDraft, fromSignup: string[] = []): StepKey[] =>
  sellerShown(d, fromSignup).map((i) => SELLER_STEPS[i]?.id as StepKey);
/** Not answered = no valid answer and before the furthest step opened. */
export const isMissed = (k: StepKey, d: SellerDraft) => !sellerAnswered(d)[k] && stepIdx(k) < stepIdx(d.reached);
/** First question without an answer (skipped included), else review. */
export function firstUnanswered(d: SellerDraft, fromSignup: string[] = []): StepKey {
  const v = sellerAnswered(d);
  return sellerQuestionKeys(d, fromSignup).find((k) => !v[k]) ?? "review";
}
export const joinNames = (n: string[], th: boolean) =>
  n.length < 2 ? n.join("") : th ? `${n.slice(0, -1).join(", ")} และ ${n[n.length - 1]}` : `${n.slice(0, -1).join(", ")} and ${n[n.length - 1]}`;

export const normalizeUrl = (raw: string) => {
  const v = raw.trim();
  return v && !/^https?:\/\//i.test(v) ? `https://${v}` : v;
};

export interface SellerDraft {
  step: number;
  shortDescription?: string; longDescription?: string; productTags?: string[]; marketTags?: string[];
  shortDescriptionTh?: string; longDescriptionTh?: string; productTagsTh?: string[]; marketTagsTh?: string[];
  highlights?: string[]; highlightsTh?: string[];
  founders?: SellerFounder[];
  /** Additional website findings are applied only after Review, under the existing access gate. */
  enrichResult?: Record<string, unknown>;
  role: SellerRelation | null;
  name: string;
  reg: string;
  web: string;
  year: string;
  city: string;
  rev: string | null;
  size: string | null;
  sector: string | null;
  /** The short-list pick that gave the sector. */
  pick?: { type: string; kind?: string } | null;
  licences: RegulatoryLicence[];
  iso: string[];
  addr: SellerAddr;
  /** Listing questions (saved on the business's listing). */
  hasLogo?: boolean;
  photos?: number;
  deal?: string | null;
  stays?: "yes" | "no" | null;
  months?: number | null;
  /** Asking price (Estimate), whole baht. */
  price?: number | null;
  listingName?: string;
  /** false while a typed name is taken or names the company. */
  nameOk?: boolean;
  /** + Add My Business before the business exists: photos are added in My Company. */
  noUpload?: boolean;
  /** Furthest step key opened (setup_reached). */
  reached?: string | null;
  savedAt: string;
}

export const emptyDraft = (): SellerDraft => ({
  step: 0, role: null, name: "", reg: "", web: "", year: "", city: "",
  rev: null, size: null, sector: null, licences: [], iso: [], addr: emptyAddr(), reached: null, savedAt: new Date().toISOString(),
});


export const isValidUrl = (raw: string) => {
  const v = raw.trim();
  if (!v) return false;
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    return /^[^.\s]+(\.[^.\s]+)+$/.test(u.hostname);
  } catch {
    return false;
  }
};

export interface SellerPrefill {
  sellerRelation: SellerRelation | null;
  startupName: string;
  registeredNumber: string;
  websiteUrl: string;
  yearFounded: string;
  country: string;
  city: string;
  lastYearRevenue: string;
  companySize: string;
  sector: string | null;
  licences: RegulatoryLicence[];
  isoStandards: string[];
  addr: SellerAddr;
}

export function draftToPrefill(d: SellerDraft): SellerPrefill {
  const web = d.web.trim();
  return {
    sellerRelation: d.role,
    startupName: d.name.trim(),
    registeredNumber: d.reg,
    websiteUrl: web && isValidUrl(web) ? (/^https?:\/\//i.test(web) ? web : `https://${web}`) : "",
    yearFounded: d.year,
    country: "Thailand",
    city: d.addr.province || d.city,
    lastYearRevenue: d.rev ?? "",
    companySize: d.size ?? "",
    sector: d.sector,
    licences: d.licences,
    isoStandards: d.iso,
    addr: d.addr,
  };
}

/** What the listing questions save (the name only once it passed its checks). */
export function listingPayload(d: SellerDraft) {
  return {
    deal: (d.deal ?? null) as never, stays: d.stays ?? null, months: (d.stays === "yes" ? d.months ?? 6 : null) as never,
    price: d.price && d.price > 0 ? d.price : null, name: null,
  };
}
