import { Banknote, Calculator, FileChartColumn, Handshake, Percent, RefreshCw, Scale, Search, Sprout, Store, type LucideIcon } from "lucide-react";
import { THB_PER_USD } from "@/lib/investor-bands";

/** Client-safe shapes and constants for Advisor › My Company (firm profiles). */

export const ADVISOR_SERVICES: { name: string; icon: LucideIcon; line: string }[] = [
  { name: "M&A advisory", icon: Handshake, line: "Sell-side and buy-side mandates, buyer search and negotiation to signing." },
  { name: "Valuation", icon: Calculator, line: "Business valuations and fairness opinions for sales and fundraising." },
  { name: "Tax", icon: Percent, line: "Deal tax structuring, tax due diligence and BOI incentives." },
  { name: "Legal", icon: Scale, line: "Share purchase agreements, legal due diligence and licences." },
  { name: "Accounting & audit", icon: FileChartColumn, line: "Audited accounts, carve-out financials and closing statements." },
  { name: "Financial due diligence", icon: Search, line: "Quality of earnings, net debt and working capital reviews." },
  { name: "Debt & financing", icon: Banknote, line: "Acquisition finance, refinancing and lender introductions." },
  { name: "Business broker", icon: Store, line: "Listing small businesses for sale and matching buyers." },
  { name: "Restructuring", icon: RefreshCw, line: "Turnarounds, debt restructuring and distressed sales." },
  { name: "ESG & sustainability", icon: Sprout, line: "Environmental and social due diligence and reporting." },
];
export const serviceOf = (n: string) => ADVISOR_SERVICES.find((s) => s.name === n) ?? ADVISOR_SERVICES[0];

export const FIRM_TYPES = ["Advisory firm", "Law firm", "Tax and accounting firm", "Valuation firm", "Business broker", "Other"];
export const LANGUAGES = ["Thai", "English", "Chinese", "Japanese", "Korean", "French", "German", "Malay", "Vietnamese"];

export type FirmStatus = "draft" | "live" | "paused";
export type FirmTeam = { id?: string; name: string; role: string | null; email: string | null };
export type FirmCredential = { id?: string; name: string; note: string | null; status: "pending" | "verified"; checkedAt: string | null };
export type FirmDocument = { id?: string; path: string; name: string; type: string | null; checkedAt: string | null; validUntil: string | null; url?: string | null };
export type FirmReview = { id: string; role: "seller" | "buyer"; detail: string | null; service: string | null; stars: number; comment: string | null; at: string };

export type AdvisorFirm = {
  id: string; refNo: string; name: string; firmType: string; logoPath: string | null; logoUrl: string | null;
  description: string | null; yearFounded: number | null; city: string | null; country: string | null;
  services: string[]; fees: Record<string, string>;
  dealMinUsdM: number | null; dealMaxUsdM: number | null; teamSize: number | null;
  languages: string[]; sectors: string[];
  legalName: string | null; thaiName: string | null; registrationNo: string | null;
  addrStreet: string | null; addrUnit: string | null; addrSubdistrict: string | null; addrDistrict: string | null;
  addrProvince: string | null; addrPostal: string | null;
  website: string | null; email: string | null; phone: string | null;
  status: FirmStatus; liveSince: string | null; verifiedAt: string | null; updatedAt: string;
  team: FirmTeam[]; credentials: FirmCredential[]; documents: FirmDocument[]; reviews: FirmReview[];
};

/** Full address in Thai order: floor/unit, no. and street, sub-district, district, province postal, country. */
export function fullAddress(f: AdvisorFirm): string {
  const prov = [f.addrProvince, f.addrPostal].filter(Boolean).join(" ");
  return [f.addrUnit, f.addrStreet, f.addrSubdistrict, f.addrDistrict, prov, f.country].filter((x) => x && String(x).trim()).join(", ");
}
/** Map query: leaves out floor/unit so Google finds the building. */
export function mapQuery(f: AdvisorFirm): string {
  const prov = [f.addrProvince, f.addrPostal].filter(Boolean).join(" ");
  return [f.addrStreet, f.addrSubdistrict, f.addrDistrict, prov, f.country].filter((x) => x && String(x).trim()).join(", ");
}

const fmtUsd = (m: number) => (m >= 1000 ? `${+(m / 1000).toFixed(1)}B` : `${+m.toFixed(1)}M`);
const roundThb = (m: number) => {
  // rounded like the investor bands: whole millions, 2 significant figures above 100M
  if (m >= 1000) return `฿${+(m / 1000).toFixed(1)}B`;
  if (m >= 100) return `฿${Math.round(m / 10) * 10}M`;
  return `฿${Math.max(1, Math.round(m))}M`;
};
export function dealSizeLabels(f: Pick<AdvisorFirm, "dealMinUsdM" | "dealMaxUsdM">): { usd: string; thb: string } | null {
  const { dealMinUsdM: lo, dealMaxUsdM: hi } = f;
  if (lo == null && hi == null) return null;
  const a = lo ?? 0;
  const usd = hi == null ? `US$${fmtUsd(a)}+` : `US$${fmtUsd(a)} – ${fmtUsd(hi)}`;
  const thb = hi == null ? `${roundThb(a * THB_PER_USD)}+` : `${roundThb(a * THB_PER_USD)} – ${roundThb(hi * THB_PER_USD).replace("฿", "")}`;
  return { usd, thb };
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

export type ChecklistKey = "logo" | "description" | "services" | "fees" | "deal" | "team-size" | "address" | "website" | "email" | "phone" | "team" | "credentials" | "documents";
export type EditSection = "firm" | "services" | "work" | "company" | "team" | "credentials" | "documents";
export function firmChecklist(f: AdvisorFirm): { key: ChecklistKey; label: string; done: boolean; section: EditSection }[] {
  return [
    { key: "logo", label: "Logo", done: !!f.logoPath, section: "firm" },
    { key: "description", label: "Description", done: !!f.description?.trim(), section: "firm" },
    { key: "services", label: "At least one service", done: f.services.length > 0, section: "services" },
    { key: "fees", label: "A fee for every service", done: f.services.length > 0 && f.services.every((s) => !!f.fees[s]?.trim()), section: "services" },
    { key: "deal", label: "Typical deal size", done: f.dealMinUsdM != null || f.dealMaxUsdM != null, section: "work" },
    { key: "team-size", label: "Team size", done: !!f.teamSize, section: "work" },
    { key: "address", label: "Address", done: !!f.addrStreet?.trim() && !!f.addrProvince?.trim(), section: "company" },
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
