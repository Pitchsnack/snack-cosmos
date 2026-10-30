/**
 * Businesses Wanted — browser-safe rules shared by the page, the cards and the server:
 * the 28 SET sectors, cover colours, baht ranges, the four-check match, cities and dates.
 */

export type BoKind = "sealed" | "advertisement";
export type BoStatus = "draft" | "waiting" | "sent_back" | "posted" | "closed";
export type BoAppStatus = "new" | "nda_requested" | "not_a_fit";
export type BoPersona = "seller" | "buyer" | "advisor";
/** Control's Buyer view stays sealed-only; other personas use the standard view. */
export const sealedOnly = (role: string | null, persona: BoPersona) => role === "admin" && persona === "buyer";
export const managedApplyState = (eligibleIds: string[], appliedIds: string[]) =>
  !eligibleIds.length ? "none" : eligibleIds.every((id) => appliedIds.includes(id)) ? "applied" : "available";
export const canShareOrder = (role: string | null, ownAdvertisement: boolean) => !!role && (role === "admin" || !ownAdvertisement);

export type BoGroup = { group: string; th: string; icon: string; sectors: { name: string; th: string; icon: string }[] };

export const BO_GROUPS: BoGroup[] = [
  { group: "Agro & Food Industry", th: "เกษตรและอุตสาหกรรมอาหาร", icon: "wheat", sectors: [
    { name: "Agribusiness", th: "ธุรกิจการเกษตร", icon: "sprout" },
    { name: "Food & Beverage", th: "อาหารและเครื่องดื่ม", icon: "utensils" },
  ] },
  { group: "Consumer Products", th: "สินค้าอุปโภคบริโภค", icon: "shopping-bag", sectors: [
    { name: "Fashion", th: "แฟชั่น", icon: "shirt" },
    { name: "Home & Office Products", th: "ของใช้ในครัวเรือนและสำนักงาน", icon: "armchair" },
    { name: "Personal Products & Pharmaceuticals", th: "ของใช้ส่วนตัวและเวชภัณฑ์", icon: "pill" },
  ] },
  { group: "Financials", th: "ธุรกิจการเงิน", icon: "landmark", sectors: [
    { name: "Banking", th: "ธนาคาร", icon: "landmark" },
    { name: "Finance & Securities", th: "เงินทุนและหลักทรัพย์", icon: "trending-up" },
    { name: "Insurance", th: "ประกันภัยและประกันชีวิต", icon: "shield-check" },
  ] },
  { group: "Industrials", th: "สินค้าอุตสาหกรรม", icon: "factory", sectors: [
    { name: "Automotive", th: "ยานยนต์", icon: "car" },
    { name: "Industrial Materials & Machinery", th: "วัสดุอุตสาหกรรมและเครื่องจักร", icon: "cog" },
    { name: "Paper & Printing Materials", th: "กระดาษและวัสดุการพิมพ์", icon: "printer" },
    { name: "Petrochemicals & Chemicals", th: "ปิโตรเคมีและเคมีภัณฑ์", icon: "flask-conical" },
    { name: "Packaging", th: "บรรจุภัณฑ์", icon: "package" },
    { name: "Steel and Metal Products", th: "เหล็กและผลิตภัณฑ์โลหะ", icon: "factory" },
  ] },
  { group: "Property & Construction", th: "อสังหาริมทรัพย์และก่อสร้าง", icon: "building", sectors: [
    { name: "Construction Materials", th: "วัสดุก่อสร้าง", icon: "brick-wall" },
    { name: "Construction Services", th: "บริการรับเหมาก่อสร้าง", icon: "hard-hat" },
    { name: "Property Development", th: "พัฒนาอสังหาริมทรัพย์", icon: "building" },
    { name: "Property Fund & REITs", th: "กองทุนรวมอสังหาริมทรัพย์และ REITs", icon: "house" },
  ] },
  { group: "Resources", th: "ทรัพยากร", icon: "zap", sectors: [
    { name: "Energy & Utilities", th: "พลังงานและสาธารณูปโภค", icon: "zap" },
    { name: "Mining", th: "เหมืองแร่", icon: "pickaxe" },
  ] },
  { group: "Services", th: "บริการ", icon: "briefcase", sectors: [
    { name: "Commerce", th: "พาณิชย์", icon: "shopping-bag" },
    { name: "Health Care Services", th: "การแพทย์", icon: "stethoscope" },
    { name: "Media & Publishing", th: "สื่อและสิ่งพิมพ์", icon: "newspaper" },
    { name: "Professional Services", th: "บริการเฉพาะกิจ", icon: "briefcase" },
    { name: "Tourism & Leisure", th: "การท่องเที่ยวและสันทนาการ", icon: "hotel" },
    { name: "Transportation & Logistics", th: "ขนส่งและโลจิสติกส์", icon: "truck" },
  ] },
  { group: "Technology", th: "เทคโนโลยี", icon: "cpu", sectors: [
    { name: "Electronic Components", th: "ชิ้นส่วนอิเล็กทรอนิกส์", icon: "cpu" },
    { name: "Information & Communication Technology", th: "เทคโนโลยีสารสนเทศและการสื่อสาร", icon: "laptop" },
  ] },
];

