import {
  Banknote, Briefcase, Calculator, FileChartColumn, Handshake, Percent, RefreshCw, Scale, Search, Sprout, Store, type LucideIcon,
} from "lucide-react";
import rates from "@/config/display-rates.json";
import { isValidUrl } from "@/lib/seller-wizard";

/** Client-safe shapes, constants and rules for Advisor › My Company (firm profiles). */

export const USD_THB_DISPLAY_RATE: number = rates.usd_thb_display_rate;

export const ADVISOR_SERVICES: { name: string; icon: LucideIcon; line: string; fixed: string; own: string; pct: string }[] = [
  { name: "M&A advisory", icon: Handshake, line: "Sell-side and buy-side mandates, buyer search and negotiation to signing.", fixed: "500,000", own: "e.g. Monthly retainer, then a success fee of 2–3%", pct: "2" },
  { name: "Valuation", icon: Calculator, line: "Business valuations and fairness opinions for sales and fundraising.", fixed: "150,000", own: "e.g. Fixed fee from ฿150,000", pct: "2" },
  { name: "Tax", icon: Percent, line: "Deal tax structuring, tax due diligence and BOI incentives.", fixed: "90,000", own: "e.g. From ฿90,000 per engagement", pct: "2" },
  { name: "Legal", icon: Scale, line: "Share purchase agreements, legal due diligence and licences.", fixed: "50,000", own: "e.g. ฿5,500 an hour, or a fixed fee per agreement", pct: "2" },
  { name: "Accounting & audit", icon: FileChartColumn, line: "Audited accounts, carve-out financials and closing statements.", fixed: "220,000", own: "e.g. Annual audit from ฿220,000", pct: "2" },
  { name: "Financial due diligence", icon: Search, line: "Quality of earnings, net debt and working capital reviews.", fixed: "350,000", own: "e.g. From ฿350,000 per review", pct: "2" },
  { name: "Debt & financing", icon: Banknote, line: "Acquisition finance, refinancing and lender introductions.", fixed: "200,000", own: "e.g. 1% of the facility arranged", pct: "1" },
  { name: "Business broker", icon: Store, line: "Listing small businesses for sale and matching buyers.", fixed: "100,000", own: "e.g. 5–8% of the sale price, paid on completion", pct: "5" },
  { name: "Restructuring", icon: RefreshCw, line: "Turnarounds, debt restructuring and distressed sales.", fixed: "300,000", own: "e.g. Fixed fee per case, agreed after a first review", pct: "2" },
  { name: "ESG & sustainability", icon: Sprout, line: "Environmental and social due diligence and reporting.", fixed: "150,000", own: "e.g. From ฿150,000 per assessment", pct: "2" },
];
export const serviceOf = (n: string) => ADVISOR_SERVICES.find((s) => s.name === n) ?? ADVISOR_SERVICES[0];

export const FIRM_TYPE_OPTIONS: { value: string; icon: LucideIcon; line: string; services: string[] }[] = [
  { value: "Advisory firm", icon: Handshake, line: "M&A, corporate finance and deal advice", services: ["M&A advisory"] },
  { value: "Law firm", icon: Scale, line: "Corporate, M&A and commercial law", services: ["Legal"] },
  { value: "Tax and accounting firm", icon: Percent, line: "Tax, audit and accounting work", services: ["Tax", "Accounting & audit"] },
  { value: "Valuation firm", icon: Calculator, line: "Business valuations and fairness opinions", services: ["Valuation"] },
  { value: "Business broker", icon: Store, line: "Sells small businesses and finds their buyers", services: ["Business broker"] },
  { value: "Other", icon: Briefcase, line: "Another professional firm, such as financing or ESG", services: [] },
];
export const FIRM_TYPES = FIRM_TYPE_OPTIONS.map((t) => t.value);
export const LANGUAGES = ["Thai", "English", "Chinese", "Japanese", "Korean", "Vietnamese", "Malay", "Indonesian", "French"];

/* ------------------------------ Deal bands ------------------------------ */

