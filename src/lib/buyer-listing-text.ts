import { bandOf, INDIVIDUAL_TYPE, SECTOR_AGNOSTIC, sortActsFor } from "./investor-bands";
import { descriptionWords } from "./buyer-description";
import { contactPlace, basedIn } from "./marketplace-contacts";

export type BuyerListingLanguage = "en" | "th";
export type BuyerListingAnswers = {
  relation: "individual" | "corporate" | "agent" | null;
  type: string;
  actsFor?: string[];
  dealTypes: string[];
  industries: string[];
  geography: string[];
  province?: string;
  city?: string;
  country?: string;
  year?: string;
  ticketBand?: string;
  revenueBand?: string;
};
export type BuyerListingTexts = { want: string; wantTh: string; description: string; descriptionTh: string };

export const BUYER_DESCRIPTION_TYPE_WORDS: Record<string, { en: string; th: string }> = {
  "Family Office": { en: "family office", th: "แฟมิลี่ออฟฟิศ" },
  "Private Equity": { en: "private equity firm", th: "บริษัทไพรเวทอิควิตี้" },
  "Venture Capital": { en: "venture capital firm", th: "บริษัทเวนเจอร์แคปิทัล" },
  "Corporate VC": { en: "corporate venture capital firm", th: "บริษัทคอร์ปอเรตเวนเจอร์แคปิทัล" },
  "Corporate Enterprise": { en: "corporate buyer", th: "ผู้ซื้อนิติบุคคล" },
  "Incubator/Accelerator": { en: "incubator and accelerator", th: "ตู้ฟักธุรกิจและบ่มเพาะธุรกิจ" },
  [INDIVIDUAL_TYPE]: { en: "individual investor", th: "นักลงทุนรายบุคคล" },
};

const DEAL_WORDS: Record<string, { en: string; th: string }> = {
  "Full acquisition": { en: "full acquisitions", th: "การซื้อกิจการทั้งหมด" },
  "Majority stake (above 51%)": { en: "majority stakes", th: "การถือหุ้นส่วนใหญ่" },
  "Minority stake (below 49%)": { en: "minority stakes", th: "การถือหุ้นส่วนน้อย" },
  "Growth capital": { en: "growth capital", th: "การให้เงินทุนเพื่อการเติบโต" },
  "Management buy-in": { en: "management buy-ins", th: "การเข้าซื้อกิจการโดยผู้บริหารภายนอก" },
};

const INDUSTRY_WORDS: Record<string, { en: string; th: string }> = {
  Commerce: { en: "commerce", th: "พาณิชย์" },
  "Health Care Services": { en: "healthcare", th: "การแพทย์" },
  "Media & Publishing": { en: "media and publishing", th: "สื่อและสิ่งพิมพ์" },
  "Professional Services": { en: "professional services", th: "บริการเฉพาะกิจ" },
  "Tourism & Leisure": { en: "tourism and leisure", th: "การท่องเที่ยวและสันทนาการ" },
  "Transportation & Logistics": { en: "transportation and logistics", th: "ขนส่งและโลจิสติกส์" },
  "Information & Communication Technology": { en: "technology", th: "เทคโนโลยี" },
  "Electronic Components": { en: "electronic components", th: "ชิ้นอิเล็กทรอนิกส์" },
  Agribusiness: { en: "agribusiness", th: "ธุรกิจการเกษตร" },
  "Food & Beverage": { en: "food and beverage", th: "อาหารและเครื่องดื่ม" },
  "Finance & Securities": { en: "finance and securities", th: "เงินทุนและหลักทรัพย์" },
  Insurance: { en: "insurance", th: "ประกันภัย" },
  Banking: { en: "banking", th: "ธนาคาร" },
  Fashion: { en: "fashion", th: "แฟชั่น" },
  "Home & Office Products": { en: "home and office products", th: "ของใช้ในครัวเรือนและสำนักงาน" },
  "Personal Products & Pharmaceuticals": { en: "personal products and pharmaceuticals", th: "ของใช้ส่วนตัวและเวชภัณฑ์" },
  "Property Development": { en: "property development", th: "พัฒนาอสังหาริมทรัพย์" },
  "Construction Services": { en: "construction services", th: "บริการรับเหมาก่อสร้าง" },
  Automotive: { en: "automotive", th: "ยานยนต์" },
  "Industrial Materials & Machinery": { en: "industrial materials and machinery", th: "วัสดุอุตสาหกรรมและเครื่องจักร" },
  Packaging: { en: "packaging", th: "บรรจุภัณฑ์" },
};