export const BO_SECTORS = BO_GROUPS.flatMap((g) => g.sectors.map((s) => ({ ...s, group: g.group })));
export const boSector = (name: string | null | undefined) => BO_SECTORS.find((s) => s.name === name) ?? null;
export const boGroupOf = (sector: string | null | undefined) => BO_GROUPS.find((g) => g.sectors.some((s) => s.name === sector)) ?? null;
export const sectorOrder = (name: string) => { const i = BO_SECTORS.findIndex((s) => s.name === name); return i < 0 ? 999 : i; };

/** 140° cover gradient by group: [0%, 55%, 100%]; the middle colour is used for tiles. */
const COVERS: Record<string, [string, string, string]> = {
  amber: ["#7A3E06", "#B45309", "#D9892B"],
  teal: ["#0B4F4A", "#0F766E", "#3A9A8F"],
  violet: ["#3B1F75", "#5B3BA8", "#8669CC"],
  slate: ["#29313F", "#475266", "#6F7B90"],
  wine: ["#6E1730", "#9F2A4B", "#C8607A"],
  blue: ["#13306E", "#1E4FA8", "#4C7BD1"],
};
const GROUP_COVER: Record<string, keyof typeof COVERS> = {
  "Agro & Food Industry": "amber", Resources: "amber", "Consumer Products": "teal", Financials: "violet", Technology: "violet",
  Industrials: "slate", "Property & Construction": "wine", Services: "blue",
};
export function coverOf(sector: string | null | undefined) {
  const c = COVERS[GROUP_COVER[boGroupOf(sector)?.group ?? ""] ?? "slate"];
  return { gradient: `linear-gradient(140deg, ${c[0]} 0%, ${c[1]} 55%, ${c[2]} 100%)`, mid: c[1] };
}
/** The app's 21-sector list maps onto the SET list by name; "Other" has no SET sector. */
export const toBoSector = (appSector: string | null | undefined) => (boSector(appSector) ? appSector! : null);

// ---------- sizes, places, deals ----------
export const BO_LOCATIONS = ["Thailand", "Vietnam", "Malaysia", "Indonesia", "Southeast Asia"] as const;
export const PROPERTY_SIZES = ["Any", "1 rai or more", "2 rai or more", "5 rai or more", "10 rai or more", "20 rai or more", "50 rai or more"];
export const FACTORY_SIZES = ["Any", "500 sqm or more", "1,000 sqm or more", "2,000 sqm or more", "5,000 sqm or more", "10,000 sqm or more", "20,000 sqm or more"];
export const BO_DEAL_TYPES = ["Full acquisition", "Majority stake (above 51%)", "Minority stake (below 49%)", "Growth capital", "Management buy-in"];
export const PERIODS = [3, 6, 12] as const;
/** "10 rai or more" → 16,000 sqm (1 rai = 1,600 sqm). */
export const raiSqm = (size: string) => { const m = /^(\d+) rai/.exec(size); return m ? (Number(m[1]) * 1600).toLocaleString("en-US") : null; };

