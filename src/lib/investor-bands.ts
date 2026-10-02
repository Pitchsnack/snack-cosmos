/**
 * One set of US$ money bands for investor profiles: wizard, Edit profile /
 * Edit Investor, cards, panels and Browse investors filters. Baht in brackets
 * is display-only (rounded); the exact rate ฿32 = US$1 is used for conversions.
 */
export const THB_PER_USD = 32;

export type Band = { key: string; label: string; baht: string; lo: number; hi: number | null };

export const AUM_BANDS: Band[] = [
  { key: "aum_below_50", label: "Below US$50M", baht: "below ฿1.5B", lo: 0, hi: 50 },
  { key: "aum_50_100", label: "US$50M – 100M", baht: "฿1.5B – 3B", lo: 50, hi: 100 },
  { key: "aum_100_250", label: "US$100M – 250M", baht: "฿3B – 8B", lo: 100, hi: 250 },
  { key: "aum_250_500", label: "US$250M – 500M", baht: "฿8B – 15B", lo: 250, hi: 500 },
  { key: "aum_500_plus", label: "+US$500M", baht: "฿15B and above", lo: 500, hi: null },
];
export const TICKET_BANDS: Band[] = [
  { key: "tkt_below_5", label: "Below US$5M", baht: "below ฿150M", lo: 0, hi: 5 },
  { key: "tkt_5_10", label: "US$5M – 10M", baht: "฿150M – 300M", lo: 5, hi: 10 },
  { key: "tkt_10_25", label: "US$10M – 25M", baht: "฿300M – 800M", lo: 10, hi: 25 },
  { key: "tkt_25_50", label: "US$25M – 50M", baht: "฿800M – 1.5B", lo: 25, hi: 50 },
  { key: "tkt_50_plus", label: "+US$50M", baht: "฿1.5B and above", lo: 50, hi: null },
];
export const REV_BANDS: Band[] = [
  { key: "rev_below_3", label: "Below US$3M", baht: "below ฿100M", lo: 0, hi: 3 },
  { key: "rev_3_8", label: "US$3M – 8M", baht: "฿100M – 250M", lo: 3, hi: 8 },
  { key: "rev_8_15", label: "US$8M – 15M", baht: "฿250M – 500M", lo: 8, hi: 15 },
  { key: "rev_15_30", label: "US$15M – 30M", baht: "฿500M – 1B", lo: 15, hi: 30 },
  { key: "rev_30_plus", label: "+US$30M", baht: "฿1B and above", lo: 30, hi: null },
];

/** Average deal size: total value of a typical deal (same edges as the average investment). */
export const DEAL_BANDS: Band[] = [
  { key: "deal_below_5", label: "Below US$5M", baht: "below ฿150M", lo: 0, hi: 5 },
  { key: "deal_5_10", label: "US$5M – 10M", baht: "฿150M – 300M", lo: 5, hi: 10 },
  { key: "deal_10_25", label: "US$10M – 25M", baht: "฿300M – 800M", lo: 10, hi: 25 },
  { key: "deal_25_50", label: "US$25M – 50M", baht: "฿800M – 1.5B", lo: 25, hi: 50 },
  { key: "deal_50_plus", label: "+US$50M", baht: "฿1.5B and above", lo: 50, hi: null },
];

const ALL = [...AUM_BANDS, ...TICKET_BANDS, ...REV_BANDS, ...DEAL_BANDS];
export const bandOf = (key: string | null | undefined): Band | null => (key ? ALL.find((b) => b.key === key) ?? null : null);
/** "{US$ label} ({baht})" — cards and selects. */
export const bandText = (key: string | null | undefined): string | null => {
  const b = bandOf(key);
  return b ? `${b.label} (${b.baht})` : null;
};
export const AUM_KEYS = AUM_BANDS.map((b) => b.key) as [string, ...string[]];
export const TICKET_KEYS = TICKET_BANDS.map((b) => b.key) as [string, ...string[]];
export const REV_KEYS = REV_BANDS.map((b) => b.key) as [string, ...string[]];
export const DEAL_KEYS = DEAL_BANDS.map((b) => b.key) as [string, ...string[]];

/** Min / Max Ticket Size columns filled from a ticket band (US$, plain numbers). */
export function ticketColumns(key: string | null | undefined): { min: string | null; max: string | null } {
  const b = bandOf(key);
  if (!b) return { min: null, max: null };
  return { min: String(b.lo * 1e6), max: b.hi == null ? null : String(b.hi * 1e6) };
}

export const usd = (n: number) => `US$${Math.round(n).toLocaleString("en-US")}`;

// ---------- investor types ----------
export const INDIVIDUAL_TYPE = "Individual Investor";
export const WIZARD_TYPES: { value: string; label: string; hint: string }[] = [
  { value: "Family Office", label: "Family office", hint: "Invests a family's own wealth" },
  { value: "Private Equity", label: "Private equity", hint: "A fund that buys stakes in established companies" },
  { value: "Venture Capital", label: "Venture capital", hint: "A fund that backs startups and young companies" },
  { value: "Corporate VC", label: "Corporate VC", hint: "The investment arm of a company" },
  { value: "Corporate Enterprise", label: "Corporate buyer", hint: "A company buying businesses to grow" },
  { value: "Incubator/Accelerator", label: "Incubator / Accelerator", hint: "A programme that invests in early-stage founders" },
];
export const showsStages = (type: string | null | undefined) => {
  const t = (type ?? "").toLowerCase();
  return t.includes("venture") || t.includes("corporate vc") || t.includes("private equity");
};
/** Seller-facing name before an NDA. */
export const typeName = (type: string | null | undefined) => (type && type.trim() ? type : "Investor");