export const DEAL_BANDS: { key: string; lo: number | null; hi: number | null }[] = [
  { key: "deal_below_1", lo: null, hi: 1 },
  { key: "deal_1_5", lo: 1, hi: 5 },
  { key: "deal_5_25", lo: 5, hi: 25 },
  { key: "deal_25_50", lo: 25, hi: 50 },
  { key: "deal_50_plus", lo: 50, hi: null },
];
const thbM = (usdM: number) => {
  const v = usdM * USD_THB_DISPLAY_RATE;
  if (v >= 1000) return `฿${Number((v / 1000).toPrecision(2))}B`;
  return `฿${Number(v.toPrecision(2))}M`;
};
/** "{US$ label}" and "{baht}" for a deal band; baht is display-only, worked out from the rate. */
export function dealBandLabels(key: string | null | undefined): { usd: string; thb: string; full: string } | null {
  const b = DEAL_BANDS.find((x) => x.key === key);
  if (!b) return null;
  let usd: string, thb: string;
  if (b.lo == null) { usd = `Below US$${b.hi}M`; thb = `below ${thbM(b.hi!)}`; }
  else if (b.hi == null) { usd = `US$${b.lo}M+`; thb = `${thbM(b.lo)}+`; }
  else { usd = `US$${b.lo}M–US$${b.hi}M`; thb = `${thbM(b.lo)}–${thbM(b.hi)}`; }
  return { usd, thb, full: `${usd} (${thb})` };
}

/* --------------------------------- Fees --------------------------------- */

export type FeeType = "fixed" | "hourly" | "retainer" | "success" | "retainer_success" | "quote" | "other";
export const FEE_TYPES: { value: FeeType; label: string }[] = [
  { value: "fixed", label: "Fixed fee" },
  { value: "hourly", label: "Hourly rate" },
  { value: "retainer", label: "Monthly retainer" },
  { value: "success", label: "Success fee" },
  { value: "retainer_success", label: "Retainer + success fee" },
  { value: "quote", label: "Request a Price Quote" },
  { value: "other", label: "Other (write your own)" },
];
/** Form shape: amount = digits only; pct = as typed. */
export type FeeDetail = { type: FeeType; amount: string; pct: string; words: string };
export const newFee = (): FeeDetail => ({ type: "quote", amount: "", pct: "", words: "" });
export const feeNeedsAmount = (t: FeeType) => t === "fixed" || t === "hourly" || t === "retainer" || t === "retainer_success";
export const feeNeedsPct = (t: FeeType) => t === "success" || t === "retainer_success";

export function parsePct(raw: string): { min: number; max: number | null } | null {
  const s = raw.replace(/,/g, ".").replace(/\s/g, "");
  const m = s.match(/^(\d{1,2}(?:\.\d{1,2})?)(?:[-–](\d{1,2}(?:\.\d{1,2})?))?$/);
  if (!m) return null;
  const a = Number(m[1]); const b = m[2] != null ? Number(m[2]) : null;
  if (!(a > 0)) return null;
  if (b != null && !(b > a)) return null;
  return { min: a, max: b };
}
export const fmtPct = (p: { min: number; max: number | null }) => (p.max != null ? `${p.min}–${p.max}` : `${p.min}`);
export const fmtAmount = (digits: string) => (digits ? Number(digits).toLocaleString("en-US") : "");
const amountOk = (d: string) => /^\d{1,12}$/.test(d) && Number(d) >= 1;