// ---------- baht ranges (THB millions; lower edge included, upper excluded) ----------
export type Range = { label: string; lo: number; hi: number };
const INF = Number.POSITIVE_INFINITY;
export const SELLER_BANDS: Range[] = [
  { label: "Under ฿50M", lo: 0, hi: 50 }, { label: "฿50M – 100M", lo: 50, hi: 100 }, { label: "฿100M – 250M", lo: 100, hi: 250 },
  { label: "฿250M – 500M", lo: 250, hi: 500 }, { label: "฿500M – 1B", lo: 500, hi: 1000 }, { label: "Over ฿1B", lo: 1000, hi: INF },
];
export const BO_RANGES: Range[] = [
  { label: "Under ฿50M", lo: 0, hi: 50 }, { label: "฿50M – 100M", lo: 50, hi: 100 }, { label: "฿50M – 250M", lo: 50, hi: 250 },
  { label: "฿100M – 250M", lo: 100, hi: 250 }, { label: "฿100M – 500M", lo: 100, hi: 500 }, { label: "฿250M – 500M", lo: 250, hi: 500 },
  { label: "฿250M – 1B", lo: 250, hi: 1000 }, { label: "฿500M – 1B", lo: 500, hi: 1000 }, { label: "Over ฿1B", lo: 1000, hi: INF },
];
export const rangeOf = (label: string | null | undefined) => BO_RANGES.find((r) => r.label === label) ?? SELLER_BANDS.find((r) => r.label === label) ?? null;
export const overlaps = (a: Range | null, b: Range | null) => !!a && !!b && a.lo < b.hi && b.lo < a.hi;

/** The seller's FY25 revenue as stored by the wizard ("Below ฿50M", "฿1B +", …) → a seller band. */
export function sellerBand(raw: string | null | undefined): Range | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  if (/^(below|under|ต่ำกว่า)/i.test(v)) return SELLER_BANDS[0];
  if (/1B\s*\+|over ฿?1B|มากกว่า/i.test(v)) return SELLER_BANDS[5];
  return SELLER_BANDS.find((b) => b.label.replace(/\s/g, "") === v.replace(/\s/g, "")) ?? null;
}

// ---------- match ----------
export type ListingFacts = { sector: string | null; country: string | null; revenue: string | null; dealType: string | null };
export type MatchRow = { key: "industry" | "location" | "revenue" | "deal"; ok: boolean };
export function matchOf(l: ListingFacts, bo: { sector: string; location: string; target_revenue: string; deal_types: string[] }) {
  const rows: MatchRow[] = [
    { key: "industry", ok: !!l.sector && l.sector === bo.sector },
    { key: "location", ok: bo.location === "Southeast Asia" || (!!l.country && l.country === bo.location) },
    { key: "revenue", ok: overlaps(sellerBand(l.revenue), rangeOf(bo.target_revenue)) },
    { key: "deal", ok: !!l.dealType && bo.deal_types.includes(l.dealType) },
  ];
  return { rows, n: rows.filter((r) => r.ok).length };
}

// ---------- cities ----------
export function citiesOf(text: string | null | undefined): string[] {
  const v = (text ?? "").trim();
  if (!v || /^any$/i.test(v)) return [];
  return v.split(/,|\bor\b|หรือ/i).map((s) => s.trim()).filter((s) => s && !/^any$/i.test(s));
}
export const placeOf = (cities: string, location: string) => (citiesOf(cities).length ? `${cities}, ${location}` : location);

// ---------- dates (Bangkok) ----------
const BKK = 7 * 3600_000;
/** Today's Bangkok calendar day as YYYY-MM-DD. */
export const bkkToday = (now = Date.now()) => new Date(now + BKK).toISOString().slice(0, 10);
export function addMonths(day: string, months: number) {
  const [y, m, d] = day.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(d, last));
  return t.toISOString().slice(0, 10);
}
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86400_000);
/** Posted and its closing day not yet come. */
export const isOpen = (status: BoStatus, closesOn: string | null, now = Date.now()) => status === "posted" && (!closesOn || closesOn > bkkToday(now));
export const effectiveStatus = (status: BoStatus, closesOn: string | null, now = Date.now()): BoStatus =>
  status === "posted" && closesOn && closesOn <= bkkToday(now) ? "closed" : status;
