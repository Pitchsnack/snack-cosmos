/**
 * Businesses Wanted — form defaults (browser-safe): the opening text of a new buy order,
 * the products/must-have lines per SET sector, the Thai city list, profit choices and
 * the bullet-point boxes. Saved text stays as written; only choices are stored as codes.
 */

// ---------- the buyer's country → nationality ----------
const NATIONALITIES: Record<string, string> = {
  Thailand: "Thai", Japan: "Japanese", "South Korea": "South Korean", Singapore: "Singaporean", Vietnam: "Vietnamese",
  Malaysia: "Malaysian", Indonesia: "Indonesian", China: "Chinese", Taiwan: "Taiwanese", "Hong Kong": "Hong Kong",
  India: "Indian", Philippines: "Filipino", "United States": "American", "United Kingdom": "British", Australia: "Australian",
  Germany: "German", France: "French", Netherlands: "Dutch", Switzerland: "Swiss",
};
const COUNTRY_TH: Record<string, string> = {
  Thailand: "ไทย", Japan: "ญี่ปุ่น", "South Korea": "เกาหลีใต้", Singapore: "สิงคโปร์", Vietnam: "เวียดนาม",
  Malaysia: "มาเลเซีย", Indonesia: "อินโดนีเซีย", China: "จีน", Taiwan: "ไต้หวัน", "Hong Kong": "ฮ่องกง",
  India: "อินเดีย", Philippines: "ฟิลิปปินส์", "United States": "สหรัฐอเมริกา", "United Kingdom": "สหราชอาณาจักร",
  Australia: "ออสเตรเลีย", Germany: "เยอรมนี", France: "ฝรั่งเศส", Netherlands: "เนเธอร์แลนด์", Switzerland: "สวิตเซอร์แลนด์",
};
export const LOCATION_TH: Record<string, string> = {
  Thailand: "ไทย", Vietnam: "เวียดนาม", Malaysia: "มาเลเซีย", Indonesia: "อินโดนีเซีย", "Southeast Asia": "เอเชียตะวันออกเฉียงใต้",
};

/** "a South Korean company" · "an Indonesian company" · "a company from X" · "a company". */
export function buyerPhrase(country: string | null | undefined): string {
  if (!country) return "a company";
  const n = NATIONALITIES[country];
  if (n) return `${/^[AEIOU]/.test(n) ? "an" : "a"} ${n} company`;
  return `a company from ${country}`;
}

/** Lower case, keeping "REITs" as it is. */
const lowerSector = (sector: string) => sector.toLowerCase().replace(/\breits\b/g, "REITs");

/** The default Description, following the buyer, industry and location picked. */
export function defaultDescription(opts: { country: string | null; sector: string; location: string }, th: boolean): string {
  const { country, sector, location } = opts;
  if (th) {
    const from = country ? `จาก${COUNTRY_TH[country] ? `ประเทศ${COUNTRY_TH[country]}` : country}` : "";
    const what = sector ? `ธุรกิจ${sector}` : "ธุรกิจ";
    const where = location === "Southeast Asia" ? LOCATION_TH[location] : `ประเทศ${LOCATION_TH[location] ?? location}`;
    return `ผู้ซื้อเป็นบริษัท${from}ที่กำลังมองหา${what}ที่มั่นคงใน${where} โดยต้องการบริษัทที่มีทีมผู้บริหารที่มีความสามารถ มีลูกค้าประจำ และมีศักยภาพในการเติบโต ผู้ซื้อวางแผนจะรักษาทีมงานเดิมไว้และลงทุนเพื่อขยายธุรกิจในอนาคต`;
  }
  const what = sector ? `an established ${lowerSector(sector)} business` : "an established business";
  return `The buyer is ${buyerPhrase(country)} looking for ${what} in ${location}. Preference is for a company with a capable management team, recurring customers, and growth potential. The buyer plans to retain the team and invest in future expansion.`;
}

// ---------- Products and services, and Must have, by industry ----------
export type IndustryText = { products: [string, string]; mustHave: [string[], string[]] };
const t = (en: string, th: string, enMust: string, thMust: string): IndustryText => ({
  products: [en, th],
  mustHave: [enMust.split(" · "), thMust.split(" · ")],
});