/** Words shown on the card, panel and Review; null while the fee is incomplete. */
export function feeWords(f: FeeDetail): string | null {
  const amt = `฿${fmtAmount(f.amount)}`;
  const p = parsePct(f.pct);
  switch (f.type) {
    case "quote": return "Request a Price Quote";
    case "fixed": return amountOk(f.amount) ? `Fixed fee from ${amt}` : null;
    case "hourly": return amountOk(f.amount) ? `${amt} an hour` : null;
    case "retainer": return amountOk(f.amount) ? `Retainer ${amt} a month` : null;
    case "success": return p ? `${fmtPct(p)}% success fee` : null;
    case "retainer_success": return amountOk(f.amount) && p ? `Retainer ${amt} a month, then a ${fmtPct(p)}% success fee` : null;
    case "other": return f.words.trim() ? f.words.trim().slice(0, 80) : null;
  }
}
/** Field errors for one fee (only once its fields are touched). */
export function feeError(service: string, f: FeeDetail): { msg: string; amount?: boolean; pct?: boolean; words?: boolean } | null {
  if (feeWords(f)) return null;
  const pctBad = feeNeedsPct(f.type) && f.pct.trim() && !parsePct(f.pct);
  if (pctBad) return { msg: "Enter the success fee as a number, e.g. 2 or 2–3.", pct: true, amount: feeNeedsAmount(f.type) && !amountOk(f.amount) };
  return {
    msg: `Add how you charge for ${service}.`,
    amount: feeNeedsAmount(f.type) && !amountOk(f.amount),
    pct: feeNeedsPct(f.type) && !parsePct(f.pct),
    words: f.type === "other" && !f.words.trim(),
  };
}

/* ------------------------------ The record ------------------------------ */

export type FirmStatus = "draft" | "live" | "paused";
export type FirmTeam = { id?: string; name: string; role: string | null; email: string | null };
export type FirmCredential = { id?: string; name: string; note: string | null; status: "pending" | "verified"; checkedAt: string | null };
export type FirmDocument = { id?: string; path: string; name: string; type: string | null; checkedAt: string | null; validUntil: string | null; url?: string | null };
export type FirmReview = { id: string; role: "seller" | "buyer"; detail: string | null; service: string | null; stars: number; comment: string | null; at: string };

export type AdvisorFirm = {
  id: string; refNo: string; name: string; firmType: string; logoPath: string | null; logoUrl: string | null; logoSource: "upload" | "enrich" | null;
  description: string | null; yearFounded: number | null; city: string | null; country: string | null;
  services: string[]; fees: Record<string, string>; feeDetails: Record<string, FeeDetail>;
  dealBand: string | null; teamSize: number | null;
  languages: string[]; sectors: string[];
  legalName: string | null; thaiName: string | null; registrationNo: string | null;
  addrStreet: string | null; addrUnit: string | null; addrDistrict: string | null;
  addrProvince: string | null; addrPostal: string | null;
  website: string | null; email: string | null; phone: string | null;
  status: FirmStatus; liveSince: string | null; verifiedAt: string | null; updatedAt: string;
  setupAnswered: string[]; setupDoneAt: string | null; wizard: WizardState;
  team: FirmTeam[]; credentials: FirmCredential[]; documents: FirmDocument[]; reviews: FirmReview[];
};

type AddrParts = Pick<AdvisorFirm, "addrStreet" | "addrUnit" | "addrDistrict" | "addrProvince" | "addrPostal" | "country" | "city">;
const cityOf = (f: AddrParts) => (f.country === "Thailand" ? f.addrDistrict : f.addrDistrict || f.city);
const join = (xs: (string | null | undefined)[]) => xs.filter((x) => x && String(x).trim()).join(", ");
/** "{floor/unit}, {street}, {city/district}, {province} {postal}, {country}" leaving out empty parts. */
export function fullAddress(f: AddrParts): string {
  if (!f.addrStreet?.trim()) return "";
  const tail = f.addrProvince?.trim()
    ? [cityOf(f), [f.addrProvince, f.addrPostal].filter(Boolean).join(" ")]
    : [[cityOf(f), f.addrPostal].filter(Boolean).join(" ")];
  return join([f.addrUnit, f.addrStreet, ...tail, f.country]);
}
/** Map query: the address line without floor / unit. */
export function mapQuery(f: AddrParts): string {
  return fullAddress({ ...f, addrUnit: null });
}
export function addressDone(f: AddrParts): boolean {
  if (f.country === "Thailand") return !!f.addrStreet?.trim() && !!f.addrDistrict?.trim() && !!f.addrProvince?.trim() && /^\d{5}$/.test(f.addrPostal ?? "");
  return !!f.addrStreet?.trim() && !!cityOf(f)?.trim();
}

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
}