const join = (values: string[], lang: BuyerListingLanguage) => values.length < 2
  ? (values[0] ?? "")
  : lang === "th"
    ? `${values.slice(0, -1).join(", ")}และ${values[values.length - 1]}`
    : `${values.slice(0, -1).join(", ")} and ${values[values.length - 1]}`;

export const buyerListingTextLength = (value: string) => Array.from(value).length;

function cap80(value: string): string {
  if (buyerListingTextLength(value) <= 80) return value;
  const chars = Array.from(value).slice(0, 80).join("");
  return /[\u0E00-\u0E7F]/.test(chars) ? chars.trimEnd() : chars.replace(/\s+\S*$/, "").trimEnd();
}

function wantToBuy(a: BuyerListingAnswers, lang: BuyerListingLanguage): string {
  const agnostic = a.industries.includes(SECTOR_AGNOSTIC);
  const deals = a.dealTypes.map((key) => DEAL_WORDS[key]?.[lang] ?? key);
  const industries = a.industries.filter((key) => key !== SECTOR_AGNOSTIC).map((key) => INDUSTRY_WORDS[key]?.[lang] ?? key.toLowerCase());
  const geography = a.geography.filter(Boolean);
  const build = (dealCount: number, industryCount: number, geographyCount: number) => {
    const dealText = join(deals.slice(0, dealCount), lang) || (lang === "th" ? "การลงทุน" : "Investment");
    if (agnostic) return lang === "th" ? `${dealText}ในธุรกิจทุกอุตสาหกรรม` : `${dealText} in businesses of any industry`;
    const places = geography.slice(0, geographyCount);
    const global = places.includes("Global");
    const placeText = join(places.filter((place) => place !== "Global").map((place) => lang === "th" && place === "Thailand" ? "ประเทศไทย" : contactPlace(place, lang)), lang);
    const industryText = join(industries.slice(0, industryCount), lang);
    if (lang === "th") {
      return `${dealText}ใน${industryText ? `ธุรกิจ${industryText}` : "ธุรกิจ"}${global ? "ทั่วโลก" : placeText ? `ใน${placeText}` : ""}`;
    }
    return `${dealText} in ${industryText ? `${industryText} ` : ""}businesses${global ? " worldwide" : placeText ? ` in ${placeText}` : ""}`;
  };
  let out = build(deals.length, industries.length, geography.length);
  if (buyerListingTextLength(out) > 80) out = build(deals.length, industries.length, Math.min(1, geography.length));
  if (buyerListingTextLength(out) > 80) out = build(deals.length, Math.min(2, industries.length), Math.min(1, geography.length));
  if (buyerListingTextLength(out) > 80) out = build(Math.min(1, deals.length), Math.min(2, industries.length), Math.min(1, geography.length));
  const sentence = lang === "en" && out ? out[0]!.toUpperCase() + out.slice(1) : out;
  return cap80(sentence);
}