export const BO_INDUSTRY_TEXT: Record<string, IndustryText> = {
  Agribusiness: t(
    "Crops, fresh produce, seeds, animal feed, fertilisers, and related farm products.",
    "พืชผล ผลผลิตสด เมล็ดพันธุ์ อาหารสัตว์ ปุ๋ย และผลิตภัณฑ์การเกษตรที่เกี่ยวข้อง",
    "GAP (Good Agricultural Practice) certification · Phytosanitary certificates and export permits · Land title deeds or long-term leases · A traceable supply chain",
    "ได้รับการรับรองมาตรฐาน GAP · ใบรับรองสุขอนามัยพืชและใบอนุญาตส่งออก · โฉนดที่ดินหรือสัญญาเช่าระยะยาว · ห่วงโซ่อุปทานที่ตรวจสอบย้อนกลับได้"),
  "Food & Beverage": t(
    "Packaged foods, beverages, snacks, ready meals, ingredients, and related food products.",
    "อาหารบรรจุภัณฑ์ เครื่องดื่ม ขนมขบเคี้ยว อาหารพร้อมรับประทาน วัตถุดิบ และผลิตภัณฑ์อาหารที่เกี่ยวข้อง",
    "Thai FDA product registrations · GMP / HACCP certification · ISO 22000 or FSSC 22000 certification · Halal certification for export markets",
    "เลขทะเบียนผลิตภัณฑ์จาก อย. · ได้รับการรับรอง GMP / HACCP · ได้รับการรับรอง ISO 22000 หรือ FSSC 22000 · ได้รับการรับรองฮาลาลสำหรับตลาดส่งออก"),
  Fashion: t(
    "Apparel, footwear, bags, accessories, textiles, and related fashion products.",
    "เครื่องแต่งกาย รองเท้า กระเป๋า เครื่องประดับ สิ่งทอ และผลิตภัณฑ์แฟชั่นที่เกี่ยวข้อง",
    "Registered trademarks · OEKO-TEX or equivalent product safety certification · Social compliance audit (for example BSCI or WRAP) · Certificate of Origin (CO)",
    "เครื่องหมายการค้าที่จดทะเบียนแล้ว · ได้รับการรับรอง OEKO-TEX หรือมาตรฐานความปลอดภัยของผลิตภัณฑ์ที่เทียบเท่า · ผ่านการตรวจประเมินด้านสังคม (เช่น BSCI หรือ WRAP) · หนังสือรับรองถิ่นกำเนิดสินค้า (CO)"),
  "Home & Office Products": t(
    "Furniture, home décor, kitchenware, office supplies, and related household products.",
    "เฟอร์นิเจอร์ ของตกแต่งบ้าน เครื่องครัว อุปกรณ์สำนักงาน และผลิตภัณฑ์ของใช้ในบ้านที่เกี่ยวข้อง",
    "TISI / Thai Industrial Standards certification · Registered trademarks · FSC certification for wood products · Certificate of Origin (CO)",
    "ได้รับการรับรองมาตรฐานผลิตภัณฑ์อุตสาหกรรม (มอก.) · เครื่องหมายการค้าที่จดทะเบียนแล้ว · ได้รับการรับรอง FSC สำหรับผลิตภัณฑ์ไม้ · หนังสือรับรองถิ่นกำเนิดสินค้า (CO)"),
  "Personal Products & Pharmaceuticals": t(
    "Medicines, supplements, cosmetics, personal care products, medical supplies, and related health products.",
    "ยา ผลิตภัณฑ์เสริมอาหาร เครื่องสำอาง ผลิตภัณฑ์ดูแลส่วนบุคคล เวชภัณฑ์ และผลิตภัณฑ์สุขภาพที่เกี่ยวข้อง",
    "Thai FDA product registrations · PIC/S GMP certification · ISO 22716 (cosmetics) or ISO 13485 (medical devices) where relevant · Registered trademarks",
    "เลขทะเบียนผลิตภัณฑ์จาก อย. · ได้รับการรับรอง PIC/S GMP · ได้รับการรับรอง ISO 22716 (เครื่องสำอาง) หรือ ISO 13485 (เครื่องมือแพทย์) ตามที่เกี่ยวข้อง · เครื่องหมายการค้าที่จดทะเบียนแล้ว"),
  Banking: t(
    "Lending, deposits, payments, and related banking services.",
    "สินเชื่อ เงินฝาก การชำระเงิน และบริการธนาคารที่เกี่ยวข้อง",
    "Bank of Thailand licence · Capital adequacy above the regulatory minimum · A clean audit and compliance record · Non-performing loans below the industry average",
    "ใบอนุญาตจากธนาคารแห่งประเทศไทย · เงินกองทุนสูงกว่าเกณฑ์ขั้นต่ำที่กฎหมายกำหนด · ประวัติการตรวจสอบบัญชีและการปฏิบัติตามกฎระเบียบที่ดี · สินเชื่อด้อยคุณภาพ (NPL) ต่ำกว่าค่าเฉลี่ยของอุตสาหกรรม"),
  "Finance & Securities": t(
    "Brokerage, asset management, consumer finance, leasing, and related financial services.",
    "นายหน้าซื้อขายหลักทรัพย์ การจัดการสินทรัพย์ สินเชื่อผู้บริโภค ลีสซิ่ง และบริการทางการเงินที่เกี่ยวข้อง",
    "SEC or Bank of Thailand licence for the business · Capital above the regulatory minimum · A clean audit and compliance record · Staff with the licences the services need",
    "ใบอนุญาตจาก ก.ล.ต. หรือธนาคารแห่งประเทศไทยสำหรับธุรกิจ · เงินกองทุนสูงกว่าเกณฑ์ขั้นต่ำที่กฎหมายกำหนด · ประวัติการตรวจสอบบัญชีและการปฏิบัติตามกฎระเบียบที่ดี · มีบุคลากรที่ได้รับใบอนุญาตตามที่บริการกำหนด"),
  Insurance: t(
    "Life, health, motor and property insurance, and related insurance services.",
    "ประกันชีวิต ประกันสุขภาพ ประกันภัยรถยนต์ ประกันทรัพย์สิน และบริการประกันภัยที่เกี่ยวข้อง",
    "OIC (Office of Insurance Commission) licence · Capital adequacy ratio above the regulatory minimum · A clean audit and compliance record · Licensed agents and brokers",
    "ใบอนุญาตจากสำนักงาน คปภ. · อัตราส่วนความเพียงพอของเงินกองทุนสูงกว่าเกณฑ์ขั้นต่ำ · ประวัติการตรวจสอบบัญชีและการปฏิบัติตามกฎระเบียบที่ดี · มีตัวแทนและนายหน้าประกันภัยที่ได้รับใบอนุญาต"),
  Automotive: t(
    "Auto parts, components, accessories, vehicle assembly, and related automotive products.",
    "อะไหล่ ชิ้นส่วนยานยนต์ อุปกรณ์ตกแต่ง การประกอบรถยนต์ และผลิตภัณฑ์ยานยนต์ที่เกี่ยวข้อง",
    "IATF 16949 certification · Approved supplier status with car makers · ISO 14001 certification · TISI / Thai Industrial Standards certification",
    "ได้รับการรับรอง IATF 16949 · เป็นผู้ผลิตที่ได้รับการอนุมัติจากผู้ผลิตรถยนต์ · ได้รับการรับรอง ISO 14001 · ได้รับการรับรองมาตรฐานผลิตภัณฑ์อุตสาหกรรม (มอก.)"),
  "Industrial Materials & Machinery": t(
    "Machinery, equipment, tools, industrial materials, and related engineering products.",
    "เครื่องจักร อุปกรณ์ เครื่องมือ วัสดุอุตสาหกรรม และผลิตภัณฑ์วิศวกรรมที่เกี่ยวข้อง",
    "ISO 9001 certification · TISI / Thai Industrial Standards certification · CE certification for export markets · A factory operating licence",
    "ได้รับการรับรอง ISO 9001 · ได้รับการรับรองมาตรฐานผลิตภัณฑ์อุตสาหกรรม (มอก.) · ได้รับการรับรอง CE สำหรับตลาดส่งออก · ใบอนุญาตประกอบกิจการโรงงาน (ร.ง.4)"),
  "Paper & Printing Materials": t(
    "Paper, board, printing materials, labels, and related printing products.",
    "กระดาษ กระดาษแข็ง วัสดุการพิมพ์ ฉลาก และผลิตภัณฑ์การพิมพ์ที่เกี่ยวข้อง",
    "FSC or PEFC certification · ISO 9001 certification · A factory operating licence · Environmental permits",
    "ได้รับการรับรอง FSC หรือ PEFC · ได้รับการรับรอง ISO 9001 · ใบอนุญาตประกอบกิจการโรงงาน (ร.ง.4) · ใบอนุญาตด้านสิ่งแวดล้อม"),
  "Petrochemicals & Chemicals": t(
    "Chemicals, plastics, resins, coatings, and related chemical products.",
    "เคมีภัณฑ์ พลาสติก เรซิน สารเคลือบ และผลิตภัณฑ์เคมีที่เกี่ยวข้อง",
    "Hazardous substance licences · REACH compliance for export markets · ISO 9001 and ISO 14001 certification · Environmental Impact Assessment (EIA) approval",
    "ใบอนุญาตวัตถุอันตราย · เป็นไปตามมาตรฐาน REACH สำหรับตลาดส่งออก · ได้รับการรับรอง ISO 9001 และ ISO 14001 · ผ่านการอนุมัติรายงานผลกระทบสิ่งแวดล้อม (EIA)"),
  Packaging: t(
    "Corrugated boxes, flexible packaging, labels, containers, and related packaging products.",
    "กล่องกระดาษลูกฟูก บรรจุภัณฑ์อ่อนตัว ฉลาก ภาชนะบรรจุ และผลิตภัณฑ์บรรจุภัณฑ์ที่เกี่ยวข้อง",
    "Food-contact compliance for packaging materials · ISO 9001 or BRCGS Packaging certification · FSC certification for paper packaging · A factory operating licence",
    "วัสดุบรรจุภัณฑ์ที่สัมผัสอาหารได้ตามมาตรฐาน · ได้รับการรับรอง ISO 9001 หรือ BRCGS Packaging · ได้รับการรับรอง FSC สำหรับบรรจุภัณฑ์กระดาษ · ใบอนุญาตประกอบกิจการโรงงาน (ร.ง.4)"),
  "Steel and Metal Products": t(
    "Steel, fabricated metal parts, castings, wire, and related metal products.",
    "เหล็ก ชิ้นส่วนโลหะแปรรูป งานหล่อ ลวด และผลิตภัณฑ์โลหะที่เกี่ยวข้อง",
    "TISI / Thai Industrial Standards certification · ISO 9001 certification · Mill test certificates for its products · A factory operating licence",
    "ได้รับการรับรองมาตรฐานผลิตภัณฑ์อุตสาหกรรม (มอก.) · ได้รับการรับรอง ISO 9001 · ใบรับรองผลการทดสอบ (Mill test certificate) สำหรับผลิตภัณฑ์ · ใบอนุญาตประกอบกิจการโรงงาน (ร.ง.4)"),
  "Construction Materials": t(
    "Cement, concrete, tiles, sanitary ware, and related building materials.",
    "ปูนซีเมนต์ คอนกรีต กระเบื้อง สุขภัณฑ์ และวัสดุก่อสร้างที่เกี่ยวข้อง",
    "TISI / Thai Industrial Standards certification · ISO 9001 certification · A factory operating licence · Environmental permits",
    "ได้รับการรับรองมาตรฐานผลิตภัณฑ์อุตสาหกรรม (มอก.) · ได้รับการรับรอง ISO 9001 · ใบอนุญาตประกอบกิจการโรงงาน (ร.ง.4) · ใบอนุญาตด้านสิ่งแวดล้อม"),
  "Construction Services": t(
    "Building, civil works, engineering, fit-out, and related construction services.",
    "งานก่อสร้างอาคาร งานโยธา งานวิศวกรรม งานตกแต่งภายใน และบริการก่อสร้างที่เกี่ยวข้อง",
    "Contractor registration with government agencies · Licensed engineers (Council of Engineers) · ISO 9001 and ISO 45001 certification · A record of completed projects",
    "ขึ้นทะเบียนผู้รับเหมากับหน่วยงานภาครัฐ · มีวิศวกรที่ได้รับใบอนุญาตจากสภาวิศวกร · ได้รับการรับรอง ISO 9001 และ ISO 45001 · มีผลงานโครงการที่แล้วเสร็จ"),
  "Property Development": t(
    "Residential, commercial and industrial property, and related development services.",
    "อสังหาริมทรัพย์เพื่อการอยู่อาศัย เพื่อการพาณิชย์ และเพื่ออุตสาหกรรม และบริการพัฒนาที่เกี่ยวข้อง",
    "Clear land title deeds · Building and land allotment permits · Environmental Impact Assessment (EIA) approval where required · A record of completed projects",
    "โฉนดที่ดินที่ไม่มีภาระผูกพัน · ใบอนุญาตก่อสร้างอาคารและใบอนุญาตจัดสรรที่ดิน · ผ่านการอนุมัติรายงาน EIA ตามที่กฎหมายกำหนด · มีผลงานโครงการที่แล้วเสร็จ"),
  "Property Fund & REITs": t(
    "Income-producing property, leasing, property management, and related real estate services.",
    "อสังหาริมทรัพย์ที่สร้างรายได้ การให้เช่า การบริหารอสังหาริมทรัพย์ และบริการที่เกี่ยวข้อง",
    "Clear title to the properties · Long-term leases with tenants · SEC approval where required · High occupancy rates",
    "กรรมสิทธิ์ในทรัพย์สินที่ไม่มีภาระผูกพัน · สัญญาเช่าระยะยาวกับผู้เช่า · ได้รับอนุญาตจาก ก.ล.ต. ตามที่กฎหมายกำหนด · อัตราการเช่าพื้นที่สูง"),
  "Energy & Utilities": t(
    "Power generation, renewable energy, water, fuel, and related energy services.",
    "การผลิตไฟฟ้า พลังงานหมุนเวียน น้ำประปา เชื้อเพลิง และบริการพลังงานที่เกี่ยวข้อง",
    "ERC (Energy Regulatory Commission) licence · Power purchase agreements (PPA) · Environmental permits · Land rights or long-term leases for the sites",
    "ใบอนุญาตจากคณะกรรมการกำกับกิจการพลังงาน (กกพ.) · สัญญาซื้อขายไฟฟ้า (PPA) · ใบอนุญาตด้านสิ่งแวดล้อม · สิทธิในที่ดินหรือสัญญาเช่าระยะยาวสำหรับพื้นที่โครงการ"),
  Mining: t(
    "Minerals, quarrying, aggregates, mining services, and related resources.",
    "แร่ เหมืองหิน หินก่อสร้าง บริการเหมืองแร่ และทรัพยากรที่เกี่ยวข้อง",
    "A mining concession from the Department of Primary Industries and Mines · Environmental Impact Assessment (EIA) approval · Land rights for the mine site · Proven reserves backed by a geological report",
    "ประทานบัตรจากกรมอุตสาหกรรมพื้นฐานและการเหมืองแร่ · ผ่านการอนุมัติรายงานผลกระทบสิ่งแวดล้อม (EIA) · สิทธิในที่ดินของพื้นที่เหมือง · ปริมาณสำรองแร่ที่ยืนยันด้วยรายงานทางธรณีวิทยา"),
  Commerce: t(
    "Retail, wholesale, distribution, e-commerce, and related trading services.",
    "ค้าปลีก ค้าส่ง การจัดจำหน่าย อีคอมเมิร์ซ และบริการการค้าที่เกี่ยวข้อง",
    "Registered trademarks or distribution rights · Long-term supplier agreements · VAT registration and a clean tax record · An established store or online sales network",
    "เครื่องหมายการค้าที่จดทะเบียนหรือสิทธิการจัดจำหน่าย · สัญญากับซัพพลายเออร์ระยะยาว · จดทะเบียนภาษีมูลค่าเพิ่มและมีประวัติภาษีที่ดี · มีเครือข่ายร้านค้าหรือช่องทางขายออนไลน์ที่มั่นคง"),
  "Health Care Services": t(
    "Hospitals, clinics, diagnostics, elderly care, and related health care services.",
    "โรงพยาบาล คลินิก การตรวจวินิจฉัย การดูแลผู้สูงอายุ และบริการสุขภาพที่เกี่ยวข้อง",
    "A licence under the Sanatorium Act · Licensed doctors and nurses on staff · Hospital accreditation (HA or JCI) · Contracts with the Social Security Office or insurers",
    "ใบอนุญาตประกอบกิจการสถานพยาบาล · มีแพทย์และพยาบาลที่มีใบอนุญาตประกอบวิชาชีพ · ได้รับการรับรองคุณภาพโรงพยาบาล (HA หรือ JCI) · สัญญากับสำนักงานประกันสังคมหรือบริษัทประกัน"),
  "Media & Publishing": t(
    "Content, publishing, advertising, events, and related media services.",
    "คอนเทนต์ สิ่งพิมพ์ โฆษณา อีเวนต์ และบริการสื่อที่เกี่ยวข้อง",
    "Broadcasting or publishing licences where required (NBTC) · Ownership of its content rights · Registered trademarks · Long-term advertising or distribution contracts",
    "ใบอนุญาตประกอบกิจการกระจายเสียงหรือสิ่งพิมพ์ตามที่กำหนด (กสทช.) · เป็นเจ้าของลิขสิทธิ์ในเนื้อหา · เครื่องหมายการค้าที่จดทะเบียนแล้ว · สัญญาโฆษณาหรือสัญญาเผยแพร่ระยะยาว"),
  "Professional Services": t(
    "Consulting, accounting, legal, staffing, and related professional services.",
    "ที่ปรึกษา บัญชี กฎหมาย จัดหาบุคลากร และบริการวิชาชีพที่เกี่ยวข้อง",
    "Professional licences for the services offered · Long-term client contracts · Registered trademarks · PDPA (personal data) compliance",
    "ใบอนุญาตประกอบวิชาชีพสำหรับบริการที่ให้ · สัญญากับลูกค้าระยะยาว · เครื่องหมายการค้าที่จดทะเบียนแล้ว · ปฏิบัติตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA)"),
  "Tourism & Leisure": t(
    "Hotels, resorts, travel, restaurants, entertainment, and related leisure services.",
    "โรงแรม รีสอร์ต การท่องเที่ยว ร้านอาหาร ความบันเทิง และบริการด้านสันทนาการที่เกี่ยวข้อง",
    "A hotel licence · A tour business licence (Department of Tourism) where relevant · Clear land title or a long-term lease · Building and fire safety inspection certificates",
    "ใบอนุญาตประกอบธุรกิจโรงแรม · ใบอนุญาตประกอบธุรกิจนำเที่ยว (กรมการท่องเที่ยว) ตามที่เกี่ยวข้อง · โฉนดที่ดินที่ไม่มีภาระผูกพันหรือสัญญาเช่าระยะยาว · ใบรับรองการตรวจสอบอาคารและระบบป้องกันอัคคีภัย"),
  "Transportation & Logistics": t(
    "Freight, warehousing, cold chain, last-mile delivery, and related logistics services.",
    "การขนส่งสินค้า คลังสินค้า ห่วงโซ่ความเย็น การจัดส่งถึงปลายทาง และบริการโลจิสติกส์ที่เกี่ยวข้อง",
    "Transport licences from the Department of Land Transport · A customs broker licence where relevant · ISO 9001 certification · Long-term customer contracts",
    "ใบอนุญาตประกอบการขนส่งจากกรมการขนส่งทางบก · ใบอนุญาตตัวแทนออกของ (Customs broker) ตามที่เกี่ยวข้อง · ได้รับการรับรอง ISO 9001 · สัญญากับลูกค้าระยะยาว"),
  "Electronic Components": t(
    "Electronic components, PCB assemblies, sensors, connectors, power modules, and related industrial electronics.",
    "ชิ้นส่วนอิเล็กทรอนิกส์ แผงวงจรพิมพ์ประกอบ (PCBA) เซนเซอร์ คอนเนกเตอร์ โมดูลพลังงาน และอุปกรณ์อิเล็กทรอนิกส์อุตสาหกรรมที่เกี่ยวข้อง",
    "RoHS / REACH compliance for export markets · Certificate of Origin (CO) · TISI / Thai Industrial Standards certification · UL / CE certification",
    "เป็นไปตามมาตรฐาน RoHS / REACH สำหรับตลาดส่งออก · หนังสือรับรองถิ่นกำเนิดสินค้า (CO) · ได้รับการรับรองมาตรฐานผลิตภัณฑ์อุตสาหกรรม (มอก.) · ได้รับการรับรอง UL / CE"),
  "Information & Communication Technology": t(
    "Software, IT services, cloud, data centres, telecoms, and related technology services.",
    "ซอฟต์แวร์ บริการไอที คลาวด์ ศูนย์ข้อมูล โทรคมนาคม และบริการเทคโนโลยีที่เกี่ยวข้อง",
    "Ownership of its software and source code · PDPA (personal data) compliance · ISO 27001 certification · Recurring revenue contracts",
    "เป็นเจ้าของซอฟต์แวร์และซอร์สโค้ด · ปฏิบัติตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA) · ได้รับการรับรอง ISO 27001 · สัญญาที่สร้างรายได้ต่อเนื่อง"),
};