export function reviewStats(reviews: FirmReview[]) {
  const n = reviews.length;
  const counts = [0, 0, 0, 0, 0];
  for (const r of reviews) counts[r.stars - 1]++;
  const avg = n ? Math.round((reviews.reduce((s, r) => s + r.stars, 0) / n) * 10) / 10 : 0;
  return { n, avg, counts };
}

export type ChecklistKey = "description" | "services" | "fees" | "team-size" | "address" | "website" | "email" | "phone" | "team" | "credentials" | "documents";
export type EditSection = "firm" | "services" | "work" | "company" | "team" | "credentials" | "documents";
export function firmChecklist(f: AdvisorFirm): { key: ChecklistKey; label: string; done: boolean; section: EditSection }[] {
  return [
    { key: "description", label: "Description", done: !!f.description?.trim(), section: "firm" },
    { key: "services", label: "At least one service", done: f.services.length > 0, section: "services" },
    { key: "fees", label: "A fee for every service", done: f.services.length > 0 && f.services.every((s) => !!f.fees[s]?.trim()), section: "services" },
    { key: "team-size", label: "Team size", done: !!f.teamSize, section: "work" },
    { key: "address", label: "Address", done: addressDone(f), section: "company" },
    { key: "website", label: "Website", done: !!f.website?.trim(), section: "company" },
    { key: "email", label: "Email", done: !!f.email?.trim(), section: "company" },
    { key: "phone", label: "Phone", done: !!f.phone?.trim(), section: "company" },
    { key: "team", label: "At least one team member", done: f.team.length > 0, section: "team" },
    { key: "credentials", label: "At least one licence or credential", done: f.credentials.length > 0, section: "credentials" },
    { key: "documents", label: "At least one document", done: f.documents.length > 0, section: "documents" },
  ];
}

/** Keeps the firm's own order: kept services stay put, new ones go to the end. */
export function mergeServiceOrder(current: string[], picked: string[]): string[] {
  const set = new Set(picked);
  const kept = current.filter((s) => set.has(s));
  return [...kept, ...ADVISOR_SERVICES.map((s) => s.name).filter((s) => set.has(s) && !kept.includes(s))];
}

export const SERVICE_COLS: Record<number, number> = { 1: 1, 2: 2, 3: 3, 4: 2, 5: 3, 6: 3, 7: 4, 8: 4, 9: 3, 10: 2 };

/* ------------------------------ Shared checks ----------------------------- */

export const nameError = (v: string) => (v.trim().length >= 2 ? null : "Add your firm's name.");
export const cityError = (v: string, country: string) => (v.trim().length >= 2 || (country === "Thailand" && v) ? null : country === "Thailand" ? "Choose your province." : "Add your city.");
export const webError = (v: string) => (isValidUrl(v) ? null : "Enter a valid website address, e.g. www.yourfirm.com");
export const emailError = (v: string) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? null : "Enter a valid email, e.g. hello@yourfirm.com");
export const phoneError = (v: string) => {
  const t = v.trim();
  const ok = /^\+?[\d\s().-]+$/.test(t) && (t.match(/\d/g)?.length ?? 0) >= 9;
  return ok ? null : "Enter a phone number with its area code, e.g. +66 2 123 4567.";
};
export const descError = (v: string) => (v.trim().length >= 30 ? null : "Write at least 30 characters.");
export const teamSizeError = (v: string) => (Number(v) >= 1 ? null : "Add your team size, e.g. 8.");

/* ------------------------------ Setup wizard ------------------------------ */

export const WIZARD_QS = ["type", "loc", "name", "web", "services", "deal", "team", "contact", "logo", "desc"] as const;
export type WizardQ = (typeof WIZARD_QS)[number] | "review";
export function setupProgress(answered: string[]): { n: number; first: WizardQ } {
  const done = WIZARD_QS.filter((q) => answered.includes(q));
  const first = WIZARD_QS.find((q) => !answered.includes(q)) ?? "review";
  return { n: done.length, first };
}

export type WizardState = {
  feeVisited?: boolean; enrichSig?: string;
  enrich?: { logo: boolean; legalName: string | null; thaiName: string | null; teamAdded: boolean; found: number };
};