function moneyBand(key: string | undefined, kind: "ticket" | "revenue", lang: BuyerListingLanguage): string {
  const band = bandOf(key);
  if (!band) return "";
  if (kind === "ticket" && band.key === "tkt_below_5") return lang === "th" ? "ต่ำกว่า US$5M" : "under US$5M";
  if (kind === "ticket" && band.key === "tkt_50_plus") return lang === "th" ? "มากกว่า US$50M" : "over US$50M";
  if (kind === "revenue") return `US$${band.lo}M`;
  return band.label.replace(/\s*–\s*(?:US\$)?/u, "–").replace(/^\+/, lang === "th" ? "มากกว่า " : "over ");
}

function typeWords(a: BuyerListingAnswers, lang: BuyerListingLanguage, maxTypes = Number.POSITIVE_INFINITY): string {
  if (a.relation === "agent") {
    const types = sortActsFor(a.actsFor?.length ? a.actsFor : [a.type]).slice(0, maxTypes).map((type) => {
      const words = BUYER_DESCRIPTION_TYPE_WORDS[type]?.[lang] ?? type.toLowerCase();
      if (lang === "th") return words;
      return words.endsWith("family office") ? words.replace(/family office$/, "family offices") : words.endsWith("firm") ? `${words}s` : words;
    });
    return lang === "th" ? `ที่ปรึกษาแทน${join(types, lang)}` : `adviser acting for ${join(types, lang)}`;
  }
  const key = a.relation === "individual" ? INDIVIDUAL_TYPE : a.type;
  return BUYER_DESCRIPTION_TYPE_WORDS[key]?.[lang] ?? (key ? key.toLowerCase() : lang === "th" ? "นักลงทุน" : "investor");
}

function article(value: string): string {
  return /^[aeiou]/i.test(value) ? "An" : "A";
}

function placeOf(a: BuyerListingAnswers, lang: BuyerListingLanguage): string {
  const country = a.country || "Thailand";
  const place = country === "Thailand" ? a.province || a.city : a.city || a.province;
  return basedIn(place || null, country, lang);
}

function description(a: BuyerListingAnswers, lang: BuyerListingLanguage): string {
  const ticket = moneyBand(a.ticketBand, "ticket", lang);
  const revenue = a.revenueBand && a.revenueBand !== "rev_below_3" ? moneyBand(a.revenueBand, "revenue", lang) : "";
  const place = placeOf(a, lang);
  const year = a.relation !== "individual" && /^\d{4}$/.test(a.year ?? "") ? a.year! : "";
  const build = (includeYear: boolean, includeRevenue: boolean, maxTypes = Number.POSITIVE_INFINITY) => {
    const type = typeWords(a, lang, maxTypes);
    if (lang === "th") {
      const first = `${type}${place ? `ใน${place}` : ""}${includeYear && year ? ` ดำเนินงานมาตั้งแต่ปี ${year}` : ""}`;
      return `${first} ลงทุนดีลละ ${ticket || "ตามเกณฑ์ของบริษัท"}${includeRevenue && revenue ? ` ในบริษัทที่มีรายได้มากกว่า ${revenue}` : ""}`;
    }
    const first = `${article(type)} ${type}${place ? ` based in ${place}` : ""}${includeYear && year ? `${place ? "," : ""} operating since ${year}` : ""}.`;
    return `${first} Invests ${ticket || "by its own criteria"} per deal${includeRevenue && revenue ? ` in companies with revenue above ${revenue}` : ""}.`;
  };
  let out = build(true, true);
  if (descriptionWords(out) > 25) out = build(false, true);
  if (descriptionWords(out) > 25) out = build(false, false);
  if (descriptionWords(out) > 25 && a.relation === "agent") out = build(false, false, 2);
  if (descriptionWords(out) > 25 && a.relation === "agent") out = build(false, false, 1);
  return out;
}

/** Written only from wizard answers; callers fill blank fields and never replace buyer text. */
export function writeBuyerListingTexts(a: BuyerListingAnswers): BuyerListingTexts {
  return {
    want: wantToBuy(a, "en"),
    wantTh: wantToBuy(a, "th"),
    description: description(a, "en"),
    descriptionTh: description(a, "th"),
  };
}
