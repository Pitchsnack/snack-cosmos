/**
 * Shared Edit information words (seller brief: About Company grid + Thai).
 * One entry per string, used by every page that shows the same field, option
 * or chip. Interface text only — never user-authored content.
 *
 * Two kinds:
 * - EDIT_INFO_TH: labels, hints, Missing lines, placeholders and buttons.
 *   These follow the APP language (merged into the shared lookup in
 *   language.tsx).
 * - The *Label helpers and maps: list options and chips. These follow the
 *   "Texts in" language on pages that have the switch, and the app language
 *   everywhere else. The saved value never changes.
 */

export const EDIT_INFO_TH: Record<string, string> = {
  // 2.1 Header, footer and buttons
  "Listing view": "มุมมองรายการ",
  "Exclusive view": "มุมมองพิเศษ",
  "Cancel": "ยกเลิก",
  "Save changes": "บันทึกการเปลี่ยนแปลง",
  "Save Changes": "บันทึกการเปลี่ยนแปลง",
  "Saving…": "กำลังบันทึก…",
  "Auto Enrich": "เติมข้อมูลอัตโนมัติ",
  "Enriching…": "กำลังเติมข้อมูล…",
  "Add": "เพิ่ม",
  "Suggest": "แนะนำ",
  "(optional)": "(ไม่บังคับ)",

  // 2.2 Listing view › Listing Identity
  "Listing Identity": "ข้อมูลประกาศ",
  "Deal Terms": "เงื่อนไขดีล",
  "Marketplace listing name": "ชื่อประกาศใน Marketplace",
  "Auto-fill this tab": "เติมข้อมูลแท็บนี้อัตโนมัติ",
  "Buyer preview": "ตัวอย่างที่ผู้ซื้อเห็น",
  "Listing name": "ชื่อประกาศ",
  "Type a name or pick a suggestion": "พิมพ์ชื่อหรือเลือกจากชื่อที่แนะนำ",
  "Headline": "หัวข้อ",
  "Description": "คำอธิบาย",
  "Highlights": "จุดเด่น",
  "3 required": "ต้องมี 3 ข้อ",
  "Highlight 4 (optional)": "จุดเด่นที่ 4 (ไม่บังคับ)",

  // 2.3 Exclusive view › About Company
  "Year Founded": "ปีที่ก่อตั้ง",
  "Company Name": "ชื่อบริษัท",
  "Registered Number": "เลขทะเบียนนิติบุคคล",
  "e.g. 0105555078063": "เช่น 0105555078063",
  "Company Type": "ประเภทบริษัท",
  "Company Size": "ขนาดบริษัท",
  "Region": "ภูมิภาค",
  "Last Year's Revenue (THB)": "รายได้ปีที่แล้ว (บาท)",
  "Last Year's Revenue (USD)": "รายได้ปีที่แล้ว (ดอลลาร์สหรัฐ)",
  "Headquarters": "สำนักงานใหญ่",
  "City": "เมือง",
  "Email": "อีเมล",
  "Website": "เว็บไซต์",
  "LinkedIn URL": "ลิงก์ LinkedIn",
  "https://www.linkedin.com/company/… (optional)": "https://www.linkedin.com/company/... (ไม่บังคับ)",
  "Short Description": "คำอธิบายสั้น",
  "Long Description": "คำอธิบายแบบละเอียด",
  "Select country...": "เลือกประเทศ…",
  "Select country": "เลือกประเทศ",
  "e.g. 2020": "เช่น 2020",
  "Acme Inc.": "เช่น บริษัท ตัวอย่าง จำกัด",
  "e.g. Acme Technologies": "เช่น บริษัท ตัวอย่าง จำกัด",
  "Company Info": "ข้อมูลบริษัท",

  // 2.4 Exclusive view › Address
  "Registered Name": "ชื่อที่จดทะเบียน",
  "Official registered company name": "ชื่อบริษัทตามที่จดทะเบียนอย่างเป็นทางการ",
  "Business Address": "ที่อยู่ธุรกิจ",

  // 2.5 Exclusive view › Industry & Market
  "how the market describes this company": "คำที่ตลาดใช้อธิบายบริษัทนี้",
  "⚠ Missing: pick at least one industry": "⚠ ยังขาด: เลือกอุตสาหกรรมอย่างน้อยหนึ่งรายการ",
  "Add custom industry…": "เพิ่มอุตสาหกรรมเอง…",
  "Add custom industry...": "เพิ่มอุตสาหกรรมเอง…",
  "Sector": "กลุ่มอุตสาหกรรม",
  "SET classification, used for financial benchmarking": "การจัดกลุ่มของ SET ใช้เทียบเคียงตัวเลขทางการเงิน",
  "Search or pick a sector…": "ค้นหาหรือเลือกกลุ่มอุตสาหกรรม…",
  "Business model": "รูปแบบธุรกิจ",
  "Choose a business model…": "เลือกรูปแบบธุรกิจ…",
  "⚠ Missing: add at least one product tag": "⚠ ยังขาด: เพิ่มแท็กสินค้าอย่างน้อยหนึ่งแท็ก",

  // 2.6 Exclusive view › About Owner
  "⚠ Missing: add at least one founder": "⚠ ยังขาด: เพิ่มผู้ก่อตั้งอย่างน้อยหนึ่งคน",
  "Add founder": "เพิ่มผู้ก่อตั้ง",

  // Section 4 — Buyer preview card
  "Business": "ธุรกิจ",
  "Your headline": "หัวข้อของท่าน",
  "Products & services": "สินค้าและบริการ",
  "Markets": "ตลาด",
};