/** Must have before an industry is picked. */
export const GENERAL_MUST_HAVE: [string[], string[]] = [
  ["Audited accounts for the last 3 years", "The licences the business needs", "Export licences", "A clean tax record"],
  ["งบการเงินที่ผ่านการตรวจสอบย้อนหลัง 3 ปี", "มีใบอนุญาตที่ธุรกิจต้องใช้", "มีใบอนุญาตส่งออก", "มีประวัติภาษีที่ดี"],
];
export const DEFAULT_NICE_TO_HAVE: [string[], string[]] = [
  ["International sales to the USA and EU", "Established own brand"],
  ["มียอดขายในต่างประเทศ ไปยังสหรัฐอเมริกาและสหภาพยุโรป", "มีแบรนด์ของตนเองที่เป็นที่รู้จัก"],
];
export const DEFAULT_TIMING: [string, string] = ["Wants to sign within 6 months", "ต้องการลงนามภายใน 6 เดือน"];

export const industryText = (sector: string) => BO_INDUSTRY_TEXT[sector] ?? null;

// ---------- City, when Location is Thailand ----------
export type ThaiCity = { en: string; th: string };
export const FEATURED_CITIES: ThaiCity[] = [
  { en: "Bangkok", th: "กรุงเทพฯ" }, { en: "Chiang Mai", th: "เชียงใหม่" }, { en: "Phuket", th: "ภูเก็ต" },
  { en: "Pattaya", th: "พัทยา" }, { en: "Laem Chabang", th: "แหลมฉบัง" },
];
export const OTHER_PROVINCES: ThaiCity[] = [
  ["Amnat Charoen", "อำนาจเจริญ"], ["Ang Thong", "อ่างทอง"], ["Ayutthaya", "อยุธยา"], ["Bueng Kan", "บึงกาฬ"],
  ["Buriram", "บุรีรัมย์"], ["Chachoengsao", "ฉะเชิงเทรา"], ["Chai Nat", "ชัยนาท"], ["Chaiyaphum", "ชัยภูมิ"],
  ["Chanthaburi", "จันทบุรี"], ["Chiang Rai", "เชียงราย"], ["Chonburi", "ชลบุรี"], ["Chumphon", "ชุมพร"],
  ["Kalasin", "กาฬสินธุ์"], ["Kamphaeng Phet", "กำแพงเพชร"], ["Kanchanaburi", "กาญจนบุรี"], ["Khon Kaen", "ขอนแก่น"],
  ["Krabi", "กระบี่"], ["Lampang", "ลำปาง"], ["Lamphun", "ลำพูน"], ["Loei", "เลย"], ["Lopburi", "ลพบุรี"],
  ["Mae Hong Son", "แม่ฮ่องสอน"], ["Maha Sarakham", "มหาสารคาม"], ["Mukdahan", "มุกดาหาร"], ["Nakhon Nayok", "นครนายก"],
  ["Nakhon Pathom", "นครปฐม"], ["Nakhon Phanom", "นครพนม"], ["Nakhon Ratchasima", "นครราชสีมา"], ["Nakhon Sawan", "นครสวรรค์"],
  ["Nakhon Si Thammarat", "นครศรีธรรมราช"], ["Nan", "น่าน"], ["Narathiwat", "นราธิวาส"], ["Nong Bua Lamphu", "หนองบัวลำภู"],
  ["Nong Khai", "หนองคาย"], ["Nonthaburi", "นนทบุรี"], ["Pathum Thani", "ปทุมธานี"], ["Pattani", "ปัตตานี"],
  ["Phang Nga", "พังงา"], ["Phatthalung", "พัทลุง"], ["Phayao", "พะเยา"], ["Phetchabun", "เพชรบูรณ์"],
  ["Phetchaburi", "เพชรบุรี"], ["Phichit", "พิจิตร"], ["Phitsanulok", "พิษณุโลก"], ["Phrae", "แพร่"],
  ["Prachinburi", "ปราจีนบุรี"], ["Prachuap Khiri Khan", "ประจวบคีรีขันธ์"], ["Ranong", "ระนอง"], ["Ratchaburi", "ราชบุรี"],
  ["Rayong", "ระยอง"], ["Roi Et", "ร้อยเอ็ด"], ["Sa Kaeo", "สระแก้ว"], ["Sakon Nakhon", "สกลนคร"],
  ["Samut Prakan", "สมุทรปราการ"], ["Samut Sakhon", "สมุทรสาคร"], ["Samut Songkhram", "สมุทรสงคราม"], ["Saraburi", "สระบุรี"],
  ["Satun", "สตูล"], ["Singburi", "สิงห์บุรี"], ["Sisaket", "ศรีสะเกษ"], ["Songkhla", "สงขลา"],
  ["Sukhothai", "สุโขทัย"], ["Suphanburi", "สุพรรณบุรี"], ["Surat Thani", "สุราษฎร์ธานี"], ["Surin", "สุรินทร์"],
  ["Tak", "ตาก"], ["Trang", "ตรัง"], ["Trat", "ตราด"], ["Ubon Ratchathani", "อุบลราชธานี"],
  ["Udon Thani", "อุดรธานี"], ["Uthai Thani", "อุทัยธานี"], ["Uttaradit", "อุตรดิตถ์"], ["Yala", "ยะลา"], ["Yasothon", "ยโสธร"],
].map(([en, th]) => ({ en, th }));
export const THAI_CITIES: ThaiCity[] = [...FEATURED_CITIES, ...OTHER_PROVINCES];
const CITY_TH = new Map(THAI_CITIES.map((x) => [x.en, x.th]));

