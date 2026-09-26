/**
 * Seller onboarding wizard — shared constants, draft storage and the
 * wizard → "Add my business" form mapping. Drafts autosave to this browser
 * (per user) until the business is created.
 */
import type { RegulatoryLicence } from "@/lib/compliance";

export type SellerRelation = "owner" | "family_owner" | "agent";

export const SELLER_RELATIONS: { value: SellerRelation; label: string; hint: string }[] = [
  { value: "owner", label: "Business owner", hint: "I am selling my own company" },
  { value: "family_owner", label: "Family business owner", hint: "I am selling or considering the sale of my family business" },
  { value: "agent", label: "Authorized representative (agent)", hint: "I am acting on behalf of the owner" },
];

/** Stored exactly as selected (THB bands) — never converted. */
export const THB_REVENUE_BANDS: string[] = [
  "Under ฿50M",
  "฿50M – 100M",
  "฿100M – 250M",
  "฿250M – 500M",
  "฿500M – 1B",
  "Over ฿1B",
];

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
  "Your role", "Company name", "Website", "Year founded", "Location",
  "Revenue", "Company size", "Sector", "Licences & certifications",
];

/** Answered flags for the 9 questions (review excluded). */
export function answeredFlags(d: SellerDraft): boolean[] {
  return [
    !!d.role,
    !!d.name.trim() && /^\d{13}$/.test(d.reg),
    !!d.web.trim(),
    /^\d{4}$/.test(d.year),
    !!d.city,
    !!d.rev,
    !!d.size,
    !!d.sector,
    d.licences.length + d.iso.length > 0,
  ];
}
export const answeredCount = (d: SellerDraft) => answeredFlags(d).filter(Boolean).length;
/** First unanswered required question (website + licences are optional); 9 = review. */
export function firstOpenStep(d: SellerDraft): number {
  const f = answeredFlags(d);
  const required = [0, 1, 3, 4, 5, 6, 7];
  const i = required.find((n) => !f[n]);
  return i ?? 9;
}

export const normalizeUrl = (raw: string) => {
  const v = raw.trim();
  return v && !/^https?:\/\//i.test(v) ? `https://${v}` : v;
};

export interface SellerDraft {
  step: number;
  role: SellerRelation | null;
  name: string;
  reg: string;
  web: string;
  year: string;
  city: string;
  rev: string | null;
  size: string | null;
  sector: string | null;
  licences: RegulatoryLicence[];
  iso: string[];
  savedAt: string;
}

export const emptyDraft = (): SellerDraft => ({
  step: 0, role: null, name: "", reg: "", web: "", year: "", city: "",
  rev: null, size: null, sector: null, licences: [], iso: [], savedAt: new Date().toISOString(),
});

const key = (userId: string) => `ps.sellerDraft.${userId}`;

export function loadDraft(userId: string | undefined): SellerDraft | null {
  if (!userId || typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key(userId));
    return raw ? ({ ...emptyDraft(), ...JSON.parse(raw) } as SellerDraft) : null;
  } catch {
    return null;
  }
}
export function saveDraft(userId: string, d: SellerDraft) {
  localStorage.setItem(key(userId), JSON.stringify({ ...d, savedAt: new Date().toISOString() }));
  window.dispatchEvent(new Event("ps-seller-draft"));
}
export function clearDraft(userId: string) {
  localStorage.removeItem(key(userId));
  window.dispatchEvent(new Event("ps-seller-draft"));
}

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
    city: d.city,
    lastYearRevenue: d.rev ?? "",
    companySize: d.size ?? "",
    sector: d.sector,
    licences: d.licences,
    isoStandards: d.iso,
  };
}