export const DEAL_TYPES = ["Full acquisition", "Majority stake (above 51%)", "Minority stake (below 49%)", "Growth capital", "Management buy-in"];
export const STAGE_OPTIONS = ["Seed", "Early", "Growth", "Buyout", "Mature"];
export const GEOGRAPHY = ["Thailand", "Vietnam", "Indonesia", "Malaysia", "Singapore", "Japan", "Australia", "Southeast Asia", "Asia", "Global"];
export const SECTOR_AGNOSTIC = "Sector Agnostic";
export const COUNTRIES = ["Thailand", "Singapore", "Malaysia", "Vietnam", "Indonesia", "Japan", "Hong Kong", "China", "South Korea", "Taiwan", "United States", "United Kingdom", "Other"];

// ---------- description leak check ----------
const GENERIC = new Set(["ventures", "venture", "capital", "partners", "group", "holdings", "holding", "investment", "investments", "fund", "funds", "family", "office", "company", "limited", "the", "and", "asia", "thailand", "corporation"]);
export function descriptionLeaks(text: string, firm: string, website: string): string[] {
  const t = text.toLowerCase();
  if (!t.trim()) return [];
  const found = new Set<string>();
  if (firm.trim() && t.includes(firm.trim().toLowerCase())) found.add(firm.trim());
  for (const w of firm.split(/[^\p{L}\p{N}]+/u)) {
    if (w.length >= 4 && !GENERIC.has(w.toLowerCase()) && new RegExp(`(^|[^\\p{L}\\p{N}])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}\\p{N}])`, "iu").test(text)) found.add(w);
  }
  const dom = website.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  if (dom && t.includes(dom)) found.add(dom);
  for (const m of ["@", "http", "www.", ".com", ".co.th", ".net", ".org", ".io"]) if (t.includes(m)) found.add(m);
  const phone = text.match(/\d[\d\s-]{7,}\d/);
  if (phone) found.add(phone[0]);
  return [...found];
}
export function descriptionError(text: string): string | null {
  const n = text.trim().length;
  if (!n) return null;
  if (n < 10) return "Write at least 10 characters.";
  if (n > 140) return "Keep it to 140 characters.";
  return null;
}

// ---------- year / registration ----------
export function yearError(y: string): string | null {
  const now = new Date().getFullYear();
  if (!y.trim()) return "Add the year your firm was founded.";
  if (!/^\d{4}$/.test(y)) return "Enter the year with 4 digits, e.g. 2014.";
  const n = Number(y);
  if (n > now && n - 543 >= 1800 && n - 543 <= now) return `That looks like a Thai year (พ.ศ.). Enter it in ค.ศ.: ${n - 543}.`;
  if (n < 1800 || n > now) return `Enter a year between 1800 and ${now}.`;
  return null;
}
export const regError = (reg: string, country: string) =>
  country === "Thailand" && !/^\d{13}$/.test(reg) ? "The registration number has 13 digits." : null;

export const THAI_PROVINCES_77 = [
  "Bangkok", "Amnat Charoen", "Ang Thong", "Bueng Kan", "Buriram", "Chachoengsao", "Chai Nat", "Chaiyaphum", "Chanthaburi",
  "Chiang Mai", "Chiang Rai", "Chonburi", "Chumphon", "Kalasin", "Kamphaeng Phet", "Kanchanaburi", "Khon Kaen", "Krabi",
  "Lampang", "Lamphun", "Loei", "Lopburi", "Mae Hong Son", "Maha Sarakham", "Mukdahan", "Nakhon Nayok", "Nakhon Pathom",
  "Nakhon Phanom", "Nakhon Ratchasima", "Nakhon Sawan", "Nakhon Si Thammarat", "Nan", "Narathiwat", "Nong Bua Lamphu",
  "Nong Khai", "Nonthaburi", "Pathum Thani", "Pattani", "Phang Nga", "Phatthalung", "Phayao", "Phetchabun", "Phetchaburi",
  "Phichit", "Phitsanulok", "Phra Nakhon Si Ayutthaya", "Phrae", "Phuket", "Prachinburi", "Prachuap Khiri Khan", "Ranong",
  "Ratchaburi", "Rayong", "Roi Et", "Sa Kaeo", "Sakon Nakhon", "Samut Prakan", "Samut Sakhon", "Samut Songkhram", "Saraburi",
  "Satun", "Sing Buri", "Sisaket", "Songkhla", "Sukhothai", "Suphan Buri", "Surat Thani", "Surin", "Tak", "Trang", "Trat",
  "Ubon Ratchathani", "Udon Thani", "Uthai Thani", "Uttaradit", "Yala", "Yasothon",
];