/** Ticked cities → the saved English text: "Bangkok" · "Bangkok or Pattaya" · "Bangkok, Pattaya or Chonburi"; none → "Any". */
export function citiesText(ticked: string[]): string {
  const list = THAI_CITIES.filter((x) => ticked.includes(x.en)).map((x) => x.en);
  if (!list.length) return "Any";
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} or ${list[1]}`;
  return `${list.slice(0, -1).join(", ")} or ${list[list.length - 1]}`;
}

/** The saved city text for display: Thai names joined with spaces and "หรือ" before the last; typed text stays as typed. */
export function citiesDisplay(cities: string | null | undefined, th: boolean): string {
  const v = (cities ?? "").trim() || "Any";
  if (!th) return v;
  if (/^any$/i.test(v)) return "ไม่จำกัด";
  const parts = v.split(/,|\bor\b|หรือ/i).map((s) => s.trim()).filter(Boolean);
  const names = parts.map((p) => CITY_TH.get(p) ?? p);
  if (names.length <= 1) return names[0] ?? v;
  return `${names.slice(0, -1).join(" ")} หรือ${names[names.length - 1]}`;
}

// ---------- Profit ----------
export type BoProfit = "yes" | "no" | "not_stated";
export const BO_PROFITS: BoProfit[] = ["yes", "no", "not_stated"];
/** View details: "Must be profitable" / "Doesn’t need to be profitable"; not_stated leaves the row out. */
export function profitLabel(profit: string | null | undefined, th: boolean): string | null {
  if (profit === "yes") return th ? "ต้องมีกำไร" : "Must be profitable";
  if (profit === "no") return th ? "ไม่จำเป็นต้องมีกำไร" : "Doesn’t need to be profitable";
  return null;
}

// ---------- Must have / Nice to have, as bullet points ----------
export const BULLET = "• ";
/** Every non-empty line starts with "• ". */
export const ensureBullets = (text: string) =>
  text.split("\n").map((l) => {
    const s = l.replace(/^•\s*/, "");
    return s.trim() ? BULLET + s.trimStart() : l.trim() ? l : "";
  }).join("\n");
/** For saving: bullets and empty lines dropped, one point per line. */
export const stripBullets = (text: string) =>
  text.split("\n").map((l) => l.replace(/^•\s*/, "").trim()).filter(Boolean).join("\n");