/** "⚠ Missing: {label}" — the app's own word is ยังขาด (Images & Logo). */
export function missingLine(label: string, th: boolean): string {
  return th ? `⚠ ยังขาด: ${label}` : `⚠ Missing: ${label}`;
}

/* ---------------- options and chips (follow Texts in) ---------------- */

export type OptLang = "en" | "th";

export const INDUSTRY_TH: Record<string, string> = {
  "FinTech": "ฟินเทค",
  "eCommerce & Marketplace": "อีคอมเมิร์ซและมาร์เก็ตเพลส",
  "MarTech": "มาร์เทค",
  "HealthTech": "เฮลท์เทค",
  "Sustainability": "ความยั่งยืน",
  "Mobility & Logistics": "การเดินทางและโลจิสติกส์",
  "DeepTech": "ดีพเทค",
  "Defense": "กลาโหม",
  "EdTech": "เอ็ดเทค",
  "Gaming": "เกม",
  "PropTech": "พร็อพเทค",
  "AgriTech": "อะกริเทค",
  "FMCG": "สินค้าอุปโภคบริโภค (FMCG)",
  "Others": "อื่นๆ",
};

export const LICENCE_TH: Record<string, string> = {
  "BOT – e-Money licence": "ธปท. – ใบอนุญาตเงินอิเล็กทรอนิกส์",
  "BOT – Payment agent": "ธปท. – ตัวแทนรับชำระเงิน",
  "SEC licence": "ใบอนุญาต ก.ล.ต.",
  "Thai FDA (อย.)": "อย.",
  "BOI promotion": "การส่งเสริมการลงทุน (BOI)",
  "TISI (มอก.)": "มอก.",
  "Halal certification": "การรับรองฮาลาล",
  "Factory licence (รง.4)": "ใบอนุญาตประกอบกิจการโรงงาน (รง.4)",
};

export const ISO_TH: Record<string, string> = {
  "ISO 9001 – Quality": "ISO 9001 – คุณภาพ",
  "ISO 14001 – Environment": "ISO 14001 – สิ่งแวดล้อม",
  "ISO 22000 – Food safety": "ISO 22000 – ความปลอดภัยของอาหาร",
  "ISO 27001 – Information security": "ISO 27001 – ความมั่นคงปลอดภัยสารสนเทศ",
  "ISO 45001 – Health & safety": "ISO 45001 – อาชีวอนามัยและความปลอดภัย",
  "ISO 13485 – Medical devices": "ISO 13485 – เครื่องมือแพทย์",
  "HACCP": "HACCP",
  "GMP": "GMP",
};

/** Company size bands: the band stays, the unit word translates. */
export function sizeLabel(v: string, lang: OptLang): string {
  if (lang !== "th") return `${v} employees`;
  return v === "1000+" ? "มากกว่า 1,000 คน" : `${v} คน`;
}

/** Region codes (APAC, EMEA, …) are standard abbreviations: same in both. */
export function regionLabel(v: string, _lang: OptLang): string {
  return v;
}

const COUNTRY_TH: Record<string, string> = {
  "Thailand": "ประเทศไทย",
  "Singapore": "สิงคโปร์",
  "Malaysia": "มาเลเซีย",
  "Vietnam": "เวียดนาม",
  "Indonesia": "อินโดนีเซีย",
  "Philippines": "ฟิลิปปินส์",
  "Myanmar": "เมียนมาร์",
  "Cambodia": "กัมพูชา",
  "Laos": "ลาว",
  "Japan": "ญี่ปุ่น",
  "Hong Kong": "ฮ่องกง",
  "China": "จีน",
  "South Korea": "เกาหลีใต้",
  "Taiwan": "ไต้หวัน",
  "India": "อินเดีย",
  "Australia": "ออสเตรเลีย",
  "United States": "สหรัฐอเมริกา",
  "United Kingdom": "สหราชอาณาจักร",
  "Germany": "เยอรมนี",
  "France": "ฝรั่งเศส",
};

/** A country's display name; the saved value stays the English name. */
export function countryLabel(v: string, lang: OptLang): string {
  return lang === "th" ? COUNTRY_TH[v] ?? v : v;
}

export const BUSINESS_MODEL_TH: Record<string, string> = {
  "Operator": "ผู้ดำเนินการ",
  "Platform / marketplace": "แพลตฟอร์ม / มาร์เก็ตเพลส",
  "Software / SaaS": "ซอฟต์แวร์ / SaaS",
  "Supplier / manufacturer": "ซัพพลายเออร์ / ผู้ผลิต",
};

export function businessModelLabel(v: string, lang: OptLang): string {
  return lang === "th" ? BUSINESS_MODEL_TH[v] ?? v : v;
}

export function industryLabel(v: string, lang: OptLang): string {
  return lang === "th" ? INDUSTRY_TH[v] ?? v : v;
}

/** A licence or standard added under Other stays as typed. */
export function licenceLabel(v: string, lang: OptLang): string {
  return lang === "th" ? LICENCE_TH[v] ?? v : v;
}

export function isoLabel(v: string, lang: OptLang): string {
  return lang === "th" ? ISO_TH[v] ?? v : v;
}