export const isNew = (postedAt: string | null, now = Date.now()) => !!postedAt && now - Date.parse(postedAt) < 7 * 86400_000;
/** "Closes in {n} days" while 1–14 days away; else null. */
export function closesInDays(closesOn: string | null, now = Date.now()) {
  if (!closesOn) return null;
  const n = daysBetween(bkkToday(now), closesOn);
  return n >= 1 && n <= 14 ? n : null;
}

const MON_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MON_TH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
/** "30 Nov 2026" / "30 พ.ย. 2569"; a timestamp is read as its Bangkok day. */
export function fmtDay(v: string | null | undefined, th = false, withYear = true) {
  if (!v) return "";
  const day = v.length > 10 ? bkkToday(Date.parse(v)) : v;
  const [y, m, d] = day.split("-").map(Number);
  const mon = (th ? MON_TH : MON_EN)[m - 1];
  return withYear ? `${d} ${mon} ${th ? y + 543 : y}` : `${d} ${mon}`;
}

// ---------- the buy order form (shared by the browser and the server) ----------
export type BoDraft = {
  clientId?: string | null; sector: string; name: string; description: string; location: string; cities: string;
  propertySize: string; factorySize: string; products: string; targetRevenue: string; priceRange: string;
  dealTypes: string[]; mustHave: string; niceToHave: string; profit: string; timing: string; periodMonths: number;
};
export type BoField = keyof BoDraft;
export const emptyDraft = (): BoDraft => ({
  clientId: null, sector: "", name: "", description: "", location: "Thailand", cities: "", propertySize: "Any", factorySize: "Any",
  products: "", targetRevenue: "", priceRange: "", dealTypes: BO_DEAL_TYPES.slice(0, 2) as unknown as string[], mustHave: "", niceToHave: "",
  profit: "", timing: "", periodMonths: 3,
});
export const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 20);
/** The form's checks (section 10.1). Returns the fields in error, in form order. */
export function checkDraft(d: BoDraft, needClient: boolean): Partial<Record<BoField, "pick" | "description" | "deal" | "long">> {
  const e: Partial<Record<BoField, "pick" | "description" | "deal" | "long">> = {};
  if (needClient && !d.clientId) e.clientId = "pick";
  if (!boSector(d.sector)) e.sector = "pick";
  if (d.name.trim().length > 40) e.name = "long";
  const n = d.description.trim().length;
  if (n < 10 || n > 280) e.description = "description";
  if (!(BO_LOCATIONS as readonly string[]).includes(d.location)) e.location = "pick";
  if (!(PROPERTY_SIZES as readonly string[]).includes(d.propertySize)) e.propertySize = "pick";
  if (!(FACTORY_SIZES as readonly string[]).includes(d.factorySize)) e.factorySize = "pick";
  if (!BO_RANGES.some((r) => r.label === d.targetRevenue)) e.targetRevenue = "pick";
  if (!BO_RANGES.some((r) => r.label === d.priceRange)) e.priceRange = "pick";
  if (!d.dealTypes.length || d.dealTypes.some((x) => !(BO_DEAL_TYPES as readonly string[]).includes(x))) e.dealTypes = "deal";
  if (!(PERIODS as readonly number[]).includes(d.periodMonths)) e.periodMonths = "pick";
  return e;
}
/** The row's columns from a checked draft. */
export const draftRow = (d: BoDraft) => ({
  sector: d.sector, name_on_card: d.name.trim() || d.sector, description: d.description.trim(), location: d.location,
  cities: d.cities.trim() || "Any", property_size: d.propertySize, factory_size: d.factorySize, products: d.products.trim() || null,
  target_revenue: d.targetRevenue, price_range: d.priceRange, deal_types: d.dealTypes, must_have: lines(d.mustHave), nice_to_have: lines(d.niceToHave),
  profit: d.profit.trim() || null, timing: d.timing.trim() || null, period_months: d.periodMonths,
});
export const periodLabel = (m: number, th = false) => (m === 12 ? (th ? "รายปี" : "Annual") : th ? `${m} เดือน` : `${m} months`);
